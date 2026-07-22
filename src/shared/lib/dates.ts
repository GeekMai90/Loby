/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 today、nowTimestamp、formatMetadataTimestamp
 * [POS]: shared 层的跨功能纯工具或平台适配，不依赖 app 与具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function today() {
  const date = new Date();
  return formatLocalDate(date);
}

export function nowTimestamp() {
  const date = new Date();
  return `${formatLocalDate(date)} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}`;
}

export function formatMetadataTimestamp(value: string) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  if (match) return `${match[1]} ${match[2]}`;
  return value;
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}
