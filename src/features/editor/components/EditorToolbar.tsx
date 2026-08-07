/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、shared 公共契约、窗口拖拽回调与发布模块
 * [OUTPUT]: 对外提供 EditorToolbar，以 28px 控件和窗口顶栏 26px 中心线组织编辑器操作
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ChevronLeft, ChevronRight, Focus, PanelLeftOpen } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { APP_SHORTCUTS, appShortcutAriaKeys, appShortcutTitle } from "@/shared/lib/keyboardShortcuts";
import type { PublishChannelId } from "@/features/publishing/model/types";
import { PublishMenu } from "@/features/publishing/components/PublishMenu";
import type { PublishingTarget } from "@/features/publishing/model/publishingTargets";

interface EditorToolbarProps {
  focusMode: boolean;
  leftSidebarHidden: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  canPublish: boolean;
  githubPublishingTarget?: PublishingTarget;
  documentInformationControl?: ReactNode;
  onExpandLeftSidebar: () => void;
  onToggleFocusMode: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  onSelectPublishChannel: (channelId: PublishChannelId, targetId?: string) => void;
  onWindowDragStart: (event: MouseEvent<HTMLElement>) => void;
  onWindowToolbarDoubleClick: (event: MouseEvent<HTMLElement>) => void;
}

export function EditorToolbar({
  focusMode,
  leftSidebarHidden,
  canNavigateBack,
  canNavigateForward,
  canPublish,
  githubPublishingTarget,
  documentInformationControl,
  onExpandLeftSidebar,
  onToggleFocusMode,
  onNavigateBack,
  onNavigateForward,
  onSelectPublishChannel,
  onWindowDragStart,
  onWindowToolbarDoubleClick,
}: EditorToolbarProps) {
  return (
    <header
      className="editor-toolbar absolute inset-x-0 top-0 z-20 flex min-h-[50px] shrink-0 items-center justify-between gap-3 bg-background px-1.5 py-2 isolate"
      onMouseDown={onWindowDragStart}
      onDoubleClick={onWindowToolbarDoubleClick}
    >
      {!focusMode && (
        <div className="inline-flex shrink-0 items-center gap-1.5" aria-label="文稿导航">
          {leftSidebarHidden && (
            <Button variant="ghost" size="icon-sm" onClick={onExpandLeftSidebar} title="展开侧边栏" data-no-window-drag>
              <PanelLeftOpen className="size-3.5" />
            </Button>
          )}
          <div className="inline-flex items-center gap-1.5" aria-label="文稿前后导航">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onNavigateBack}
              title="上一篇文稿"
              disabled={!canNavigateBack}
              data-no-window-drag
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onNavigateForward}
              title="下一篇文稿"
              disabled={!canNavigateForward}
              data-no-window-drag
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-auto" />

      <div className="inline-flex shrink-0 items-center gap-1.5">
        {!focusMode && documentInformationControl}
        {!focusMode && (
          <PublishMenu disabled={!canPublish} githubPublishingTarget={githubPublishingTarget} onSelectChannel={onSelectPublishChannel} />
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleFocusMode}
          title={appShortcutTitle("toggleFocusMode", focusMode ? "退出专注模式" : "专注模式")}
          aria-keyshortcuts={appShortcutAriaKeys(APP_SHORTCUTS.toggleFocusMode)}
          data-no-window-drag
        >
          <Focus className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}
