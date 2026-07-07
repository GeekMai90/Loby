import { Facet, Prec, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, keymap, type ViewUpdate } from "@codemirror/view";
import {
  filterSlashCommands,
  type SlashCommand,
  type SlashMenuActions,
  type SlashTrigger,
} from "./editorSlashCommands";

const slashMenuActionsFacet = Facet.define<SlashMenuActions, SlashMenuActions>({
  combine(values) {
    return values.at(-1) ?? {};
  },
});

const slashMenuTheme = EditorView.theme({
  ".cm-slash-menu": {
    position: "fixed",
    zIndex: "10000",
    width: "250px",
    maxHeight: "360px",
    overflow: "hidden",
    border: "1px solid rgb(0 0 0 / 12%)",
    borderRadius: "10px",
    padding: "6px",
    color: "#1d1d1f",
    backgroundColor: "rgb(255 255 255 / 94%)",
    boxShadow: "0 18px 44px rgb(0 0 0 / 18%)",
    font: "13px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif",
    backdropFilter: "blur(24px) saturate(160%)",
  },
  ".cm-slash-menu-list": {
    display: "flex",
    maxHeight: "348px",
    flexDirection: "column",
    overflowY: "auto",
    gap: "2px",
    paddingRight: "8px",
    scrollbarGutter: "stable",
    scrollbarWidth: "thin",
    scrollbarColor: "rgb(0 0 0 / 28%) transparent",
  },
  ".cm-slash-menu-list::-webkit-scrollbar": {
    width: "6px",
  },
  ".cm-slash-menu-list::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  ".cm-slash-menu-list::-webkit-scrollbar-thumb": {
    borderRadius: "999px",
    backgroundColor: "rgb(0 0 0 / 24%)",
  },
  ".cm-slash-menu-item": {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    alignItems: "center",
    gap: "9px",
    minHeight: "34px",
    boxSizing: "border-box",
    border: "0",
    borderRadius: "7px",
    padding: "0 10px 0 6px",
    color: "inherit",
    backgroundColor: "transparent",
    font: "inherit",
    textAlign: "left",
    cursor: "default",
  },
  ".cm-slash-menu-item.active": {
    color: "#ffffff",
    backgroundColor: "#0071e3",
  },
  ".cm-slash-menu-preview": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "28px",
    height: "22px",
    borderRadius: "5px",
    color: "#515154",
    backgroundColor: "#f2f2f5",
    fontFamily: "'SF Mono', 'SFMono-Regular', Menlo, Consolas, monospace",
    fontSize: "11px",
    fontWeight: "650",
  },
  ".cm-slash-menu-item.active .cm-slash-menu-preview": {
    color: "#0071e3",
    backgroundColor: "rgb(255 255 255 / 92%)",
  },
  ".cm-slash-menu-title": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-slash-menu-empty": {
    padding: "10px 12px",
    color: "#8e8e93",
  },
});

class SlashMenuView {
  private menu: HTMLElement | null = null;
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
    }

    const list = document.createElement("div");
    list.className = "cm-slash-menu-list";
    if (this.commands.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cm-slash-menu-empty";
      empty.textContent = "没有匹配的格式";
      list.append(empty);
    }

    this.commands.forEach((command, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `cm-slash-menu-item${index === this.selectedIndex ? " active" : ""}`;
      item.dataset.slashMenuIndex = String(index);
      item.addEventListener("mousemove", () => {
        if (this.selectedIndex === index) return;
        this.selectedIndex = index;
        this.updateActiveItem(false);
      });
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.selectedIndex = index;
        this.runSelected();
      });

      const preview = document.createElement("span");
      preview.className = "cm-slash-menu-preview";
      preview.textContent = command.preview;
      const title = document.createElement("span");
      title.className = "cm-slash-menu-title";
      title.textContent = command.title;
      item.append(preview, title);
      list.append(item);
    });

    this.menu.replaceChildren(list);
    this.position();
  }

  private updateActiveItem(shouldScroll: boolean) {
    if (!this.menu) return;
    const items = Array.from(this.menu.querySelectorAll<HTMLElement>(".cm-slash-menu-item"));
    items.forEach((item) => {
      item.classList.toggle("active", item.dataset.slashMenuIndex === String(this.selectedIndex));
    });
    if (shouldScroll) {
      items
        .find((item) => item.dataset.slashMenuIndex === String(this.selectedIndex))
        ?.scrollIntoView({ block: "nearest" });
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
