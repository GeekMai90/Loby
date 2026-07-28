/**
 * [INPUT]: 依赖 Tauri asset URL、agent run/单图及批量图片 action 来源契约、消息目标上下文与共享原生图片预览组件
 * [OUTPUT]: 对外提供 AssistantRunArtifacts，把尚未被持久化图片动作覆盖的 Loby image generation 成果呈现在消息流中
 * [POS]: AI 助手消息成果层的运行产物视图，在 message 边界消除临时生成图与持久化 action 图的重复
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useContext } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { AssistantActionImagePreview } from "@/features/assistant/components/AssistantActionImagePreview";
import { AssistantActionTargetContext } from "@/features/assistant/components/AssistantMessageContexts";
import { buildInsertImageActionPreviews } from "@/features/assistant/model/assistantActionImagePreview";
import { collectVisibleRunImageArtifactPaths } from "@/features/assistant/model/agentImageArtifacts";
import type { AgentRunActivity, AiAction } from "@/shared/types";

export function AssistantRunArtifacts({ activities, actions = [] }: { activities: AgentRunActivity[]; actions?: AiAction[] }) {
  const targetContext = useContext(AssistantActionTargetContext);
  const renderableImageActions = actions.filter(
    (action) =>
      (action.type === "insertImage" || action.type === "insertImages") && buildInsertImageActionPreviews(action, targetContext).length > 0,
  );
  const artifactPaths = collectVisibleRunImageArtifactPaths(activities, renderableImageActions);
  if (artifactPaths.length === 0) return null;

  return (
    <div className="mt-2.5 grid min-w-0 gap-3" data-slot="assistant-run-artifacts">
      {artifactPaths.map((sourcePath) => (
        <AssistantActionImagePreview
          key={sourcePath}
          preview={{
            src: convertFileSrc(sourcePath),
            alt: "AI 生成的图片",
            label: sourcePath.split(/[\\/]/).at(-1) || "生成图片",
            sourcePath,
          }}
        />
      ))}
    </div>
  );
}
