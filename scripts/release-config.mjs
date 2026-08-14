/**
 * [INPUT]: 依赖发布版本、Tauri macOS/Windows/Linux bundle 命名和 GitHub Release 约定
 * [OUTPUT]: 对外提供三平台构建矩阵、资产映射、下载 URL 与 updater manifest 校验
 * [POS]: scripts 发布链路的纯配置层；统一原生构建产物、公开资产和 Tauri 静态更新平台键
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

export const RELEASE_REPOSITORY = "GeekMai90/Loby";
export const RELEASE_LATEST_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/latest/download/latest.json`;
export const GITEE_REPOSITORY = "geekmai/Loby-Releases";
export const GITEE_REPOSITORY_BRANCH = "master";
export const GITEE_MIRROR_PLATFORM_IDS = ["darwin-aarch64", "windows-x86_64"];
export const GITEE_RAW_BASE_URL = `https://gitee.com/${GITEE_REPOSITORY}/raw/${GITEE_REPOSITORY_BRANCH}`;

export const RELEASE_PLATFORM_IDS = ["darwin-aarch64", "windows-x86_64", "linux-x86_64"];

const PLATFORM_DEFINITIONS = {
  "darwin-aarch64": {
    id: "darwin-aarch64",
    label: "macOS Apple Silicon",
    hostPlatform: "darwin",
    target: "aarch64-apple-darwin",
    bundles: "app,dmg",
    config: null,
    updaterAssetKey: "darwin-updater",
    signatureAssetKey: "darwin-signature",
    assets: [
      {
        key: "darwin-dmg",
        source: (version) => `dmg/落笔_${version}_aarch64.dmg`,
        name: (version) => `Loby_${version}_aarch64.dmg`,
        contentType: "application/x-apple-diskimage",
        role: "installer",
      },
      {
        key: "darwin-updater",
        source: () => "macos/落笔.app.tar.gz",
        name: (version) => `Loby_${version}_aarch64.app.tar.gz`,
        contentType: "application/gzip",
        role: "updater",
      },
      {
        key: "darwin-signature",
        source: () => "macos/落笔.app.tar.gz.sig",
        name: (version) => `Loby_${version}_aarch64.app.tar.gz.sig`,
        contentType: "application/octet-stream",
        role: "signature",
      },
    ],
  },
  "windows-x86_64": {
    id: "windows-x86_64",
    label: "Windows x64",
    hostPlatform: "win32",
    target: "x86_64-pc-windows-msvc",
    bundles: "nsis",
    config: "src-tauri/tauri.windows.conf.json",
    updaterAssetKey: "windows-nsis",
    signatureAssetKey: "windows-signature",
    assets: [
      {
        key: "windows-nsis",
        source: (version) => `nsis/落笔_${version}_x64-setup.exe`,
        name: (version) => `Loby_${version}_x64-setup.exe`,
        contentType: "application/vnd.microsoft.portable-executable",
        role: "installer-updater",
      },
      {
        key: "windows-signature",
        source: (version) => `nsis/落笔_${version}_x64-setup.exe.sig`,
        name: (version) => `Loby_${version}_x64-setup.exe.sig`,
        contentType: "application/octet-stream",
        role: "signature",
      },
    ],
  },
  "linux-x86_64": {
    id: "linux-x86_64",
    label: "Linux x64 AppImage",
    hostPlatform: "linux",
    target: "x86_64-unknown-linux-gnu",
    bundles: "appimage",
    config: null,
    updaterAssetKey: "linux-appimage",
    signatureAssetKey: "linux-signature",
    assets: [
      {
        key: "linux-appimage",
        source: (version) => `appimage/落笔_${version}_amd64.AppImage`,
        name: (version) => `Loby_${version}_amd64.AppImage`,
        contentType: "application/octet-stream",
        role: "installer-updater",
      },
      {
        key: "linux-signature",
        source: (version) => `appimage/落笔_${version}_amd64.AppImage.sig`,
        name: (version) => `Loby_${version}_amd64.AppImage.sig`,
        contentType: "application/octet-stream",
        role: "signature",
      },
    ],
  },
};

const assertReleaseVersion = (version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`发布版本必须是三段式 SemVer：${version}`);
  }
  return version;
};

const materializePlatform = (definition, version) => ({
  ...definition,
  assets: definition.assets.map((asset) => ({
    ...asset,
    source: asset.source(version),
    name: asset.name(version),
  })),
});

export function getReleasePlatform(platformId, version) {
  assertReleaseVersion(version);
  const definition = PLATFORM_DEFINITIONS[platformId];
  if (!definition) {
    throw new Error(`未知发布平台：${platformId}`);
  }
  return materializePlatform(definition, version);
}

export function getReleaseAssets(version) {
  assertReleaseVersion(version);
  const platforms = Object.fromEntries(RELEASE_PLATFORM_IDS.map((platformId) => [platformId, getReleasePlatform(platformId, version)]));
  const platformAssets = RELEASE_PLATFORM_IDS.flatMap((platformId) => platforms[platformId].assets);

  return {
    version,
    tagName: `v${version}`,
    title: `落笔 ${version}`,
    platforms,
    legacyNames: [`落笔_${version}_aarch64.dmg`, "落笔.app.tar.gz", "落笔.app.tar.gz.sig"],
    published: [
      ...platformAssets,
      {
        key: "latest",
        name: "latest.json",
        contentType: "application/json",
        role: "manifest",
      },
    ],
  };
}

export function getReleaseDownloadUrl(version, assetName) {
  const { tagName } = getReleaseAssets(version);
  return `https://github.com/${RELEASE_REPOSITORY}/releases/download/${tagName}/${encodeURIComponent(assetName)}`;
}

export function getGiteeReleaseDownloadUrl(version, assetName) {
  const { tagName } = getReleaseAssets(version);
  return `https://gitee.com/${GITEE_REPOSITORY}/releases/download/${tagName}/${encodeURIComponent(assetName)}`;
}

export function getGiteeManifestPath(platformId) {
  if (!GITEE_MIRROR_PLATFORM_IDS.includes(platformId)) {
    throw new Error(`Gitee 镜像不支持平台：${platformId}`);
  }
  return `updates/${platformId}/latest.json`;
}

export function getGiteeManifestUrl(platformId) {
  return `${GITEE_RAW_BASE_URL}/${getGiteeManifestPath(platformId)}`;
}

export function getGiteeMirrorAssets(version) {
  const assets = getReleaseAssets(version);
  return GITEE_MIRROR_PLATFORM_IDS.flatMap((platformId) => assets.platforms[platformId].assets);
}

function assertSignature(signature, platformId) {
  if (!signature?.trim()) {
    throw new Error(`${platformId} updater .sig 文件为空，无法生成 latest.json。`);
  }
  if (signature !== signature.trim()) {
    throw new Error(`${platformId} updater .sig 文件包含首尾空白，已停止生成 latest.json 以避免签名被静默改写。`);
  }
}

export function createLatestManifest({ version, signatures, notes, publishedAt }) {
  const assets = getReleaseAssets(version);
  const platforms = {};

  for (const platformId of RELEASE_PLATFORM_IDS) {
    const signature = signatures?.[platformId];
    assertSignature(signature, platformId);
    const platform = assets.platforms[platformId];
    const updaterAsset = platform.assets.find((asset) => asset.key === platform.updaterAssetKey);
    platforms[platformId] = {
      signature,
      url: getReleaseDownloadUrl(version, updaterAsset.name),
    };
  }

  return {
    version,
    notes: notes || `${assets.title}：请查看 Release 说明。`,
    pub_date: publishedAt || new Date().toISOString(),
    platforms,
  };
}

export function assertLatestManifest(manifest, { version, signatures }) {
  const assets = getReleaseAssets(version);
  if (manifest?.version !== version) {
    throw new Error(`latest.json 版本不匹配：期望 ${version}，实际 ${manifest?.version ?? "缺失"}。`);
  }

  for (const platformId of RELEASE_PLATFORM_IDS) {
    const expectedSignature = signatures?.[platformId];
    assertSignature(expectedSignature, platformId);
    const platformManifest = manifest?.platforms?.[platformId];
    const platform = assets.platforms[platformId];
    const updaterAsset = platform.assets.find((asset) => asset.key === platform.updaterAssetKey);
    const expectedUrl = getReleaseDownloadUrl(version, updaterAsset.name);

    if (!platformManifest) {
      throw new Error(`latest.json 缺少 ${platformId} 平台信息。`);
    }
    if (platformManifest.signature !== expectedSignature) {
      throw new Error(`latest.json 中 ${platformId} 的 updater 签名与 .sig 文件不一致。`);
    }
    if (platformManifest.url !== expectedUrl) {
      throw new Error(`latest.json 中 ${platformId} 的 updater URL 不符合发布资产契约：${platformManifest.url ?? "缺失"}`);
    }
  }

  const unexpectedPlatforms = Object.keys(manifest?.platforms ?? {}).filter((platformId) => !RELEASE_PLATFORM_IDS.includes(platformId));
  if (unexpectedPlatforms.length > 0) {
    throw new Error(`latest.json 包含未受发布矩阵管理的平台：${unexpectedPlatforms.join(", ")}`);
  }

  return true;
}

export function createGiteeLatestManifest({ version, signatures, urls, notes, publishedAt }) {
  const assets = getReleaseAssets(version);
  const platforms = {};

  for (const platformId of GITEE_MIRROR_PLATFORM_IDS) {
    const signature = signatures?.[platformId];
    assertSignature(signature, platformId);
    const url = urls?.[platformId];
    if (!url) throw new Error(`Gitee latest.json 缺少 ${platformId} updater URL。`);
    platforms[platformId] = { signature, url };
  }

  return {
    version,
    notes: notes || `${assets.title}：请查看 Release 说明。`,
    pub_date: publishedAt || new Date().toISOString(),
    platforms,
  };
}

export function assertGiteeLatestManifest(manifest, { version, signatures, urls }) {
  if (manifest?.version !== version) {
    throw new Error(`Gitee latest.json 版本不匹配：期望 ${version}，实际 ${manifest?.version ?? "缺失"}。`);
  }

  for (const platformId of GITEE_MIRROR_PLATFORM_IDS) {
    const platformManifest = manifest?.platforms?.[platformId];
    const expectedSignature = signatures?.[platformId];
    assertSignature(expectedSignature, platformId);
    if (!platformManifest) throw new Error(`Gitee latest.json 缺少 ${platformId} 平台信息。`);
    if (platformManifest.signature !== expectedSignature) {
      throw new Error(`Gitee latest.json 中 ${platformId} 的 updater 签名不一致。`);
    }
    if (platformManifest.url !== urls?.[platformId]) {
      throw new Error(`Gitee latest.json 中 ${platformId} 的 updater URL 不一致。`);
    }
  }

  const unexpectedPlatforms = Object.keys(manifest?.platforms ?? {}).filter(
    (platformId) => !GITEE_MIRROR_PLATFORM_IDS.includes(platformId),
  );
  if (unexpectedPlatforms.length > 0) {
    throw new Error(`Gitee latest.json 包含未镜像的平台：${unexpectedPlatforms.join(", ")}`);
  }

  return true;
}

export function getPublishedAsset(version, key) {
  const asset = getReleaseAssets(version).published.find((candidate) => candidate.key === key);
  if (!asset) {
    throw new Error(`未知发布资产：${key}`);
  }
  return asset;
}
