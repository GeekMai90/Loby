/**
 * [INPUT]: 依赖 Vitest、Node 文件读取与 assistant-surface.css 原始样式源码
 * [OUTPUT]: 验证 AI 小窗与右侧栏共享不透明背景且小窗不再启用磨玻璃滤镜
 * [POS]: AI inspector 双展示模式的材质回归测试，防止浮动模式重新漂移为透明玻璃
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const assistantSurfaceSource = readFileSync(join(process.cwd(), "src/styles/assistant-surface.css"), "utf8");

describe("assistant surface material", () => {
  it("uses the docked background without backdrop blur in floating mode", () => {
    const ruleStart = assistantSurfaceSource.indexOf(".assistant-surface--floating {");
    const ruleEnd = assistantSurfaceSource.indexOf("}", ruleStart);
    const floatingRule = assistantSurfaceSource.slice(ruleStart, ruleEnd);

    expect(ruleStart).toBeGreaterThanOrEqual(0);
    expect(floatingRule).toContain("background: var(--background)");
    expect(floatingRule).not.toContain("backdrop-filter");
    expect(assistantSurfaceSource).not.toContain("--assistant-floating-bg");
  });
});
