import { describe, expect, it } from "vitest";
import { mowenProgressPresentation } from "./progress";

describe("mowenProgressPresentation", () => {
  it("maps publishing milestones to stable progress states", () => {
    expect(mowenProgressPresentation({ stage: "preparing" })).toEqual({ value: 14, label: "正在整理文稿…" });
    expect(mowenProgressPresentation({ stage: "uploading", completed: 1, total: 2 })).toEqual({
      value: 50,
      label: "正在上传图片 2/2…",
    });
    expect(mowenProgressPresentation({ stage: "creating" })).toEqual({ value: 86, label: "正在创建墨问笔记…" });
    expect(mowenProgressPresentation({ stage: "finished" })).toEqual({ value: 100, label: "发布完成" });
  });
});
