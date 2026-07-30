/**
 * [INPUT]: 依赖 ESLint、typescript-eslint、React Hooks/Refresh plugins 与仓库源码边界
 * [OUTPUT]: 对外提供 renderer、构建脚本和配置源码共用的 flat ESLint configuration
 * [POS]: 根级静态分析配置，集中声明忽略范围、运行时 globals 与 React/TypeScript 规则例外
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "src-tauri/target"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "cli/**/*.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts", "vitest.config.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        HTMLTextAreaElement: "readonly",
        KeyboardEvent: "readonly",
        localStorage: "readonly",
        MouseEvent: "readonly",
        Node: "readonly",
        PointerEvent: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}", "src/components/animate-ui/**/*.{ts,tsx}", "src/shared/hooks/use-is-in-view.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
