/**
 * [INPUT]: 依赖 Vitest、Node 文件读取与 ai-thread.css 原始样式源码
 * [OUTPUT]: 验证 AI 消息在 Preflight 下显式恢复标题、表格、围栏代码和任务列表样式
 * [POS]: AI Markdown 视觉契约回归测试，防止 GFM 节点再次退化为无样式文本
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const markdownStyles = readFileSync(join(process.cwd(), "src/styles/ai-thread.css"), "utf8");

describe("assistant Markdown styles", () => {
  it.each([
    ".assistant-markdown h1",
    ".assistant-markdown table",
    ".assistant-markdown th",
    ".assistant-markdown pre code",
    '.assistant-markdown .task-list-item > input[type="checkbox"]',
  ])("restores %s after Tailwind Preflight", (selector) => {
    expect(markdownStyles).toContain(selector);
  });

  it("gives fenced code and tables bounded semantic surfaces", () => {
    const preRule = ruleFor(".assistant-markdown pre");
    const tableRule = ruleFor(".assistant-markdown table");

    expect(preRule).toContain("border: 1px solid var(--border)");
    expect(preRule).toContain("background: var(--background-soft)");
    expect(tableRule).toContain("table-layout: fixed");
    expect(tableRule).toContain("overflow: hidden");
  });
});

function ruleFor(selector: string) {
  const start = markdownStyles.indexOf(`${selector} {`);
  const end = markdownStyles.indexOf("}", start);
  expect(start).toBeGreaterThanOrEqual(0);
  return markdownStyles.slice(start, end);
}
