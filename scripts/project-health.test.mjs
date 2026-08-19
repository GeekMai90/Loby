/**
 * [INPUT]: 依赖 Node.js test/fs、临时 Git 工作区与 project-health 导出的纯统计/渲染函数
 * [OUTPUT]: 验证统计纳入未跟踪未忽略文件、跳过删除/忽略文件，并锁定无末尾换行与阈值等号边界
 * [POS]: scripts 工程体检统计层的聚焦回归测试，断言结构化结果而非控制台文案，防止工作区统计退化为 tracked-only 或 off-by-one
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectHealthReport, REVIEW_LINE_THRESHOLD, SEVERE_LINE_THRESHOLD } from "./project-health.mjs";

function withTemporaryWorktree(run) {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "loby-project-health-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: worktree });
    return run(worktree);
  } finally {
    fs.rmSync(worktree, { recursive: true, force: true });
  }
}

test("counts tracked and untracked worktree sources with inclusive line thresholds", () => {
  const report = withTemporaryWorktree((worktree) => {
    fs.writeFileSync(path.join(worktree, ".gitignore"), "ignored.ts\n");
    // 无末尾换行，正好 500 行：等于阈值必须计入热点
    fs.writeFileSync(path.join(worktree, "tracked.ts"), Array.from({ length: 500 }, (_, index) => `tracked-${index}`).join("\n"));
    fs.writeFileSync(path.join(worktree, "deleted.ts"), "deleted\n");
    execFileSync("git", ["add", ".gitignore", "tracked.ts", "deleted.ts"], { cwd: worktree });
    fs.rmSync(path.join(worktree, "deleted.ts"));

    // 有末尾换行，正好 800 行：不得因换行多算一行
    fs.writeFileSync(
      path.join(worktree, "untracked.ts"),
      `${Array.from({ length: 800 }, (_, index) => `untracked-${index}`).join("\n")}\n`,
    );
    fs.writeFileSync(path.join(worktree, "ignored.ts"), "ignored\n".repeat(900));

    return collectHealthReport(worktree);
  });

  assert.deepEqual(
    report.hotspots.map((row) => [row.file, row.lines]),
    [
      ["untracked.ts", SEVERE_LINE_THRESHOLD],
      ["tracked.ts", REVIEW_LINE_THRESHOLD],
    ],
  );
  assert.deepEqual(
    report.severeHotspots.map((row) => row.file),
    ["untracked.ts"],
  );

  const files = report.rows.map((row) => row.file);
  assert.ok(!files.includes("deleted.ts"), "已从磁盘删除的 tracked 文件不得进入报告");
  assert.ok(!files.includes("ignored.ts"), ".gitignore 命中的文件不得进入报告");
});
