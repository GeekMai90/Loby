import { FileText, Folder } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface RailModeSwitchProps {
  active: "list" | "document";
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSelectMode: (mode: "list" | "document") => void;
}

export function RailModeSwitch({ active, expanded, onExpandedChange, onSelectMode }: RailModeSwitchProps) {
  return (
    <ToggleGroup
      type="single"
      value={active}
      variant="default"
      size="sm"
      spacing={0}
      className="absolute right-1/2 bottom-3.75 z-8 translate-x-1/2 rounded-lg border border-border bg-card p-1 shadow-lg"
      data-expanded={expanded}
      aria-label="列表栏切换"
      onValueChange={(value) => value && onSelectMode(value as "list" | "document")}
      onPointerEnter={() => onExpandedChange(true)}
      onPointerLeave={() => onExpandedChange(false)}
    >
      <ToggleGroupItem value="list" title="列表" aria-label="列表" aria-pressed={active === "list"}>
        <Folder size={16} />
      </ToggleGroupItem>
      <ToggleGroupItem value="document" title="文稿" aria-label="文稿" aria-pressed={active === "document"}>
        <FileText size={16} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
