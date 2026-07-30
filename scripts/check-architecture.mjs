/**
 * [INPUT]: 依赖 Node.js fs/path、renderer/native/CLI/仓库脚本源码、GEB 地图与 index.css 设计系统边界
 * [OUTPUT]: 以退出码和错误清单验证依赖方向、L2 父链/成员、唯一完整 L3、旧 Token 禁用及普通 UI 全 Tailwind palette/裸色边界
 * [POS]: scripts 的本地架构门禁；把代码地图同构与设计系统约定固化为可重复证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const gebProtocol = "[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md";
const ignoredTerrainEntries = new Set([".DS_Store", "dist", "node_modules", "target"]);
const legacyDesignTokens = [
  "--neutral-ink",
  "--theme-blue-rgb",
  "--on-accent-rgb",
  "--app-bg",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--text-muted",
  "--icon-primary",
  "--accent-strong",
  "--accent-border",
  "--danger",
  "--success",
  "--ui-accent",
  "--ui-accent-foreground",
];
const legacySurfaceTokenPattern = /--[\w-]*surface[\w-]*/g;
const rawColorDomainFiles = new Set([
  "src/styles/index.css",
  "src/styles/themes.css",
  "src/styles/settings-controls.css",
  "src/shared/constants/themes.ts",
  "src/features/editor/model/documentProperties.ts",
  "src/features/library/constants/projectAppearance.ts",
]);

function walk(directory, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && [".git", "dist", "node_modules", "target"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, predicate));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function requireFile(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) errors.push(`缺少工程地图：${relativePath}`);
  return absolute;
}

