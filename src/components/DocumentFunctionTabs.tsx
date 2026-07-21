import { Clock3, ImageIcon, Search } from "lucide-react";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "./FunctionSegmentedTabs";

export type DocumentRailTab = "media" | "search" | "history";

interface DocumentFunctionTabsProps {
  activeTab: DocumentRailTab;
  onActiveTabChange: (tab: DocumentRailTab) => void;
}

const DOCUMENT_TABS: Array<FunctionSegmentedTab<DocumentRailTab>> = [
  { value: "media", label: "媒体", icon: ImageIcon },
  { value: "search", label: "查找替换", icon: Search },
  { value: "history", label: "历史版本", icon: Clock3 },
];

export function DocumentFunctionTabs({ activeTab, onActiveTabChange }: DocumentFunctionTabsProps) {
  return <FunctionSegmentedTabs value={activeTab} tabs={DOCUMENT_TABS} ariaLabel="文稿功能" onValueChange={onActiveTabChange} />;
}
