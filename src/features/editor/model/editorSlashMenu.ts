/**
 * [INPUT]: 依赖 CodeMirror state/view、React root、EditorSlashMenuList/commands 与 menu/editor 语义 Token
 * [OUTPUT]: 对外提供 slashMenuExtension
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Facet, Prec, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, keymap, type ViewUpdate } from "@codemirror/view";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { EditorSlashMenuList } from "@/features/editor/components/EditorSlashMenuList";
import {
  filterSlashCommands,
  type SlashCommand,
  type SlashMenuActions,
  type SlashTrigger,
} from "@/features/editor/model/editorSlashCommands";

const slashMenuActionsFacet = Facet.define<SlashMenuActions, SlashMenuActions>({
  combine(values) {
    return values.at(-1) ?? {};
  },
});

const slashMenuTheme = EditorView.theme({
  ".cm-slash-menu": {
    position: "fixed",
    zIndex: "10000",
    width: "192px",
    maxHeight: "268px",
    overflow: "hidden",
    border: "0",
    borderRadius: "var(--menu-radius)",
    padding: "var(--menu-padding)",
    color: "var(--menu-foreground)",
    backgroundColor: "var(--menu-background)",
    boxShadow: "var(--menu-solid-shadow-ring)",
    font: "13px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif",
    WebkitBackdropFilter: "none",
    backdropFilter: "none",
  },
  ".cm-slash-menu-list": {
    display: "flex",
    maxHeight: "260px",
    flexDirection: "column",
    overflowY: "auto",
    gap: "0",
    scrollbarWidth: "thin",
    scrollbarColor: "var(--menu-separator) transparent",
  },
  ".cm-slash-menu-list::-webkit-scrollbar": {
    width: "4px",
  },
  ".cm-slash-menu-list::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  ".cm-slash-menu-list::-webkit-scrollbar-thumb": {
    borderRadius: "var(--radius-full)",
    backgroundColor: "var(--menu-separator)",
  },
  ".cm-slash-menu-item": {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    alignItems: "center",
    gap: "10px",
    height: "26px",
    boxSizing: "border-box",
    border: "0",
    borderRadius: "var(--menu-item-radius)",
    padding: "0 10px 0 14px",
    color: "inherit",
    backgroundColor: "transparent",
    font: "inherit",
    textAlign: "left",
    cursor: "default",
  },
  ".cm-slash-menu-item.active": {
    color: "var(--menu-highlight-foreground)",
    backgroundColor: "var(--menu-highlight)",
  },
  ".cm-slash-menu-preview": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    color: "var(--foreground-secondary)",
    backgroundColor: "transparent",
  },
  ".cm-slash-menu-preview svg": {
    width: "14px",
    height: "14px",
    strokeWidth: "1.8",
  },
  ".cm-slash-menu-item.active .cm-slash-menu-preview": {
    color: "var(--menu-highlight-foreground)",
  },
  ".cm-slash-menu-title": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-slash-menu-empty": {
    padding: "10px 12px",
    color: "var(--editor-slash-empty-foreground)",
  },
});

class SlashMenuView {
  private menu: HTMLElement | null = null;
  private menuRoot: Root | null = null;
  private trigger: SlashTrigger | null = null;
  private commands: SlashCommand[] = [];
  private selectedIndex = 0;
  private triggerKey = "";

  constructor(private readonly view: EditorView) {
    this.sync();
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.sync();
    }
  }

  destroy() {
    this.close();
  }

  handleKey(key: string) {
    if (!this.menu || !this.trigger) return false;
    if (key === "Escape") {
      this.close();
      return true;
    }
    if (this.commands.length === 0) return false;
    if (key === "ArrowDown") {
      this.selectedIndex = (this.selectedIndex + 1) % this.commands.length;
      this.updateActiveItem(true);
      return true;
    }
    if (key === "ArrowUp") {
      this.selectedIndex = (this.selectedIndex - 1 + this.commands.length) % this.commands.length;
      this.updateActiveItem(true);
      return true;
    }
    if (key === "Enter" || key === "Tab") {
      this.runSelected();
      return true;
    }
    return false;
  }

  private sync() {
    const trigger = findSlashTrigger(this.view);
    if (!trigger) {
      this.close();
      return;
    }

    this.trigger = trigger;
    const triggerKey = `${trigger.from}:${trigger.query}`;
    if (triggerKey !== this.triggerKey) {
      this.selectedIndex = 0;
      this.triggerKey = triggerKey;
    }
    this.commands = filterSlashCommands(trigger.query);
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.commands.length - 1));
    this.render();
  }

  private render() {
    if (!this.trigger) return;
    if (!this.menu) {
      this.menu = document.createElement("div");
      this.menu.className = "cm-slash-menu";
      this.menu.addEventListener("mousedown", (event) => event.preventDefault());
      this.view.dom.append(this.menu);
      this.menuRoot = createRoot(this.menu);
    }

    flushSync(() => {
      this.menuRoot?.render(
        createElement(EditorSlashMenuList, {
          commands: this.commands,
          selectedIndex: this.selectedIndex,
          onHover: (index: number) => {
            if (this.selectedIndex === index) return;
            this.selectedIndex = index;
            this.updateActiveItem(false);
          },
          onSelect: (index: number) => {
            this.selectedIndex = index;
            this.runSelected();
          },
        }),
      );
    });
    this.position();
  }

  private updateActiveItem(shouldScroll: boolean) {
    if (!this.menu) return;
    const items = Array.from(this.menu.querySelectorAll<HTMLElement>(".cm-slash-menu-item"));
    items.forEach((item) => {
      item.classList.toggle("active", item.dataset.slashMenuIndex === String(this.selectedIndex));
    });
    if (shouldScroll) {
      items.find((item) => item.dataset.slashMenuIndex === String(this.selectedIndex))?.scrollIntoView({ block: "nearest" });
    }
  }

  private position() {
    if (!this.menu || !this.trigger) return;
    const menu = this.menu;
    const from = this.trigger.from;
    this.view.requestMeasure({
      key: this,
      read: (view) => {
        const coords = view.coordsAtPos(from);
        const rect = menu.getBoundingClientRect();
        return { coords, height: rect.height, width: rect.width };
      },
      write: ({ coords, height, width }) => {
        if (!coords || this.menu !== menu || !this.trigger || this.trigger.from !== from) return;
        const left = Math.min(coords.left, window.innerWidth - width - 8);
        const top = Math.min(coords.bottom + 6, window.innerHeight - height - 8);
        menu.style.left = `${Math.max(8, left)}px`;
        menu.style.top = `${Math.max(8, top)}px`;
      },
    });
  }

  private runSelected() {
    const command = this.commands[this.selectedIndex];
    const trigger = this.trigger;
    if (!command || !trigger) return;
    const actions = this.view.state.facet(slashMenuActionsFacet);
    this.close();
    command.run(this.view, trigger, actions);
  }

  private close() {
    this.menuRoot?.unmount();
    this.menuRoot = null;
    this.menu?.remove();
    this.menu = null;
    this.trigger = null;
    this.commands = [];
    this.selectedIndex = 0;
    this.triggerKey = "";
  }
}

const slashMenuPlugin = ViewPlugin.fromClass(SlashMenuView);

const slashMenuKeymap = Prec.highest(
  keymap.of([
    createSlashMenuKeyBinding("ArrowDown"),
    createSlashMenuKeyBinding("ArrowUp"),
    createSlashMenuKeyBinding("Enter"),
    createSlashMenuKeyBinding("Tab"),
    createSlashMenuKeyBinding("Escape"),
  ]),
);

export function slashMenuExtension(actions: SlashMenuActions = {}): Extension {
  return [slashMenuTheme, slashMenuActionsFacet.of(actions), slashMenuPlugin, slashMenuKeymap];
}

function createSlashMenuKeyBinding(key: string) {
  return {
    key,
    run(view: EditorView) {
      return view.plugin(slashMenuPlugin)?.handleKey(key) ?? false;
    },
  };
}

function findSlashTrigger(view: EditorView): SlashTrigger | null {
  const selection = view.state.selection.main;
  if (!selection.empty) return null;
  const line = view.state.doc.lineAt(selection.head);
  const offset = selection.head - line.from;
  const beforeCursor = line.text.slice(0, offset);
  const match = beforeCursor.match(/(^|\s)\/([^\s/]*)$/);
  if (!match || match.index === undefined) return null;
  const slashOffset = match.index + match[1].length;
  return {
    from: line.from + slashOffset,
    to: selection.head,
    query: match[2] ?? "",
  };
}
