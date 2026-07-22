import { describe, expect, it } from "vitest";
import type { WritingProject } from "@/shared/types";
import {
  DEFAULT_USER_GROUP_ID,
  INBOX_PROJECT_ID,
  NOTES_PROJECT_ID,
  NOTES_QUICK_GROUP_ID,
  STARTER_PROJECT_ID,
} from "@/features/library/model/projectModel";
import { createSheetMoveMenuModel, isCurrentSheetMoveTarget } from "@/features/library/model/sheetMoveMenu";

describe("sheetMoveMenu", () => {
  it("keeps system destinations separate from project group submenus", () => {
    const model = createSheetMoveMenuModel([
      project(INBOX_PROJECT_ID, "收件箱", [{ id: "inbox", title: "收件箱" }]),
      project(NOTES_PROJECT_ID, "笔记", [
        { id: NOTES_QUICK_GROUP_ID, title: "随手记" },
        { id: "ideas", title: "想法" },
      ]),
      project(STARTER_PROJECT_ID, "落笔指南", [{ id: DEFAULT_USER_GROUP_ID, title: "待整理" }]),
      project("blog", "博客", [
        { id: DEFAULT_USER_GROUP_ID, title: "待整理" },
        { id: "published", title: "已发布" },
      ]),
    ]);

    expect(model.inbox.title).toBe("收件箱");
    expect(model.notes?.groups.map((group) => group.title)).toEqual(["随手记", "想法"]);
    expect(model.projects).toHaveLength(1);
    expect(model.projects.some((project) => project.projectId === STARTER_PROJECT_ID)).toBe(false);
    expect(model.projects[0].title).toBe("博客");
    expect(model.projects[0].groups.map((group) => group.title)).toEqual(["待整理", "已发布"]);
  });

  it("disables a destination only when every selected sheet is already there", () => {
    const target = { projectId: "blog", groupId: "published" };
    expect(isCurrentSheetMoveTarget([{ projectId: "blog", groupId: "published" }], target)).toBe(true);
    expect(
      isCurrentSheetMoveTarget(
        [
          { projectId: "blog", groupId: "published" },
          { projectId: "blog", groupId: DEFAULT_USER_GROUP_ID },
        ],
        target,
      ),
    ).toBe(false);
  });
});

function project(id: string, title: string, groups: WritingProject["groups"]): WritingProject {
  return {
    id,
    title,
    description: "",
    status: "构思",
    targetPlatform: "公众号",
    targetWords: 1000,
    tags: [],
    groups,
    sheets: [],
    updatedAt: "2026-07-19 10:00:00",
  };
}
