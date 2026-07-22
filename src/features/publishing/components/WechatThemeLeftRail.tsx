/**
 * [INPUT]: 依赖 lucide-react、发布模块、shared 公共契约
 * [OUTPUT]: 对外提供 WechatThemeLeftRailView、WechatThemeLeftRail
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FileText, SlidersHorizontal } from "lucide-react";
import type { WechatThemeBaseStyleChange } from "@/features/publishing/model/wechatThemeBaseStyle";
import type { WechatThemeBaseStyle } from "@/features/publishing/model/wechatThemes";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "@/shared/components/FunctionSegmentedTabs";
import { WechatThemeArticleRail } from "@/features/publishing/components/WechatThemeArticleRail";
import { WechatThemeBaseStylePanel } from "@/features/publishing/components/WechatThemeBaseStylePanel";

export type WechatThemeLeftRailView = "articles" | "styles";

const LEFT_RAIL_TABS: Array<FunctionSegmentedTab<WechatThemeLeftRailView>> = [
  { value: "articles", label: "文章", icon: FileText },
  { value: "styles", label: "样式", icon: SlidersHorizontal },
];

interface WechatThemeLeftRailProps {
  view: WechatThemeLeftRailView;
  onViewChange: (view: WechatThemeLeftRailView) => void;
  projects: WritingProject[];
  activeSheetId: string;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (project: WritingProject, sheet: WritingSheet) => void;
  baseStyle: WechatThemeBaseStyle;
  styleDisabled?: boolean;
  onBaseStyleChange: (change: WechatThemeBaseStyleChange, commit: boolean) => void;
}

export function WechatThemeLeftRail({
  view,
  onViewChange,
  projects,
  activeSheetId,
  search,
  onSearchChange,
  onSelect,
  baseStyle,
  styleDisabled,
  onBaseStyleChange,
}: WechatThemeLeftRailProps) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-muted/25">
      <div className="shrink-0 border-b border-border p-2">
        <FunctionSegmentedTabs value={view} tabs={LEFT_RAIL_TABS} ariaLabel="主题编辑功能" showLabels onValueChange={onViewChange} />
      </div>
      {view === "articles" ? (
        <WechatThemeArticleRail
          projects={projects}
          activeSheetId={activeSheetId}
          search={search}
          onSearchChange={onSearchChange}
          onSelect={onSelect}
        />
      ) : (
        <WechatThemeBaseStylePanel baseStyle={baseStyle} disabled={styleDisabled} onChange={onBaseStyleChange} />
      )}
    </aside>
  );
}
