/**
 * [INPUT]: 依赖 AiAssistantPanel 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 AiAssistantPanelHost，将 AI 面板的动态加载边界保留在 assistant feature
 * [POS]: assistant feature 的面板 surface host；不拥有会话、运行时、编辑器或应用级展示状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { AiAssistantPanelProps } from "@/features/assistant/components/AiAssistantPanel";

const AiAssistantPanel = lazy(() =>
  import("@/features/assistant/components/AiAssistantPanel").then((module) => ({
    default: module.AiAssistantPanel,
  })),
);

export type AiAssistantPanelHostProps = AiAssistantPanelProps;

export function AiAssistantPanelHost(props: AiAssistantPanelHostProps) {
  return (
    <Suspense fallback={null}>
      <AiAssistantPanel {...props} />
    </Suspense>
  );
}
