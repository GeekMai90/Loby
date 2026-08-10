/**
 * [INPUT]: 依赖当前用户消息与有界会话历史中的文本
 * [OUTPUT]: 对外提供 extractExplicitLocalDirectoryPaths
 * [POS]: AI Runtime 的本地目录授权投影，只把用户明确写出的路径传给 native 只读工具
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentConversationMessage } from "@/shared/types";

const INLINE_PATH_PATTERN =
  /(?<![\w:])(?:\/Users\/|\/Volumes\/|\/private\/|\/tmp\/|\/home\/|\/opt\/|\/Applications\/|~[\\/]|[A-Za-z]:[\\/]|\\\\)[^\s"'`<>，。；：！？]+/g;

export function extractExplicitLocalDirectoryPaths(
  prompt: string,
  messages: Pick<AgentConversationMessage, "role" | "content">[] = [],
): string[] {
  const sources = [prompt, ...messages.filter((message) => message.role === "user").map((message) => message.content)];
  const paths = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(INLINE_PATH_PATTERN)) {
      const path = normalizeLocalPath(match[0]);
      if (path) paths.add(path);
    }
    for (const line of source.split(/\r?\n/)) {
      const path = normalizeLocalPath(line.trim());
      if (path && isAbsoluteLocalPath(path)) paths.add(path);
    }
  }
  return Array.from(paths).slice(0, 4);
}

function normalizeLocalPath(value: string): string | null {
  const path = value
    .trim()
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/[，。；：！？]+$/, "");
  return path && !path.includes("://") ? path : null;
}

function isAbsoluteLocalPath(value: string): boolean {
  return value.startsWith("/") || /^~[\\/]/.test(value) || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\");
}
