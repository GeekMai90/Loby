import { Clock3, ImageIcon, Info, List, Search } from "lucide-react";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "./FunctionSegmentedTabs";

export type DocumentRailTab = "information" | "outline" | "media" | "search" | "history";

interface DocumentFunctionTabsProps {
  activeTab: DocumentRailTab;
  onActiveTabChange: (tab: DocumentRailTab) => void;
}

const DOCUMENT_TABS: Array<FunctionSegmentedTab<DocumentRailTab>> = [
  { value: "outline", label: "目录", icon: List },
  { value: "information", label: "信息", icon: Info },
  { value: "media", label: "媒体", icon: ImageIcon },
  { value: "search", label: "查找替换", icon: Search },
  { value: "history", label: "历史版本", icon: Clock3 },
];

export function DocumentFunctionTabs({ activeTab, onActiveTabChange }: DocumentFunctionTabsProps) {
  return <FunctionSegmentedTabs value={activeTab} tabs={DOCUMENT_TABS} ariaLabel="文稿功能" onValueChange={onActiveTabChange} />;
}
