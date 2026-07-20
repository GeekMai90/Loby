import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  Bold,
  CalendarClock,
  CodeXml,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareText,
  Minus,
  Quote,
  SquareCode,
  Strikethrough,
  Table2,
  type LucideIcon,
} from "lucide-react";

export interface SlashMenuActions {
  onInsertImage?: () => void;
}

export interface SlashTrigger {
  from: number;
  to: number;
  query: string;
}

export interface SlashCommand {
  id: string;
  title: string;
  preview: string;
  icon: LucideIcon;
  keywords: string[];
  group: "format" | "block" | "insert";
  run: (view: EditorView, trigger: SlashTrigger, actions: SlashMenuActions) => void;
}

export const slashCommands: SlashCommand[] = [
  createTextCommand("h1", "一级标题", "H1", Heading1, ["h1", "标题", "一级", "title"], "# "),
  createTextCommand("h2", "二级标题", "H2", Heading2, ["h2", "小标题", "二级", "subtitle"], "## "),
  createTextCommand("h3", "三级标题", "H3", Heading3, ["h3", "副标题", "三级"], "### "),
  createTextCommand("bullet-list", "无序列表", "- ", List, ["列表", "无序", "list", "ul"], "- "),
  createTextCommand("ordered-list", "有序列表", "1.", ListOrdered, ["有序", "数字", "ol"], "1. "),
  createTextCommand("task-list", "任务列表", "☐", ListChecks, ["任务", "todo", "task"], "- [ ] "),
  createTextCommand("quote", "引用块", ">", Quote, ["引用", "quote"], "> "),
  createInlineCommand("bold", "加粗", "B", Bold, ["bold", "加粗", "粗体"], "****", 2),
  createInlineCommand("italic", "斜体", "I", Italic, ["italic", "斜体"], "**", 1),
  createInlineCommand("strike", "删除线", "S", Strikethrough, ["strike", "删除线"], "~~~~", 2),
  createInlineCommand("inline-code", "行内代码", "`", CodeXml, ["code", "行内代码", "代码"], "``", 1),
  createInlineCommand("highlight", "突出显示", "==", Highlighter, ["highlight", "高亮", "突出"], "====", 2),
  {
    id: "code-block",
    title: "代码块",
    preview: "```",
    icon: SquareCode,
    keywords: ["代码块", "codeblock", "pre"],
    group: "block",
    run(view, trigger) {
      replaceSlashTrigger(view, trigger, "```\n\n```", { cursorOffset: 4 });
    },
  },
  {
    id: "divider",
    title: "分隔线",
    preview: "---",
    icon: Minus,
    keywords: ["分隔", "divider", "hr"],
    group: "block",
    run(view, trigger) {
      replaceSlashTrigger(view, trigger, "---", { cursorOffset: 3 });
    },
  },
  {
    id: "link",
    title: "链接",
    preview: "🔗",
    icon: Link,
    keywords: ["链接", "link", "url"],
    group: "insert",
    run(view, trigger) {
      replaceSlashTrigger(view, trigger, "[链接文字](https://)", { selectFrom: 1, selectTo: 5 });
    },
  },
  {
    id: "image",
    title: "图片",
    preview: "img",
    icon: ImagePlus,
    keywords: ["图片", "image", "img", "照片"],
    group: "insert",
    run(view, trigger, actions) {
      replaceSlashTrigger(view, trigger, "", { cursorOffset: 0 });
      actions.onInsertImage?.();
    },
  },
  {
    id: "table",
    title: "表格",
    preview: "tbl",
    icon: Table2,
    keywords: ["表格", "table", "tbl"],
    group: "insert",
    run(view, trigger) {
      const table = ["| 列 1 | 列 2 | 列 3 |", "| --- | --- | --- |", "|  |  |  |", "|  |  |  |"].join("\n");
      replaceSlashTrigger(view, trigger, table, { cursorOffset: table.indexOf("|  |") + 2 });
    },
  },
  {
    id: "comment",
    title: "注释",
    preview: "<!--",
    icon: MessageSquareText,
    keywords: ["注释", "comment", "note"],
    group: "insert",
    run(view, trigger) {
      replaceSlashTrigger(view, trigger, "<!-- 注释 -->", { selectFrom: 5, selectTo: 7 });
    },
  },
  {
    id: "datetime",
    title: "日期时间",
    preview: "time",
    icon: CalendarClock,
    keywords: ["日期", "时间", "date", "time", "now"],
    group: "insert",
    run(view, trigger) {
      const dateTime = formatLocalDateTime();
      replaceSlashTrigger(view, trigger, dateTime, { cursorOffset: dateTime.length });
    },
  },
];

export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = normalizeQuery(query);
  if (!needle) return slashCommands;
  return slashCommands
    .map((command, index) => ({ command, index, score: scoreSlashCommand(command, needle) }))
    .filter(isScoredSlashCommand)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map((item) => item.command);
}

function createTextCommand(
  id: string,
  title: string,
  preview: string,
  icon: LucideIcon,
  keywords: string[],
  insertion: string,
): SlashCommand {
  return {
    id,
    title,
    preview,
    icon,
    keywords,
    group: "format",
    run(view, trigger) {
      replaceSlashTrigger(view, trigger, insertion, { cursorOffset: insertion.length });
    },
  };
}

function createInlineCommand(
  id: string,
  title: string,
  preview: string,
  icon: LucideIcon,
  keywords: string[],
  insertion: string,
  cursorOffset: number,
): SlashCommand {
  return {
    id,
    title,
    preview,
    icon,
    keywords,
    group: "format",
    run(view, trigger) {
      replaceSlashTrigger(view, trigger, insertion, { cursorOffset });
    },
  };
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function scoreSlashCommand(command: SlashCommand, needle: string) {
  const title = normalizeQuery(command.title);
  const preview = normalizeQuery(command.preview);
  const id = normalizeQuery(command.id);
  const keywords = command.keywords.map(normalizeQuery);

  if (title.startsWith(needle)) return 0;
  if (keywords.some((keyword) => keyword === needle || keyword.startsWith(needle))) return 1;
  if (title.includes(needle)) return 2;
  if (preview.startsWith(needle)) return 3;
  if (keywords.some((keyword) => keyword.includes(needle))) return 4;
  if (id.includes(needle)) return 5;
  return null;
}

function isScoredSlashCommand(item: {
  command: SlashCommand;
  index: number;
  score: number | null;
}): item is { command: SlashCommand; index: number; score: number } {
  return item.score !== null;
}

function replaceSlashTrigger(
  view: EditorView,
  trigger: SlashTrigger,
  insertion: string,
  options: { cursorOffset?: number; selectFrom?: number; selectTo?: number } = {},
) {
  const cursorOffset = options.cursorOffset ?? insertion.length;
  const selection =
    typeof options.selectFrom === "number" && typeof options.selectTo === "number"
      ? EditorSelection.range(trigger.from + options.selectFrom, trigger.from + options.selectTo)
      : EditorSelection.cursor(trigger.from + cursorOffset);
  view.dispatch({
    changes: { from: trigger.from, to: trigger.to, insert: insertion },
    selection,
    scrollIntoView: true,
  });
  view.focus();
}

function formatLocalDateTime() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
