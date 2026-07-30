// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React 测试运行时、项目创建模型与 ProjectDragPreview
 * [OUTPUT]: 验证项目拖拽快照位于页面顶层并以图标中心锚定指针
 * [POS]: library components 的项目排序反馈回归测试，保护 Portal 层级与跟手几何
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectDragPreview } from "@/features/library/components/ProjectDragPreview";
import { createWritingProject } from "@/features/library/model/projectCreation";

describe("ProjectDragPreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("renders above the rail with its icon center on the pointer", async () => {
    const project = createWritingProject({ title: "博客", icon: "book", iconColor: "#007aff" });

    await act(async () => {
      root.render(<ProjectDragPreview project={project} x={300} y={200} />);
    });

    const preview = document.body.querySelector<HTMLElement>(".project-drag-preview");
    expect(preview?.parentElement).toBe(document.body);
    expect(container.querySelector(".project-drag-preview")).toBeNull();
    expect(preview?.style.left).toBe("278px");
    expect(preview?.style.top).toBe("180px");
    expect(preview?.textContent).toContain("博客");
  });
});
