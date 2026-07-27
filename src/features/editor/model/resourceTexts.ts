/**
 * [INPUT]: 依赖 shared 公共契约、AI 助手模块
 * [OUTPUT]: 对外提供 loadSelectedResourceTexts
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ProjectResourceText } from "@/shared/types";
import { readProjectResourceText } from "@/features/assistant/model/agentRuntime";

export async function loadSelectedResourceTexts(libraryPath: string, selectedResourcePaths: string[]): Promise<ProjectResourceText[]> {
  if (selectedResourcePaths.length === 0) return [];
  try {
    return await readProjectResourceText(libraryPath, selectedResourcePaths);
  } catch (error) {
    return [
      {
        path: "resource-read",
        name: "resource-read",
        status: `read-failed: ${error instanceof Error ? error.message : String(error)}`,
        content: "",
        sizeBytes: 0,
        truncated: false,
      },
    ];
  }
}
