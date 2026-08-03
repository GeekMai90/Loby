/**
 * [INPUT]: 依赖 Radix ContextMenu、Lucide 图标、CodeMirror EditorView 与 editor 剪贴板动作
 * [OUTPUT]: 对外提供普通 Markdown 编辑区的 Loby 风格右键菜单，承载撤销、重做、剪切、复制、粘贴与全选
 * [POS]: editor feature 的编辑区交互边界；只接管普通文本区域，图片预览通过阻止冒泡继续使用图片专属菜单
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { redo, redoDepth, selectAll, undo, undoDepth } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { ClipboardPaste, Copy, ListChecks, Redo2, Scissors, Undo2 } from "lucide-react";
import { useState, type ReactNode, type RefObject } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyEditorSelection, cutEditorSelection, hasEditorSelection, pasteEditorClipboard } from "@/features/editor/model/editorClipboard";
import { currentShortcutPlatform, platformModKeyLabel } from "@/shared/lib/keyboardShortcuts";

interface EditorContextMenuState {
  hasView: boolean;
  canEdit: boolean;
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

interface EditorContextMenuProps {
  editorViewRef: RefObject<EditorView | null>;
  readOnly: boolean;
  children: ReactNode;
}

export function EditorContextMenu({ editorViewRef, readOnly, children }: EditorContextMenuProps) {
  const [menuState, setMenuState] = useState<EditorContextMenuState | null>(null);
  const shortcuts = editorShortcutLabels();
  const state = menuState ?? EMPTY_EDITOR_CONTEXT_MENU_STATE;

  function runEditorCommand(command: (view: EditorView) => boolean) {
    const currentView = editorViewRef.current;
    if (!currentView) return;
    currentView.focus();
    command(currentView);
  }

  return (
    <ContextMenu
      modal={false}
      onOpenChange={(open) => {
        setMenuState(open ? createEditorContextMenuState(editorViewRef.current, readOnly) : null);
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem disabled={!state.canUndo} onSelect={() => runEditorCommand(undo)}>
          <ContextMenuItemIcon>
            <Undo2 aria-hidden="true" />
          </ContextMenuItemIcon>
          撤销
          <ContextMenuShortcut>{shortcuts.undo}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!state.canRedo} onSelect={() => runEditorCommand(redo)}>
          <ContextMenuItemIcon>
            <Redo2 aria-hidden="true" />
          </ContextMenuItemIcon>
          重做
          <ContextMenuShortcut>{shortcuts.redo}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          disabled={!state.canEdit || !state.hasSelection}
          onSelect={() => void runEditorClipboardAction(editorViewRef, "cut")}
        >
          <ContextMenuItemIcon>
            <Scissors aria-hidden="true" />
          </ContextMenuItemIcon>
          剪切
          <ContextMenuShortcut>{shortcuts.cut}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!state.hasSelection} onSelect={() => void runEditorClipboardAction(editorViewRef, "copy")}>
          <ContextMenuItemIcon>
            <Copy aria-hidden="true" />
          </ContextMenuItemIcon>
          复制
          <ContextMenuShortcut>{shortcuts.copy}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={!state.canEdit} onSelect={() => void runEditorClipboardAction(editorViewRef, "paste")}>
          <ContextMenuItemIcon>
            <ClipboardPaste aria-hidden="true" />
          </ContextMenuItemIcon>
          粘贴
          <ContextMenuShortcut>{shortcuts.paste}</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem disabled={!state.hasView} onSelect={() => runEditorCommand(selectAll)}>
          <ContextMenuItemIcon>
            <ListChecks aria-hidden="true" />
          </ContextMenuItemIcon>
          全选
          <ContextMenuShortcut>{shortcuts.selectAll}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const EMPTY_EDITOR_CONTEXT_MENU_STATE: EditorContextMenuState = {
  hasView: false,
  canEdit: false,
  hasSelection: false,
  canUndo: false,
  canRedo: false,
};

function createEditorContextMenuState(view: EditorView | null, readOnly: boolean): EditorContextMenuState {
  const canEdit = Boolean(view && !readOnly && !view.state.readOnly);
  return {
    hasView: Boolean(view),
    canEdit,
    hasSelection: Boolean(view && hasEditorSelection(view)),
    canUndo: Boolean(canEdit && view && undoDepth(view.state) > 0),
    canRedo: Boolean(canEdit && view && redoDepth(view.state) > 0),
  };
}

async function runEditorClipboardAction(editorViewRef: RefObject<EditorView | null>, action: "copy" | "cut" | "paste") {
  const view = editorViewRef.current;
  if (!view) return;
  if (action === "copy") {
    await copyEditorSelection(view);
    return;
  }
  if (action === "cut") {
    await cutEditorSelection(view);
    return;
  }
  await pasteEditorClipboard(view);
}

function editorShortcutLabels() {
  const platform = currentShortcutPlatform();
  const mod = platformModKeyLabel(platform);
  if (platform === "mac") {
    return {
      undo: `${mod}Z`,
      redo: `⇧${mod}Z`,
      cut: `${mod}X`,
      copy: `${mod}C`,
      paste: `${mod}V`,
      selectAll: `${mod}A`,
    };
  }
  return {
    undo: `${mod}+Z`,
    redo: `${mod}+Y`,
    cut: `${mod}+X`,
    copy: `${mod}+C`,
    paste: `${mod}+V`,
    selectAll: `${mod}+A`,
  };
}
