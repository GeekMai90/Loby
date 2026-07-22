/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 extractFirstHeadingTitle
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function extractFirstHeadingTitle(markdown: string) {
  const heading = markdown.match(/^#\s+(.+?)\s*#*\s*$/m);
  return heading?.[1]?.trim() ?? "";
}
