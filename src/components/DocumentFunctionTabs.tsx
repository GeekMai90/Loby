import { Clock3, ImageIcon, Info, List, Search, type LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type DocumentRailTab = "information" | "outline" | "media" | "search" | "history";

interface DocumentFunctionTabsProps {
  activeTab: DocumentRailTab;
  onActiveTabChange: (tab: DocumentRailTab) => void;
}

const DOCUMENT_TABS: Array<{ id: DocumentRailTab; label: string; icon: LucideIcon }> = [
  { id: "information", label: "信息", icon: Info },
  { id: "outline", label: "目录", icon: List },
  { id: "media", label: "媒体", icon: ImageIcon },
  { id: "search", label: "查找替换", icon: Search },
  { id: "history", label: "历史版本", icon: Clock3 },
];

export function DocumentFunctionTabs({ activeTab, onActiveTabChange }: DocumentFunctionTabsProps) {
  return (
    <ToggleGroup
      type="single"
      value={activeTab}
      variant="outline"
      size="sm"
      spacing={0}
      className="mx-0.5 mt-2 mb-3 grid w-auto shrink-0 grid-cols-5"
      aria-label="文稿功能"
      onValueChange={(value) => value && onActiveTabChange(value as DocumentRailTab)}
    >
      {DOCUMENT_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <ToggleGroupItem key={tab.id} value={tab.id} title={tab.label} aria-label={tab.label}>
            <Icon size={16} />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
