/**
 * [INPUT]: 依赖 Node.js 进程/文件系统能力、Tauri CLI、Cargo target 产物与 macOS hdiutil/SetFile/codesign 工具
 * [OUTPUT]: 对外提供仓库级 Tauri 构建入口，并在 macOS DMG 生成后写入、校验自定义卷图标
 * [POS]: scripts 的桌面生产构建编排器；只包装 toolchain 与产物处理，不承载应用业务规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriBinary = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tauri.cmd" : "tauri");
const buildArguments = process.argv.slice(2);
const buildStartedAt = Date.now();

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
  }

  return result;
};

const requestedBundles = () => {
  if (buildArguments.includes("--no-bundle")) {
    return [];
  }

  const bundles = [];
  for (let index = 0; index < buildArguments.length; index += 1) {
    const argument = buildArguments[index];
    if (argument === "--bundles" && buildArguments[index + 1]) {
      bundles.push(...buildArguments[index + 1].split(","));
      index += 1;
    } else if (argument.startsWith("--bundles=")) {
      bundles.push(...argument.slice("--bundles=".length).split(","));
    }
  }

  return bundles.length > 0 ? bundles : ["all"];
};

const findRecentDmgFiles = async () => {
  const configuredTarget = process.env.CARGO_TARGET_DIR;
  const targetRoot = configuredTarget ? path.resolve(repoRoot, configuredTarget) : path.join(repoRoot, "src-tauri", "target");
  const releaseDirectories = [path.join(targetRoot, "release")];

  try {
    const targetEntries = await readdir(targetRoot, { withFileTypes: true });
    for (const entry of targetEntries) {
      if (entry.isDirectory()) {
        releaseDirectories.push(path.join(targetRoot, entry.name, "release"));
      }
    }
  } catch {
    return [];
  }

  const dmgFiles = [];
  for (const releaseDirectory of releaseDirectories) {
    const dmgDirectory = path.join(releaseDirectory, "bundle", "dmg");
    try {
      const entries = await readdir(dmgDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".dmg")) {
          continue;
        }
        const dmgPath = path.join(dmgDirectory, entry.name);
        const metadata = await stat(dmgPath);
        if (metadata.mtimeMs >= buildStartedAt - 2_000) {
          dmgFiles.push(dmgPath);
        }
      }
    } catch {
      // This target did not produce a DMG.
    }
  }

  return dmgFiles;
};

const hashFile = async (filePath) =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");

const setFinderFlag = (flag, target) => {
  const setFileLookup = run("xcrun", ["--find", "SetFile"], {
    allowFailure: true,
    capture: true,
  });
  const setFile = setFileLookup.status === 0 ? setFileLookup.stdout.trim() : null;
  if (setFile) {
    run(setFile, ["-a", flag, target]);
  }
};

const customizeDmgVolumeIcon = async (dmgPath, iconPath) => {
  const signatureCheck = run("codesign", ["--verify", dmgPath], {
    allowFailure: true,
    capture: true,
  });
  if (signatureCheck.status === 0) {
    throw new Error(`Refusing to replace the volume icon in an already signed DMG: ${dmgPath}. The DMG must be customized before signing.`);
  }

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-dmg-icon-"));
  const writableDmg = path.join(temporaryDirectory, "writable.dmg");
  const customizedDmg = path.join(temporaryDirectory, "customized.dmg");
  const stagedDmg = `${dmgPath}.customizing`;
  const mountPoint = path.join(temporaryDirectory, "mounted");
  const verifyMountPoint = path.join(temporaryDirectory, "verified");
  let mounted = false;
  let verifyMounted = false;

  try {
    await mkdir(mountPoint);
    await mkdir(verifyMountPoint);
    run("hdiutil", ["convert", dmgPath, "-format", "UDRW", "-o", writableDmg]);
    run("hdiutil", ["attach", writableDmg, "-readwrite", "-nobrowse", "-noverify", "-mountpoint", mountPoint]);
    mounted = true;

    const mountedIcon = path.join(mountPoint, ".VolumeIcon.icns");
    await copyFile(iconPath, mountedIcon);
    setFinderFlag("V", mountedIcon);
    setFinderFlag("C", mountPoint);
    run("hdiutil", ["detach", mountPoint]);
    mounted = false;

    run("hdiutil", ["convert", writableDmg, "-format", "UDZO", "-imagekey", "zlib-level=9", "-o", customizedDmg]);
    run("hdiutil", ["attach", customizedDmg, "-readonly", "-nobrowse", "-noverify", "-mountpoint", verifyMountPoint]);
    verifyMounted = true;

    const expectedHash = await hashFile(iconPath);
    const bundledHash = await hashFile(path.join(verifyMountPoint, ".VolumeIcon.icns"));
    if (expectedHash !== bundledHash) {
      throw new Error(`DMG volume icon verification failed for ${dmgPath}.`);
    }

    run("hdiutil", ["detach", verifyMountPoint]);
    verifyMounted = false;
    await copyFile(customizedDmg, stagedDmg);
    await rename(stagedDmg, dmgPath);
    process.stdout.write(`Applied custom DMG volume icon: ${dmgPath}\n`);
  } finally {
    if (verifyMounted) {
      run("hdiutil", ["detach", verifyMountPoint], { allowFailure: true, capture: true });
    }
    if (mounted) {
      run("hdiutil", ["detach", mountPoint], { allowFailure: true, capture: true });
    }
    await rm(stagedDmg, { force: true });
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

const buildResult = spawnSync(tauriBinary, ["build", ...buildArguments], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

if (buildResult.error) {
  throw buildResult.error;
}
if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const bundles = requestedBundles();
if (process.platform === "darwin" && bundles.some((bundle) => bundle === "all" || bundle === "dmg")) {
  const dmgIcon = path.join(repoRoot, "src-tauri", "icons", "dmg-volume.icns");
  const dmgFiles = await findRecentDmgFiles();
  for (const dmgFile of dmgFiles) {
    await customizeDmgVolumeIcon(dmgFile, dmgIcon);
  }
}
