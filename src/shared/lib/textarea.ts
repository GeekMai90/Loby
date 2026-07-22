/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 resizeTextareaToContent
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function resizeTextareaToContent(input: HTMLTextAreaElement | null, maxHeight = 180) {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
}
