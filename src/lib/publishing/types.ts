export type PublishChannelId = "wechat" | "wordpress" | "mowen";

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
