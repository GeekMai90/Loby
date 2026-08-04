/**
 * [INPUT]: 依赖发布版本、Tauri 当前 macOS bundle 命名和 GitHub Release 约定
 * [OUTPUT]: 对外提供发布仓库、资产映射、下载 URL 与 updater manifest 校验
 * [POS]: scripts 发布链路的纯配置层；统一构建产物与公开发布资产之间的命名契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

export const RELEASE_REPOSITORY = "GeekMai90/Loby-Releases";
export const RELEASE_LATEST_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/latest/download/latest.json`;

const DARWIN_PLATFORM = "darwin-aarch64";

const assertReleaseVersion = (version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`发布版本必须是三段式 SemVer：${version}`);
  }
  return version;
};

export function getReleaseAssets(version) {
  assertReleaseVersion(version);

  return {
    version,
    tagName: `v${version}`,
    title: `落笔 ${version}`,
    source: {
      dmg: `落笔_${version}_aarch64.dmg`,
      updater: "落笔.app.tar.gz",
      signature: "落笔.app.tar.gz.sig",
    },
    legacyNames: [`落笔_${version}_aarch64.dmg`, "落笔.app.tar.gz", "落笔.app.tar.gz.sig"],
    published: [
      {
        key: "dmg",
        name: `Loby_${version}_aarch64.dmg`,
        contentType: "application/x-apple-diskimage",
      },
      {
        key: "updater",
        name: `Loby_${version}_aarch64.app.tar.gz`,
        contentType: "application/gzip",
      },
      {
        key: "signature",
        name: `Loby_${version}_aarch64.app.tar.gz.sig`,
        contentType: "application/octet-stream",
      },
      {
        key: "latest",
        name: "latest.json",
        contentType: "application/json",
      },
    ],
  };
}

export function getReleaseDownloadUrl(version, assetName) {
  const { tagName } = getReleaseAssets(version);
  return `https://github.com/${RELEASE_REPOSITORY}/releases/download/${tagName}/${encodeURIComponent(assetName)}`;
}

export function createLatestManifest({ version, signature, notes, publishedAt }) {
  const assets = getReleaseAssets(version);
  if (!signature?.trim()) {
    throw new Error("updater .sig 文件为空，无法生成 latest.json。");
  }
  if (signature !== signature.trim()) {
    throw new Error("updater .sig 文件包含首尾空白，已停止生成 latest.json 以避免签名被静默改写。");
  }

  return {
    version,
    notes: notes || `${assets.title}：请查看 Release 说明。`,
    pub_date: publishedAt || new Date().toISOString(),
    platforms: {
      [DARWIN_PLATFORM]: {
        signature,
        url: getReleaseDownloadUrl(version, assets.published.find((asset) => asset.key === "updater").name),
      },
    },
  };
}

export function assertLatestManifest(manifest, { version, signature }) {
  const assets = getReleaseAssets(version);
  const platform = manifest?.platforms?.[DARWIN_PLATFORM];
  const expectedUrl = getReleaseDownloadUrl(version, assets.published.find((asset) => asset.key === "updater").name);

  if (manifest?.version !== version) {
    throw new Error(`latest.json 版本不匹配：期望 ${version}，实际 ${manifest?.version ?? "缺失"}。`);
  }
  if (!platform) {
    throw new Error(`latest.json 缺少 ${DARWIN_PLATFORM} 平台信息。`);
  }
  if (platform.signature !== signature) {
    throw new Error("latest.json 中的 updater 签名与 .sig 文件不一致。");
  }
  if (platform.url !== expectedUrl) {
    throw new Error(`latest.json updater URL 不符合发布资产契约：${platform.url ?? "缺失"}`);
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
