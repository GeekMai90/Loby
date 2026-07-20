import type { SlashCommand } from "@/lib/editorSlashCommands";

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
