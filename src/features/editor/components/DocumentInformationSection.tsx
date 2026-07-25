/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、编辑器模块、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 DocumentInformationSection、DocumentPropertyControl
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, ChevronDown, ExternalLink, FolderTree, Settings2, X } from "lucide-react";
import { lazy, Suspense, useMemo, useState, type KeyboardEvent } from "react";
import {
  getSheetPropertyValue,
  getDocumentPropertyDefinitions,
  getVisiblePropertyDefinitions,
  isSupportedPropertyValue,
  setSheetPropertyValue,
} from "@/features/editor/model/documentProperties";
import { buildSheetMarkdownPath, getVisibleProjectGroups } from "@/features/library/model/projectModel";
import { nowTimestamp } from "@/shared/lib/dates";
import type { MetadataValue, DocumentPropertyDefinition, WritingProject, WritingSheet } from "@/shared/types";

const PropertyDateCalendar = lazy(() =>
  import("@/shared/components/PropertyDateCalendar").then((module) => ({ default: module.PropertyDateCalendar })),
);

interface DocumentInformationSectionProps {
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onUpdateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  onManageFields: () => void;
}

export function DocumentInformationSection({
  project,
  sheet,
  libraryPath,
  onUpdateSheet,
  onManageFields,
}: DocumentInformationSectionProps) {
  const group = getVisibleProjectGroups(project).find((item) => item.id === sheet.groupId);
  const filePath = buildSheetMarkdownPath(libraryPath, project, sheet);
  const definitions = getDocumentPropertyDefinitions(project.documentPropertyDefinitions);
  const visibleDefinitions = getVisiblePropertyDefinitions(sheet, definitions);

  function updateValue(definition: DocumentPropertyDefinition, value: MetadataValue | undefined) {
    onUpdateSheet((current) => ({
      ...setSheetPropertyValue(current, definition, value),
      updatedAt: nowTimestamp(),
    }));
  }

  return (
    <section className="pb-5">
      {sheet.archivedAt && (
        <div className="mb-3.5 flex items-center justify-between gap-2 rounded-md border border-status-warning/30 bg-[var(--status-warning-soft)] px-2.5 py-2.25 text-xs font-semibold text-status-warning">
          <span>这篇文稿已归档</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdateSheet((current) => ({ ...current, archivedAt: "", updatedAt: nowTimestamp() }))}
          >
            恢复
          </Button>
        </div>
      )}

      <div className="mb-4.5 border-b border-border pb-3.5">
        <h2 className="text-[15px] font-bold">文稿信息</h2>
        <dl className="mt-3 grid gap-2">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs leading-[1.4] text-muted-foreground">所属项目</dt>
            <dd className="m-0 truncate text-xs leading-[1.4]">{project.title}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs leading-[1.4] text-muted-foreground">所属分组</dt>
            <dd className="m-0 truncate text-xs leading-[1.4]">{group?.title ?? "待整理"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs leading-[1.4] text-muted-foreground">创建时间</dt>
            <dd className="m-0 truncate text-xs leading-[1.4]">{sheet.createdAt || "未记录"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs leading-[1.4] text-muted-foreground">更新时间</dt>
            <dd className="m-0 truncate text-xs leading-[1.4]">{sheet.updatedAt || "未记录"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-xs leading-[1.4] text-muted-foreground">本地文件</dt>
            <dd className="m-0 truncate text-xs leading-[1.4]" title={filePath}>
              {filePath || "浏览器开发模式"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold">文稿属性</h2>
          <p className="mt-0.75 text-[11px] text-muted-foreground">系统属性归文稿所有，自定义属性按当前项目隔离。</p>
        </div>
        <Button variant="ghost" size="icon-sm" title="管理文稿属性" onClick={onManageFields}>
          <Settings2 size={15} />
        </Button>
      </div>

      <div className="grid gap-3.75">
        {visibleDefinitions.map((definition) => (
          <DocumentPropertyControl
            key={definition.id}
            definition={definition}
            value={getSheetPropertyValue(sheet, definition)}
            project={project}
            onChange={(value) => updateValue(definition, value)}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="mt-[17px]" onClick={onManageFields}>
          <Settings2 /> 管理属性
        </Button>
      </div>
    </section>
  );
}

interface DocumentPropertyControlProps {
  definition: DocumentPropertyDefinition;
  value: MetadataValue | undefined;
  project: WritingProject;
  onChange: (value: MetadataValue | undefined) => void;
  idPrefix?: string;
  showDescription?: boolean;
  layout?: "stacked" | "inline";
  labelClassName?: string;
}

export function DocumentPropertyControl({
  definition,
  value,
  project,
  onChange,
  idPrefix = "document-property",
  showDescription = true,
  layout = "stacked",
  labelClassName = "",
}: DocumentPropertyControlProps) {
  const controlId = `${idPrefix}-${definition.id}`;
  const stringValue = typeof value === "string" ? value : "";
  const inline = layout === "inline";

  return (
    <div className={inline ? "grid grid-cols-[minmax(0,88px)_minmax(0,1fr)] items-center gap-3" : "grid gap-1.75"}>
      <label className={`flex min-w-0 flex-col gap-0.5 text-xs font-semibold text-muted-foreground ${labelClassName}`} htmlFor={controlId}>
        <span>{definition.label}</span>
        {showDescription && definition.description && (
          <small className="truncate text-[10px] font-medium text-muted-foreground/70">{definition.description}</small>
        )}
      </label>
      <div className="min-w-0">
        {definition.type === "text" &&
          (definition.key === "summary" ? (
            <Textarea id={controlId} value={stringValue} rows={3} onChange={(event) => onChange(event.target.value)} />
          ) : (
            <Input id={controlId} value={stringValue} onChange={(event) => onChange(event.target.value)} />
          ))}
        {definition.type === "number" && (
          <Input
            id={controlId}
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
          />
        )}
        {definition.type === "checkbox" && (
          <div className={`flex items-center ${inline ? "justify-end" : ""}`}>
            <Checkbox id={controlId} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
          </div>
        )}
        {definition.type === "date" && (
          <DatePropertyControl controlId={controlId} label={definition.label} value={stringValue} onChange={onChange} />
        )}
        {definition.type === "url" && (
          <div className="relative">
            <Input
              id={controlId}
              type="url"
              value={stringValue}
              placeholder="https://"
              className={stringValue ? "pr-8" : undefined}
              onChange={(event) => onChange(event.target.value)}
            />
            {stringValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-0.5 right-0.5"
                title="打开链接"
                onClick={() => window.open(stringValue, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink />
              </Button>
            )}
          </div>
        )}
        {definition.type === "select" && (
          <Select
            value={stringValue || "__unset__"}
            onValueChange={(nextValue) => onChange(nextValue === "__unset__" ? undefined : nextValue)}
          >
            <SelectTrigger id={controlId} width={inline ? "fit" : "full"} className={inline ? "ml-auto min-w-24" : undefined}>
              <SelectValue placeholder="未设置" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unset__">未设置</SelectItem>
              {(definition.options ?? []).map((option) => (
                <SelectItem key={option.id} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {definition.type === "multiSelect" && (
          <MultiSelectControl controlId={controlId} definition={definition} value={value} onChange={onChange} />
        )}
        {definition.type === "tags" && (
          <TagsControl controlId={controlId} definition={definition} value={value} project={project} onChange={onChange} />
        )}
        {!isSupportedPropertyValue(value) && (
          <div className="flex items-start gap-1.5 text-[11px] leading-[1.4] text-muted-foreground">
            <FolderTree size={14} /> 复杂 YAML 值已保留，请在源码编辑器中修改。
          </div>
        )}
      </div>
    </div>
  );
}

function DatePropertyControl({
  controlId,
  label,
  value,
  onChange,
}: Pick<DocumentPropertyControlProps, "onChange"> & { controlId: string; label: string; value: string }) {
  const [open, setOpen] = useState(false);
  const selectedDate = parsePropertyDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={controlId}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          aria-label={selectedDate ? `${label}：${formatPropertyDateLabel(selectedDate)}` : `${label}：选择日期`}
        >
          <span>{selectedDate ? formatPropertyDateLabel(selectedDate) : "选择日期"}</span>
          <CalendarDays className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        variant="solid"
        align="end"
        sideOffset={5}
        className="w-auto p-1.5"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Suspense
          fallback={<div className="flex h-[228px] w-[212px] items-center justify-center text-xs text-muted-foreground">加载日历…</div>}
        >
          <PropertyDateCalendar
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(nextDate) => {
              if (!nextDate) return;
              onChange(formatPropertyDateValue(nextDate));
              setOpen(false);
            }}
            className="bg-transparent p-1"
          />
        </Suspense>
        {selectedDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 w-full text-muted-foreground"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            清除日期
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function parsePropertyDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
}

function formatPropertyDateLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatPropertyDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function MultiSelectControl({
  controlId,
  definition,
  value,
  onChange,
}: Pick<DocumentPropertyControlProps, "definition" | "value" | "onChange"> & { controlId: string }) {
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const summary = selected.length > 0 ? selected.join("、") : "选择选项";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button id={controlId} type="button" variant="outline" className="w-full justify-between gap-2 font-normal">
          <span className={`min-w-0 truncate ${selected.length === 0 ? "text-muted-foreground" : ""}`}>{summary}</span>
          <ChevronDown className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {(definition.options ?? []).length > 0 ? (
          (definition.options ?? []).map((option) => {
            const active = selected.includes(option.label);
            return (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={active}
                onCheckedChange={() => onChange(active ? selected.filter((item) => item !== option.label) : [...selected, option.label])}
                onSelect={(event) => event.preventDefault()}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />
                <span>{option.label}</span>
              </DropdownMenuCheckboxItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled>暂无选项</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TagsControl({
  controlId,
  value,
  project,
  onChange,
}: Pick<DocumentPropertyControlProps, "definition" | "value" | "project" | "onChange"> & { controlId: string }) {
  const [draft, setDraft] = useState("");
  const tags = useMemo(() => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []), [value]);
  const suggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...project.sheets.flatMap((sheet) => {
            return sheet.tags;
          }),
        ]),
      ).filter((tag) => !tags.includes(tag)),
    [project, tags],
  );

  function commitDraft() {
    const nextTags = draft
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (nextTags.length === 0) return;
    onChange(Array.from(new Set([...tags, ...nextTags])));
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    commitDraft();
  }

  return (
    <div className="flex flex-wrap gap-1.25">
      <div className="flex flex-wrap gap-1.25">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex min-h-6.25 items-center gap-0.75 rounded-md bg-accent px-1.25 pl-1.75 text-[11px] text-muted-foreground"
          >
            {tag}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={`移除 ${tag}`}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
            >
              <X />
            </Button>
          </span>
        ))}
      </div>
      <Input
        className="basis-full"
        id={controlId}
        list={`${controlId}-tag-suggestions`}
        value={draft}
        placeholder="输入后按回车"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
      />
      <datalist id={`${controlId}-tag-suggestions`}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
