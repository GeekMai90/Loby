/**
 * [INPUT]: 依赖 Vitest 与发布进度映射
 * [OUTPUT]: 验证墨问、GitHub 博客、GitHub 文档站与微信公众号草稿的真实阶段映射为稳定百分比和用户文案
 * [POS]: publishing model 的跨渠道进度回归测试，防止阶段新增后进度倒退或显示虚假完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  githubProgressPresentation,
  helpCenterProgressPresentation,
  mowenProgressPresentation,
  wechatDraftProgressPresentation,
} from "@/features/publishing/model/progress";

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

describe("helpCenterProgressPresentation", () => {
  it("maps document synchronization milestones to the shared GitHub progress geometry", () => {
    expect(helpCenterProgressPresentation({ stage: "checkingAuthorization" })).toEqual({
      value: 8,
      label: "正在检查 GitHub 连接与仓库权限…",
    });
    expect(helpCenterProgressPresentation({ stage: "preparing" })).toEqual({
      value: 14,
      label: "正在读取远端同步清单…",
    });
    expect(helpCenterProgressPresentation({ stage: "packaging", completed: 1, total: 2 })).toEqual({
      value: 50,
      label: "正在整理文稿与图片 2/2…",
    });
    expect(helpCenterProgressPresentation({ stage: "committing" })).toEqual({
      value: 86,
      label: "正在提交到 GitHub…",
    });
    expect(helpCenterProgressPresentation({ stage: "finished" })).toEqual({ value: 100, label: "GitHub 提交完成" });
  });
});

describe("wechatDraftProgressPresentation", () => {
  it("maps WeChat connection, images, cover and draft milestones to stable progress states", () => {
    expect(wechatDraftProgressPresentation({ stage: "checkingConnection" })).toEqual({
      value: 8,
      label: "正在检查微信公众号连接与 IP 白名单…",
    });
    expect(wechatDraftProgressPresentation({ stage: "uploadingImages", completed: 1, total: 2 })).toEqual({
      value: 46,
      label: "正在上传正文图片 1/2…",
    });
    expect(wechatDraftProgressPresentation({ stage: "uploadingCover" })).toEqual({
      value: 76,
      label: "正在上传正文第一张图片作为封面…",
    });
    expect(wechatDraftProgressPresentation({ stage: "creating" })).toEqual({ value: 88, label: "正在创建公众号草稿…" });
    expect(wechatDraftProgressPresentation({ stage: "updating" })).toEqual({ value: 88, label: "正在更新公众号草稿…" });
    expect(wechatDraftProgressPresentation({ stage: "finished" })).toEqual({ value: 100, label: "公众号草稿已保存" });
  });
});
