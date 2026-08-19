/**
 * [INPUT]: 依赖 Vitest/Vite config、renderer @ 路径别名与 src 下的聚焦测试文件
 * [OUTPUT]: 对外提供 Node 默认测试环境、React act 测试初始化、`.test.ts`/`.test.tsx` 发现规则与路径解析配置
 * [POS]: 根级前端测试配置，保持测试导入边界与生产 renderer 一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: [path.resolve(rootDirectory, "src/testSetup.ts")],
  },
});
