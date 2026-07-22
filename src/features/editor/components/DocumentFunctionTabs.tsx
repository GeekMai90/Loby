/**
 * [INPUT]: 依赖 lucide-react、shared 公共契约
 * [OUTPUT]: 对外提供 DocumentRailTab、DocumentFunctionTabs
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Clock3, ImageIcon, Search } from "lucide-react";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "@/shared/components/FunctionSegmentedTabs";

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
