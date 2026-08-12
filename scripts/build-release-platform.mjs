/**
 * [INPUT]: 依赖三平台发布配置、Tauri 原生构建产物、updater 私钥和当前宿主系统校验工具
 * [OUTPUT]: 对外提供单平台原生构建、产物标准化、完整性验证与 SHA-256 收据生成入口
 * [POS]: scripts 发布链路的矩阵构建器；每个原生 runner 只负责一个平台，不执行 GitHub 发布
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_PLATFORM_IDS, getReleasePlatform } from "./release-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repoRoot, "package.json");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();
    throw new Error(`命令失败（${result.status}）：${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
  }
  return result;
};

const parseArguments = (args) => {
  const options = { version: null, platform: null, outputDirectory: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--version" && args[index + 1]) {
      options.version = args[++index];
    } else if (argument === "--platform" && args[index + 1]) {
      options.platform = args[++index];
    } else if (argument === "--output-dir" && args[index + 1]) {
      options.outputDirectory = args[++index];
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
};

const printUsage = () => {
  console.log("用法：npm run release:build -- --version <version> --platform <platform> --output-dir <directory>");
  console.log(`平台：${RELEASE_PLATFORM_IDS.join(", ")}`);
};

const hashFile = async (filePath) =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");

const assertFreshFile = async (filePath, buildStartedAt) => {
  let metadata;
  try {
    metadata = await stat(filePath);
  } catch {
    throw new Error(`没有找到本次构建资产：${filePath}`);
  }
  if (!metadata.isFile() || metadata.size === 0 || metadata.mtimeMs < buildStartedAt - 2_000) {
    throw new Error(`构建资产为空或不是本次构建生成：${filePath}`);
  }
  return metadata;
};

const findAppBundle = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) return candidate;
    if (entry.isDirectory()) {
      const nested = await findAppBundle(candidate);
      if (nested) return nested;
    }
  }
  return null;
};

const verifyCodesign = (appPath, label) => {
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  console.log(`已通过 codesign 校验：${label}`);
};

const verifyMacAssets = async (bundleRoot, platform) => {
  const appPath = path.join(bundleRoot, "macos", "落笔.app");
  const dmgPath = path.join(bundleRoot, platform.assets.find(({ key }) => key === "darwin-dmg").source);
  const updaterPath = path.join(bundleRoot, platform.assets.find(({ key }) => key === "darwin-updater").source);
  verifyCodesign(appPath, "源 .app");

  const verificationDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-release-verify-"));
  const updaterDirectory = path.join(verificationDirectory, "updater");
  const dmgDirectory = path.join(verificationDirectory, "dmg");
  await mkdir(updaterDirectory);
  await mkdir(dmgDirectory);
  let mounted = false;
  try {
    run("tar", ["-xzf", updaterPath, "-C", updaterDirectory]);
    const updaterApp = await findAppBundle(updaterDirectory);
    if (!updaterApp) throw new Error("macOS updater tar.gz 中没有找到 .app bundle。");
    verifyCodesign(updaterApp, "updater 内 .app");

    run("hdiutil", ["attach", dmgPath, "-readonly", "-nobrowse", "-noverify", "-mountpoint", dmgDirectory]);
    mounted = true;
    const dmgApp = await findAppBundle(dmgDirectory);
    if (!dmgApp) throw new Error("DMG 中没有找到 .app bundle。");
    verifyCodesign(dmgApp, "DMG 内 .app");
  } finally {
    if (mounted) run("hdiutil", ["detach", dmgDirectory], { allowFailure: true, capture: true });
    await rm(verificationDirectory, { recursive: true, force: true });
  }
};

const assertMagic = async (filePath, expected, label) => {
  const content = await readFile(filePath);
  if (!content.subarray(0, expected.length).equals(expected)) {
    throw new Error(`${label} 文件头无效：${filePath}`);
  }
};

const verifyPlatformAssets = async (bundleRoot, platform) => {
  if (platform.id === "darwin-aarch64") {
    await verifyMacAssets(bundleRoot, platform);
    return;
  }
  const updater = platform.assets.find(({ key }) => key === platform.updaterAssetKey);
  const updaterPath = path.join(bundleRoot, updater.source);
  if (platform.id === "windows-x86_64") {
    await assertMagic(updaterPath, Buffer.from("MZ"), "Windows NSIS");
    return;
  }

  const appImage = platform.assets.find(({ key }) => key === "linux-appimage");
  await assertMagic(path.join(bundleRoot, appImage.source), Buffer.from([0x7f, 0x45, 0x4c, 0x46]), "Linux AppImage");
  const archiveList = run("tar", ["-tzf", updaterPath], { capture: true }).stdout;
  if (!archiveList.split(/\r?\n/).some((entry) => entry.endsWith(".AppImage"))) {
    throw new Error("Linux updater tar.gz 中没有找到 AppImage。");
  }
};

const buildPlatformRelease = async ({ version, platformId, outputDirectory }) => {
  const platform = getReleasePlatform(platformId, version);
  if (process.platform !== platform.hostPlatform) {
    throw new Error(`${platform.label} 必须在 ${platform.hostPlatform} 原生 runner 构建，当前宿主是 ${process.platform}。`);
  }
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
    throw new Error("缺少 TAURI_SIGNING_PRIVATE_KEY，无法生成可在线更新的签名资产。");
  }

  const currentVersion = JSON.parse(await readFile(packagePath, "utf8")).version;
  if (currentVersion !== version) {
    throw new Error(`package.json 当前版本是 ${currentVersion}，与 --version ${version} 不一致。`);
  }

  const resolvedOutput = path.resolve(repoRoot, outputDirectory);
  await mkdir(resolvedOutput, { recursive: true });
  const existing = await readdir(resolvedOutput);
  if (existing.length > 0) {
    throw new Error(`输出目录必须为空，避免复用旧发布资产：${resolvedOutput}`);
  }

  const buildArguments = ["--target", platform.target, "--bundles", platform.bundles];
  if (platform.config) buildArguments.push("--config", platform.config);
  const buildStartedAt = Date.now();
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npmCommand, ["run", "build", "--", ...buildArguments], {
    env: {
      ...process.env,
      APPLE_SIGNING_IDENTITY:
        platform.id === "darwin-aarch64" ? (process.env.APPLE_SIGNING_IDENTITY ?? "-") : process.env.APPLE_SIGNING_IDENTITY,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
    },
  });

  const targetRoot = process.env.CARGO_TARGET_DIR
    ? path.resolve(repoRoot, process.env.CARGO_TARGET_DIR, platform.target)
    : path.join(repoRoot, "src-tauri", "target", platform.target);
  const bundleRoot = path.join(targetRoot, "release", "bundle");
  const receiptAssets = [];
  for (const asset of platform.assets) {
    const sourcePath = path.join(bundleRoot, asset.source);
    await assertFreshFile(sourcePath, buildStartedAt);
    const destination = path.join(resolvedOutput, asset.name);
    await copyFile(sourcePath, destination);
    const metadata = await stat(destination);
    receiptAssets.push({
      key: asset.key,
      name: asset.name,
      contentType: asset.contentType,
      role: asset.role,
      size: metadata.size,
      sha256: await hashFile(destination),
    });
  }

  const signatureAsset = platform.assets.find(({ key }) => key === platform.signatureAssetKey);
  const signature = await readFile(path.join(resolvedOutput, signatureAsset.name), "utf8");
  if (!signature.trim() || signature !== signature.trim()) {
    throw new Error(`${platform.id} updater .sig 为空或包含首尾空白。`);
  }
  await verifyPlatformAssets(bundleRoot, platform);

  const receipt = {
    schemaVersion: 1,
    version,
    platformId: platform.id,
    target: platform.target,
    updaterAssetKey: platform.updaterAssetKey,
    signatureAssetKey: platform.signatureAssetKey,
    builtAt: new Date().toISOString(),
    assets: receiptAssets,
  };
  const receiptPath = path.join(resolvedOutput, `release-receipt-${platform.id}.json`);
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`已生成 ${platform.label} 发布资产与收据：${resolvedOutput}`);
  return receipt;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printUsage();
  if (!options.version || !options.platform || !options.outputDirectory) {
    throw new Error("必须显式传入 --version、--platform 和 --output-dir。");
  }
  await buildPlatformRelease({
    version: options.version,
    platformId: options.platform,
    outputDirectory: options.outputDirectory,
  });
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error(`单平台 Release 构建失败：${error.message}`);
    process.exitCode = 1;
  });
}

export { buildPlatformRelease, parseArguments };
