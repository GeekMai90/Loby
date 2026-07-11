import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
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
