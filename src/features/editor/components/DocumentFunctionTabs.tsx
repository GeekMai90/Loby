/**
 * [INPUT]: 依赖 lucide-react 与 Animate UI Tabs 成品组件
 * [OUTPUT]: 对外提供 DocumentRailTab、DocumentFunctionTabs
 * [POS]: 编辑器功能栏顶部的动画切换器，连接 rail 选中状态与媒体、查找、历史三个视图
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Clock3, ImageIcon, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";

export type DocumentRailTab = "media" | "search" | "history";

interface DocumentFunctionTabsProps {
  activeTab: DocumentRailTab;
  onActiveTabChange: (tab: DocumentRailTab) => void;
}

const DOCUMENT_TABS = [
  { value: "media", label: "媒体", icon: ImageIcon },
  { value: "search", label: "查找替换", icon: Search },
  { value: "history", label: "历史版本", icon: Clock3 },
] as const satisfies ReadonlyArray<{ value: DocumentRailTab; label: string; icon: typeof ImageIcon }>;

export function DocumentFunctionTabs({ activeTab, onActiveTabChange }: DocumentFunctionTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as DocumentRailTab)} className="mx-0.5 mt-2 mb-3">
      <TabsList className="grid w-full grid-cols-3" aria-label="文稿功能">
        {DOCUMENT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.value} value={tab.value} aria-label={tab.label} title={tab.label}>
              <Icon aria-hidden="true" />
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
