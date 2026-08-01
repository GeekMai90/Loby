/**
 * [INPUT]: 依赖 React SSR、Vitest、WritingActivityPanel 与可观测的项目统计边界
 * [OUTPUT]: 验证热力图关闭时不物化项目正文统计
 * [POS]: writing-activity 组件的输入热路径回归边界，防止工具栏隐藏内容拖慢编辑器模型提交
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { WritingProject } from "@/shared/types";
import { WritingActivityPanel } from "@/features/writing-activity/components/WritingActivityPanel";

const getProjectInformation = vi.hoisted(() => vi.fn());

vi.mock("@/features/library/model/projectInformation", () => ({ getProjectInformation }));

describe("WritingActivityPanel", () => {
  beforeEach(() => {
    getProjectInformation.mockReset();
  });

  it("does not scan project bodies while the activity surfaces are closed", () => {
    const html = renderToStaticMarkup(
      React.createElement(WritingActivityPanel, {
        checkIns: [],
        projects: [project()],
      }),
    );

    expect(html).toContain("写作热力图");
    expect(getProjectInformation).not.toHaveBeenCalled();
  });
});

function project(): WritingProject {
  return {
    id: "project-1",
    title: "写作项目",
    status: "构思",
    projectGoal: { enabled: true, unit: "words", target: 1000 },
    sheets: [],
    updatedAt: "2026-08-01 20:00:00",
  };
}
