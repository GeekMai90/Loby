import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

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
