/**
 * [INPUT]: 依赖 shadcn/ui 按钮、lucide 图标与编辑器 Markdown 格式命令
 * [OUTPUT]: 对外提供固定在编辑页底部的常用 Markdown 格式栏
 * [POS]: 编辑器 feature 的快捷编辑入口，不持有正文和选区状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarkdownFormat } from "@/features/editor/model/editorMarkdown";

interface EditorBottomToolbarProps {
  onFormat: (format: MarkdownFormat) => void;
}

const ACTIONS: Array<{ format: MarkdownFormat; label: string; icon: LucideIcon; group: number }> = [
  { format: "h1", label: "一级标题", icon: Heading1, group: 0 },
  { format: "h2", label: "二级标题", icon: Heading2, group: 0 },
  { format: "h3", label: "三级标题", icon: Heading3, group: 0 },
  { format: "bold", label: "加粗", icon: Bold, group: 1 },
  { format: "italic", label: "斜体", icon: Italic, group: 1 },
  { format: "link", label: "链接", icon: Link, group: 1 },
  { format: "list", label: "无序列表", icon: List, group: 2 },
  { format: "ordered", label: "有序列表", icon: ListOrdered, group: 2 },
  { format: "task", label: "待办列表", icon: ListChecks, group: 2 },
  { format: "quote", label: "引用", icon: Quote, group: 2 },
  { format: "table", label: "插入表格", icon: Table2, group: 3 },
];

export function EditorBottomToolbar({ onFormat }: EditorBottomToolbarProps) {
  return (
    <div className="editor-bottom-toolbar absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 pointer-events-none">
      <div
        role="toolbar"
        aria-label="正文格式"
        className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-background/95 p-1 shadow-lg"
      >
        {ACTIONS.map(({ format, label, icon: Icon, group }, index) => (
          <div key={format} className="flex shrink-0 items-center">
            {index > 0 && ACTIONS[index - 1].group !== group && <span className="mx-1.5 h-5 w-px bg-border" aria-hidden="true" />}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onFormat(format)}
              title={label}
              aria-label={label}
            >
              <Icon className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
