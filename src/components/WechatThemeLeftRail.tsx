import { FileText, SlidersHorizontal } from "lucide-react";
import type { WechatThemeBaseStyleChange } from "../lib/publishing/wechatThemeBaseStyle";
import type { WechatThemeBaseStyle } from "../lib/publishing/wechatThemes";
import type { WritingProject, WritingSheet } from "../types";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "./FunctionSegmentedTabs";
import { WechatThemeArticleRail } from "./WechatThemeArticleRail";
import { WechatThemeBaseStylePanel } from "./WechatThemeBaseStylePanel";

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
