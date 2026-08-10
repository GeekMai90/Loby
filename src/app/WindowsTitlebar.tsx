/**
 * [INPUT]: 依赖 Tauri 当前窗口 API、renderer 菜单事件、DropdownMenu/Button 基础控件与 lucide 图标
 * [OUTPUT]: 对外提供 Windows 运行时检测与包含文件/编辑/视图/窗口/帮助菜单、拖拽、缩放和窗口控制的自定义标题栏
 * [POS]: app 组合层的 Windows 窗口 Chrome；Windows 使用它承接系统装饰职责，macOS 与公众号主题工作室不加载它
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isWindowsDesktopRuntime } from "@/shared/lib/platform";

type ResizeDirection = "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West";
type TauriWindow = ReturnType<typeof getCurrentWindow>;
type DocumentCommand = "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll";
type WindowAction = "minimize" | "toggle-maximize" | "close";

type MenuItemDefinition = {
  kind: "item";
  label: string;
  event?: string;
  documentCommand?: DocumentCommand;
  windowAction?: WindowAction;
  shortcut?: string;
};

type MenuItem = MenuItemDefinition | { kind: "separator" };

type MenuSection = {
  label: string;
  items: MenuItem[];
};

const MENU_SECTIONS: MenuSection[] = [
  {
    label: "文件",
    items: [
      { kind: "item", label: "新建项目", event: "loby://new-project" },
      { kind: "item", label: "新建文稿", event: "loby://new-sheet", shortcut: "Ctrl+N" },
      { kind: "item", label: "快速记录", event: "loby://quick-capture", shortcut: "Ctrl+D" },
      { kind: "item", label: "导入…", event: "loby://import-markdown" },
      { kind: "separator" },
      { kind: "item", label: "清理未使用的图片…", event: "loby://clean-unused-images" },
      { kind: "item", label: "清理空白文稿", event: "loby://clean-empty-sheets" },
      { kind: "item", label: "重建索引", event: "loby://rebuild-index" },
    ],
  },
  {
    label: "编辑",
    items: [
      { kind: "item", label: "撤销", documentCommand: "undo", shortcut: "Ctrl+Z" },
      { kind: "item", label: "重做", documentCommand: "redo", shortcut: "Ctrl+Y" },
      { kind: "separator" },
      { kind: "item", label: "剪切", documentCommand: "cut", shortcut: "Ctrl+X" },
      { kind: "item", label: "复制", documentCommand: "copy", shortcut: "Ctrl+C" },
      { kind: "item", label: "粘贴", documentCommand: "paste", shortcut: "Ctrl+V" },
      { kind: "separator" },
      { kind: "item", label: "全选", documentCommand: "selectAll", shortcut: "Ctrl+A" },
    ],
  },
  {
    label: "视图",
    items: [{ kind: "item", label: "打字机模式", event: "loby://toggle-typewriter-mode" }],
  },
  {
    label: "窗口",
    items: [
      { kind: "item", label: "最小化", windowAction: "minimize" },
      { kind: "item", label: "最大化/还原", windowAction: "toggle-maximize" },
      { kind: "separator" },
      { kind: "item", label: "关闭窗口", windowAction: "close", shortcut: "Alt+F4" },
    ],
  },
  {
    label: "帮助",
    items: [
      { kind: "item", label: "设置", event: "loby://open-settings", shortcut: "Ctrl+," },
      { kind: "item", label: "键盘快捷键", event: "loby://open-shortcuts" },
      { kind: "item", label: "欢迎界面", event: "loby://open-welcome" },
    ],
  },
];

const RESIZE_HANDLES: Array<{ direction: ResizeDirection; className: string }> = [
  { direction: "North", className: "windows-titlebar-resize-handle-north" },
  { direction: "South", className: "windows-titlebar-resize-handle-south" },
  { direction: "East", className: "windows-titlebar-resize-handle-east" },
  { direction: "West", className: "windows-titlebar-resize-handle-west" },
  { direction: "NorthEast", className: "windows-titlebar-resize-handle-north-east" },
  { direction: "NorthWest", className: "windows-titlebar-resize-handle-north-west" },
  { direction: "SouthEast", className: "windows-titlebar-resize-handle-south-east" },
  { direction: "SouthWest", className: "windows-titlebar-resize-handle-south-west" },
];

export function WindowsTitlebar() {
  const appWindow = useMemo(() => (isWindowsDesktopRuntime() ? getCurrentWindow() : null), []);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!appWindow) return;
    let disposed = false;
    const syncMaximizedState = () => {
      void appWindow
        .isMaximized()
        .then((maximized) => {
          if (!disposed) setIsMaximized(maximized);
        })
        .catch(() => undefined);
    };

    syncMaximizedState();
    const unlisten = appWindow.onResized(syncMaximizedState);
    return () => {
      disposed = true;
      void unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, [appWindow]);

  if (!appWindow) return null;

  return (
    <>
      <WindowsResizeHandles appWindow={appWindow} />
      <header className="windows-titlebar" onMouseDown={(event) => handleTitlebarMouseDown(event, appWindow)}>
        <nav className="windows-titlebar-menu" aria-label="应用菜单">
          {MENU_SECTIONS.map((section) => (
            <MenuSectionButton key={section.label} section={section} appWindow={appWindow} />
          ))}
        </nav>
        <span className="windows-titlebar-title" aria-hidden="true">
          落笔
        </span>
        <div className="windows-titlebar-controls" aria-label="窗口控制">
          <WindowControl label="最小化" onClick={() => invokeWindowAction(() => appWindow.minimize())}>
            <Minus />
          </WindowControl>
          <WindowControl label={isMaximized ? "还原" : "最大化"} onClick={() => invokeWindowAction(() => appWindow.toggleMaximize())}>
            {isMaximized ? <Copy /> : <Square />}
          </WindowControl>
          <WindowControl
            label="关闭"
            className="windows-titlebar-control-close"
            onClick={() => invokeWindowAction(() => appWindow.close())}
          >
            <X />
          </WindowControl>
        </div>
      </header>
    </>
  );
}

function MenuSectionButton({ section, appWindow }: { section: MenuSection; appWindow: TauriWindow }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="windows-titlebar-menu-trigger" data-no-window-drag>
          {section.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={0} className="windows-titlebar-menu-content">
        {section.items.map((item, index) => {
          if (item.kind === "separator") {
            return <DropdownMenuSeparator key={`separator-${index}`} />;
          }
          return (
            <DropdownMenuItem key={item.label} onSelect={() => runMenuItem(item, appWindow)}>
              <span>{item.label}</span>
              {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WindowsResizeHandles({ appWindow }: { appWindow: TauriWindow }) {
  return (
    <>
      {RESIZE_HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          className={`windows-titlebar-resize-handle ${className}`}
          data-no-window-drag
          aria-hidden="true"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void appWindow.startResizeDragging(direction).catch(() => undefined);
          }}
        />
      ))}
    </>
  );
}

function WindowControl({
  label,
  className = "",
  onClick,
  children,
}: {
  label: string;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`windows-titlebar-control ${className}`}
      data-no-window-drag
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function runMenuItem(item: MenuItemDefinition, appWindow: TauriWindow) {
  if (item.event) {
    void emit(item.event).catch(() => undefined);
    return;
  }
  if (item.documentCommand) {
    runDocumentCommand(item.documentCommand);
    return;
  }
  if (item.windowAction) {
    runWindowAction(item.windowAction, appWindow);
  }
}

function runDocumentCommand(command: DocumentCommand) {
  if (typeof document === "undefined") return;
  try {
    document.execCommand(command);
  } catch {
    // WebView 对剪贴板权限的支持存在差异，菜单动作不能阻断窗口交互。
  }
}

function runWindowAction(action: WindowAction, appWindow: TauriWindow) {
  const actionPromise =
    action === "minimize" ? appWindow.minimize() : action === "toggle-maximize" ? appWindow.toggleMaximize() : appWindow.close();
  void actionPromise.catch(() => undefined);
}

function invokeWindowAction(action: () => Promise<void>) {
  void action().catch(() => undefined);
}

function handleTitlebarMouseDown(event: MouseEvent<HTMLElement>, appWindow: TauriWindow) {
  if (event.button !== 0) return;
  if (event.target instanceof Element && event.target.closest("button, input, textarea, select, a, [data-no-window-drag]")) {
    return;
  }
  event.preventDefault();
  if (event.detail === 2) {
    event.stopPropagation();
    void appWindow.toggleMaximize().catch(() => undefined);
    return;
  }
  if (event.detail === 1) {
    void appWindow.startDragging().catch(() => undefined);
  }
}
