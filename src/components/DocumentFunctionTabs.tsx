import { Clock3, ImageIcon, Info, List, Search, type LucideIcon } from "lucide-react";
import clsx from "clsx";

export type DocumentRailTab = "information" | "outline" | "media" | "search" | "history";

interface DocumentFunctionTabsProps {
  activeTab: DocumentRailTab;
  onActiveTabChange: (tab: DocumentRailTab) => void;
}

const DOCUMENT_TABS: Array<{ id: DocumentRailTab; label: string; icon: LucideIcon }> = [
  { id: "outline", label: "目录", icon: List },
  { id: "information", label: "信息", icon: Info },
  { id: "media", label: "媒体", icon: ImageIcon },
  { id: "search", label: "查找替换", icon: Search },
  { id: "history", label: "历史版本", icon: Clock3 },
];

export function DocumentFunctionTabs({ activeTab, onActiveTabChange }: DocumentFunctionTabsProps) {
  const activeTabIndex = DOCUMENT_TABS.findIndex((tab) => tab.id === activeTab);

  return (
    <div className="document-function-tabs" role="tablist" aria-label="文稿功能" data-active-index={activeTabIndex}>
      <span className="document-function-tab-indicator" aria-hidden="true" />
      {DOCUMENT_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={clsx(activeTab === tab.id && "active")}
            title={tab.label}
            aria-label={tab.label}
            aria-selected={activeTab === tab.id}
            onClick={() => onActiveTabChange(tab.id)}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
