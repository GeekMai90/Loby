/**
 * [INPUT]: 依赖 Node.js fs/path、renderer 源码结构、GEB 文档与 index.css 设计系统边界
 * [OUTPUT]: 以退出码和错误清单验证依赖方向、L2/L3 契约、旧 Token 禁用及普通 UI 裸色边界
 * [POS]: scripts 的本地架构门禁；把项目结构与设计系统约定固化为可重复检查
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
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
const rawColorDomainFiles = new Set([
  "src/styles/index.css",
  "src/styles/themes.css",
  "src/styles/zen-mode.css",
  "src/styles/settings-controls.css",
  "src/styles/publishing.css",
  "src/shared/constants/themes.ts",
  "src/features/editor/model/documentProperties.ts",
  "src/features/library/constants/projectAppearance.ts",
  "src/features/library/model/projectModel.ts",
  "src/features/library/components/LibraryNotesSection.tsx",
  "src/features/library/components/project-fields/ProjectFieldDefinitionEditor.tsx",
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
].filter((file) => !/\.test\.(ts|tsx)$/.test(file));
for (const file of frontendContractFiles) {
  if (!fs.readFileSync(file, "utf8").slice(0, 1_200).includes("[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md")) {
    errors.push(`缺少或损坏 L3 契约：${path.relative(root, file)}`);
  }
}

const rustFiles = walk(path.join(root, "src-tauri/src"), (file) => file.endsWith(".rs") && !file.endsWith("/tests.rs"));
for (const file of rustFiles) {
  if (!fs.readFileSync(file, "utf8").slice(0, 1_200).includes("[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md")) {
    errors.push(`缺少或损坏 Rust L3 契约：${path.relative(root, file)}`);
  }
}

const rendererStyleFiles = walk(
  path.join(root, "src"),
  (file) => /\.(css|ts|tsx)$/.test(file) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(file),
);
for (const file of rendererStyleFiles) {
  const relativePath = path.relative(root, file).split(path.sep).join("/");
  const content = fs.readFileSync(file, "utf8");

  for (const token of legacyDesignTokens) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`${escapedToken}(?![-\\w])`).test(content)) {
      errors.push(`仍在使用旧设计 Token ${token}：${relativePath}`);
    }
  }

  const ownsDomainColors = rawColorDomainFiles.has(relativePath) || relativePath.startsWith("src/features/publishing/");
  if (ownsDomainColors) continue;

  content.split("\n").forEach((sourceLine, index) => {
    const isMaskPrimitive = /(?:mask|linear-gradient)\b/.test(sourceLine) && /#000(?:000)?\b/i.test(sourceLine);
    const line = isMaskPrimitive ? sourceLine.replace(/#000(?:000)?\b/gi, "") : sourceLine;
    const hasRawColor = /#[0-9a-f]{3,8}\b|(?:rgb|rgba|hsl|hsla)\(\s*[\d.]/i.test(line);
    const hasRawTailwindColor = /\b(?:bg|text|border|from|via|to)-(?:black|white)(?:\/(?:[\d.]+|\[[^\]]+\]))?\b/.test(line);
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
for (const file of agentMaps) {
  if (!fs.readFileSync(file, "utf8").includes("[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md")) {
    errors.push(`缺少 L2 protocol：${path.relative(root, file)}`);
  }
}

if (errors.length) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("Architecture boundaries and GEB contracts are aligned.\n");
