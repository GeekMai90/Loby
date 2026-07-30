/**
 * [INPUT]: 依赖 Node test/assert、Rust 共用文稿 fixture、临时文件系统与 CLI core
 * [OUTPUT]: 验证活动库解析、自检、收件箱 Markdown 跨语言契约、库边界、同名避让及 Skill 安装不变量
 * [POS]: cli 的纯领域回归测试，不访问用户真实写作库和 Codex 配置
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { URL } from "node:url";
import {
  CliError,
  createInboxDraft,
  diagnoseCli,
  installCodexSkill,
  resolveLibrary,
  resolveLibraryPath,
  setConfiguredLibrary,
  updateDocument,
} from "../src/core.mjs";

const contract = JSON.parse(await fs.readFile(new URL("./fixtures/document-contract.json", import.meta.url), "utf8"));

test("creates a status-free Loby document directly in the inbox", async (context) => {
  const root = await createLibrary(context, { targetWords: 1800 });
  const result = await createInboxDraft({
    libraryPath: root,
    title: contract.title,
    content: contract.body,
    now: new Date(2026, 6, 30, 18, 20, 30),
    randomBytes: () => Uint8Array.from(contract.uuidBytes),
  });
  const markdown = await fs.readFile(result.path, "utf8");

  assert.equal(path.dirname(result.path), path.join(root, "inbox"));
  assert.equal(path.basename(result.path), contract.filename);
  assert.equal(result.sheetId, contract.sheetId);
  assert.match(markdown, new RegExp(`groupId: ${JSON.stringify(contract.groupId)}`));
  assert.match(markdown, new RegExp(`targetWords: ${contract.targetWords}`));
  assert.match(markdown, new RegExp(`createdAt: ${JSON.stringify(contract.timestamp)}`));
  for (const key of contract.forbiddenFrontmatterKeys) assert.doesNotMatch(markdown, new RegExp(`\\b${key}:`));
  assert.equal(markdown.endsWith(contract.body), true);
});

test("never overwrites an existing same-title document", async (context) => {
  const root = await createLibrary(context);
  const input = {
    libraryPath: root,
    title: "同名文稿",
    content: "正文",
    randomBytes: () => new Uint8Array(16),
  };
  const first = await createInboxDraft(input);
  const second = await createInboxDraft(input);

  assert.equal(path.basename(first.path), "同名文稿.md");
  assert.equal(path.basename(second.path), "同名文稿 2.md");
  assert.equal(await fs.readFile(first.path, "utf8"), await fs.readFile(second.path, "utf8"));
});

test("directly replaces a document body by stable ID while preserving frontmatter", async (context) => {
  const root = await createLibrary(context);
  const created = await createInboxDraft({
    libraryPath: root,
    title: "直接修改",
    content: "# 旧正文\n\n旧内容",
    now: new Date(2026, 6, 30, 18, 0, 0),
    randomBytes: () => new Uint8Array(16),
  });
  const original = await fs.readFile(created.path, "utf8");
  await fs.writeFile(created.path, original.replace("tags: []", "customField: 保留我\ntags: []"));
  await fs.writeFile(path.join(root, "inbox", ".hidden-copy.md"), original);

  const result = await updateDocument({
    libraryPath: root,
    sheetId: created.sheetId,
    content: "# 新正文\n\nAgent 已经直接修改。",
    now: new Date(2026, 6, 30, 19, 20, 30),
  });
  const updated = await fs.readFile(created.path, "utf8");

  assert.equal(result.action, "document.update");
  assert.equal(result.path, created.path);
  assert.equal(result.sheetId, created.sheetId);
  assert.notEqual(result.previousContentHash, result.contentHash);
  assert.match(updated, /customField: 保留我/);
  assert.match(updated, /createdAt: "2026-07-30 18:00:00"/);
  assert.match(updated, /updatedAt: "2026-07-30 19:20:30"/);
  assert.doesNotMatch(updated, /旧内容/);
  assert.equal(updated.endsWith("# 新正文\n\nAgent 已经直接修改。\n"), true);
});

test("updates by an absolute managed path and rejects paths outside the library", async (context) => {
  const root = await createLibrary(context);
  const created = await createInboxDraft({ libraryPath: root, title: "路径修改", content: "旧正文" });
  const result = await updateDocument({ libraryPath: root, documentPath: created.path, content: "新正文" });
  assert.equal(result.sheetId, created.sheetId);
  assert.equal((await fs.readFile(created.path, "utf8")).endsWith("新正文\n"), true);

  const outside = path.join(await temporaryDirectory(context), "outside.md");
  await fs.writeFile(outside, await fs.readFile(created.path, "utf8"));
  await assert.rejects(
    () => updateDocument({ libraryPath: root, documentPath: outside, content: "越界" }),
    (error) => error instanceof CliError && error.code === "UNSAFE_DOCUMENT_PATH",
  );
});

test("resolves an enclosing library before the configured fallback", async (context) => {
  const root = await createLibrary(context);
  const fallback = await createLibrary(context);
  const configPath = path.join(await temporaryDirectory(context), "config.json");
  await setConfiguredLibrary(fallback, { configPath });
  const nested = path.join(root, "projects", "demo");
  await fs.mkdir(nested, { recursive: true });

  assert.equal(await resolveLibraryPath({ cwd: nested, configPath, home: path.dirname(root), env: {} }), root);
});

test("prefers the desktop active library over the CLI configured fallback", async (context) => {
  const active = await createLibrary(context);
  const fallback = await createLibrary(context);
  const state = await temporaryDirectory(context);
  const activeStatePath = path.join(state, "active-library.json");
  const configPath = path.join(state, "config.json");
  await fs.writeFile(activeStatePath, JSON.stringify({ version: 1, libraryPath: active }));
  await setConfiguredLibrary(fallback, { configPath });

  assert.deepEqual(await resolveLibrary({ cwd: state, activeStatePath, configPath, env: {}, home: state }), {
    libraryPath: active,
    source: "app",
  });
});

test("doctor reports the resolved library source, write access, and Codex Skill", async (context) => {
  const root = await createLibrary(context);
  const temporary = await temporaryDirectory(context);
  const activeStatePath = path.join(temporary, "active-library.json");
  const skillsRoot = path.join(temporary, "skills");
  await fs.writeFile(activeStatePath, JSON.stringify({ version: 1, libraryPath: root }));
  await fs.mkdir(path.join(skillsRoot, "loby-cli"), { recursive: true });
  await fs.writeFile(path.join(skillsRoot, "loby-cli", "SKILL.md"), "# Test\n");

  const result = await diagnoseCli({
    version: "0.1.0",
    cwd: temporary,
    env: {},
    home: temporary,
    activeStatePath,
    configPath: path.join(temporary, "missing-config.json"),
    skillsRoot,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.library, { ok: true, path: root, source: "app", writable: true });
  assert.equal(result.skill.installed, true);
});

test("rejects ordinary directories instead of turning them into a writing library", async (context) => {
  const ordinary = await temporaryDirectory(context);
  await assert.rejects(
    () => setConfiguredLibrary(ordinary, { configPath: path.join(ordinary, "config.json") }),
    (error) => error instanceof CliError && error.code === "NOT_A_LOBY_LIBRARY",
  );
});

test("rejects an inbox symlink that escapes the writing library", async (context) => {
  const root = await createLibrary(context);
  const outside = await temporaryDirectory(context);
  await fs.rm(path.join(root, "inbox"), { recursive: true });
  await fs.symlink(outside, path.join(root, "inbox"), "dir");

  await assert.rejects(
    () => createInboxDraft({ libraryPath: root, title: "不能越界" }),
    (error) => error instanceof CliError && error.code === "UNSAFE_LIBRARY_PATH",
  );
});

test("installs the bundled skill without overwriting an existing copy", async (context) => {
  const temporary = await temporaryDirectory(context);
  const source = path.join(temporary, "source");
  const destinationRoot = path.join(temporary, "skills");
  await fs.mkdir(source);
  await fs.writeFile(path.join(source, "SKILL.md"), "---\nname: loby-cli\ndescription: test\n---\n\n# Test\n");

  const installed = await installCodexSkill({ sourcePath: source, destinationRoot });
  assert.equal(installed.path, path.join(destinationRoot, "loby-cli"));
  await assert.rejects(
    () => installCodexSkill({ sourcePath: source, destinationRoot }),
    (error) => error instanceof CliError && error.code === "SKILL_ALREADY_INSTALLED",
  );
});

async function createLibrary(context, { targetWords = 1000 } = {}) {
  const root = await temporaryDirectory(context);
  await Promise.all([".loby", "inbox", "notes", "projects"].map((directory) => fs.mkdir(path.join(root, directory))));
  await fs.writeFile(
    path.join(root, ".loby", "library.json"),
    JSON.stringify([
      {
        id: "inbox-root",
        documentPropertyDefinitions: [{ id: "loby-target-words", defaultValue: targetWords }],
      },
    ]),
  );
  return fs.realpath(root);
}

async function temporaryDirectory(context) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "loby-cli-test-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
