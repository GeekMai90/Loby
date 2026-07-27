/**
 * [INPUT]: 依赖 React 错误边界生命周期、lucide-react 与 shadcn/ui 按钮
 * [OUTPUT]: 对外提供 AssistantPanelErrorBoundary，将助手子树异常收敛为可恢复的局部降级界面
 * [POS]: AI 助手 feature 的渲染故障隔离边界，保护编辑器与应用外壳不受第三方消息组件异常影响
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssistantPanelErrorBoundaryProps {
  children: ReactNode;
}

interface AssistantPanelErrorBoundaryState {
  failed: boolean;
}

export class AssistantPanelErrorBoundary extends Component<AssistantPanelErrorBoundaryProps, AssistantPanelErrorBoundaryState> {
  state: AssistantPanelErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AssistantPanelErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AI assistant render failed.", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="grid min-h-0 flex-auto place-items-center px-6 py-10 text-center" data-slot="assistant-error-fallback" role="alert">
        <div className="flex max-w-72 flex-col items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="size-4" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="font-medium text-foreground">AI 助手显示遇到问题</p>
            <p className="text-caption leading-relaxed text-muted-foreground">编辑器和文稿没有受到影响，可以重新加载助手后继续。</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>
            重新加载助手
          </Button>
        </div>
      </div>
    );
  }
}
