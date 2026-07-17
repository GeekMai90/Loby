import { FileText, SlidersHorizontal } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WechatThemeBaseStyleChange } from "../lib/publishing/wechatThemeBaseStyle";
import type { WechatThemeBaseStyle } from "../lib/publishing/wechatThemes";
import type { WritingProject, WritingSheet } from "../types";
import { WechatThemeArticleRail } from "./WechatThemeArticleRail";
import { WechatThemeBaseStylePanel } from "./WechatThemeBaseStylePanel";

export type WechatThemeLeftRailView = "articles" | "styles";

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
        <ToggleGroup
          type="single"
          value={view}
          variant="outline"
          size="sm"
          spacing={1}
          className="grid w-full grid-cols-2 bg-background/70"
          aria-label="左侧面板"
          onValueChange={(value) => {
            if (value === "articles" || value === "styles") onViewChange(value);
          }}
        >
          <ToggleGroupItem value="articles" aria-label="选择文章">
            <FileText /> 文章
          </ToggleGroupItem>
          <ToggleGroupItem value="styles" aria-label="设置基础样式">
            <SlidersHorizontal /> 样式
          </ToggleGroupItem>
        </ToggleGroup>
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
