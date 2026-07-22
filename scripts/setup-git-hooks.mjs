/**
 * [INPUT]: 依赖 Node.js child_process/fs/path、当前 Git worktree 与仓库跟踪的 .githooks
 * [OUTPUT]: 配置 core.hooksPath 并恢复 pre-commit/pre-push 可执行权限；非可写 checkout 安全跳过
 * [POS]: scripts 的本地 Git 治理安装器，由 npm prepare 与手动 setup 命令消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { execFileSync } from "node:child_process";
import { chmod } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const hooks = ["pre-commit", "pre-push"];

try {
  execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
  await Promise.all(hooks.map((hook) => chmod(path.join(root, ".githooks", hook), 0o755)));
  process.stdout.write("Loby Git hooks enabled from .githooks.\n");
} catch {
  process.stdout.write("Skipped Git hook setup because this directory is not a writable Git checkout.\n");
}
