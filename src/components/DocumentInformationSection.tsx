import { Check, ExternalLink, FolderTree, Plus, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [forcedVisibleFieldIds, setForcedVisibleFieldIds] = useState<string[]>([]);
  const addPropertyRef = useRef<HTMLDivElement>(null);
  const visibleDefinitions = getVisiblePropertyDefinitions(sheet, definitions, forcedVisibleFieldIds);
  const hiddenDefinitions = definitions.filter((definition) => !visibleDefinitions.some((visible) => visible.id === definition.id));

  useEffect(() => {
    setForcedVisibleFieldIds([]);
    setAddPropertyOpen(false);
  }, [sheet.id]);

  useEffect(() => {
    if (!addPropertyOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!addPropertyRef.current?.contains(event.target as Node)) setAddPropertyOpen(false);
    }
    window.addEventListener("mousedown", closeOnOutsideClick);
    return () => window.removeEventListener("mousedown", closeOnOutsideClick);
  }, [addPropertyOpen]);

  function updateValue(definition: ProjectPropertyDefinition, value: MetadataValue | undefined) {
    onUpdateSheet((current) => ({
      ...setSheetPropertyValue(current, definition, value),
      updatedAt: nowTimestamp(),
    }));
  }

  function revealProperty(definition: ProjectPropertyDefinition) {
    setForcedVisibleFieldIds((current) => (current.includes(definition.id) ? current : [...current, definition.id]));
    setAddPropertyOpen(false);
    requestAnimationFrame(() => document.getElementById(`document-property-${definition.id}`)?.focus());
  }

  return (
    <section className="document-information-section">
      {sheet.archivedAt && (
        <div className="document-archived-notice">
          <span>这篇文稿已归档</span>
          <button type="button" onClick={() => onUpdateSheet((current) => ({ ...current, archivedAt: "", updatedAt: nowTimestamp() }))}>
            恢复
          </button>
        </div>
      )}

      <details className="document-system-information">
        <summary>文稿信息</summary>
        <dl>
          <div>
            <dt>所属项目</dt>
            <dd>{project.title}</dd>
          </div>
          <div>
            <dt>所属分组</dt>
            <dd>{group?.title ?? "默认组"}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{sheet.createdAt || "未记录"}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{sheet.updatedAt || "未记录"}</dd>
          </div>
          <div>
            <dt>本地文件</dt>
            <dd title={filePath}>{filePath || "浏览器开发模式"}</dd>
          </div>
        </dl>
      </details>

      <div className="document-properties-heading">
        <div>
          <h2>文稿属性</h2>
          <p>字段结构由当前项目统一管理。</p>
        </div>
        <button type="button" className="icon-button" title="管理项目字段" onClick={onManageFields}>
          <Settings2 size={15} />
        </button>
      </div>

      <div className="document-property-list">
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

      <div className="document-add-property" ref={addPropertyRef}>
        <button type="button" className="document-add-property-button" onClick={() => setAddPropertyOpen((open) => !open)}>
          <Plus size={15} /> 添加属性
        </button>
        {addPropertyOpen && (
          <div className="document-add-property-menu">
            {hiddenDefinitions.length > 0 && <small>可添加字段</small>}
            {hiddenDefinitions.map((definition) => (
              <button key={definition.id} type="button" onClick={() => revealProperty(definition)}>
                <Plus size={13} />
                <span>{definition.label}</span>
              </button>
            ))}
            {hiddenDefinitions.length > 0 && <div className="document-property-menu-separator" />}
            <button type="button" onClick={onManageFields}>
              <Settings2 size={13} />
              <span>管理项目字段</span>
            </button>
          </div>
        )}
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
    <div className="document-property-row">
      <label htmlFor={controlId}>
        <span>{definition.label}</span>
        {definition.description && <small>{definition.description}</small>}
      </label>
      {definition.type === "text" &&
        (definition.key === "summary" ? (
          <textarea id={controlId} value={stringValue} rows={3} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <input id={controlId} value={stringValue} onChange={(event) => onChange(event.target.value)} />
        ))}
      {definition.type === "number" && (
        <input
          id={controlId}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        />
      )}
      {definition.type === "checkbox" && (
        <button
          id={controlId}
          type="button"
          className={`document-checkbox-control ${value === true ? "checked" : ""}`}
          role="checkbox"
          aria-checked={value === true}
          onClick={() => onChange(value !== true)}
        >
          <span>{value === true && <Check size={13} />}</span>
          {value === true ? "已勾选" : "未勾选"}
        </button>
      )}
      {definition.type === "date" && (
        <input id={controlId} type="date" value={stringValue.slice(0, 10)} onChange={(event) => onChange(event.target.value)} />
      )}
      {definition.type === "url" && (
        <div className="document-url-control">
          <input id={controlId} type="url" value={stringValue} placeholder="https://" onChange={(event) => onChange(event.target.value)} />
          {stringValue && (
            <button type="button" title="打开链接" onClick={() => window.open(stringValue, "_blank", "noopener,noreferrer")}>
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      )}
      {definition.type === "select" && (
        <select id={controlId} value={stringValue} onChange={(event) => onChange(event.target.value || undefined)}>
          <option value="">未设置</option>
          {(definition.options ?? []).map((option) => (
            <option key={option.id} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {definition.type === "multiSelect" && (
        <MultiSelectControl controlId={controlId} definition={definition} value={value} onChange={onChange} />
      )}
      {definition.type === "tags" && (
        <TagsControl controlId={controlId} definition={definition} value={value} project={project} onChange={onChange} />
      )}
      {!isSupportedPropertyValue(value) && (
        <div className="document-unsupported-property">
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
    <div id={controlId} className="document-option-grid" tabIndex={-1}>
      {(definition.options ?? []).map((option) => {
        const active = selected.includes(option.label);
        return (
          <button
            key={option.id}
            type="button"
            className={active ? "selected" : ""}
            onClick={() => onChange(active ? selected.filter((item) => item !== option.label) : [...selected, option.label])}
          >
            <span style={{ backgroundColor: option.color }} />
            {option.label}
            {active && <Check size={12} />}
          </button>
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
    <div className="document-tags-control">
      <div className="document-tag-list">
        {tags.map((tag) => (
          <span key={tag}>
            {tag}
            <button type="button" title={`移除 ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <input
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
