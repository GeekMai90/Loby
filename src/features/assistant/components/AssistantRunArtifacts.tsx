/**
 * [INPUT]: 依赖 Tauri asset URL、agent run artifact 契约与共享原生图片预览组件
 * [OUTPUT]: 对外提供 AssistantRunArtifacts，把 Codex imageGeneration 成果呈现在消息流中
 * [POS]: AI 助手消息成果层的只读运行产物视图，不把生成图片混入用户附件或正文 action
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { convertFileSrc } from "@tauri-apps/api/core";
import { AssistantActionImagePreview } from "@/features/assistant/components/AssistantActionImagePreview";
import type { AgentRunActivity } from "@/shared/types";

export function AssistantRunArtifacts({ activities }: { activities: AgentRunActivity[] }) {
  const artifactPaths = Array.from(
    new Set(activities.map((activity) => activity.artifactPath?.trim() || "").filter(isLocalImageArtifactPath)),
  );
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

function isLocalImageArtifactPath(path: string) {
  return path.startsWith("/") && /\.(?:png|jpe?g|webp|gif)$/i.test(path);
}
