/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 PublishChannelId、PublishChannelDefinition、PUBLISH_CHANNELS 与应用级 GitHub 目标渠道工厂
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { publishingTargetActionLabel, publishingTargetName, type PublishingTarget } from "@/features/publishing/model/publishingTargets";

export type PublishChannelId = "wechat" | "wordpress" | "mowen" | "blog" | "docs";

export interface PublishChannelDefinition {
  id: PublishChannelId;
  label: string;
  description: string;
  targetId?: string;
}

export const PUBLISH_CHANNELS: PublishChannelDefinition[] = [
  { id: "wechat", label: "微信公众号", description: "选择主题、预览排版并复制到公众号" },
  { id: "wordpress", label: "WordPress 博客", description: "发布为博客草稿或正式文章" },
  { id: "mowen", label: "墨问笔记", description: "创建墨问草稿或公开发布" },
];

export function githubPublishChannel(target: PublishingTarget): PublishChannelDefinition {
  return {
    id: target.kind === "githubHugoBlog" ? "blog" : "docs",
    label: publishingTargetActionLabel(target),
    description: `发布到“${publishingTargetName(target)}”配置的 GitHub 仓库`,
    targetId: target.id,
  };
}
