// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest 与 DocumentPropertyManagerDialogHost
 * [OUTPUT]: 验证文稿属性管理 surface 只在打开且存在项目时加载，并保留项目上下文
 * [POS]: editor property surface host 的聚焦回归测试，保护 lazy 迁移不改变打开条件
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject } from "@/shared/types";
import {
  DocumentPropertyManagerDialogHost,
  type DocumentPropertyManagerDialogHostProps,
} from "@/features/editor/components/DocumentPropertyManagerDialogHost";

vi.mock("@/features/editor/components/DocumentPropertyManagerDialog", () => ({
  DocumentPropertyManagerDialog: ({ project }: { project?: WritingProject }) =>
    createElement("div", { "data-testid": "document-property-dialog" }, project?.id ?? "missing"),
}));

const project: WritingProject = {
  id: "project-properties",
  title: "属性项目",
  status: "修改中",
  updatedAt: "2026-01-01T00:00:00.000Z",
  sheets: [],
};

function createProps(overrides: Partial<DocumentPropertyManagerDialogHostProps> = {}): DocumentPropertyManagerDialogHostProps {
  return {
    open: true,
    project,
    onClose: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

describe("DocumentPropertyManagerDialogHost", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.replaceChildren();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderHost(props: DocumentPropertyManagerDialogHostProps) {
    await act(async () => {
      root.render(createElement(DocumentPropertyManagerDialogHost, props));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("does not mount without an open project property surface", async () => {
    await renderHost(createProps({ open: false }));
    expect(document.body.querySelector('[data-testid="document-property-dialog"]')).toBeNull();
  });

  it("passes the selected project to the lazy surface", async () => {
    await renderHost(createProps());
    expect(document.body.querySelector('[data-testid="document-property-dialog"]')?.textContent).toBe("project-properties");
  });
});
