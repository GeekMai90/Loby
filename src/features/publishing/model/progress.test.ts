import { describe, expect, it } from "vitest";
import { githubProgressPresentation, mowenProgressPresentation } from "@/features/publishing/model/progress";

describe("mowenProgressPresentation", () => {
  it("maps publishing milestones to stable progress states", () => {
    expect(mowenProgressPresentation({ stage: "preparing" })).toEqual({ value: 14, label: "正在整理文稿…" });
    expect(mowenProgressPresentation({ stage: "uploading", completed: 1, total: 2 })).toEqual({
      value: 50,
      label: "正在上传图片 2/2…",
    });
    expect(mowenProgressPresentation({ stage: "creating" })).toEqual({ value: 86, label: "正在创建墨问笔记…" });
    expect(mowenProgressPresentation({ stage: "settingPrivacy" })).toEqual({ value: 94, label: "正在设为私密笔记…" });
    expect(mowenProgressPresentation({ stage: "finished" })).toEqual({ value: 100, label: "发布完成" });
  });
});

describe("githubProgressPresentation", () => {
  it("maps GitHub milestones and image packaging to stable progress states", () => {
    expect(githubProgressPresentation({ stage: "checkingAuthorization" })).toEqual({
      value: 8,
      label: "正在检查 GitHub 连接与仓库权限…",
    });
    expect(githubProgressPresentation({ stage: "preparing" })).toEqual({ value: 14, label: "正在检查文稿…" });
    expect(githubProgressPresentation({ stage: "packaging", completed: 0, total: 0 })).toEqual({
      value: 32,
      label: "正在生成发布内容…",
    });
    expect(githubProgressPresentation({ stage: "packaging", completed: 1, total: 2 })).toEqual({
      value: 50,
      label: "正在整理图片 2/2…",
    });
    expect(githubProgressPresentation({ stage: "committing" })).toEqual({ value: 86, label: "正在提交到 GitHub…" });
    expect(githubProgressPresentation({ stage: "finished" })).toEqual({ value: 100, label: "GitHub 提交完成" });
  });
});
