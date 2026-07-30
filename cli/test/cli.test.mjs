/**
 * [INPUT]: 依赖 Node test/assert/child_process、临时落笔目录与真实 cli.mjs 进程
 * [OUTPUT]: 验证 Agent 通过 doctor、stdin 和 --json 使用 CLI 的端到端命令契约
 * [POS]: cli 的进程级回归测试，保护 npm bin 入口、退出码与 JSON 回执
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/cli.mjs");

test("accepts Markdown on stdin and returns a machine-readable receipt", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loby-cli-process-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await Promise.all([".loby", "inbox", "notes", "projects"].map((directory) => fs.mkdir(path.join(root, directory))));

  const execution = await runCli(["inbox", "create", "--title", "CLI 端到端", "--library", root, "--json"], "# CLI 端到端\n\n正文");
  assert.equal(execution.code, 0, execution.stderr);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.action, "inbox.create");
  assert.equal(await fs.readFile(result.path, "utf8").then((value) => value.endsWith("# CLI 端到端\n\n正文\n")), true);
});

test("directly updates a created document on stdin", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loby-cli-update-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await Promise.all([".loby", "inbox", "notes", "projects"].map((directory) => fs.mkdir(path.join(root, directory))));
  const created = await runCli(["inbox", "create", "--title", "待修改", "--library", root, "--json"], "旧正文");
  assert.equal(created.code, 0, created.stderr);
  const receipt = JSON.parse(created.stdout);

  const execution = await runCli(["document", "update", "--path", receipt.path, "--library", root, "--json"], "# 已修改\n\n这是新正文。");
  assert.equal(execution.code, 0, execution.stderr);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.action, "document.update");
  assert.equal(result.sheetId, receipt.sheetId);
  assert.equal(await fs.readFile(result.path, "utf8").then((value) => value.endsWith("# 已修改\n\n这是新正文。\n")), true);
});

test("doctor returns a machine-readable healthy installation", async (context) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "loby-cli-doctor-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const library = path.join(temporary, "library");
  const configHome = path.join(temporary, "config");
  const codexHome = path.join(temporary, "codex");
  await Promise.all(
    [".loby", "inbox", "notes", "projects"].map((directory) => fs.mkdir(path.join(library, directory), { recursive: true })),
  );
  await fs.mkdir(path.join(codexHome, "skills", "loby-cli"), { recursive: true });
  await fs.writeFile(path.join(codexHome, "skills", "loby-cli", "SKILL.md"), "# Test\n");
  await fs.mkdir(configHome, { recursive: true });
  await fs.writeFile(path.join(configHome, "active-library.json"), JSON.stringify({ version: 1, libraryPath: library }));

  const execution = await runCli(["doctor", "--json"], "", {
    ...process.env,
    LOBY_CONFIG_HOME: configHome,
    CODEX_HOME: codexHome,
  });
  assert.equal(execution.code, 0, execution.stderr);
  const result = JSON.parse(execution.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.library.source, "app");
  assert.equal(result.skill.installed, true);
});

function runCli(args, stdin, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdin);
  });
}
