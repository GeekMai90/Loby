/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 PublishChannelId、PublishChannelDefinition、PUBLISH_CHANNELS 与项目 GitHub 发布渠道工厂
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export type PublishChannelId = "wechat" | "wordpress" | "mowen" | "blog";

export interface PublishChannelDefinition {
  id: PublishChannelId;
  label: string;
  description: string;
}

export const PUBLISH_CHANNELS: PublishChannelDefinition[] = [
  { id: "wechat", label: "微信公众号", description: "选择主题、预览排版并复制到公众号" },
  { id: "wordpress", label: "WordPress 博客", description: "发布为博客草稿或正式文章" },
  { id: "mowen", label: "墨问笔记", description: "创建墨问草稿或公开发布" },
];

export function githubPublishChannel(name: string): PublishChannelDefinition {
  const label = name.trim() || "GitHub 发布";
  return {
    id: "blog",
    label,
    description: `发布到“${label}”配置的 GitHub 仓库`,
  };
}
