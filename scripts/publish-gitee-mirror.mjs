/**
 * [INPUT]: 依赖已通过 GitHub 发布门禁的三平台资产、Gitee 发布令牌与 macOS/Windows 镜像清单契约
 * [OUTPUT]: 对外提供 Gitee Release 附件同步、平台清单提交、匿名下载验收与 Gitee API 边界归一化入口
 * [POS]: scripts 发布链路的国内镜像适配器；只镜像 macOS/Windows，不改变 GitHub 三平台正式发布事实
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  assertGiteeLatestManifest,
  createGiteeLatestManifest,
  GITEE_MIRROR_PLATFORM_IDS,
  GITEE_REPOSITORY,
  GITEE_REPOSITORY_BRANCH,
  getGiteeReleaseDownloadUrl,
  getGiteeManifestPath,
  getGiteeManifestUrl,
  getGiteeMirrorAssets,
} from "./release-config.mjs";

const [giteeOwner, giteeRepository] = GITEE_REPOSITORY.split("/");
const giteeApiRoot = "https://gitee.com/api/v5";
const giteeBranch = GITEE_REPOSITORY_BRANCH;
const userAgent = "Loby-gitee-release-mirror";
const retryDelays = [800, 1_600, 3_200];
const giteeRequestTimeoutMs = 180_000;
const publicRequestTimeoutMs = 180_000;
const request = (...args) => globalThis.fetch(...args);
const hashBuffer = (buffer) => createHash("sha256").update(buffer).digest("hex");
const hashFile = async (filePath) => hashBuffer(await readFile(filePath));
const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

const attachmentName = (attachment) => attachment.name ?? attachment.file_name ?? attachment.filename;

const giteeRequest = async (token, endpoint, options = {}) => {
  if (!token?.trim()) throw new Error("缺少 GITEE_RELEASE_TOKEN，无法同步国内更新镜像。");
  const url = endpoint.startsWith("http") ? endpoint : `${giteeApiRoot}${endpoint}`;
  const { expectedStatuses = [], retryable = true, timeoutMs = giteeRequestTimeoutMs, ...requestOptions } = options;
  const expectedStatusSet = new Set(expectedStatuses);

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let response;
    try {
      response = await request(url, {
        ...requestOptions,
        signal: globalThis.AbortSignal.timeout(timeoutMs),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
          ...(requestOptions.headers ?? {}),
        },
      });
    } catch (error) {
      const reason = error?.name === "TimeoutError" || error?.name === "AbortError" ? `请求超时（${timeoutMs}ms）` : error.message;
      if (retryable && attempt < retryDelays.length) {
        await delay(retryDelays[attempt]);
        continue;
      }
      throw new Error(`Gitee API 网络请求失败：${reason}`, { cause: error });
    }

    const responseText = await response.text();
    if (response.ok) {
      if (!responseText) return null;
      try {
        return JSON.parse(responseText);
      } catch {
        return responseText;
      }
    }
    if (expectedStatusSet.has(response.status)) return null;
    if (retryable && attempt < retryDelays.length && retryableStatus(response.status)) {
      await delay(retryDelays[attempt]);
      continue;
    }
    throw new Error(`Gitee API ${response.status} ${response.statusText}：${responseText.slice(0, 500)}`);
  }
  throw new Error(`Gitee API 请求失败：${endpoint}`);
};

export const createGiteeReleasePayload = (version, notes) => ({
  tag_name: `v${version}`,
  name: `落笔 ${version}`,
  body: notes,
  prerelease: false,
});

const getOrCreateRelease = async (token, version, notes) => {
  const tagName = `v${version}`;
  const releasePayload = createGiteeReleasePayload(version, notes);
  const releaseEndpoint = `/repos/${giteeOwner}/${giteeRepository}/releases/tags/${encodeURIComponent(tagName)}`;
  let release = await giteeRequest(token, releaseEndpoint, { expectedStatuses: [404] });
  if (release) {
    return giteeRequest(token, `/repos/${giteeOwner}/${giteeRepository}/releases/${release.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(releasePayload),
    });
  }

  return giteeRequest(token, `/repos/${giteeOwner}/${giteeRepository}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...releasePayload,
      target_commitish: giteeBranch,
    }),
  });
};

const listAttachments = (token, releaseId) =>
  giteeRequest(token, `/repos/${giteeOwner}/${giteeRepository}/releases/${releaseId}/attach_files?per_page=100`);

const deleteAttachment = (token, releaseId, attachmentId) =>
  giteeRequest(token, `/repos/${giteeOwner}/${giteeRepository}/releases/${releaseId}/attach_files/${attachmentId}`, {
    method: "DELETE",
    expectedStatuses: [404],
  });

const waitForAttachment = async (token, releaseId, assetName) => {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const attachments = await listAttachments(token, releaseId);
    const matching = attachments.filter((candidate) => attachmentName(candidate) === assetName);
    if (matching.length > 0) return matching.at(-1);
    if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
  }
  return null;
};

const uploadAttachment = async (token, releaseId, asset, localPath, version, expectedDigest) => {
  const existingAttachments = await listAttachments(token, releaseId);
  const existing = existingAttachments.filter((candidate) => attachmentName(candidate) === asset.name);
  if (existing.length > 0) {
    try {
      await verifyPublicAsset(getGiteeReleaseDownloadUrl(version, asset.name), expectedDigest, asset.name);
      console.log(`Gitee 附件内容一致，跳过：${asset.name}`);
      return existing.at(-1);
    } catch {
      for (const attachment of existing) await deleteAttachment(token, releaseId, attachment.id);
    }
  }

  const file = await readFile(localPath);
  let lastError;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const form = new globalThis.FormData();
    form.append("file", new globalThis.Blob([file], { type: asset.contentType }), asset.name);
    try {
      await giteeRequest(token, `/repos/${giteeOwner}/${giteeRepository}/releases/${releaseId}/attach_files`, {
        method: "POST",
        body: form,
        retryable: false,
      });
    } catch (error) {
      lastError = error;
    }

    let attachment;
    try {
      attachment = await waitForAttachment(token, releaseId, asset.name);
    } catch (error) {
      lastError = error;
    }
    if (attachment) {
      console.log(`已同步 Gitee 附件：${asset.name}`);
      return attachment;
    }
    if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
  }
  throw new Error(`Gitee Release 附件上传失败：${asset.name}，${lastError?.message ?? "服务端未返回附件"}`, { cause: lastError });
};

export const normalizeRepositoryFileResponse = (value) => (Array.isArray(value) ? null : value);

const getRepositoryFile = async (token, filePath) => {
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const current = await giteeRequest(
    token,
    `/repos/${giteeOwner}/${giteeRepository}/contents/${encodedPath}?ref=${encodeURIComponent(giteeBranch)}`,
    {
      expectedStatuses: [404],
    },
  );
  return normalizeRepositoryFileResponse(current);
};

const upsertRepositoryFile = async (token, filePath, content, message) => {
  const current = await getRepositoryFile(token, filePath);
  const encodedContent = Buffer.from(content).toString("base64");
  if (current?.content?.replace(/\s/g, "") === encodedContent) {
    console.log(`Gitee 清单内容未变化：${filePath}`);
    return current;
  }

  const body = {
    content: encodedContent,
    message,
    branch: giteeBranch,
    ...(current?.sha ? { sha: current.sha } : {}),
  };
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const method = current ? "PUT" : "POST";
  const result = await giteeRequest(token, `/repos/${giteeOwner}/${giteeRepository}/contents/${encodedPath}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`已更新 Gitee 清单：${filePath}`);
  return result;
};

const fetchPublic = async (url) => {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    let response;
    try {
      response = await request(url, {
        cache: "no-store",
        signal: globalThis.AbortSignal.timeout(publicRequestTimeoutMs),
        headers: { "Cache-Control": "no-cache", "User-Agent": userAgent },
      });
    } catch (error) {
      if (attempt < retryDelays.length) {
        await delay(retryDelays[attempt]);
        continue;
      }
      throw new Error(`Gitee 公开下载网络请求失败：${error.message}`, { cause: error });
    }
    if (response.ok) return response;
    if (attempt < retryDelays.length && retryableStatus(response.status)) {
      await delay(retryDelays[attempt]);
      continue;
    }
    throw new Error(`Gitee 公开下载失败 ${response.status} ${response.statusText}：${url}`);
  }
  throw new Error(`Gitee 公开下载失败：${url}`);
};

const getCacheBustedUrl = (url) => `${url}${url.includes("?") ? "&" : "?"}loby_check=${Date.now()}-${Math.random().toString(36).slice(2)}`;

const verifyPublicAsset = async (url, expectedDigest, assetName) => {
  let lastError;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetchPublic(getCacheBustedUrl(url));
      const digest = hashBuffer(Buffer.from(await response.arrayBuffer()));
      if (digest !== expectedDigest) throw new Error(`Gitee 公开资产内容不一致：${assetName}`);
      console.log(`已匿名验收 Gitee 资产：${assetName}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
    }
  }
  throw new Error(`Gitee 资产验收失败：${assetName}，${lastError?.message ?? "未知错误"}`, { cause: lastError });
};

const verifyPublicManifest = async (version, signatures, urls) => {
  let lastError;
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      for (const platformId of GITEE_MIRROR_PLATFORM_IDS) {
        const response = await fetchPublic(getCacheBustedUrl(getGiteeManifestUrl(platformId)));
        const manifest = JSON.parse(await response.text());
        assertGiteeLatestManifest(manifest, { version, signatures, urls });
      }
      console.log("已匿名验收 Gitee updater 清单。");
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retryDelays.length) await delay(retryDelays[attempt]);
    }
  }
  throw new Error(`Gitee updater 清单验收失败：${lastError?.message ?? "未知错误"}`, { cause: lastError });
};

const getGiteeManifestContent = (manifest) => `${JSON.stringify(manifest, null, 2)}\n`;

export const publishGiteeMirror = async ({ prepared, notes, token }) => {
  const version = prepared.assets.version;
  const release = await getOrCreateRelease(token, version, notes);
  const mirrorAssets = getGiteeMirrorAssets(version);
  const manifestAsset = { name: "latest.json", contentType: "application/json" };

  const urls = Object.fromEntries(
    GITEE_MIRROR_PLATFORM_IDS.map((platformId) => {
      const platform = prepared.assets.platforms[platformId];
      const updaterAsset = platform.assets.find(({ key }) => key === platform.updaterAssetKey);
      return [platformId, getGiteeReleaseDownloadUrl(version, updaterAsset.name)];
    }),
  );
  const giteeManifest = createGiteeLatestManifest({
    version,
    signatures: prepared.signatures,
    urls,
    notes,
  });
  assertGiteeLatestManifest(giteeManifest, { version, signatures: prepared.signatures, urls });

  const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), "loby-gitee-mirror-"));
  const manifestPath = path.join(stagingDirectory, "latest.json");
  await writeFile(manifestPath, getGiteeManifestContent(giteeManifest));
  const manifestDigest = await hashFile(manifestPath);
  try {
    for (const asset of mirrorAssets) {
      await uploadAttachment(token, release.id, asset, prepared.localPaths[asset.key], version, prepared.checksums[asset.name]);
    }
    await uploadAttachment(token, release.id, manifestAsset, manifestPath, version, manifestDigest);

    for (const platformId of GITEE_MIRROR_PLATFORM_IDS) {
      await upsertRepositoryFile(
        token,
        getGiteeManifestPath(platformId),
        getGiteeManifestContent(giteeManifest),
        `chore: update ${platformId} updater manifest for v${version}`,
      );
    }

    for (const asset of mirrorAssets) {
      await verifyPublicAsset(getGiteeReleaseDownloadUrl(version, asset.name), prepared.checksums[asset.name], asset.name);
    }
    await verifyPublicAsset(getGiteeReleaseDownloadUrl(version, manifestAsset.name), manifestDigest, manifestAsset.name);
    await verifyPublicManifest(version, prepared.signatures, urls);
    console.log(`Gitee 镜像发布完成：${GITEE_REPOSITORY} v${version}`);
    return { manifest: giteeManifest, urls };
  } finally {
    await rm(stagingDirectory, { recursive: true, force: true });
  }
};
