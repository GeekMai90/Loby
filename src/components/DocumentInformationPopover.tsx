import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { nowTimestamp } from "../lib/dates";
import { getSheetPropertyValue, setSheetPropertyValue } from "../lib/documentProperties";
import { revealLocalPath } from "../lib/persistence";
import { buildSheetMarkdownPath, getVisibleProjectGroups } from "../lib/projectModel";
import { countWords, sheetStats } from "../lib/text";
import type { MetadataValue, ProjectPropertyDefinition, WritingProject, WritingSheet } from "../types";
import { DocumentPropertyControl } from "./DocumentInformationSection";
import { LiquidGlassButton } from "./LiquidGlassButton";

type DocumentInformationTab = "properties" | "statistics";
type InformationIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface DocumentInformationPopoverProps {
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onUpdateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
}

export function DocumentInformationPopover({ project, sheet, libraryPath, onUpdateSheet }: DocumentInformationPopoverProps) {
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
}: DocumentInformationPopoverPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="文稿信息面板">
      <header className="shrink-0 px-5 pt-5 pb-4">
        <h2 className="text-center text-[17px] font-bold">{activeTab === "properties" ? "属性" : "统计"}</h2>
        <div className="mt-3.5 grid grid-cols-2 rounded-lg bg-muted/75 p-0.5" role="tablist" aria-label="文稿信息分类">
          <InformationTabButton
            active={activeTab === "properties"}
            icon={SlidersHorizontal}
            label="属性"
            onClick={() => onActiveTabChange("properties")}
          />
          <InformationTabButton
            active={activeTab === "statistics"}
            icon={BarChart3}
            label="统计"
            onClick={() => onActiveTabChange("statistics")}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {activeTab === "properties" ? (
          <DocumentPropertiesPanel project={project} sheet={sheet} onUpdateSheet={onUpdateSheet} />
        ) : (
          <DocumentStatisticsPanel project={project} sheet={sheet} libraryPath={libraryPath} />
        )}
      </div>
    </section>
  );
}

function InformationTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: InformationIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      className={`flex h-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-1 focus-visible:ring-foreground/20 ${
        active ? "bg-background text-foreground shadow-sm ring-1 ring-border/80" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

function DocumentPropertiesPanel({
  project,
  sheet,
  onUpdateSheet,
}: Pick<DocumentInformationPopoverProps, "project" | "sheet" | "onUpdateSheet">) {
  const definitions = useMemo(
    () => (project.propertyDefinitions ?? []).filter((definition) => definition.key === "tags" || !definition.locked),
    [project.propertyDefinitions],
  );

  function updateValue(definition: ProjectPropertyDefinition, value: MetadataValue | undefined) {
    onUpdateSheet((current) => ({
      ...setSheetPropertyValue(current, definition, value),
      updatedAt: nowTimestamp(),
    }));
  }

  return (
    <div className="grid gap-4">
      {definitions.map((definition) => (
        <DocumentPropertyControl
          key={definition.id}
          idPrefix="document-information-popover-property"
          definition={definition}
          value={getSheetPropertyValue(sheet, definition)}
          project={project}
          showDescription={false}
          onChange={(value) => updateValue(definition, value)}
        />
      ))}
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

      <dl className="overflow-hidden rounded-2xl bg-muted/70">
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
    <div className="min-w-0 rounded-2xl bg-muted/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <strong className="min-w-0 text-[15px] leading-5 font-bold tabular-nums">{value}</strong>
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/55" aria-hidden="true" />
      </div>
      <span className="mt-2.5 block text-xs font-semibold text-muted-foreground">{label}</span>
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
      <Icon className="size-4 text-muted-foreground/60" aria-hidden="true" />
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
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
