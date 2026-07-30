/**
 * [INPUT]: 依赖 editor/model/editorSlashCommands 的 SlashCommand 视图模型与调用方选择事件
 * [OUTPUT]: 对外提供 EditorSlashMenuList
 * [POS]: 编辑器斜线命令的无状态 listbox 视图，渲染筛选结果并把 hover/select 意图交还协调层
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { SlashCommand } from "@/features/editor/model/editorSlashCommands";

interface EditorSlashMenuListProps {
  commands: SlashCommand[];
  selectedIndex: number;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
}

export function EditorSlashMenuList({ commands, selectedIndex, onHover, onSelect }: EditorSlashMenuListProps) {
  return (
    <div className="cm-slash-menu-list">
      {commands.length === 0 && <div className="cm-slash-menu-empty">没有匹配的格式</div>}
      {commands.map((command, index) => {
        const Icon = command.icon;
        return (
          <button
            key={command.id}
            type="button"
            className={`cm-slash-menu-item${index === selectedIndex ? " active" : ""}`}
            data-slash-menu-index={index}
            onMouseMove={() => onHover(index)}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(index);
            }}
          >
            <span className="cm-slash-menu-preview" aria-hidden="true">
              <Icon size={14} strokeWidth={1.8} />
            </span>
            <span className="cm-slash-menu-title">{command.title}</span>
          </button>
        );
      })}
    </div>
  );
}