function toRelativePath(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function isTestSource(file) {
  return /\.(?:test|spec)\.(?:ts|tsx)$/.test(file);
}

function validateL3Contract(file, label) {
  const content = fs.readFileSync(file, "utf8");
  const head = content.slice(0, 1_800);
  const commentPrefix = String.raw`(?:\s*\*\s*|\s*\/\/!\s*)`;
  const missingFields = ["INPUT", "OUTPUT", "POS"].filter(
    (field) => !new RegExp(String.raw`^${commentPrefix}\[${field}\]:`, "m").test(head),
  );
  const protocolMatches = content.match(/^\s*(?:\*|\/\/!)\s*\[PROTOCOL\]: 变更时更新此头部，然后检查 AGENTS\.md\s*$/gm);

  if (missingFields.length > 0 || !protocolMatches) {
    errors.push(`${label}缺少或损坏 L3 契约：${toRelativePath(file)}`);
    return;
  }
  if (protocolMatches.length > 1) {
    errors.push(`${label}存在重复 L3 契约：${toRelativePath(file)}`);
  }
}

function nearestParentAgent(relativeAgentPath, agentPaths) {
  let directory = path.dirname(path.dirname(relativeAgentPath));
  while (true) {
    const candidate = directory === "." ? "AGENTS.md" : path.join(directory, "AGENTS.md");
    const normalized = candidate.split(path.sep).join("/");
    if (agentPaths.has(normalized)) return normalized;
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

for (const legacyDirectory of ["src/hooks", "src/constants", "src/lib"]) {
  if (fs.existsSync(path.join(root, legacyDirectory))) errors.push(`旧技术分层目录不应重新出现：${legacyDirectory}`);
}

for (const relativePath of [
  "src/AGENTS.md",
  "src/app/AGENTS.md",
  "src/features/AGENTS.md",
  "src/shared/AGENTS.md",
  "src/components/AGENTS.md",
  "src/styles/AGENTS.md",
  "src-tauri/AGENTS.md",
  "src-tauri/src/AGENTS.md",
]) {
  requireFile(relativePath);
}

const featureRoot = path.join(root, "src/features");
for (const entry of fs.readdirSync(featureRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  requireFile(`src/features/${entry.name}/AGENTS.md`);
}

for (const domain of ["agent", "library", "publishing", "resources"]) {
  requireFile(`src-tauri/src/${domain}/AGENTS.md`);
}

const sharedFiles = walk(path.join(root, "src/shared"), (file) => /\.(ts|tsx)$/.test(file));
for (const file of sharedFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (/@\/(?:app|features)\//.test(content)) {
    errors.push(`shared 反向依赖 app/feature：${path.relative(root, file)}`);
  }
}

const featureFiles = walk(featureRoot, (file) => /\.(ts|tsx)$/.test(file));
for (const file of featureFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (/@\/app\//.test(content)) errors.push(`feature 反向依赖 app：${path.relative(root, file)}`);
}

const frontendContractFiles = [
  path.join(root, "src/main.tsx"),
  ...walk(path.join(root, "src/app"), (file) => /\.(ts|tsx)$/.test(file)),
  ...featureFiles,
  ...sharedFiles,
  ...walk(path.join(root, "src/components"), (file) => /\.(ts|tsx)$/.test(file)),
  path.join(root, "src/styles.css"),
  ...walk(path.join(root, "src/styles"), (file) => file.endsWith(".css")),
  ...walk(path.join(root, "scripts"), (file) => file.endsWith(".mjs")),
  ...walk(path.join(root, "cli", "src"), (file) => file.endsWith(".mjs")),
  path.join(root, "eslint.config.js"),
  path.join(root, "vite.config.ts"),
  path.join(root, "vitest.config.ts"),
].filter((file) => !isTestSource(file));
for (const file of new Set(frontendContractFiles)) validateL3Contract(file, "");

const rustFiles = [
  path.join(root, "src-tauri/build.rs"),
  ...walk(path.join(root, "src-tauri/src"), (file) => file.endsWith(".rs") && !file.endsWith("/tests.rs")),
];
for (const file of rustFiles) validateL3Contract(file, "Rust ");

const rendererStyleFiles = walk(
  path.join(root, "src"),
  (file) => /\.(css|ts|tsx)$/.test(file) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file),
);
for (const file of rendererStyleFiles) {
  const relativePath = path.relative(root, file).split(path.sep).join("/");
  const content = fs.readFileSync(file, "utf8");

  for (const token of new Set(content.match(legacySurfaceTokenPattern) ?? [])) {
    errors.push(`背景颜色 Token 仍在使用旧 surface 命名 ${token}：${relativePath}`);
  }

  for (const token of legacyDesignTokens) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escapedToken}(?![-\\w])`).test(content)) {
      errors.push(`仍在使用旧设计 Token ${token}：${relativePath}`);
    }
  }

  const ownsDomainColors = rawColorDomainFiles.has(relativePath) || relativePath.startsWith("src/features/publishing/model/");
  if (ownsDomainColors) continue;

  content.split("\n").forEach((sourceLine, index) => {
    const isMaskPrimitive = /(?:mask|linear-gradient)\b/.test(sourceLine) && /#000(?:000)?\b/i.test(sourceLine);
    const line = isMaskPrimitive ? sourceLine.replace(/#000(?:000)?\b/gi, "") : sourceLine;
    const hasRawColor = /#[0-9a-f]{3,8}\b|(?:rgb|rgba|hsl|hsla)\(\s*[\d.]/i.test(line);
    const hasRawTailwindColor =
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to|shadow)-(?:black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/(?:[\d.]+|\[[^\]]+\]))?\b/.test(
        line,
      );
    if (hasRawColor || hasRawTailwindColor) {
      errors.push(`普通 UI 出现未语义化颜色：${relativePath}:${index + 1}`);
    }
  });
}

const agentMaps = walk(
  root,
  (file) =>
    path.basename(file) === "AGENTS.md" &&
    !file.includes(`${path.sep}node_modules${path.sep}`) &&
    !file.includes(`${path.sep}target${path.sep}`),
);
const relativeAgentPaths = new Set(agentMaps.map(toRelativePath));
for (const file of agentMaps) {
  const relativePath = toRelativePath(file);
  const content = fs.readFileSync(file, "utf8");
  const protocolCount = content.split(gebProtocol).length - 1;
  if (protocolCount !== 1) {
    errors.push(`${protocolCount === 0 ? "缺少" : "重复"} L2 protocol：${relativePath}`);
  }
  if (relativePath === "AGENTS.md") continue;

  const expectedParent = nearestParentAgent(relativePath, relativeAgentPaths);
  const parentLink = content.match(/父级：\[[^\]]+\]\(([^)]+)\)/);
  const resolvedParent = parentLink ? toRelativePath(path.resolve(path.dirname(file), parentLink[1])) : null;
  if (!parentLink || resolvedParent !== expectedParent) {
    errors.push(`L2 父级链接失配：${relativePath}（期望 ${expectedParent ?? "无"}）`);
  }

  for (const entry of fs.readdirSync(path.dirname(file), { withFileTypes: true })) {
    if (entry.name === "AGENTS.md" || entry.name.startsWith(".") || ignoredTerrainEntries.has(entry.name)) continue;
    const expectedMember = entry.isDirectory() ? `${entry.name}/` : entry.name;
    if (!content.includes(expectedMember)) {
      errors.push(`L2 未登记直接${entry.isDirectory() ? "目录" : "成员"} ${expectedMember}：${relativePath}`);
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("Architecture boundaries and GEB contracts are aligned.\n");
