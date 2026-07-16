import type { CodexCliProbeSnapshot } from "../types";

export interface CodexProbePresentation {
  status: string;
  detail: string;
}

export function formatCodexProbePresentation(probe: CodexCliProbeSnapshot | null): CodexProbePresentation {
  if (!probe) {
    return {
      status: "尚未检测",
      detail: "验证 Codex CLI 版本与 exec 命令是否可用。",
    };
  }

  const resolvedPath = probe.resolvedPath.trim();
  if (!probe.ok) {
    return {
      status: "检测失败",
      detail: resolvedPath ? `已找到 CLI，但版本或 exec 检测未通过 · ${resolvedPath}` : "未从自定义路径或 PATH 找到可用的 Codex CLI。",
    };
  }

  const source = resolvedPath.includes("/ChatGPT.app/Contents/") ? "ChatGPT 应用内置 CLI" : "Codex CLI";
  return {
    status: "已连接",
    detail: resolvedPath ? `${source} · ${resolvedPath}` : `${source} 可以正常运行。`,
  };
}
