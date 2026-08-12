/**
 * [INPUT]: 依赖三平台构建收据、CHANGELOG、源码版本/tag 边界和当前 GitHub 仓库写入凭证
 * [OUTPUT]: 对外提供三平台资产汇总、latest.json 生成、同仓库幂等上传与匿名验收入口
 * [POS]: scripts 发布链路的最终汇总器；不执行原生构建，只在完整矩阵通过后原子推进源码仓库 Release
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  RELEASE_LATEST_URL,
  RELEASE_PLATFORM_IDS,
  RELEASE_REPOSITORY,
  assertLatestManifest,
  createLatestManifest,
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
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();
    throw new Error(`命令失败（${result.status}）：${command} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
  }
  return result;
};

const capture = (command, args, options = {}) => run(command, args, { ...options, capture: true }).stdout.trim();
const hashBuffer = (buffer) => createHash("sha256").update(buffer).digest("hex");
const hashFile = async (filePath) => hashBuffer(await readFile(filePath));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

const parseArguments = (args) => {
  const options = { dryRun: false, version: null, artifactsDirectory: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--version" && args[index + 1]) {
      options.version = args[++index];
    } else if (argument === "--artifacts-dir" && args[index + 1]) {
      options.artifactsDirectory = args[++index];
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }
  return options;
};

const printUsage = () => {
  console.log("用法：npm run release:publish -- --version <version> --artifacts-dir <directory> [--dry-run]");
  console.log("说明：汇总器只接收三个原生 runner 生成的资产与收据，不在当前宿主重复构建。");
};

const assertCleanWorktree = () => {
  const status = capture("git", ["status", "--porcelain"]);
  if (status) throw new Error(`当前工作树不是干净状态，发布前请先提交所有修改：\n${status}`);
};

const assertTagBoundary = (version) => {
  const head = capture("git", ["rev-parse", "HEAD"]);
  const tagName = `v${version}`;
  const tagHead = capture("git", ["rev-list", "-n", "1", `refs/tags/${tagName}`], { allowFailure: true });
  if (!tagHead || tagHead !== head) {
    throw new Error(`标签 ${tagName} 不存在或没有指向当前 HEAD。`);
  }
  const branch = capture("git", ["branch", "--show-current"]);
  if (branch && branch !== "main") {
    throw new Error(`正式发布只允许 main 或 CI 的 detached tag checkout，当前分支是 ${branch}。`);
  }
  const onMain = run("git", ["merge-base", "--is-ancestor", head, "refs/remotes/origin/main"], {
    capture: true,
    allowFailure: true,
  });
  if (onMain.status !== 0) throw new Error(`${tagName} 对应提交不在 origin/main 上，拒绝发布。`);
};

const readReleaseNotes = async (version) => {
  const lines = (await readFile(changelogPath, "utf8")).split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(version)}(?:\\s|$)`);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start < 0) throw new Error(`CHANGELOG.md 没有 ${version} 的版本章节。`);
  const nextHeading = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  const notes = lines
    .slice(start + 1, nextHeading < 0 ? lines.length : nextHeading)
    .join("\n")
    .trim();
  if (!notes) throw new Error(`CHANGELOG.md 的 ${version} 章节为空。`);
  return notes;
};

const findReceiptFiles = async (directory) => {
  const results = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await findReceiptFiles(candidate)));
    if (entry.isFile() && /^release-receipt-.+\.json$/.test(entry.name)) results.push(candidate);
  }
  return results;
};

const collectReleaseArtifacts = async ({ version, artifactsDirectory }) => {
  const assets = getReleaseAssets(version);
  const root = path.resolve(repoRoot, artifactsDirectory);
  const receiptFiles = await findReceiptFiles(root);
  if (receiptFiles.length !== RELEASE_PLATFORM_IDS.length) {
    throw new Error(`发布矩阵必须恰好包含 ${RELEASE_PLATFORM_IDS.length} 份平台收据，实际 ${receiptFiles.length} 份。`);
  }

  const signatures = {};
  const localPaths = {};
  const checksums = {};
  const seenPlatforms = new Set();
  for (const receiptPath of receiptFiles) {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    if (receipt.schemaVersion !== 1 || receipt.version !== version || !RELEASE_PLATFORM_IDS.includes(receipt.platformId)) {
      throw new Error(`平台收据版本或结构无效：${receiptPath}`);
    }
    if (seenPlatforms.has(receipt.platformId)) throw new Error(`平台收据重复：${receipt.platformId}`);
    seenPlatforms.add(receipt.platformId);

    const platform = assets.platforms[receipt.platformId];
    if (receipt.target !== platform.target || receipt.updaterAssetKey !== platform.updaterAssetKey) {
      throw new Error(`${receipt.platformId} 收据的构建目标或 updater 契约不匹配。`);
    }
    if (receipt.signatureAssetKey !== platform.signatureAssetKey || receipt.assets?.length !== platform.assets.length) {
      throw new Error(`${receipt.platformId} 收据的签名或资产数量不匹配。`);
    }

    for (const expected of platform.assets) {
      const recorded = receipt.assets.find(({ key }) => key === expected.key);
      if (
        !recorded ||
        recorded.name !== expected.name ||
        recorded.contentType !== expected.contentType ||
        recorded.role !== expected.role
      ) {
        throw new Error(`${receipt.platformId} 收据中的 ${expected.key} 资产契约不匹配。`);
      }
      if (path.basename(recorded.name) !== recorded.name) throw new Error(`发布资产名不能包含路径：${recorded.name}`);
      const localPath = path.join(path.dirname(receiptPath), recorded.name);
      const metadata = await stat(localPath);
      const digest = await hashFile(localPath);
      if (!metadata.isFile() || metadata.size !== recorded.size || digest !== recorded.sha256) {
        throw new Error(`${receipt.platformId} 资产与收据哈希不一致：${recorded.name}`);
      }
      if (localPaths[expected.key]) throw new Error(`发布资产 key 重复：${expected.key}`);
      localPaths[expected.key] = localPath;
      checksums[expected.name] = digest;
    }

    const signatureAsset = platform.assets.find(({ key }) => key === platform.signatureAssetKey);
    signatures[receipt.platformId] = await readFile(localPaths[signatureAsset.key], "utf8");
  }

  for (const platformId of RELEASE_PLATFORM_IDS) {
    if (!seenPlatforms.has(platformId)) throw new Error(`发布矩阵缺少平台：${platformId}`);
  }
  return { assets, checksums, localPaths, signatures };
};

const prepareRelease = async ({ version, artifactsDirectory, notes }) => {
  const prepared = await collectReleaseArtifacts({ version, artifactsDirectory });
  const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-release-manifest-"));
  try {
    const manifest = createLatestManifest({ version, signatures: prepared.signatures, notes });
    assertLatestManifest(manifest, { version, signatures: prepared.signatures });
    const manifestPath = path.join(stagingDirectory, "latest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    prepared.localPaths.latest = manifestPath;
    prepared.checksums["latest.json"] = await hashFile(manifestPath);
    return { ...prepared, manifest, stagingDirectory };
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
};

const request = (...args) => globalThis.fetch(...args);
const githubRequest = async (token, endpoint, options = {}) => {
  const url = endpoint.startsWith("http") ? endpoint : `${apiRoot}${endpoint}`;
  const expectedStatuses = new Set(options.expectedStatuses ?? []);
  const requestOptions = { ...options };
  delete requestOptions.expectedStatuses;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
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
        await delay(retryDelays[attempt]);
        continue;
      }
      throw new Error(`GitHub API 网络请求失败：${error.message}`, { cause: error });
    }
    const responseText = await response.text();
    if (response.ok) return responseText ? JSON.parse(responseText) : null;
    if (expectedStatuses.has(response.status)) return null;
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await delay(retryDelays[attempt]);
      continue;
    }
    throw new Error(`GitHub API ${response.status} ${response.statusText}：${responseText.slice(0, 500)}`);
  }
  throw new Error(`GitHub API 请求失败：${endpoint}`);
};

const fetchPublic = async (url) => {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let response;
    try {
      response = await request(url, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", "User-Agent": userAgent },
      });
    } catch (error) {
      if (attempt < retryDelays.length) {
        await delay(retryDelays[attempt]);
        continue;
      }
      throw new Error(`公开下载网络请求失败：${error.message}`, { cause: error });
    }
    if (response.ok) return response;
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await delay(retryDelays[attempt]);
      continue;
    }
    throw new Error(`公开下载失败 ${response.status} ${response.statusText}：${url}`);
  }
  throw new Error(`公开下载失败：${url}`);
};

const getGitHubToken = () => {
  if (process.env.GITHUB_TOKEN?.trim()) return process.env.GITHUB_TOKEN.trim();
  const result = run("gh", ["auth", "token"], { capture: true, allowFailure: true });
  const token = result.status === 0 ? result.stdout.trim() : "";
  if (!token) throw new Error("缺少 GITHUB_TOKEN，且本机没有可用的 gh 登录态。");
  return token;
};

const listReleaseAssets = (token, releaseId) => githubRequest(token, `/releases/${releaseId}/assets?per_page=100`);
const deleteReleaseAsset = async (token, asset) => {
  await githubRequest(token, `/releases/assets/${asset.id}`, { method: "DELETE", expectedStatuses: [404] });
  console.log(`已移除旧资产：${asset.name}`);
};

const uploadReleaseAsset = async (token, release, asset, localPath, digest) => {
  let remoteAssets = await listReleaseAssets(token, release.id);
  let existing = remoteAssets.find(({ name }) => name === asset.name);
  if (existing?.digest === `sha256:${digest}`) {
    console.log(`远端资产内容一致，跳过：${asset.name}`);
    return existing;
  }
  if (existing) await deleteReleaseAsset(token, existing);
  const body = await readFile(localPath);
  const uploadUrl = `${release.upload_url.replace(/\{.*$/, "")}?name=${encodeURIComponent(asset.name)}`;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
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
      existing = remoteAssets.find(({ name }) => name === asset.name);
      if (existing?.digest === `sha256:${digest}`) return existing;
      if (attempt < retryDelays.length) {
        await delay(retryDelays[attempt]);
        continue;
      }
      throw new Error(`上传 ${asset.name} 网络请求失败：${error.message}`, { cause: error });
    }
    if (response.ok) {
      const uploaded = await response.json();
      if (uploaded.digest && uploaded.digest !== `sha256:${digest}`) {
        throw new Error(`${asset.name} 远端 digest 不一致。`);
      }
      console.log(`已上传资产：${asset.name}`);
      return uploaded;
    }

    remoteAssets = await listReleaseAssets(token, release.id);
    existing = remoteAssets.find(({ name }) => name === asset.name);
    if (existing?.digest === `sha256:${digest}`) return existing;
    if (existing) await deleteReleaseAsset(token, existing);
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await delay(retryDelays[attempt]);
      continue;
    }
    const responseText = await response.text();
    throw new Error(`上传 ${asset.name} 失败 ${response.status}：${responseText.slice(0, 500)}`);
  }
  throw new Error(`上传 ${asset.name} 失败。`);
};

const getOrCreateRelease = async (token, assets, notes) => {
  let release = await githubRequest(token, `/releases/tags/${assets.tagName}`, { expectedStatuses: [404] });
  if (!release) {
    const releases = await githubRequest(token, "/releases?per_page=100");
    release = releases.find(({ tag_name: tagName }) => tagName === assets.tagName) ?? null;
  }
  if (release) {
    release = await githubRequest(token, `/releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: assets.title, body: notes, prerelease: false }),
    });
    return { release, createdAsDraft: release.draft };
  }
  release = await githubRequest(token, "/releases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag_name: assets.tagName,
      name: assets.title,
      body: notes,
      draft: true,
      prerelease: false,
      target_commitish: "main",
    }),
  });
  console.log(`已创建草稿 Release：${assets.tagName}`);
  return { release, createdAsDraft: true };
};

const publishDraft = (token, release) =>
  githubRequest(token, `/releases/${release.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft: false }),
  });

const verifyPublicLatest = async (prepared) => {
  let lastError;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetchPublic(`${RELEASE_LATEST_URL}?loby_check=${Date.now()}-${attempt}`);
      const latest = JSON.parse(await response.text());
      assertLatestManifest(latest, { version: prepared.assets.version, signatures: prepared.signatures });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
    }
  }
  throw new Error(`公开 latest.json 验收失败：${lastError?.message ?? "未知错误"}`);
};

const verifyPublicAsset = async (prepared, asset) => {
  const url = getReleaseDownloadUrl(prepared.assets.version, asset.name);
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetchPublic(`${url}?loby_check=${Date.now()}-${attempt}`);
    const digest = hashBuffer(Buffer.from(await response.arrayBuffer()));
    if (digest === prepared.checksums[asset.name]) {
      console.log(`已匿名验收：${asset.name}`);
      return;
    }
    if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
  }
  throw new Error(`匿名下载内容不一致：${asset.name}`);
};

const verifyRemoteRelease = async ({ token, release, prepared }) => {
  const remoteAssets = await listReleaseAssets(token, release.id);
  for (const asset of prepared.assets.published) {
    const remote = remoteAssets.find(({ name }) => name === asset.name);
    if (!remote) throw new Error(`GitHub Release 缺少资产：${asset.name}`);
    if (remote.digest && remote.digest !== `sha256:${prepared.checksums[asset.name]}`) {
      throw new Error(`GitHub Release 资产 digest 不一致：${asset.name}`);
    }
  }

  await verifyPublicLatest(prepared);
  for (const asset of prepared.assets.published) {
    await verifyPublicAsset(prepared, asset);
  }
};

const publishPreparedRelease = async (prepared, notes) => {
  const token = getGitHubToken();
  const { release: initialRelease, createdAsDraft } = await getOrCreateRelease(token, prepared.assets, notes);
  let release = initialRelease;
  const remoteAssets = await listReleaseAssets(token, release.id);
  for (const legacyName of prepared.assets.legacyNames) {
    const legacy = remoteAssets.find(({ name }) => name === legacyName);
    if (legacy) await deleteReleaseAsset(token, legacy);
  }
  for (const asset of prepared.assets.published.filter(({ key }) => key !== "latest")) {
    await uploadReleaseAsset(token, release, asset, prepared.localPaths[asset.key], prepared.checksums[asset.name]);
  }
  const latestAsset = prepared.assets.published.find(({ key }) => key === "latest");
  await uploadReleaseAsset(token, release, latestAsset, prepared.localPaths.latest, prepared.checksums[latestAsset.name]);
  if (createdAsDraft) release = await publishDraft(token, release);
  await verifyRemoteRelease({ token, release, prepared });
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printUsage();
  if (!options.version || !options.artifactsDirectory) {
    throw new Error("必须显式传入 --version 和 --artifacts-dir。");
  }
  const currentVersion = JSON.parse(await readFile(packagePath, "utf8")).version;
  if (currentVersion !== options.version) {
    throw new Error(`package.json 当前版本是 ${currentVersion}，与 --version ${options.version} 不一致。`);
  }
  assertCleanWorktree();
  if (!options.dryRun) assertTagBoundary(options.version);
  const notes = await readReleaseNotes(options.version);
  const prepared = await prepareRelease({
    version: options.version,
    artifactsDirectory: options.artifactsDirectory,
    notes,
  });
  try {
    console.log(`三平台发布矩阵校验完成：${RELEASE_PLATFORM_IDS.join(", ")}`);
    if (options.dryRun) {
      console.log("发布汇总预演完成：没有写入 GitHub。");
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

export { collectReleaseArtifacts, parseArguments, readReleaseNotes };
