/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 ASSISTANT_COMPOSER_PLACEHOLDERS、ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS
 * [POS]: AI 助手 feature 的稳定配置边界，集中 AI 助手 选项、默认值与持久化标识
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export const ASSISTANT_COMPOSER_PLACEHOLDERS = [
  "输入 / 使用快捷提示",
  "永远记住，AI 无法代替你思考",
  "输入 @ 挂载文稿",
  "随心输入",
] as const;

export const ASSISTANT_COMPOSER_PLACEHOLDER_INTERVAL_MS = 15_000;
