/**
 * [INPUT]: 依赖 Node.js fs/path/os/crypto，消费用户显式路径、环境变量、桌面活动库定位、CLI 配置与落笔写作库目录
 * [OUTPUT]: 对外提供带来源的写作库解析/配置、CLI 自检、收件箱文稿创建、Codex Skill 安装及结构化错误契约
 * [POS]: cli 的领域核心，拥有 Agent 写入落笔的安全路径与文件协议，不负责 argv 和终端呈现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const LIBRARY_DIRECTORIES = ["inbox", "notes", "projects"];
const INBOX_PROJECT_ID = "inbox-root";
const INBOX_GROUP_ID = "inbox-default";
const TARGET_WORDS_DEFINITION_ID = "loby-target-words";
const DEFAULT_TARGET_WORDS = 1000;
const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export class CliError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function cliConfigPath({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  if (env.LOBY_CONFIG_HOME) return path.join(env.LOBY_CONFIG_HOME, "config.json");
  if (platform === "win32") return path.join(env.APPDATA || path.join(home, "AppData", "Roaming"), "Loby CLI", "config.json");
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "Loby CLI", "config.json");
  return path.join(env.XDG_CONFIG_HOME || path.join(home, ".config"), "loby", "config.json");
}

export function activeLibraryStatePath(options = {}) {
  return path.join(path.dirname(cliConfigPath(options)), "active-library.json");
}

export async function isLobyLibrary(candidate) {
  if (!candidate) return false;
  try {
    const metadata = await fs.stat(candidate);
    if (!metadata.isDirectory()) return false;
    if (await isDirectory(path.join(candidate, ".loby"))) return true;
    const checks = await Promise.all(LIBRARY_DIRECTORIES.map((directory) => isDirectory(path.join(candidate, directory))));
    return checks.every(Boolean);
  } catch {
    return false;
  }
}

export async function resolveLibrary(options = {}) {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? os.homedir();
  const platform = options.platform ?? process.platform;
  const explicitPath = options.explicitPath ?? "";
  const configPath = options.configPath ?? cliConfigPath({ env, home, platform });
  const activeStatePath = options.activeStatePath ?? activeLibraryStatePath({ env, home, platform });
  const requiredCandidates = [
    [explicitPath, "--library 指定的路径", "argument"],
    [env.LOBY_LIBRARY, "LOBY_LIBRARY 指定的路径", "environment"],
  ];
  for (const [candidate, label, source] of requiredCandidates) {
    if (!candidate) continue;
    return { libraryPath: await validateLibraryPath(candidate, label), source };
  }

  const cwdLibrary = await findLibraryFromCwd(cwd);
  if (cwdLibrary) return { libraryPath: cwdLibrary, source: "cwd" };

  const activeLibrary = await readLibraryPointer(activeStatePath);
  if (activeLibrary) {
    return {
      libraryPath: await validateLibraryPath(activeLibrary, "落笔当前活动写作库"),
      source: "app",
    };
  }

  const configured = await readLibraryPointer(configPath);
  if (configured) {
    return {
      libraryPath: await validateLibraryPath(configured, "CLI 已配置的写作库"),
      source: "config",
    };
  }

  const defaultLibrary = path.join(home, "Documents", "LobyLibrary");
  if (await isLobyLibrary(defaultLibrary)) {
    return { libraryPath: await fs.realpath(defaultLibrary), source: "default" };
  }

  throw new CliError("LIBRARY_NOT_CONFIGURED", "没有找到落笔写作库。请运行 `loby library use <路径>`，或传入 `--library <路径>`。");
}

export async function resolveLibraryPath(options = {}) {
  return (await resolveLibrary(options)).libraryPath;
}

export async function setConfiguredLibrary(libraryPath, { configPath = cliConfigPath() } = {}) {
  const resolved = await validateLibraryPath(libraryPath, "要配置的路径");
  await writeJsonAtomically(configPath, { version: 1, libraryPath: resolved });
  return resolved;
}

export async function diagnoseCli({
  version,
  env = process.env,
  home = os.homedir(),
  platform = process.platform,
  cwd = process.cwd(),
  configPath = cliConfigPath({ env, home, platform }),
  activeStatePath = activeLibraryStatePath({ env, home, platform }),
  skillsRoot = path.join(env.CODEX_HOME || path.join(home, ".codex"), "skills"),
} = {}) {
  const skillPath = path.join(skillsRoot, "loby-cli");
  const skillInstalled = await isFile(path.join(skillPath, "SKILL.md"));
  let library;
  try {
    const resolved = await resolveLibrary({ env, home, platform, cwd, configPath, activeStatePath });
    library = {
      ok: true,
      path: resolved.libraryPath,
      source: resolved.source,
      writable: await isLibraryWritable(resolved.libraryPath),
    };
  } catch (error) {
    const normalized = error instanceof CliError ? error : new CliError("LIBRARY_CHECK_FAILED", error?.message || String(error));
    library = { ok: false, error: { code: normalized.code, message: normalized.message } };
  }
  const ok = library.ok && library.writable && skillInstalled;
  return {
    ok,
    action: "doctor",
    version: String(version || "unknown"),
    nodeVersion: process.version,
    library,
    skill: { installed: skillInstalled, path: skillPath },
  };
}

export async function createInboxDraft({ libraryPath, title, content = "", now = new Date(), randomBytes = crypto.randomBytes }) {
  const root = await validateLibraryPath(libraryPath, "写作库路径");
  const normalizedTitle = normalizeTitle(title);
  const sheetId = createSheetId(randomBytes(16));
  const timestamp = formatLocalTimestamp(now);
  const targetWords = await readInboxTargetWords(root);
  const body = normalizeBody(content, normalizedTitle);
  const markdown = renderInboxMarkdown({ sheetId, title: normalizedTitle, targetWords, timestamp, body });
  const inboxDirectory = await resolveManagedDirectory(root, "inbox");
  const baseName = safeVisiblePathSegment(normalizedTitle, sheetId);
  const documentPath = await writeUniqueMarkdown(inboxDirectory, baseName, markdown);

  return {
    ok: true,
    action: "inbox.create",
    libraryPath: root,
    path: documentPath,
    sheetId,
    title: normalizedTitle,
  };
}

export async function installCodexSkill({ sourcePath, force = false, env = process.env, home = os.homedir(), destinationRoot } = {}) {
  if (!sourcePath || !(await isFile(path.join(sourcePath, "SKILL.md")))) {
    throw new CliError("SKILL_PACKAGE_MISSING", "CLI 安装包中缺少 loby-cli Skill。", 2);
  }
  const skillsRoot = destinationRoot || path.join(env.CODEX_HOME || path.join(home, ".codex"), "skills");
  const target = path.join(skillsRoot, "loby-cli");
  const targetExists = await pathExists(target);
  if (targetExists && !force) {
    throw new CliError("SKILL_ALREADY_INSTALLED", `Skill 已存在：${target}。如需更新，请增加 --force。`);
  }

  await fs.mkdir(skillsRoot, { recursive: true });
  const temporary = path.join(skillsRoot, `.loby-cli-install-${process.pid}-${Date.now()}`);
  const backup = path.join(skillsRoot, `.loby-cli-backup-${process.pid}-${Date.now()}`);
  await fs.cp(sourcePath, temporary, { recursive: true, errorOnExist: true });
  try {
    if (targetExists) await fs.rename(target, backup);
    await fs.rename(temporary, target);
    if (targetExists) await fs.rm(backup, { recursive: true, force: true });
  } catch (error) {
    await fs.rm(temporary, { recursive: true, force: true });
    if ((await pathExists(backup)) && !(await pathExists(target))) await fs.rename(backup, target);
    throw error;
  }
  return { ok: true, action: "skill.install", host: "codex", path: target };
}

export function createSheetId(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 16) {
    throw new CliError("INVALID_RANDOM_SOURCE", "文稿 ID 需要 16 字节安全随机数。", 2);
  }
  const uuidBytes = Uint8Array.from(bytes);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  let buffer = 0;
  let bits = 0;
  let output = "";
  for (const byte of uuidBytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(buffer >>> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return `sheet-${output}`;
}

export function renderInboxMarkdown({ sheetId, title, targetWords, timestamp, body }) {
  return [
    "---",
    `title: ${yamlString(title)}`,
    "tags: []",
    'description: ""',
    `createdAt: ${yamlString(timestamp)}`,
    `updatedAt: ${yamlString(timestamp)}`,
    "loby:",
    `  id: ${yamlString(sheetId)}`,
    `  groupId: ${yamlString(INBOX_GROUP_ID)}`,
    `  targetWords: ${targetWords}`,
    "---",
    "",
    body,
  ].join("\n");
}

async function validateLibraryPath(candidate, label) {
  const expanded = expandHome(String(candidate).trim());
  let resolved;
  try {
    resolved = await fs.realpath(expanded);
  } catch {
    throw new CliError("LIBRARY_NOT_FOUND", `${label}不存在：${expanded}`);
  }
  if (!(await isLobyLibrary(resolved))) {
    throw new CliError("NOT_A_LOBY_LIBRARY", `${label}不是落笔写作库：${resolved}`);
  }
  return resolved;
}

async function findLibraryFromCwd(cwd) {
  let current;
  try {
    current = await fs.realpath(cwd);
  } catch {
    return null;
  }
  while (true) {
    if (await isLobyLibrary(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function readLibraryPointer(configPath) {
  try {
    const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
    return typeof parsed.libraryPath === "string" ? parsed.libraryPath : "";
  } catch {
    return "";
  }
}

async function isLibraryWritable(root) {
  const inbox = path.join(root, "inbox");
  const target = (await isDirectory(inbox)) ? inbox : root;
  try {
    await fs.access(target, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function readInboxTargetWords(root) {
  try {
    const projects = JSON.parse(await fs.readFile(path.join(root, ".loby", "library.json"), "utf8"));
    const inbox = Array.isArray(projects) ? projects.find((project) => project?.id === INBOX_PROJECT_ID) : undefined;
    const definition = inbox?.documentPropertyDefinitions?.find((item) => item?.id === TARGET_WORDS_DEFINITION_ID);
    const value = Number(definition?.defaultValue);
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : DEFAULT_TARGET_WORDS;
  } catch {
    return DEFAULT_TARGET_WORDS;
  }
}

async function resolveManagedDirectory(root, directoryName) {
  const candidate = path.join(root, directoryName);
  await fs.mkdir(candidate, { recursive: true });
  const resolved = await fs.realpath(candidate);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new CliError("UNSAFE_LIBRARY_PATH", `写作库目录越过了库边界：${candidate}`);
  }
  return resolved;
}

async function writeUniqueMarkdown(directory, baseName, markdown) {
  for (let index = 1; index <= 9999; index += 1) {
    const suffix = index === 1 ? "" : ` ${index}`;
    const candidate = path.join(directory, `${baseName}${suffix}.md`);
    try {
      const handle = await fs.open(candidate, "wx", 0o644);
      try {
        await handle.writeFile(markdown, "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => undefined);
        await fs.rm(candidate, { force: true });
        throw error;
      }
      await handle.close();
      return candidate;
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw new CliError("DOCUMENT_WRITE_FAILED", `无法创建收件箱文稿：${error.message}`);
    }
  }
  throw new CliError("DOCUMENT_NAME_EXHAUSTED", "同名文稿过多，请换一个标题后重试。");
}

async function writeJsonAtomically(destination, value) {
  const directory = path.dirname(destination);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await fs.rename(temporary, destination);
}

function normalizeTitle(value) {
  const title = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!title) throw new CliError("TITLE_REQUIRED", "请使用 --title 提供文稿标题。", 2);
  if ([...title].length > 200) throw new CliError("TITLE_TOO_LONG", "文稿标题不能超过 200 个字符。", 2);
  return title;
}

function normalizeBody(content, title) {
  const body = String(content || "").replace(/^\uFEFF/, "");
  const resolved = body.trim().length > 0 ? body : `# ${title}\n\n`;
  return resolved.endsWith("\n") ? resolved : `${resolved}\n`;
}

function safeVisiblePathSegment(title, fallback) {
  const sanitized = title
    .trim()
    .replace(/[\\/:*?"<>|\0]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.-]+|[.-]+$/g, "");
  return sanitized || fallback;
}

function formatLocalTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new CliError("INVALID_TIMESTAMP", "无法生成文稿时间。", 2);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function expandHome(value) {
  if (value === "~") return os.homedir();
  if (value.startsWith(`~${path.sep}`)) return path.join(os.homedir(), value.slice(2));
  return path.resolve(value);
}

async function isDirectory(candidate) {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(candidate) {
  try {
    return (await fs.stat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}
