#!/usr/bin/env node
/**
 * [INPUT]: 依赖 process argv/stdin/stdout、CLI core 与随 npm 包分发的 loby-cli Skill
 * [OUTPUT]: 提供 loby doctor、library use/current、inbox create、skill install codex 与稳定 JSON 回执
 * [POS]: cli 的终端适配层，只解析命令和呈现结果，所有文件规则委托 core
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, createInboxDraft, diagnoseCli, installCodexSkill, resolveLibrary, setConfiguredLibrary } from "./core.mjs";

const VERSION = "0.1.0";
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await main(process.argv.slice(2)).catch((error) => {
  const normalized = error instanceof CliError ? error : new CliError("UNEXPECTED_ERROR", error?.message || String(error));
  const json = process.argv.includes("--json");
  const payload = { ok: false, error: { code: normalized.code, message: normalized.message } };
  process.stderr.write(json ? `${JSON.stringify(payload)}\n` : `错误：${normalized.message}\n`);
  process.exitCode = normalized.exitCode;
});

async function main(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(helpText());
    return;
  }
  if (argv.length === 1 && (argv[0] === "--version" || argv[0] === "-V")) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const [area, action, ...rest] = argv;
  if (area === "doctor") return runDoctor(argv.slice(1));
  if (area === "library" && action === "use") return useLibrary(rest);
  if (area === "library" && action === "current") return showCurrentLibrary(rest);
  if (area === "inbox" && action === "create") return createDraft(rest);
  if (area === "skill" && action === "install") return installSkill(rest);
  throw new CliError("UNKNOWN_COMMAND", `未知命令：${argv.join(" ")}。运行 \`loby --help\` 查看用法。`, 2);
}

async function useLibrary(args) {
  const { options, positional } = parseOptions(args, new Set(["--json"]));
  if (positional.length !== 1) throw new CliError("LIBRARY_PATH_REQUIRED", "用法：loby library use <写作库路径>", 2);
  const libraryPath = await setConfiguredLibrary(positional[0]);
  printResult({ ok: true, action: "library.use", libraryPath }, options.has("--json"), `已使用写作库：${libraryPath}`);
}

async function showCurrentLibrary(args) {
  const { options, positional } = parseOptions(args, new Set(["--json", "--library"]), new Set(["--library"]));
  if (positional.length > 0) throw new CliError("UNEXPECTED_ARGUMENT", "library current 不接受位置参数。", 2);
  const result = await resolveLibrary({ explicitPath: options.get("--library") || "" });
  const payload = { ok: true, action: "library.current", libraryPath: result.libraryPath, source: result.source };
  printResult(payload, options.has("--json"), result.libraryPath);
}

async function createDraft(args) {
  const { options, positional } = parseOptions(
    args,
    new Set(["--json", "--title", "--file", "--library"]),
    new Set(["--title", "--file", "--library"]),
  );
  if (positional.length > 0) throw new CliError("UNEXPECTED_ARGUMENT", "inbox create 不接受位置参数。", 2);
  const title = options.get("--title") || "";
  const { libraryPath } = await resolveLibrary({ explicitPath: options.get("--library") || "" });
  const content = options.has("--file") ? await readContentFile(options.get("--file")) : await readOptionalStdin();
  const result = await createInboxDraft({ libraryPath, title, content });
  printResult(result, options.has("--json"), `已创建收件箱文稿：${result.path}`);
}

async function runDoctor(args) {
  const { options, positional } = parseOptions(args, new Set(["--json"]));
  if (positional.length > 0) throw new CliError("UNEXPECTED_ARGUMENT", "doctor 不接受位置参数。", 2);
  const result = await diagnoseCli({ version: VERSION });
  const humanText = result.ok ? `诊断通过：写作库 ${result.library.path}；Codex Skill 已安装。` : doctorFailureText(result);
  printResult(result, options.has("--json"), humanText);
  if (!result.ok) process.exitCode = 1;
}

async function installSkill(args) {
  const { options, positional } = parseOptions(args, new Set(["--json", "--force"]));
  if (positional.length !== 1 || positional[0] !== "codex") {
    throw new CliError("SKILL_HOST_REQUIRED", "用法：loby skill install codex [--force]", 2);
  }
  const result = await installCodexSkill({
    sourcePath: path.join(packageRoot, "skills", "loby-cli"),
    force: options.has("--force"),
  });
  printResult(result, options.has("--json"), `已安装 Codex Skill：${result.path}`);
}

function parseOptions(args, allowed, valued = new Set()) {
  const options = new Map();
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--")) {
      positional.push(argument);
      continue;
    }
    const [name, inlineValue] = argument.split(/=(.*)/s, 2);
    if (!allowed.has(name)) throw new CliError("UNKNOWN_OPTION", `未知选项：${name}`, 2);
    if (!valued.has(name)) {
      if (inlineValue !== undefined) throw new CliError("UNEXPECTED_OPTION_VALUE", `${name} 不接受参数值。`, 2);
      options.set(name, true);
      continue;
    }
    const value = inlineValue === undefined ? args[++index] : inlineValue;
    if (!value || value.startsWith("--")) throw new CliError("OPTION_VALUE_REQUIRED", `${name} 需要参数值。`, 2);
    options.set(name, value);
  }
  return { options, positional };
}

async function readContentFile(candidate) {
  try {
    return await fs.readFile(path.resolve(candidate), "utf8");
  } catch (error) {
    throw new CliError("CONTENT_FILE_UNREADABLE", `无法读取正文文件 ${candidate}：${error.message}`, 2);
  }
}

async function readOptionalStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function printResult(payload, json, humanText) {
  process.stdout.write(json ? `${JSON.stringify(payload)}\n` : `${humanText}\n`);
}

function doctorFailureText(result) {
  const failures = [];
  if (!result.library.ok) failures.push(result.library.error.message);
  else if (!result.library.writable) failures.push(`写作库不可写：${result.library.path}`);
  if (!result.skill.installed) failures.push("Codex Skill 尚未安装，请运行 `loby skill install codex`。");
  return `诊断未通过：${failures.join("；")}`;
}

function helpText() {
  return `落笔 CLI ${VERSION}

用法：
  loby doctor                             检查写作库、写入权限与 Codex Skill
  loby library use <路径>                 记住默认写作库
  loby library current [--library 路径]   显示本次将使用的写作库
  loby inbox create --title 标题 [选项]   在收件箱创建 Markdown 文稿
  loby skill install codex [--force]      安装配套 Codex Skill

inbox create 选项：
  --file <路径>       从 UTF-8 文件读取正文；未提供时读取 stdin
  --library <路径>    本次显式指定写作库
  --json              输出适合 Agent 解析的 JSON

写作库解析顺序：--library → LOBY_LIBRARY → 当前目录祖先 → 落笔活动库 → CLI 配置 → ~/Documents/LobyLibrary
`;
}
