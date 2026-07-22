/**
 * [INPUT]: 依赖 发布模块
 * [OUTPUT]: 对外提供 MowenProgressPresentation、mowenProgressPresentation
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { MowenPublishProgress } from "@/features/publishing/model/api";

export interface MowenProgressPresentation {
  value: number;
  label: string;
}

export function mowenProgressPresentation(progress: MowenPublishProgress): MowenProgressPresentation {
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
