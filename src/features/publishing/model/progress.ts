/**
 * [INPUT]: 依赖 publishing/model/api 的墨问、GitHub 博客、Starlight 与微信草稿进度 DTO
 * [OUTPUT]: 对外提供墨问、GitHub 博客、GitHub 文档站与微信公众号草稿发布进度到稳定百分比/文案的映射
 * [POS]: 跨渠道发布阶段到统一进度视图的纯映射层，不发起网络请求或持有 Dialog 状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type {
  BlogPublishProgress,
  HelpCenterSyncProgress,
  MowenPublishProgress,
  WechatDraftPublishProgress,
} from "@/features/publishing/model/api";

export interface PublishProgressPresentation {
  value: number;
  label: string;
}

export function mowenProgressPresentation(progress: MowenPublishProgress): PublishProgressPresentation {
  if (progress.stage === "preparing") return { value: 14, label: "正在整理文稿…" };
  if (progress.stage === "creating") return { value: 86, label: "正在创建墨问笔记…" };
  if (progress.stage === "settingPrivacy") return { value: 94, label: "正在设为私密笔记…" };
  if (progress.stage === "finished") return { value: 100, label: "发布完成" };
  const ratio = progress.total > 0 ? progress.completed / progress.total : 0;
  return {
    value: Math.round(24 + ratio * 52),
    label: `正在上传图片 ${Math.min(progress.completed + 1, progress.total)}/${progress.total}…`,
  };
}

export function githubProgressPresentation(progress: BlogPublishProgress): PublishProgressPresentation {
  if (progress.stage === "checkingAuthorization") return { value: 8, label: "正在检查 GitHub 连接与仓库权限…" };
  if (progress.stage === "preparing") return { value: 14, label: "正在检查文稿…" };
  if (progress.stage === "committing") return { value: 86, label: "正在提交到 GitHub…" };
  if (progress.stage === "finished") return { value: 100, label: "GitHub 提交完成" };
  if (progress.total === 0) return { value: 32, label: "正在生成发布内容…" };
  const ratio = progress.completed / progress.total;
  return {
    value: Math.round(24 + ratio * 52),
    label: `正在整理图片 ${Math.min(progress.completed + 1, progress.total)}/${progress.total}…`,
  };
}

export function helpCenterProgressPresentation(progress: HelpCenterSyncProgress): PublishProgressPresentation {
  if (progress.stage === "checkingAuthorization") return { value: 8, label: "正在检查 GitHub 连接与仓库权限…" };
  if (progress.stage === "preparing") return { value: 14, label: "正在读取远端同步清单…" };
  if (progress.stage === "committing") return { value: 86, label: "正在提交到 GitHub…" };
  if (progress.stage === "finished") return { value: 100, label: "GitHub 提交完成" };
  if (progress.total === 0) return { value: 32, label: "正在整理文稿…" };
  const ratio = progress.completed / progress.total;
  return {
    value: Math.round(24 + ratio * 52),
    label: `正在整理文稿与图片 ${Math.min(progress.completed + 1, progress.total)}/${progress.total}…`,
  };
}

export function wechatDraftProgressPresentation(progress: WechatDraftPublishProgress): PublishProgressPresentation {
  if (progress.stage === "checkingConnection") return { value: 8, label: "正在检查微信公众号连接与 IP 白名单…" };
  if (progress.stage === "uploadingCover") return { value: 76, label: "正在上传正文第一张图片作为封面…" };
  if (progress.stage === "creating") return { value: 88, label: "正在创建公众号草稿…" };
  if (progress.stage === "updating") return { value: 88, label: "正在更新公众号草稿…" };
  if (progress.stage === "finished") return { value: 100, label: "公众号草稿已保存" };
  if (progress.total === 0) return { value: 24, label: "正在整理正文图片…" };
  const ratio = progress.completed / progress.total;
  return {
    value: Math.round(24 + ratio * 44),
    label: `正在上传正文图片 ${Math.min(Math.max(progress.completed, 1), progress.total)}/${progress.total}…`,
  };
}
