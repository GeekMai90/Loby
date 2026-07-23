/**
 * [INPUT]: 依赖 React Markdown、remark-gfm、AI action payload、图片预览解析与消息目标上下文
 * [OUTPUT]: 对外提供 AssistantActionArtifacts，将待写入成果完整呈现在聊天消息流中
 * [POS]: AI 助手消息的成果展示层；只读取 action 唯一数据源，不承担确认、执行或状态回执
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AssistantActionImagePreview } from "@/features/assistant/components/AssistantActionImagePreview";
import { AssistantActionTargetContext } from "@/features/assistant/components/AssistantMessageContexts";
import { buildInsertImageActionPreview } from "@/features/assistant/model/assistantActionImagePreview";
import type { AiAction } from "@/shared/types";

export function AssistantActionArtifacts({ actions, messageContent }: { actions: AiAction[]; messageContent: string }) {
  const targetContext = useContext(AssistantActionTargetContext);
  const artifacts = actions.map((action) => {
    if (action.type === "insertImage") {
      const preview = buildInsertImageActionPreview(action, targetContext);
      if (!preview) return null;
      return (
        <div key={action.id} data-action-id={action.id} data-slot="assistant-action-artifact">
          <AssistantActionImagePreview preview={preview} />
        </div>
      );
    }

    const markdown = actionMarkdownArtifact(action);
    if (!markdown || messageAlreadyContainsArtifact(messageContent, markdown)) return null;
    return (
      <div
        key={action.id}
        className="assistant-markdown min-w-0 text-app-base text-foreground"
        data-action-id={action.id}
        data-slot="assistant-action-artifact"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    );
  });

  if (!artifacts.some(Boolean)) return null;
  return (
    <div className="mt-2.5 grid min-w-0 gap-3" data-slot="assistant-action-artifacts">
      {artifacts}
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
