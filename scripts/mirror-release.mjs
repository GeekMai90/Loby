/**
 * [INPUT]: 依赖已成功 dry-run 的 Actions Run ID、同版本 GitHub Draft Release、GitHub CLI 登录态与本机 Gitee 凭证
 * [OUTPUT]: 对外提供从已校验的 GitHub Draft 下载资产、调用正式发布汇总器完成 Gitee 镜像与 GitHub Release 公开的一键本机入口
 * [POS]: scripts 发布链路的本机接管器；不构建、不重新签名，只把 GitHub-hosted 发布后的 Gitee 阶段迁移到本机网络
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RELEASE_PLATFORM_IDS, RELEASE_REPOSITORY, getReleaseAssets } from "./release-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publishScriptPath = path.join(repoRoot, "scripts", "publish-release.mjs");
const giteeKeychainService = "com.geekmai.loby-release-token";

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
      if (status === 0) {
        resolve();
        return;
      }
      reject(new Error(`命令失败（${status ?? `signal ${signal}`}）：${command} ${args.join(" ")}`));
    });
  });

const capture = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(`命令失败（${result.status}）：${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
  }
  return result.stdout.trim();
};

const captureJson = (command, args) => JSON.parse(capture(command, args));
const hashFile = async (filePath) =>
  createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");

const parseArguments = (args) => {
  const options = { version: null, sourceRunId: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--version" && args[index + 1]) {
      options.version = args[++index];
    } else if (argument === "--source-run-id" && args[index + 1]) {
      options.sourceRunId = args[++index];
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
};

const printUsage = () => {
  console.log("用法：npm run release:mirror -- --version <version> --source-run-id <dry-run-id>");
  console.log("说明：本机从已校验的 GitHub Draft 下载资产，只接管 Gitee 镜像与最终公开，不重复构建或签名。");
};

const getGiteeToken = () => {
  if (process.env.GITEE_RELEASE_TOKEN?.trim()) return process.env.GITEE_RELEASE_TOKEN.trim();
  if (process.platform !== "darwin") {
    throw new Error("缺少 GITEE_RELEASE_TOKEN；自动读取本机 Keychain 仅支持 macOS。");
  }
  const result = spawnSync("security", ["find-generic-password", "-s", giteeKeychainService, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const token = result.status === 0 ? result.stdout.trim() : "";
  if (!token) {
    throw new Error(`缺少 GITEE_RELEASE_TOKEN，且 Keychain 中没有 ${giteeKeychainService}。`);
  }
  return token;
};

const getDraftAssetPattern = (version) => `Loby_${version}_*`;

const getDraftRelease = (version) => {
  const releases = captureJson("gh", ["api", `repos/${RELEASE_REPOSITORY}/releases?per_page=100`]);
  const tagName = `v${version}`;
  const release = releases.find((candidate) => candidate.tag_name === tagName && candidate.draft);
  if (!release) throw new Error(`没有找到 ${tagName} 的 GitHub Draft Release，请先运行正式准备阶段。`);
  return release;
};

const getSourceRun = (sourceRunId) => captureJson("gh", ["api", `repos/${RELEASE_REPOSITORY}/actions/runs/${sourceRunId}`]);

const assertReleaseProvenance = ({ version, sourceRunId, sourceRun, draftRelease }) => {
  const expectedTag = `v${version}`;
  const currentCommit = capture("git", ["rev-parse", "HEAD"]);
  const failures = [];
  if (sourceRun.status !== "completed" || sourceRun.conclusion !== "success") failures.push("来源 dry-run 未成功完成");
  if (sourceRun.event !== "workflow_dispatch") failures.push("来源 Run 不是手动桌面发布流程");
  if (sourceRun.path !== ".github/workflows/desktop-release.yml") failures.push("来源 Run 不是当前桌面发布工作流");
  if (sourceRun.head_sha !== currentCommit) failures.push("来源 Run 提交与当前 tag checkout 不一致");
  if (draftRelease.tag_name !== expectedTag) failures.push(`Draft 标签不是 ${expectedTag}`);
  if (!draftRelease.draft) failures.push("GitHub Release 已公开，不能作为本机接管的 Draft 交接点");
  if (failures.length > 0) throw new Error(`发布来源校验失败：${failures.join("；")}`);
  console.log(`已验证 GitHub Draft ${expectedTag}、dry-run ${sourceRunId} 与源码提交 ${currentCommit}。`);
};

const downloadDraftAssets = async (version, outputDirectory) => {
  await mkdir(outputDirectory);
  await run("gh", [
    "release",
    "download",
    `v${version}`,
    "--repo",
    RELEASE_REPOSITORY,
    "--pattern",
    getDraftAssetPattern(version),
    "--pattern",
    "latest.json",
    "--dir",
    outputDirectory,
  ]);
};

const materializeDraftArtifacts = async ({ version, sourceRunId, sourceRun, draftRelease, downloadDirectory, outputDirectory }) => {
  const assets = getReleaseAssets(version);
  const remoteAssets = new Map((draftRelease.assets ?? []).map((asset) => [asset.name, asset]));
  const expectedAssets = assets.published.filter(({ key }) => key !== "latest");
  const latestAsset = remoteAssets.get("latest.json");
  if (!latestAsset?.digest?.startsWith("sha256:")) {
    throw new Error("GitHub Draft 缺少带 SHA-256 digest 的 latest.json。");
  }
  const latestPath = path.join(downloadDirectory, latestAsset.name);
  const latestMetadata = await stat(latestPath).catch(() => null);
  if (!latestMetadata?.isFile()) throw new Error("GitHub Draft 下载缺少资产：latest.json");
  if (latestMetadata.size !== latestAsset.size || (await hashFile(latestPath)) !== latestAsset.digest.slice("sha256:".length)) {
    throw new Error("GitHub Draft 资产 digest 或大小不一致：latest.json");
  }

  for (const asset of expectedAssets) {
    const remoteAsset = remoteAssets.get(asset.name);
    if (!remoteAsset?.digest?.startsWith("sha256:")) {
      throw new Error(`GitHub Draft 缺少带 SHA-256 digest 的资产：${asset.name}`);
    }
  }

  for (const platformId of RELEASE_PLATFORM_IDS) {
    const platform = assets.platforms[platformId];
    const platformDirectory = path.join(outputDirectory, platformId);
    await mkdir(platformDirectory, { recursive: true });
    const receiptAssets = [];
    for (const asset of platform.assets) {
      const sourcePath = path.join(downloadDirectory, asset.name);
      const destinationPath = path.join(platformDirectory, asset.name);
      let metadata;
      try {
        metadata = await stat(sourcePath);
      } catch {
        throw new Error(`GitHub Draft 下载缺少资产：${asset.name}`);
      }
      if (!metadata.isFile()) throw new Error(`GitHub Draft 下载结果不是文件：${asset.name}`);
      await copyFile(sourcePath, destinationPath);
      const digest = await hashFile(destinationPath);
      const remoteAsset = remoteAssets.get(asset.name);
      if (metadata.size !== remoteAsset.size || digest !== remoteAsset.digest.slice("sha256:".length)) {
        throw new Error(`GitHub Draft 资产 digest 或大小不一致：${asset.name}`);
      }
      receiptAssets.push({
        key: asset.key,
        name: asset.name,
        contentType: asset.contentType,
        role: asset.role,
        size: metadata.size,
        sha256: digest,
      });
    }
    await writeFile(
      path.join(platformDirectory, `release-receipt-${platformId}.json`),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          version,
          sourceCommit: sourceRun.head_sha,
          sourceRunId,
          platformId,
          target: platform.target,
          updaterAssetKey: platform.updaterAssetKey,
          signatureAssetKey: platform.signatureAssetKey,
          builtAt: new Date().toISOString(),
          assets: receiptAssets,
        },
        null,
      )}\n`,
    );
  }
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printUsage();
  if (!options.version || !/^\d+\.\d+\.\d+$/.test(options.version)) {
    throw new Error("必须传入有效的 --version <三段式版本号>。");
  }
  if (!options.sourceRunId || !/^\d+$/.test(options.sourceRunId)) {
    throw new Error("必须传入有效的 --source-run-id <dry-run-id>。");
  }

  const artifactsDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-local-release-"));
  try {
    const sourceRun = getSourceRun(options.sourceRunId);
    const draftRelease = getDraftRelease(options.version);
    assertReleaseProvenance({ version: options.version, sourceRunId: options.sourceRunId, sourceRun, draftRelease });
    const downloadDirectory = path.join(artifactsDirectory, "draft-assets");
    const inputDirectory = path.join(artifactsDirectory, "release-input");
    console.log(`开始从 GitHub Draft 下载 ${options.version} 三平台资产。`);
    await downloadDraftAssets(options.version, downloadDirectory);
    await materializeDraftArtifacts({
      version: options.version,
      sourceRunId: options.sourceRunId,
      sourceRun,
      draftRelease,
      downloadDirectory,
      outputDirectory: inputDirectory,
    });
    const giteeToken = getGiteeToken();
    await run(
      process.execPath,
      [
        publishScriptPath,
        "--version",
        options.version,
        "--artifacts-dir",
        inputDirectory,
        "--source-run-id",
        options.sourceRunId,
        "--mirror-gitee",
      ],
      { env: { ...process.env, GITEE_RELEASE_TOKEN: giteeToken } },
    );
  } finally {
    await rm(artifactsDirectory, { recursive: true, force: true });
  }
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error(`本机接管发布失败：${error.message}`);
    process.exitCode = 1;
  });
}

export { getDraftAssetPattern, parseArguments };
