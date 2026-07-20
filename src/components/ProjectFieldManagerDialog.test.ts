// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultInboxProject } from "../lib/projectModel";
import type { WritingProject } from "../types";
import { ProjectFieldManagerDialog } from "./ProjectFieldManagerDialog";

describe("ProjectFieldManagerDialog", () => {
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
      root.render(createElement(ProjectFieldManagerDialog, { open: true, project, onClose, onSave }));
      await Promise.resolve();
    });

    const editButton = document.querySelector<HTMLButtonElement>('button[title="编辑属性"]');
    expect(editButton).not.toBeNull();
    await act(async () => editButton?.click());
    expect(document.body.textContent).toContain("基本设置");
    expect(findInputByValue("阶段")).not.toBeNull();

    await act(async () => {
      root.render(
        createElement(ProjectFieldManagerDialog, {
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
        createElement(ProjectFieldManagerDialog, {
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
    expect(document.body.textContent).toContain("每个项目可以设置不同的自定义属性");
    expect(document.body.textContent).toContain("保存后会用于新文稿，并补充到已有的空值文稿");
    await act(async () => root.unmount());
  });
});

function projectWithCustomProperty(): WritingProject {
  return {
    ...createDefaultInboxProject(),
    propertyDefinitions: [
      { id: "tags", key: "tags", label: "标签", type: "tags", locked: true },
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

function findInputByValue(value: string) {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input")).find((input) => input.value === value) ?? null;
}
