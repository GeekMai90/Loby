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
    chunkSizeWarningLimit: 1350,
  },
});
