// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 React DOM、Vitest、写作库项目模型与 DocumentPropertyManagerDialog
 * [OUTPUT]: 验证文稿属性管理器的刷新、帮助说明、项目目标默认值编辑和已有文稿保护
 * [POS]: 编辑器文稿属性管理器的交互回归边界，使用普通项目夹具区分收件箱专用设置入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultInboxProject } from "@/features/library/model/projectModel";
import type { WritingProject } from "@/shared/types";
import { DocumentPropertyManagerDialog } from "@/features/editor/components/DocumentPropertyManagerDialog";

describe("DocumentPropertyManagerDialog", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("keeps an existing property editor open when the same project refreshes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const project = projectWithCustomProperty();
    const onClose = vi.fn();
    const onSave = vi.fn();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    await act(async () => {
      root.render(createElement(DocumentPropertyManagerDialog, { open: true, project, onClose, onSave }));
      await Promise.resolve();
    });

    const editButton = document.querySelector<HTMLButtonElement>('button[title="编辑属性"]');
    expect(editButton).not.toBeNull();
    await act(async () => editButton?.click());
    expect(document.body.textContent).toContain("基本设置");
    expect(findInputByValue("阶段")).not.toBeNull();

    await act(async () => {
      root.render(
        createElement(DocumentPropertyManagerDialog, {
          open: true,
          project: { ...project, updatedAt: "2026-07-20 21:00:00" },
          onClose,
          onSave,
        }),
      );
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("基本设置");
    expect(findInputByValue("阶段")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("explains project document properties from the title help button", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    await act(async () => {
      root.render(
        createElement(DocumentPropertyManagerDialog, {
          open: true,
          project: projectWithCustomProperty(),
          onClose: vi.fn(),
          onSave: vi.fn(),
        }),
      );
      await Promise.resolve();
    });

    const helpButton = document.querySelector<HTMLButtonElement>('button[aria-label="了解文稿属性"]');
    expect(helpButton).not.toBeNull();
    expect(document.querySelector("[data-slot='dialog-content']")?.className).toContain("w-[min(700px,calc(100vw-64px))]");
    await act(async () => helpButton?.click());

    expect(document.body.textContent).toContain("什么是文稿属性？");
    expect(document.body.textContent).toContain("当前定义适用于这个项目中的文稿，不属于项目本身的属性");
    expect(document.body.textContent).toContain("这里只设置当前项目中新文稿的默认值");
    expect(document.body.textContent).toContain("保存后会用于新文稿，并补充到已有的空值文稿");
    await act(async () => root.unmount());
  });

  it("edits the project target default without changing existing document targets", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSave = vi.fn();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    await act(async () => {
      root.render(
        createElement(DocumentPropertyManagerDialog, {
          open: true,
          project: projectWithCustomProperty(),
          onClose: vi.fn(),
          onSave,
        }),
      );
      await Promise.resolve();
    });

    const targetButton = document.querySelector<HTMLButtonElement>('button[title="设置目标字数"]');
    expect(targetButton).not.toBeNull();
    await act(async () => targetButton?.click());

    const targetInput = document.querySelector<HTMLInputElement>('input[type="number"]');
    expect(targetInput?.value).toBe("1000");
    await act(async () => {
      if (!targetInput) return;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(targetInput, "1800");
      targetInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => buttonByText("完成")?.click());
    await act(async () => buttonByText("保存")?.click());

    const savedProject = onSave.mock.calls[0]?.[0] as WritingProject | undefined;
    expect(savedProject?.documentPropertyDefinitions?.find((definition) => definition.key === "targetWords")?.defaultValue).toBe(1800);
    expect(savedProject?.sheets[0].targetWords).toBe(700);
    await act(async () => root.unmount());
  });
});

function projectWithCustomProperty(): WritingProject {
  return {
    ...createDefaultInboxProject(),
    id: "project-article",
    title: "文章项目",
    sheets: [
      {
        id: "existing",
        title: "既有文稿",
        groupId: "inbox-default",
        status: "构思",
        tags: [],
        targetWords: 700,
        description: "",
        body: "正文",
        createdAt: "2026-07-20 20:00:00",
        updatedAt: "2026-07-20 20:00:00",
        properties: {},
      },
    ],
    documentPropertyDefinitions: [
      {
        id: "stage",
        key: "阶段",
        label: "阶段",
        type: "select",
        options: [
          { id: "draft", label: "初稿" },
          { id: "done", label: "完成" },
        ],
      },
    ],
  };
}

function buttonByText(label: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === label) ?? null;
}

function findInputByValue(value: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === value) ?? null;
}
