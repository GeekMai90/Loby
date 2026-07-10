import clsx from "clsx";
import { FileText, Folder } from "lucide-react";

interface RailModeSwitchProps {
  active: "list" | "document";
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSelectMode: (mode: "list" | "document") => void;
}

export function RailModeSwitch({ active, expanded, onExpandedChange, onSelectMode }: RailModeSwitchProps) {
  return (
    <div
      className={clsx("rail-mode-switch", expanded && "is-expanded")}
      role="group"
      aria-label="列表栏切换"
      onPointerEnter={() => onExpandedChange(true)}
      onPointerLeave={() => onExpandedChange(false)}
    >
      <button
        type="button"
        className={clsx("rail-mode-option", active === "list" && "active")}
        title="列表"
        aria-label="列表"
        aria-pressed={active === "list"}
        onClick={() => onSelectMode("list")}
      >
        <span className="rail-mode-dot" />
        <Folder className="rail-mode-icon" size={18} strokeWidth={2.1} />
      </button>
      <button
        type="button"
        className={clsx("rail-mode-option", active === "document" && "active")}
        title="文稿"
        aria-label="文稿"
        aria-pressed={active === "document"}
        onClick={() => onSelectMode("document")}
      >
        <span className="rail-mode-dot" />
        <FileText className="rail-mode-icon" size={18} strokeWidth={2.1} />
      </button>
    </div>
  );
}
