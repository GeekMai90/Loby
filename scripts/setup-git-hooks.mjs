import { execFileSync } from "node:child_process";
import { chmod } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const hooks = ["pre-commit", "pre-push"];

try {
  execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "ignore" });
  await Promise.all(hooks.map((hook) => chmod(path.join(root, ".githooks", hook), 0o755)));
  process.stdout.write("Nibva Git hooks enabled from .githooks.\n");
} catch {
  process.stdout.write("Skipped Git hook setup because this directory is not a writable Git checkout.\n");
}
