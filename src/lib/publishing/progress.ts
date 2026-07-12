import type { MowenPublishProgress } from "./api";

export interface MowenProgressPresentation {
  value: number;
  label: string;
}

export function mowenProgressPresentation(progress: MowenPublishProgress): MowenProgressPresentation {
  if (progress.stage === "preparing") return { value: 14, label: "正在整理文稿…" };
  if (progress.stage === "creating") return { value: 86, label: "正在创建墨问笔记…" };
  if (progress.stage === "finished") return { value: 100, label: "发布完成" };
  const ratio = progress.total > 0 ? progress.completed / progress.total : 0;
  return {
    value: Math.round(24 + ratio * 52),
    label: `正在上传图片 ${Math.min(progress.completed + 1, progress.total)}/${progress.total}…`,
  };
}
