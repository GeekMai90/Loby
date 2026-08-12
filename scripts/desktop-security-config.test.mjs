/**
 * [INPUT]: 依赖 Node.js fs/promises、path/url、assert 与 src-tauri/tauri.conf.json
 * [OUTPUT]: 验证 Tauri 主窗口 CSP 为微信公众号预览保留远程图片来源且不放宽脚本来源
 * [POS]: scripts 的桌面安全配置回归测试；只读取配置，不执行构建、网络请求或 GitHub 写入
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "tauri.conf.json");
const config = JSON.parse(await readFile(configPath, "utf8"));

function cspSources(policy, directiveName) {
  const directive = policy
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${directiveName} `));
  return directive?.split(/\s+/).slice(1) ?? [];
}

test("allows remote image schemes without allowing remote scripts", () => {
  const csp = config.app?.security?.csp;
  assert.equal(typeof csp, "string");

  const imageSources = cspSources(csp, "img-src");
  const scriptSources = cspSources(csp, "script-src");

  assert.ok(imageSources.includes("http:"));
  assert.ok(imageSources.includes("https:"));
  assert.deepEqual(scriptSources, ["'self'"]);
});
