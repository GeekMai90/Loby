/**
 * [INPUT]: 依赖 Node.js test/assert 与 release-config 的发布资产纯函数
 * [OUTPUT]: 对外提供资产命名、updater manifest 和下载 URL 契约的回归证明
 * [POS]: scripts 发布链路的无副作用测试；不执行构建、网络请求或 GitHub 写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { assertLatestManifest, createLatestManifest, getReleaseAssets, getReleaseDownloadUrl } from "./release-config.mjs";

const signature = "trusted-signature";

test("maps Tauri source names to the canonical public release names", () => {
  const assets = getReleaseAssets("0.3.5");

  assert.deepEqual(assets.source, {
    dmg: "落笔_0.3.5_aarch64.dmg",
    updater: "落笔.app.tar.gz",
    signature: "落笔.app.tar.gz.sig",
  });
  assert.deepEqual(
    assets.published.map(({ key, name }) => ({ key, name })),
    [
      { key: "dmg", name: "Loby_0.3.5_aarch64.dmg" },
      { key: "updater", name: "Loby_0.3.5_aarch64.app.tar.gz" },
      { key: "signature", name: "Loby_0.3.5_aarch64.app.tar.gz.sig" },
      { key: "latest", name: "latest.json" },
    ],
  );
});

test("creates a darwin-aarch64 manifest pointing to the canonical updater asset", () => {
  const manifest = createLatestManifest({
    version: "0.3.5",
    signature,
    notes: "窗口启动与发布链路修复。",
    publishedAt: "2026-08-04T00:00:00.000Z",
  });

  assert.deepEqual(manifest, {
    version: "0.3.5",
    notes: "窗口启动与发布链路修复。",
    pub_date: "2026-08-04T00:00:00.000Z",
    platforms: {
      "darwin-aarch64": {
        signature,
        url: getReleaseDownloadUrl("0.3.5", "Loby_0.3.5_aarch64.app.tar.gz"),
      },
    },
  });
  assert.equal(assertLatestManifest(manifest, { version: "0.3.5", signature }), true);
});

test("rejects a stale or tampered updater manifest", () => {
  const manifest = createLatestManifest({ version: "0.3.5", signature });

  assert.throws(() => assertLatestManifest({ ...manifest, version: "0.3.4" }, { version: "0.3.5", signature }), /版本不匹配/);
  assert.throws(() => assertLatestManifest(manifest, { version: "0.3.5", signature: "other-signature" }), /签名与 \.sig 文件不一致/);
  assert.throws(
    () =>
      assertLatestManifest(
        {
          ...manifest,
          platforms: {
            "darwin-aarch64": { ...manifest.platforms["darwin-aarch64"], url: "https://example.com/old.tar.gz" },
          },
        },
        { version: "0.3.5", signature },
      ),
    /URL 不符合发布资产契约/,
  );
});
