// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WritingProject, WritingSheet } from "../types";
import { DirectPublishDialog } from "./DirectPublishDialog";

const { hasSecretMock, publishMowenMock } = vi.hoisted(() => ({
  hasSecretMock: vi.fn(),
  publishMowenMock: vi.fn(),
}));

vi.mock("../lib/publishing/api", () => ({
  hasPublishingSecret: hasSecretMock,
  isDesktopPublishingAvailable: () => true,
  publishMowenNote: publishMowenMock,
  publishWordPressPost: vi.fn(),
  savePublishingSecret: vi.fn(),
}));

describe("DirectPublishDialog Mowen visibility", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    hasSecretMock.mockResolvedValue(true);
    publishMowenMock.mockResolvedValue({ noteId: "note-1" });
  });

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = null;
    document.body.replaceChildren();
  });

  it("publishes publicly by default", async () => {
    root = await renderDialog();

    expect(selectedVisibilityButton()?.textContent).toBe("公开");
    expect(document.body.textContent).toContain("4 个字符");
    expect(document.body.textContent).toContain("所有人可查看");

    await clickButton("发布");

    expect(publishMowenMock).toHaveBeenCalledWith(expect.objectContaining({ visibility: "public" }), expect.any(Function));
  });

  it("lets the user create a private note", async () => {
    root = await renderDialog();

    await clickButton("私密");

    expect(selectedVisibilityButton()?.textContent).toBe("私密");
    expect(document.body.textContent).toContain("仅自己可见");
    await clickButton("保存私密笔记");

    expect(publishMowenMock).toHaveBeenCalledWith(expect.objectContaining({ visibility: "private" }), expect.any(Function));
    expect(document.body.textContent).toContain("已保存为私密笔记");
  });

  async function renderDialog(): Promise<Root> {
    const container = document.createElement("div");
    document.body.append(container);
    const nextRoot = createRoot(container);
    await act(async () => {
      nextRoot.render(
        createElement(DirectPublishDialog, {
          open: true,
          channel: "mowen",
          project: project(),
          sheet: sheet(),
          libraryPath: "/tmp/loby",
          onClose: vi.fn(),
          onOpenSettings: vi.fn(),
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    return nextRoot;
  }
});

async function clickButton(label: string): Promise<void> {
  const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === label);
  expect(button, `button ${label}`).toBeDefined();
  await act(async () => {
    button?.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function selectedVisibilityButton(): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("[aria-label='墨问笔记可见范围'] button")).find(
    (button) => button.dataset.state === "on",
  );
}

function project(): WritingProject {
  return {
    id: "project-1",
    title: "测试项目",
    description: "",
    status: "构思",
    targetPlatform: "未指定",
    targetWords: 0,
    tags: ["写作"],
    groups: [{ id: "group-1", title: "写作中" }],
    sheets: [sheet()],
    updatedAt: "2026-07-21 20:00:00",
  };
}

function sheet(): WritingSheet {
  return {
    id: "sheet-1",
    groupId: "group-1",
    title: "测试笔记",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "正文内容",
    createdAt: "2026-07-21 19:00:00",
    updatedAt: "2026-07-21 20:00:00",
  };
}
