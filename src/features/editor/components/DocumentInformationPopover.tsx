/**
 * [INPUT]: 依赖 shadcn/ui、Animate UI Tabs、lucide-react、React 运行时、shared 公共契约、编辑器模块与写作库模块
 * [OUTPUT]: 对外提供 DocumentInformationPopover、DocumentInformationPopoverPanel
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  CaseSensitive,
  Clock,
  FileText,
  Info,
  MapPin,
  MessageSquareText,
  Pilcrow,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type KeyboardEvent, type SVGProps } from "react";
import { nowTimestamp } from "@/shared/lib/dates";
import { getSheetPropertyValue, setSheetPropertyValue } from "@/features/editor/model/documentProperties";
import { revealLocalPath } from "@/features/library/model/persistence";
import { buildSheetMarkdownPath, getVisibleProjectGroups } from "@/features/library/model/projectModel";
import { countWords, sheetStats } from "@/shared/lib/text";
import type { MetadataValue, ProjectPropertyDefinition, WritingProject, WritingSheet } from "@/shared/types";
import { DocumentPropertyControl } from "@/features/editor/components/DocumentInformationSection";
import { LiquidGlassButton } from "@/shared/components/LiquidGlassButton";

type DocumentInformationTab = "properties" | "statistics";
type InformationIcon = ComponentType<SVGProps<SVGSVGElement>>;

const INFORMATION_TABS = [
  { value: "properties", label: "属性", icon: SlidersHorizontal },
  { value: "statistics", label: "统计", icon: BarChart3 },
] as const satisfies ReadonlyArray<{ value: DocumentInformationTab; label: string; icon: typeof SlidersHorizontal }>;

interface DocumentInformationPopoverProps {
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onUpdateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  onManageFields: () => void;
}

export function DocumentInformationPopover({
  project,
  sheet,
  libraryPath,
  onUpdateSheet,
  onManageFields,
}: DocumentInformationPopoverProps) {
  const [activeTab, setActiveTab] = useState<DocumentInformationTab>("properties");

  useEffect(() => {
    setActiveTab("properties");
  }, [sheet.id]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <LiquidGlassButton title="文稿信息" aria-label="文稿信息" data-no-window-drag>
          <Info size={17} />
        </LiquidGlassButton>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={10}
        collisionPadding={12}
        variant="solid"
        className="h-[436px] max-h-[calc(100vh-80px)] w-[min(350px,calc(100vw-24px))] overflow-visible rounded-[var(--menu-radius)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DocumentInformationPopoverPanel
          activeTab={activeTab}
          project={project}
          sheet={sheet}
          libraryPath={libraryPath}
          onActiveTabChange={setActiveTab}
          onUpdateSheet={onUpdateSheet}
          onManageFields={onManageFields}
        />
      </PopoverContent>
    </Popover>
  );
}

interface DocumentInformationPopoverPanelProps extends DocumentInformationPopoverProps {
  activeTab: DocumentInformationTab;
  onActiveTabChange: (tab: DocumentInformationTab) => void;
}

export function DocumentInformationPopoverPanel({
  activeTab,
  project,
  sheet,
  libraryPath,
  onActiveTabChange,
  onUpdateSheet,
  onManageFields,
}: DocumentInformationPopoverPanelProps) {
  return (
    <section
      className="flex h-full min-h-0 flex-col text-[var(--menu-body-foreground)] [--foreground:var(--menu-body-foreground)] [--muted-foreground:var(--menu-muted-foreground)]"
      aria-label="文稿信息面板"
    >
      <header className="shrink-0 px-5 pt-5 pb-4">
        <h2 className="text-center text-[17px] font-bold text-[var(--menu-title-foreground)]">
          {activeTab === "properties" ? "属性" : "统计"}
        </h2>
        <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as DocumentInformationTab)} className="mt-3.5">
          <TabsList className="grid w-full grid-cols-2" aria-label="文稿信息分类">
            {INFORMATION_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} aria-label={tab.label} title={tab.label}>
                  <Icon aria-hidden="true" />
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {activeTab === "properties" ? (
          <DocumentPropertiesPanel project={project} sheet={sheet} onUpdateSheet={onUpdateSheet} onManageFields={onManageFields} />
        ) : (
          <DocumentStatisticsPanel project={project} sheet={sheet} libraryPath={libraryPath} />
        )}
      </div>
    </section>
  );
}

function DocumentPropertiesPanel({
  project,
  sheet,
  onUpdateSheet,
  onManageFields,
}: Pick<DocumentInformationPopoverProps, "project" | "sheet" | "onUpdateSheet" | "onManageFields">) {
  const definitions = useMemo(
    () => (project.propertyDefinitions ?? []).filter((definition) => definition.key === "tags" || !definition.locked),
    [project.propertyDefinitions],
  );
  const tagDefinition = definitions.find((definition) => definition.key === "tags");
  const customDefinitions = definitions.filter((definition) => !definition.locked);

  function updateValue(definition: ProjectPropertyDefinition, value: MetadataValue | undefined) {
    onUpdateSheet((current) => ({
      ...setSheetPropertyValue(current, definition, value),
      updatedAt: nowTimestamp(),
    }));
  }

  return (
    <div>
      {tagDefinition && (
        <section>
          <h3 className="text-[13px] font-bold text-[var(--menu-body-foreground)]">标签</h3>
          <div className="mt-3">
            <DocumentPropertyControl
              idPrefix="document-information-popover-property"
              definition={tagDefinition}
              value={getSheetPropertyValue(sheet, tagDefinition)}
              project={project}
              showDescription={false}
              labelClassName="sr-only"
              onChange={(value) => updateValue(tagDefinition, value)}
            />
          </div>
        </section>
      )}

      <section className="mt-5">
        <h3 className="text-[13px] font-bold text-[var(--menu-body-foreground)]">属性</h3>
        {customDefinitions.length > 0 ? (
          <div className="mt-3 grid gap-3.5">
            {customDefinitions.map((definition) => (
              <DocumentPropertyControl
                key={definition.id}
                idPrefix="document-information-popover-property"
                definition={definition}
                value={getSheetPropertyValue(sheet, definition)}
                project={project}
                showDescription={false}
                layout="inline"
                labelClassName="text-[var(--menu-body-foreground)]"
                onChange={(value) => updateValue(definition, value)}
              />
            ))}
          </div>
        ) : (
          <Button type="button" variant="outline" className="mt-3 w-full" onClick={onManageFields}>
            设置自定义属性
          </Button>
        )}
      </section>
    </div>
  );
}

function DocumentStatisticsPanel({
  project,
  sheet,
  libraryPath,
}: Pick<DocumentInformationPopoverProps, "project" | "sheet" | "libraryPath">) {
  const group = getVisibleProjectGroups(project).find((item) => item.id === sheet.groupId);
  const filePath = buildSheetMarkdownPath(libraryPath, project, sheet) || "浏览器开发模式";
  const words = countWords(sheet.body);
  const stats = sheetStats(sheet);
  const groupTitle = group?.title.trim();
  const location = groupTitle && groupTitle !== project.title ? `${project.title} / ${groupTitle}` : project.title;

  function revealFileInFinder() {
    void revealLocalPath(filePath).catch((error: unknown) => {
      console.error("Failed to reveal the document in Finder.", error);
    });
  }

  return (
    <div className="grid gap-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <InformationCard icon={MessageSquareText} label="字数" value={formatInformationCount(words)} />
        <InformationCard icon={CaseSensitive} label="字符" value={formatInformationCount(stats.characters)} />
        <InformationCard icon={Pilcrow} label="段落" value={formatInformationCount(stats.paragraphs)} />
        <InformationCard icon={Clock} label="阅读时间" value={`${stats.readingMinutes} 分钟`} />
      </div>

      <dl className="overflow-hidden rounded-2xl bg-[var(--menu-card-background)]">
        <InformationRow icon={MapPin} label="所属位置" value={location} title={location} />
        <InformationRow icon={CalendarClock} label="编辑日期" value={formatInformationDate(sheet.updatedAt)} />
        <InformationRow icon={CalendarDays} label="创建日期" value={formatInformationDate(sheet.createdAt)} />
        <InformationRow
          icon={FileText}
          label="本地文件"
          value={filePath}
          title={filePath}
          compact
          onActivate={revealFileInFinder}
          actionLabel="在访达中显示本地文件"
        />
      </dl>
    </div>
  );
}

function InformationCard({ icon: Icon, label, value }: { icon: InformationIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[var(--menu-card-background)] p-3">
      <div className="flex items-start justify-between gap-2">
        <strong className="min-w-0 text-[15px] leading-5 font-bold tabular-nums">{value}</strong>
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/55 dark:text-[var(--menu-icon-subtle)]" aria-hidden="true" />
      </div>
      <span className="mt-2.5 block text-xs font-semibold text-[var(--menu-muted-foreground)]">{label}</span>
    </div>
  );
}

function InformationRow({
  icon: Icon,
  label,
  value,
  title,
  compact = false,
  onActivate,
  actionLabel,
}: {
  icon: InformationIcon;
  label: string;
  value: string;
  title?: string;
  compact?: boolean;
  onActivate?: () => void;
  actionLabel?: string;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onActivate || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onActivate();
  }

  return (
    <div
      className="grid grid-cols-[18px_64px_minmax(0,1fr)] items-center gap-2 border-b border-background/90 px-3 py-2.25 last:border-b-0"
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      aria-label={onActivate ? actionLabel : undefined}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
    >
      <Icon className="size-4 text-muted-foreground/60 dark:text-[var(--menu-icon-subtle)]" aria-hidden="true" />
      <dt className="text-xs font-semibold text-[var(--menu-muted-foreground)]">{label}</dt>
      <dd className={`m-0 min-w-0 truncate text-right ${compact ? "text-[11px]" : "text-xs font-semibold"}`} title={title}>
        {value}
      </dd>
    </div>
  );
}

function formatInformationDate(value: string | undefined): string {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatInformationCount(value: number): string {
  return value.toLocaleString("zh-CN");
}
