/**
 * [INPUT]: 依赖 Node.js test/assert 与 release-version 的纯版本函数
 * [OUTPUT]: 对外提供发布版本类型、SemVer 增量与一致性判断的回归证明
 * [POS]: scripts 发布准备入口的无文件副作用测试；不执行真实版本写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import test from "node:test";
import assert from "node:assert/strict";
import { assertVersionConsistency, incrementVersion, normalizeReleaseType } from "./release-version.mjs";

test("maps Chinese release language to SemVer release types", () => {
  assert.equal(normalizeReleaseType("修订版更新"), "patch");
  assert.equal(normalizeReleaseType("功能版更新"), "minor");
  assert.equal(normalizeReleaseType("重大版更新"), "major");
});

test("increments patch, minor and major versions", () => {
  assert.equal(incrementVersion("0.1.0", "patch"), "0.1.1");
  assert.equal(incrementVersion("0.1.0", "minor"), "0.2.0");
  assert.equal(incrementVersion("0.1.0", "major"), "1.0.0");
});

test("rejects inconsistent application version sources", () => {
  assert.throws(() => assertVersionConsistency({ packageJson: "0.1.0", cargoToml: "0.1.1" }), /应用版本来源不一致/);
});
