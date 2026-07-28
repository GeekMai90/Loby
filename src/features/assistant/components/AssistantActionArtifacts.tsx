/**
 * [INPUT]: 依赖 React Markdown、remark-gfm、AI action payload、图片预览解析与消息目标上下文
 * [OUTPUT]: 对外提供 AssistantActionArtifact，将单项成果或批量图片及各自位置完整呈现在对应确认卡片之前
 * [POS]: AI 助手动作的成果展示层；只读取 action 唯一数据源，不承担确认、执行或状态回执
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AssistantActionImagePreview } from "@/features/assistant/components/AssistantActionImagePreview";
import { AssistantActionTargetContext } from "@/features/assistant/components/AssistantMessageContexts";
import { buildInsertImageActionPreview } from "@/features/assistant/model/assistantActionImagePreview";
import { expandImageActions } from "@/features/assistant/model/agentImageArtifacts";
import { buildAiActionPreview } from "@/features/assistant/model/aiActionPreview";
import type { AiAction } from "@/shared/types";

export function AssistantActionArtifact({ action, messageContent }: { action: AiAction; messageContent: string }) {
  const targetContext = useContext(AssistantActionTargetContext);
  if (action.type === "insertImage" || action.type === "insertImages") {
    const imageActions = expandImageActions(action);
    return (
      <div className="grid min-w-0 gap-3" data-action-id={action.id} data-slot="assistant-action-artifact">
        {imageActions.map((imageAction, index) => {
          const preview = buildInsertImageActionPreview(imageAction, targetContext);
          if (!preview) return null;
          const position = buildAiActionPreview(imageAction).fields.find(([label]) => label === "位置")?.[1];
          return (
            <div key={imageAction.id} className="grid min-w-0 gap-1.5" data-slot="assistant-image-action-item">
              <AssistantActionImagePreview preview={preview} />
              {action.type === "insertImages" && (
                <p className="m-0 px-0.5 text-xs leading-[1.4] text-muted-foreground">
                  图片 {index + 1}
                  {position ? ` · 插入到${position}` : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const markdown = actionMarkdownArtifact(action);
  if (!markdown || messageAlreadyContainsArtifact(messageContent, markdown)) return null;
  return (
    <div
      className="assistant-markdown min-w-0 text-app-base text-foreground"
      data-action-id={action.id}
      data-slot="assistant-action-artifact"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

function actionMarkdownArtifact(action: AiAction) {
  if (action.type === "insertText") {
    return stringValue(action.payload.text) || stringValue(action.payload.markdown) || stringValue(action.payload.content);
  }
  if (action.type === "createSheet") return stringValue(action.payload.body);
  if (action.type === "saveExport") return stringValue(action.payload.content);
  return "";
}

function messageAlreadyContainsArtifact(messageContent: string, artifact: string) {
  return Boolean(artifact && messageContent.trim().includes(artifact));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
