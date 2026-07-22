/**
 * [INPUT]: 依赖 lucide-react、Animate UI Tabs、发布模块与 shared 公共契约
 * [OUTPUT]: 对外提供 WechatThemeLeftRailView、WechatThemeLeftRail
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { FileText, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import type { WechatThemeBaseStyleChange } from "@/features/publishing/model/wechatThemeBaseStyle";
import type { WechatThemeBaseStyle } from "@/features/publishing/model/wechatThemes";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { WechatThemeArticleRail } from "@/features/publishing/components/WechatThemeArticleRail";
import { WechatThemeBaseStylePanel } from "@/features/publishing/components/WechatThemeBaseStylePanel";

export type WechatThemeLeftRailView = "articles" | "styles";

const LEFT_RAIL_TABS = [
  { value: "articles", label: "文章", icon: FileText },
  { value: "styles", label: "样式", icon: SlidersHorizontal },
] as const;

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
        <Tabs value={view} onValueChange={(value) => onViewChange(value as WechatThemeLeftRailView)}>
          <TabsList className="grid w-full grid-cols-2" aria-label="主题编辑功能">
            {LEFT_RAIL_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} aria-label={tab.label}>
                  <Icon aria-hidden="true" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
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
