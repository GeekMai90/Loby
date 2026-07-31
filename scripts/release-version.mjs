/**
 * [INPUT]: 依赖 Node.js 文件系统、JSON/TOML 版本文件和 Git 工作树状态
 * [OUTPUT]: 对外提供版本类型解析、SemVer 增量与应用版本同步命令
 * [POS]: scripts 的发布准备入口；只修改应用版本元数据，不提交、打 tag 或上传 Release
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPackagePath = path.join(repoRoot, "package.json");
const packageLockPath = path.join(repoRoot, "package-lock.json");
const cargoManifestPath = path.join(repoRoot, "src-tauri", "Cargo.toml");
const cargoLockPath = path.join(repoRoot, "src-tauri", "Cargo.lock");
const tauriConfigPath = path.join(repoRoot, "src-tauri", "tauri.conf.json");

const releaseTypeAliases = new Map([
  ["patch", "patch"],
  ["修订版", "patch"],
  ["修订版更新", "patch"],
  ["补丁版", "patch"],
  ["补丁版更新", "patch"],
  ["小修复", "patch"],
  ["minor", "minor"],
  ["功能版", "minor"],
  ["功能版更新", "minor"],
  ["次版本", "minor"],
  ["次版本更新", "minor"],
  ["新功能版", "minor"],
  ["major", "major"],
  ["重大版", "major"],
  ["重大版更新", "major"],
  ["主版本", "major"],
  ["主版本更新", "major"],
  ["破坏性更新", "major"],
]);

export function normalizeReleaseType(input) {
  const normalized = input?.trim().toLowerCase();
  const releaseType = releaseTypeAliases.get(normalized);
  if (!releaseType) {
    throw new Error("版本类型必须是 patch/修订版、minor/功能版或 major/重大版。");
  }
  return releaseType;
}

export function incrementVersion(version, releaseType) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`当前版本号不是三段式 SemVer：${version}`);
  }

  const [major, minor, patch] = match.slice(1).map(Number);
  if (releaseType === "major") return `${major + 1}.0.0`;
  if (releaseType === "minor") return `${major}.${minor + 1}.0`;
  if (releaseType === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`未知版本类型：${releaseType}`);
}

export function readVersionDocuments({ packageJson, packageLock, cargoToml, cargoLock, tauriConfig }) {
  const cargoMatch = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
  const cargoLockMatch = /\[\[package\]\]\nname = "loby"\nversion = "([^"]+)"/.exec(cargoLock);

  if (!cargoMatch || !cargoLockMatch) {
    throw new Error("没有找到 Loby 的 Cargo 版本字段。");
  }

  return {
    packageJson: packageJson.version,
    packageLock: packageLock.version,
    packageLockRoot: packageLock.packages?.[""]?.version,
    cargoToml: cargoMatch[1],
    cargoLock: cargoLockMatch[1],
    tauriConfig: tauriConfig.version,
  };
}

export function assertVersionConsistency(versions) {
  const entries = Object.entries(versions);
  const expected = entries[0]?.[1];
  const inconsistent = entries.filter(([, version]) => version !== expected);
  if (inconsistent.length > 0) {
    const details = entries.map(([name, version]) => `${name}=${version}`).join(", ");
    throw new Error(`应用版本来源不一致：${details}`);
  }
  return expected;
}

export function updateVersionDocuments({ packageJson, packageLock, cargoToml, cargoLock, tauriConfig }, nextVersion) {
  const nextCargoToml = cargoToml.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${nextVersion}"`);
  const nextCargoLock = cargoLock.replace(/(\[\[package\]\]\nname = "loby"\nversion = )"[^"]+"/, `$1"${nextVersion}"`);
  if (nextCargoToml === cargoToml || nextCargoLock === cargoLock) {
    throw new Error("没有成功定位 Cargo 版本字段，已停止修改。");
  }

  return {
    packageJson: { ...packageJson, version: nextVersion },
    packageLock: {
      ...packageLock,
      version: nextVersion,
      packages: {
        ...packageLock.packages,
        "": { ...packageLock.packages[""], version: nextVersion },
      },
    },
    cargoToml: nextCargoToml,
    cargoLock: nextCargoLock,
    tauriConfig: { ...tauriConfig, version: nextVersion },
  };
}

async function readVersionFiles() {
  const [packageJsonText, packageLockText, cargoToml, cargoLock, tauriConfigText] = await Promise.all([
    readFile(appPackagePath, "utf8"),
    readFile(packageLockPath, "utf8"),
    readFile(cargoManifestPath, "utf8"),
    readFile(cargoLockPath, "utf8"),
    readFile(tauriConfigPath, "utf8"),
  ]);

  return {
    packageJson: JSON.parse(packageJsonText),
    packageLock: JSON.parse(packageLockText),
    cargoToml,
    cargoLock,
    tauriConfig: JSON.parse(tauriConfigText),
  };
}

async function writeVersionFiles(documents) {
  await Promise.all([
    writeFile(appPackagePath, `${JSON.stringify(documents.packageJson, null, 2)}\n`),
    writeFile(packageLockPath, `${JSON.stringify(documents.packageLock, null, 2)}\n`),
    writeFile(cargoManifestPath, documents.cargoToml),
    writeFile(cargoLockPath, documents.cargoLock),
    writeFile(tauriConfigPath, `${JSON.stringify(documents.tauriConfig, null, 2)}\n`),
  ]);
}

function assertCleanWorktree() {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).trim();
  if (status) {
    throw new Error("当前工作树有未提交修改，请先提交或暂存后再执行版本发布命令。\n" + status);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const dryRun = args.includes("--dry-run");
  const typeInput = args.find((argument) => !argument.startsWith("--"));
  const documents = await readVersionFiles();
  const currentVersions = readVersionDocuments(documents);
  const currentVersion = assertVersionConsistency(currentVersions);

  if (checkOnly) {
    console.log(`应用版本来源一致：${currentVersion}`);
    return;
  }

  if (!typeInput || args.some((argument) => argument.startsWith("--") && argument !== "--dry-run")) {
    throw new Error("用法：npm run release -- patch|minor|major [--dry-run]，或 npm run release -- --check。");
  }
  if (!dryRun) {
    assertCleanWorktree();
  }

  const releaseType = normalizeReleaseType(typeInput);
  const nextVersion = incrementVersion(currentVersion, releaseType);
  const nextDocuments = updateVersionDocuments(documents, nextVersion);

  if (!dryRun) {
    await writeVersionFiles(nextDocuments);
  }

  console.log(`${dryRun ? "预览" : "已同步"}应用版本：${currentVersion} -> ${nextVersion}（${releaseType}）`);
  if (!dryRun) {
    console.log("下一步：更新 CHANGELOG.md，运行 npm run check，然后提交并按发布检查清单构建 Release。");
  }
}

const isMainModule = process.argv[1] && realpathSync(path.resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
if (isMainModule) {
  main().catch((error) => {
    console.error(`版本发布失败：${error.message}`);
    process.exitCode = 1;
  });
}
