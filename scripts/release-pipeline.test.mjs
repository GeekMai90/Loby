/**
 * [INPUT]: 依赖 Node.js 临时目录、发布矩阵配置与两层构建/汇总脚本的纯参数和收据校验接口
 * [OUTPUT]: 对外提供三平台收据完整性、哈希防篡改和命令参数契约的回归证明
 * [POS]: scripts 发布流水线测试；以伪造小资产验证发布门禁，不执行 Tauri 构建或网络写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { getTauriBuildInvocation, parseArguments as parseBuildArguments } from "./build-release-platform.mjs";
import { getTauriCliInvocation } from "./build-tauri.mjs";
import { RELEASE_PLATFORM_IDS, getReleaseAssets } from "./release-config.mjs";
import { collectReleaseArtifacts, parseArguments as parsePublishArguments } from "./publish-release.mjs";

const digest = (content) => createHash("sha256").update(content).digest("hex");

const createFixture = async (version) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "loby-release-pipeline-test-"));
  const release = getReleaseAssets(version);
  for (const platformId of RELEASE_PLATFORM_IDS) {
    const platform = release.platforms[platformId];
    const directory = path.join(root, platformId);
    await mkdir(directory);
    const receiptAssets = [];
    for (const asset of platform.assets) {
      const content = asset.role === "signature" ? `${platformId}-signature` : `${platformId}:${asset.key}`;
      await writeFile(path.join(directory, asset.name), content);
      receiptAssets.push({
        key: asset.key,
        name: asset.name,
        contentType: asset.contentType,
        role: asset.role,
        size: Buffer.byteLength(content),
        sha256: digest(content),
      });
    }
    const receipt = {
      schemaVersion: 1,
      version,
      platformId,
      target: platform.target,
      updaterAssetKey: platform.updaterAssetKey,
      signatureAssetKey: platform.signatureAssetKey,
      builtAt: "2026-08-12T00:00:00.000Z",
      assets: receiptAssets,
    };
    await writeFile(path.join(directory, `release-receipt-${platformId}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  }
  return root;
};

test("parses native build and release aggregation arguments", () => {
  assert.deepEqual(parseBuildArguments(["--version", "0.4.0", "--platform", "windows-x86_64", "--output-dir", "release-output"]), {
    version: "0.4.0",
    platform: "windows-x86_64",
    outputDirectory: "release-output",
    help: false,
  });
  assert.deepEqual(parsePublishArguments(["--version", "0.4.0", "--artifacts-dir", "release-input", "--dry-run"]), {
    version: "0.4.0",
    artifactsDirectory: "release-input",
    dryRun: true,
    help: false,
  });
});

test("release builder launches the shared Tauri build entry with the current Node runtime", () => {
  const invocation = getTauriBuildInvocation(["--target", "x86_64-pc-windows-msvc", "--bundles", "nsis"]);
  assert.equal(invocation.command, process.execPath);
  assert.match(invocation.args[0], /scripts[/\\]build-tauri\.mjs$/);
  assert.deepEqual(invocation.args.slice(1), ["--target", "x86_64-pc-windows-msvc", "--bundles", "nsis"]);
});

test("shared build entry launches Tauri CLI through Node instead of a platform shim", () => {
  const invocation = getTauriCliInvocation(["--target", "x86_64-pc-windows-msvc", "--bundles", "nsis"]);
  assert.equal(invocation.command, process.execPath);
  assert.match(invocation.args[0], /@tauri-apps[/\\]cli[/\\]tauri\.js$/);
  assert.deepEqual(invocation.args.slice(1), ["build", "--target", "x86_64-pc-windows-msvc", "--bundles", "nsis"]);
});

test("accepts exactly one verified receipt for every updater platform", async () => {
  const root = await createFixture("0.4.0");
  try {
    const prepared = await collectReleaseArtifacts({ version: "0.4.0", artifactsDirectory: root });
    assert.deepEqual(Object.keys(prepared.signatures).sort(), [...RELEASE_PLATFORM_IDS].sort());
    assert.equal(prepared.signatures["windows-x86_64"], "windows-x86_64-signature");
    assert.equal(Object.keys(prepared.localPaths).length, 7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a platform asset changed after its build receipt was written", async () => {
  const root = await createFixture("0.4.0");
  try {
    const release = getReleaseAssets("0.4.0");
    const windowsInstaller = release.platforms["windows-x86_64"].assets.find(({ key }) => key === "windows-nsis");
    await writeFile(path.join(root, "windows-x86_64", windowsInstaller.name), "tampered");
    await assert.rejects(collectReleaseArtifacts({ version: "0.4.0", artifactsDirectory: root }), /windows-x86_64 资产与收据哈希不一致/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an incomplete release matrix", async () => {
  const root = await createFixture("0.4.0");
  try {
    const receipt = path.join(root, "linux-x86_64", "release-receipt-linux-x86_64.json");
    await rm(receipt);
    await assert.rejects(collectReleaseArtifacts({ version: "0.4.0", artifactsDirectory: root }), /必须恰好包含 3 份平台收据/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fixture receipt remains plain JSON without embedded private material", async () => {
  const root = await createFixture("0.4.0");
  try {
    const receipt = JSON.parse(await readFile(path.join(root, "darwin-aarch64", "release-receipt-darwin-aarch64.json"), "utf8"));
    assert.equal("signature" in receipt, false);
    assert.equal("privateKey" in receipt, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
