import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { Textarea } from "@/components/ui/textarea";
import { Check, ExternalLink, FolderTree, Plus, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  getSheetPropertyValue,
  getVisiblePropertyDefinitions,
  isSupportedPropertyValue,
  setSheetPropertyValue,
} from "../lib/documentProperties";
import { buildSheetMarkdownPath, getVisibleProjectGroups } from "../lib/projectModel";
import { nowTimestamp } from "../lib/dates";
import type { MetadataValue, ProjectPropertyDefinition, WritingProject, WritingSheet } from "../types";

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
  const definitions = project.propertyDefinitions ?? [];
  const [forcedVisibleFieldIds, setForcedVisibleFieldIds] = useState<string[]>([]);
  const visibleDefinitions = getVisiblePropertyDefinitions(sheet, definitions, forcedVisibleFieldIds);
  const hiddenDefinitions = definitions.filter((definition) => !visibleDefinitions.some((visible) => visible.id === definition.id));

  useEffect(() => {
    setForcedVisibleFieldIds([]);
  }, [sheet.id]);

  function updateValue(definition: ProjectPropertyDefinition, value: MetadataValue | undefined) {
    onUpdateSheet((current) => ({
      ...setSheetPropertyValue(current, definition, value),
      updatedAt: nowTimestamp(),
    }));
  }

  function revealProperty(definition: ProjectPropertyDefinition) {
    setForcedVisibleFieldIds((current) => (current.includes(definition.id) ? current : [...current, definition.id]));
    requestAnimationFrame(() => document.getElementById(`document-property-${definition.id}`)?.focus());
  }

  return (
    <section className="pb-5">
      {sheet.archivedAt && (
        <div className="mb-3.5 flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-50/90 px-2.5 py-2.25 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
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

      <details className="mb-4.5 border-b border-border pb-3.5">
        <summary className="cursor-default text-xs font-semibold text-muted-foreground">文稿信息</summary>
        <dl className="mt-3 grid gap-2">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-[11px] leading-[1.4] text-muted-foreground">所属项目</dt>
            <dd className="m-0 truncate text-[11px] leading-[1.4] text-muted-foreground">{project.title}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-[11px] leading-[1.4] text-muted-foreground">所属分组</dt>
            <dd className="m-0 truncate text-[11px] leading-[1.4] text-muted-foreground">{group?.title ?? "默认组"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-[11px] leading-[1.4] text-muted-foreground">创建时间</dt>
            <dd className="m-0 truncate text-[11px] leading-[1.4] text-muted-foreground">{sheet.createdAt || "未记录"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-[11px] leading-[1.4] text-muted-foreground">更新时间</dt>
            <dd className="m-0 truncate text-[11px] leading-[1.4] text-muted-foreground">{sheet.updatedAt || "未记录"}</dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
            <dt className="text-[11px] leading-[1.4] text-muted-foreground">本地文件</dt>
            <dd className="m-0 truncate text-[11px] leading-[1.4] text-muted-foreground" title={filePath}>
              {filePath || "浏览器开发模式"}
            </dd>
          </div>
        </dl>
      </details>

      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold">文稿属性</h2>
          <p className="mt-0.75 text-[11px] text-muted-foreground">字段结构由当前项目统一管理。</p>
        </div>
        <Button variant="ghost" size="icon-sm" title="管理项目字段" onClick={onManageFields}>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-[17px]">
              <Plus /> 添加属性
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-52">
            {hiddenDefinitions.length > 0 && <DropdownMenuLabel>可添加字段</DropdownMenuLabel>}
            {hiddenDefinitions.map((definition) => (
              <DropdownMenuItem key={definition.id} onSelect={() => revealProperty(definition)}>
                <Plus />
                <span>{definition.label}</span>
              </DropdownMenuItem>
            ))}
            {hiddenDefinitions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={onManageFields}>
              <Settings2 />
              <span>管理项目字段</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </section>
  );
}

interface DocumentPropertyControlProps {
  definition: ProjectPropertyDefinition;
  value: MetadataValue | undefined;
  project: WritingProject;
  onChange: (value: MetadataValue | undefined) => void;
}

function DocumentPropertyControl({ definition, value, project, onChange }: DocumentPropertyControlProps) {
  const controlId = `document-property-${definition.id}`;
  const stringValue = typeof value === "string" ? value : "";

  return (
    <div className="grid gap-1.75">
      <label className="flex min-w-0 flex-col gap-0.5 text-xs font-semibold text-muted-foreground" htmlFor={controlId}>
        <span>{definition.label}</span>
        {definition.description && (
          <small className="truncate text-[10px] font-medium text-muted-foreground/70">{definition.description}</small>
        )}
      </label>
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch id={controlId} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
          <span>{value === true ? "已勾选" : "未勾选"}</span>
        </div>
      )}
      {definition.type === "date" && (
        <Input id={controlId} type="date" value={stringValue.slice(0, 10)} onChange={(event) => onChange(event.target.value)} />
      )}
      {definition.type === "url" && (
        <div className="grid grid-cols-[minmax(0,1fr)_28px] gap-1.25">
          <Input id={controlId} type="url" value={stringValue} placeholder="https://" onChange={(event) => onChange(event.target.value)} />
          {stringValue && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
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
          <SelectTrigger id={controlId} className="w-full">
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
  );
}

function MultiSelectControl({
  controlId,
  definition,
  value,
  onChange,
}: Pick<DocumentPropertyControlProps, "definition" | "value" | "onChange"> & { controlId: string }) {
  const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return (
    <div id={controlId} className="flex flex-wrap gap-1.25" tabIndex={-1}>
      {(definition.options ?? []).map((option) => {
        const active = selected.includes(option.label);
        return (
          <Toggle
            key={option.id}
            pressed={active}
            variant="outline"
            size="sm"
            onClick={() => onChange(active ? selected.filter((item) => item !== option.label) : [...selected, option.label])}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} />
            {option.label}
            {active && <Check />}
          </Toggle>
        );
      })}
    </div>
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
          ...project.tags,
          ...project.sheets.flatMap((sheet) => {
            const value = sheet.properties?.tags;
            return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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
        list="document-tag-suggestions"
        value={draft}
        placeholder="输入后按回车"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
      />
      <datalist id="document-tag-suggestions">
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
