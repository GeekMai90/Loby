/**
 * [INPUT]: 依赖 Node.js test/assert 与 release-config 的多平台发布资产纯函数
 * [OUTPUT]: 对外提供三平台资产命名、updater manifest 和下载 URL 契约的回归证明
 * [POS]: scripts 发布链路的无副作用测试；不执行构建、网络请求或 GitHub 写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  RELEASE_LATEST_URL,
  RELEASE_PLATFORM_IDS,
  RELEASE_REPOSITORY,
  assertLatestManifest,
  createLatestManifest,
  getReleaseAssets,
  getReleaseDownloadUrl,
  getReleasePlatform,
} from "./release-config.mjs";

const signatures = {
  "darwin-aarch64": "darwin-signature",
  "windows-x86_64": "windows-signature",
  "linux-x86_64": "linux-signature",
};

test("publishes releases and updater metadata from the source repository", () => {
  assert.equal(RELEASE_REPOSITORY, "GeekMai90/Loby");
  assert.equal(RELEASE_LATEST_URL, "https://github.com/GeekMai90/Loby/releases/latest/download/latest.json");
});

test("maps native Tauri bundles to canonical public assets", () => {
  const assets = getReleaseAssets("0.4.0");

  assert.deepEqual(RELEASE_PLATFORM_IDS, ["darwin-aarch64", "windows-x86_64", "linux-x86_64"]);
  assert.deepEqual(
    assets.published.map(({ key, name }) => ({ key, name })),
    [
      { key: "darwin-dmg", name: "Loby_0.4.0_aarch64.dmg" },
      { key: "darwin-updater", name: "Loby_0.4.0_aarch64.app.tar.gz" },
      { key: "darwin-signature", name: "Loby_0.4.0_aarch64.app.tar.gz.sig" },
      { key: "windows-nsis", name: "Loby_0.4.0_x64-setup.exe" },
      { key: "windows-signature", name: "Loby_0.4.0_x64-setup.exe.sig" },
      { key: "linux-appimage", name: "Loby_0.4.0_amd64.AppImage" },
      { key: "linux-updater", name: "Loby_0.4.0_amd64.AppImage.tar.gz" },
      { key: "linux-signature", name: "Loby_0.4.0_amd64.AppImage.tar.gz.sig" },
      { key: "latest", name: "latest.json" },
    ],
  );
});

test("defines one native build contract per supported updater platform", () => {
  assert.deepEqual(
    RELEASE_PLATFORM_IDS.map((platformId) => {
      const platform = getReleasePlatform(platformId, "0.4.0");
      return [platform.id, platform.hostPlatform, platform.target, platform.bundles, platform.config];
    }),
    [
      ["darwin-aarch64", "darwin", "aarch64-apple-darwin", "app,dmg", null],
      ["windows-x86_64", "win32", "x86_64-pc-windows-msvc", "nsis", "src-tauri/tauri.windows.conf.json"],
      ["linux-x86_64", "linux", "x86_64-unknown-linux-gnu", "appimage", null],
    ],
  );
});

test("creates a complete three-platform updater manifest", () => {
  const manifest = createLatestManifest({
    version: "0.4.0",
    signatures,
    notes: "多平台发布链路。",
    publishedAt: "2026-08-12T00:00:00.000Z",
  });

  assert.deepEqual(manifest, {
    version: "0.4.0",
    notes: "多平台发布链路。",
    pub_date: "2026-08-12T00:00:00.000Z",
    platforms: {
      "darwin-aarch64": {
        signature: "darwin-signature",
        url: getReleaseDownloadUrl("0.4.0", "Loby_0.4.0_aarch64.app.tar.gz"),
      },
      "windows-x86_64": {
        signature: "windows-signature",
        url: getReleaseDownloadUrl("0.4.0", "Loby_0.4.0_x64-setup.exe"),
      },
      "linux-x86_64": {
        signature: "linux-signature",
        url: getReleaseDownloadUrl("0.4.0", "Loby_0.4.0_amd64.AppImage.tar.gz"),
      },
    },
  });
  assert.equal(assertLatestManifest(manifest, { version: "0.4.0", signatures }), true);
});

test("rejects incomplete, stale or tampered updater manifests", () => {
  const manifest = createLatestManifest({ version: "0.4.0", signatures });

  assert.throws(() => assertLatestManifest({ ...manifest, version: "0.3.9" }, { version: "0.4.0", signatures }), /版本不匹配/);
  assert.throws(
    () =>
      assertLatestManifest(
        { ...manifest, platforms: { ...manifest.platforms, "windows-x86_64": undefined } },
        { version: "0.4.0", signatures },
      ),
    /缺少 windows-x86_64/,
  );
  assert.throws(
    () => assertLatestManifest(manifest, { version: "0.4.0", signatures: { ...signatures, "linux-x86_64": "other" } }),
    /linux-x86_64.*签名/,
  );
});
