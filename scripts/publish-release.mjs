/**
 * [INPUT]: 依赖已同步的应用版本、CHANGELOG、Tauri macOS bundle、仓库外签名环境与 GitHub CLI 登录态
 * [OUTPUT]: 对外提供可预演、可重试且幂等的桌面 Release 构建、资产准备、上传与匿名验收入口
 * [POS]: scripts 的正式桌面发布编排器；把本地门禁、产物命名、updater manifest 和公开 Release 串成一条流水线
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  RELEASE_LATEST_URL,
  RELEASE_REPOSITORY,
  assertLatestManifest,
  createLatestManifest,
  getPublishedAsset,
  getReleaseAssets,
  getReleaseDownloadUrl,
} from "./release-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repoRoot, "package.json");
const changelogPath = path.join(repoRoot, "CHANGELOG.md");
const apiRoot = `https://api.github.com/repos/${RELEASE_REPOSITORY}`;
const userAgent = "Loby-release-pipeline";
const retryDelays = [800, 1_600, 3_200];

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();
    throw new Error(`命令失败（${result.status}）：${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
  }

  return result;
};

const capture = (command, args, options = {}) => run(command, args, { ...options, capture: true }).stdout.trim();

const sleep = (milliseconds) => delay(milliseconds);

const request = (...args) => globalThis.fetch(...args);

const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

const hashBuffer = (buffer) => createHash("sha256").update(buffer).digest("hex");

const hashFile = async (filePath) => hashBuffer(await readFile(filePath));

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseArguments = (args) => {
  const options = { dryRun: false, version: null };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--version" && args[index + 1]) {
      options.version = args[index + 1];
      index += 1;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
};

const printUsage = () => {
  console.log("用法：npm run release:publish -- --version <version> [--dry-run]");
  console.log("说明：dry-run 会执行安装、审计、完整门禁、构建、签名校验和资产准备，但不会写入 GitHub。");
};

const assertCleanWorktree = () => {
  const status = capture("git", ["status", "--porcelain"]);
  if (status) {
    throw new Error(`当前工作树不是干净状态，发布前请先提交所有修改：\n${status}`);
  }
};

const readPackageVersion = async () => JSON.parse(await readFile(packagePath, "utf8")).version;

const readReleaseNotes = async (version) => {
  const lines = (await readFile(changelogPath, "utf8")).split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(version)}(?:\\s|$)`);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) {
    throw new Error(`CHANGELOG.md 没有 ${version} 的版本章节，请先补充发布说明。`);
  }

  const nextHeading = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  const notes = lines
    .slice(start + 1, nextHeading < 0 ? lines.length : nextHeading)
    .join("\n")
    .trim();
  if (!notes) {
    throw new Error(`CHANGELOG.md 的 ${version} 章节为空，请先补充发布说明。`);
  }
  return notes;
};

const assertSigningEnvironment = () => {
  if (!process.env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
    throw new Error("缺少 TAURI_SIGNING_PRIVATE_KEY；请从仓库外的受控环境注入 updater 私钥或私钥文件路径。");
  }
};

const assertTagBoundary = (version) => {
  const branch = capture("git", ["branch", "--show-current"]);
  if (branch !== "main") {
    throw new Error(`正式上传必须从 main 发布，当前分支是 ${branch || "（detached HEAD）"}。先合并版本 PR，再切回 main。`);
  }

  const head = capture("git", ["rev-parse", "HEAD"]);
  const tagName = `v${version}`;
  const tagResult = run("git", ["rev-list", "-n", "1", `refs/tags/${tagName}`], {
    capture: true,
    allowFailure: true,
  });
  if (tagResult.status !== 0 || tagResult.stdout.trim() !== head) {
    throw new Error(`标签 ${tagName} 不存在或没有指向当前 main HEAD；请先创建并推送同版本 tag。`);
  }
};

const resolveTargetRoot = () => {
  const configuredTarget = process.env.CARGO_TARGET_DIR;
  return configuredTarget ? path.resolve(repoRoot, configuredTarget) : path.join(repoRoot, "src-tauri", "target");
};

const findBundleDirectories = async () => {
  const targetRoot = resolveTargetRoot();
  const directories = [path.join(targetRoot, "release", "bundle")];
  try {
    const entries = await readdir(targetRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories.push(path.join(targetRoot, entry.name, "release", "bundle"));
      }
    }
  } catch {
    // 构建未生成 target 目录时，统一在候选路径检查阶段给出错误。
  }
  return [...new Set(directories)];
};

const findFreshArtifact = async (directories, relativePath, buildStartedAt) => {
  for (const directory of directories) {
    const candidate = path.join(directory, relativePath);
    try {
      const metadata = await stat(candidate);
      if (metadata.isFile() && metadata.size > 0 && metadata.mtimeMs >= buildStartedAt - 2_000) {
        return candidate;
      }
    } catch {
      // 继续检查其他 target 目录。
    }
  }

  throw new Error(`没有找到本次构建生成的新资产：${relativePath}。请确认目标平台、签名环境和 bundle 配置正确。`);
};

const findAppBundle = async (rootDirectory) => {
  let entries;
  try {
    entries = await readdir(rootDirectory, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const candidate = path.join(rootDirectory, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      return candidate;
    }
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

const verifyBundleSignatures = async ({ dmgPath, updaterPath, appPath }) => {
  verifyCodesign(appPath, "source .app");

  const verificationDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-release-verify-"));
  const extractedUpdater = path.join(verificationDirectory, "updater");
  const extractedDmg = path.join(verificationDirectory, "dmg");
  await mkdir(extractedUpdater);
  await mkdir(extractedDmg);

  let mounted = false;
  try {
    run("tar", ["-xzf", updaterPath, "-C", extractedUpdater]);
    const updaterApp = await findAppBundle(extractedUpdater);
    if (!updaterApp) {
      throw new Error("updater tar.gz 中没有找到 .app bundle。");
    }
    verifyCodesign(updaterApp, "updater .app");

    run("hdiutil", ["attach", dmgPath, "-readonly", "-nobrowse", "-noverify", "-mountpoint", extractedDmg]);
    mounted = true;
    const dmgApp = await findAppBundle(extractedDmg);
    if (!dmgApp) {
      throw new Error("DMG 中没有找到 .app bundle。");
    }
    verifyCodesign(dmgApp, "DMG 内 .app");
  } finally {
    if (mounted) {
      run("hdiutil", ["detach", extractedDmg], { allowFailure: true, capture: true });
    }
    await rm(verificationDirectory, { recursive: true, force: true });
  }
};

const stageReleaseAssets = async ({ version, notes, buildStartedAt }) => {
  const assets = getReleaseAssets(version);
  const bundleDirectories = await findBundleDirectories();
  const sourcePaths = {
    dmg: await findFreshArtifact(bundleDirectories, path.join("dmg", assets.source.dmg), buildStartedAt),
    updater: await findFreshArtifact(bundleDirectories, path.join("macos", assets.source.updater), buildStartedAt),
    signature: await findFreshArtifact(bundleDirectories, path.join("macos", assets.source.signature), buildStartedAt),
    app: await findFreshArtifact(bundleDirectories, path.join("macos", "落笔.app", "Contents", "Info.plist"), buildStartedAt),
  };
  sourcePaths.app = path.dirname(path.dirname(sourcePaths.app));

  const signature = await readFile(sourcePaths.signature, "utf8");
  const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-release-"));
  const stagedPaths = {};

  try {
    for (const asset of assets.published.filter(({ key }) => key !== "latest")) {
      const destination = path.join(stagingDirectory, asset.name);
      await copyFile(sourcePaths[asset.key], destination);
      stagedPaths[asset.key] = destination;
    }

    const manifest = createLatestManifest({ version, signature, notes });
    assertLatestManifest(manifest, { version, signature });
    const manifestPath = path.join(stagingDirectory, getPublishedAsset(version, "latest").name);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    stagedPaths.latest = manifestPath;

    const checksums = {};
    for (const asset of assets.published) {
      checksums[asset.name] = await hashFile(stagedPaths[asset.key]);
    }
    await verifyBundleSignatures({
      dmgPath: sourcePaths.dmg,
      updaterPath: sourcePaths.updater,
      appPath: sourcePaths.app,
    });

    console.log("已准备公开发布资产：");
    for (const asset of assets.published) {
      console.log(`- ${asset.name} sha256:${checksums[asset.name]}`);
    }
    return { assets, manifest, sourcePaths, stagedPaths, checksums, stagingDirectory };
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
};

const getGitHubToken = () => {
  const token = capture("gh", ["auth", "token"]);
  if (!token) {
    throw new Error("没有读取到 gh 登录态，请先执行 gh auth login。不会把 token 写入仓库或日志。");
  }
  return token;
};

const githubRequest = async (token, endpoint, options = {}) => {
  const url = endpoint.startsWith("http") ? endpoint : `${apiRoot}${endpoint}`;
  const expectedStatuses = new Set(options.expectedStatuses ?? []);
  const requestOptions = { ...options };
  delete requestOptions.expectedStatuses;
  delete requestOptions.retries;

  for (let attempt = 0; attempt < retryDelays.length + 1; attempt += 1) {
    let response;
    try {
      response = await request(url, {
        ...requestOptions,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": userAgent,
          ...(requestOptions.headers ?? {}),
        },
      });
    } catch (error) {
      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      throw new Error(`GitHub API 网络请求失败：${error.message}`, { cause: error });
    }
    const responseText = await response.text();

    if (response.ok) {
      return responseText ? JSON.parse(responseText) : null;
    }
    if (expectedStatuses.has(response.status)) {
      return null;
    }
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await sleep(retryDelays[attempt]);
      continue;
    }

    throw new Error(`GitHub API ${response.status} ${response.statusText}：${responseText.slice(0, 500)}`);
  }

  throw new Error(`GitHub API 请求失败：${endpoint}`);
};

const fetchPublic = async (url, options = {}) => {
  for (let attempt = 0; attempt < retryDelays.length + 1; attempt += 1) {
    let response;
    try {
      response = await request(url, {
        cache: "no-store",
        ...options,
        headers: {
          "Cache-Control": "no-cache",
          "User-Agent": userAgent,
          ...(options.headers ?? {}),
        },
      });
    } catch (error) {
      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      throw new Error(`公开下载网络请求失败：${error.message}`, { cause: error });
    }
    if (response.ok) return response;
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await sleep(retryDelays[attempt]);
      continue;
    }
    throw new Error(`公开下载失败 ${response.status} ${response.statusText}：${url}`);
  }
  throw new Error(`公开下载失败：${url}`);
};

const listReleaseAssets = async (token, releaseId) => githubRequest(token, `/releases/${releaseId}/assets?per_page=100`);

const deleteReleaseAsset = async (token, asset) => {
  await githubRequest(token, `/releases/assets/${asset.id}`, { method: "DELETE", expectedStatuses: [404] });
  console.log(`已移除同名旧资产：${asset.name}`);
};

const uploadReleaseAsset = async (token, release, asset, localPath, expectedDigest) => {
  let remoteAssets = await listReleaseAssets(token, release.id);
  let existing = remoteAssets.find((candidate) => candidate.name === asset.name);
  if (existing?.digest === `sha256:${expectedDigest}`) {
    console.log(`远端资产内容一致，跳过上传：${asset.name}`);
    return existing;
  }
  if (existing) {
    await deleteReleaseAsset(token, existing);
  }

  const body = await readFile(localPath);
  const uploadEndpoint = release.upload_url.replace(/\{.*$/, "");
  const uploadUrl = `${uploadEndpoint}?name=${encodeURIComponent(asset.name)}`;
  for (let attempt = 0; attempt < retryDelays.length + 1; attempt += 1) {
    let response;
    try {
      response = await request(uploadUrl, {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": asset.contentType,
          "User-Agent": userAgent,
        },
        body,
      });
    } catch (error) {
      remoteAssets = await listReleaseAssets(token, release.id);
      existing = remoteAssets.find((candidate) => candidate.name === asset.name);
      if (existing?.digest === `sha256:${expectedDigest}`) {
        console.log(`上传网络响应异常但远端内容已落地，复用现有资产：${asset.name}`);
        return existing;
      }
      if (attempt < retryDelays.length) {
        await sleep(retryDelays[attempt]);
        continue;
      }
      throw new Error(`上传 ${asset.name} 网络请求失败：${error.message}`, { cause: error });
    }

    if (response.ok) {
      const uploaded = await response.json();
      if (uploaded.digest && uploaded.digest !== `sha256:${expectedDigest}`) {
        throw new Error(`GitHub 返回的 ${asset.name} digest 与本地不一致。`);
      }
      console.log(`已上传资产：${asset.name}`);
      return uploaded;
    }

    remoteAssets = await listReleaseAssets(token, release.id);
    existing = remoteAssets.find((candidate) => candidate.name === asset.name);
    if (existing?.digest === `sha256:${expectedDigest}`) {
      console.log(`上传响应异常但远端内容已落地，复用现有资产：${asset.name}`);
      return existing;
    }
    if (existing) {
      await deleteReleaseAsset(token, existing);
    }
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await sleep(retryDelays[attempt]);
      continue;
    }

    const responseText = await response.text();
    throw new Error(`上传 ${asset.name} 失败 ${response.status} ${response.statusText}：${responseText.slice(0, 500)}`);
  }

  throw new Error(`上传 ${asset.name} 失败。`);
};

const getOrCreateRelease = async (token, assets, notes) => {
  let release = await githubRequest(token, `/releases/tags/${assets.tagName}`, { expectedStatuses: [404] });
  if (!release) {
    release = await githubRequest(token, "/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag_name: assets.tagName,
        name: assets.title,
        body: notes,
        draft: false,
        prerelease: false,
        target_commitish: "main",
      }),
    });
    console.log(`已创建 GitHub Release：${assets.tagName}`);
  } else {
    release = await githubRequest(token, `/releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: assets.title,
        body: notes,
        draft: false,
        prerelease: false,
      }),
    });
    console.log(`已复用 GitHub Release：${assets.tagName}`);
  }
  return release;
};

const removeLegacyAssets = async (token, release, assets) => {
  const remoteAssets = await listReleaseAssets(token, release.id);
  for (const legacyName of assets.legacyNames) {
    const legacyAsset = remoteAssets.find((candidate) => candidate.name === legacyName);
    if (legacyAsset) {
      await deleteReleaseAsset(token, legacyAsset);
    }
  }
};

const verifyRemoteRelease = async ({ token, release, prepared }) => {
  const remoteAssets = await listReleaseAssets(token, release.id);
  for (const asset of prepared.assets.published) {
    const remote = remoteAssets.find((candidate) => candidate.name === asset.name);
    if (!remote) {
      throw new Error(`GitHub Release 缺少资产：${asset.name}`);
    }
    if (remote.digest && remote.digest !== `sha256:${prepared.checksums[asset.name]}`) {
      throw new Error(`GitHub Release 资产 digest 不一致：${asset.name}`);
    }
  }

  const latestResponse = await fetchPublic(`${RELEASE_LATEST_URL}?loby_check=${Date.now()}`);
  const latestManifest = JSON.parse(await latestResponse.text());
  assertLatestManifest(latestManifest, {
    version: prepared.assets.version,
    signature: await readFile(prepared.sourcePaths.signature, "utf8"),
  });

  const updaterUrl = latestManifest.platforms["darwin-aarch64"].url;
  const updaterResponse = await fetchPublic(`${updaterUrl}?loby_check=${Date.now()}`);
  const updaterDigest = hashBuffer(Buffer.from(await updaterResponse.arrayBuffer()));
  if (updaterDigest !== prepared.checksums[getPublishedAsset(prepared.assets.version, "updater").name]) {
    throw new Error("匿名下载的 updater 包与本地发布资产不一致。");
  }
  console.log(
    `已匿名验证 latest.json 与 updater 下载：${getReleaseDownloadUrl(prepared.assets.version, getPublishedAsset(prepared.assets.version, "updater").name)}`,
  );
};

const publishPreparedRelease = async (prepared, notes) => {
  const token = getGitHubToken();
  const release = await getOrCreateRelease(token, prepared.assets, notes);
  await removeLegacyAssets(token, release, prepared.assets);
  for (const asset of prepared.assets.published) {
    await uploadReleaseAsset(token, release, asset, prepared.stagedPaths[asset.key], prepared.checksums[asset.name]);
  }
  await verifyRemoteRelease({ token, release, prepared });
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  if (process.platform !== "darwin") {
    throw new Error("当前发布资产只支持 macOS Apple Silicon，必须在 macOS 上执行发布流水线。");
  }
  if (!options.version) {
    throw new Error("必须显式传入 --version，避免把旧构建或错误版本上传到 Release。");
  }

  const version = options.version;
  const currentVersion = await readPackageVersion();
  if (currentVersion !== version) {
    throw new Error(`package.json 当前版本是 ${currentVersion}，与 --version ${version} 不一致。`);
  }
  getReleaseAssets(version);
  assertCleanWorktree();
  if (!options.dryRun) {
    assertTagBoundary(version);
  }
  const notes = await readReleaseNotes(version);
  assertSigningEnvironment();

  console.log(`${options.dryRun ? "开始发布预演" : "开始正式发布"}：落笔 ${version}`);
  const buildStartedAt = Date.now();
  run("npm", ["ci", "--legacy-peer-deps"]);
  run("npm", ["run", "release", "--", "--check"]);
  run("npm", ["run", "check"]);
  run("npm", ["run", "audit:npm"]);
  run("npm", ["run", "build"], {
    env: {
      ...process.env,
      APPLE_SIGNING_IDENTITY: process.env.APPLE_SIGNING_IDENTITY ?? "-",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
    },
  });
  assertCleanWorktree();

  const prepared = await stageReleaseAssets({ version, notes, buildStartedAt });
  try {
    if (options.dryRun) {
      console.log("发布预演完成：没有创建、修改或上传 GitHub Release。");
      return;
    }
    await publishPreparedRelease(prepared, notes);
    console.log(`发布完成：${RELEASE_REPOSITORY} ${prepared.assets.tagName}`);
  } finally {
    await rm(prepared.stagingDirectory, { recursive: true, force: true });
  }
};

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error(`桌面 Release 失败：${error.message}`);
    process.exitCode = 1;
  });
}

export { parseArguments, readReleaseNotes };
