/**
 * [INPUT]: 依赖 Vite、React/Tailwind plugins、renderer 依赖图与本地 Tauri dev server 约定
 * [OUTPUT]: 对外提供开发服务器、@ 路径别名、依赖预构建与生产分包配置
 * [POS]: 根级 renderer 构建配置；连接 Web 工具链，不承载产品运行时状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["@assistant-ui/react", "@assistant-ui/react-markdown"],
  },
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: 1420,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // A stricter raw and gzip limit is enforced by scripts/check-bundle-size.mjs.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/radix-ui/") || id.includes("/node_modules/@radix-ui/")) return "radix-ui";
        },
      },
    },
  },
});
