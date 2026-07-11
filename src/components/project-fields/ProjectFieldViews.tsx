import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare2,
  Hash,
  Link2,
  List,
  ListChecks,
  LockKeyhole,
  Pencil,
  Plus,
  Tags,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { createPropertyOption } from "../../lib/documentProperties";
import { FIELD_TYPES, fieldTypeLabel } from "../../constants/propertyFields";
import type { MetadataValue, ProjectPropertyDefinition, PropertyFieldType, PropertyOption } from "../../types";

export function FieldListScreen({
  definitions,
  onEdit,
  onRemove,
  onAdd,
}: {
  definitions: ProjectPropertyDefinition[];
  onEdit: (definition: ProjectPropertyDefinition) => void;
  onRemove: (definition: ProjectPropertyDefinition) => void;
  onAdd: () => void;
}) {
  return (
    <div className="property-field-list-screen">
      <div className="property-list-heading">
        <div>
          <h3>全部字段</h3>
          <small>{definitions.length} 个</small>
        </div>
        <button type="button" className="primary-button" onClick={onAdd}>
          <Plus size={14} /> 新增字段
        </button>
      </div>
      <div className="property-field-table">
        {definitions.map((definition) => (
          <div key={definition.id} className="property-field-table-row">
            <span className="property-field-icon">{fieldTypeIcon(definition.type)}</span>
            <span className="property-field-list-copy">
              <strong>{definition.label}</strong>
              <small>
                {fieldTypeLabel(definition.type)} · {definition.key}
              </small>
            </span>
            {definition.locked && (
              <span className="property-system-badge">
                <LockKeyhole size={11} /> 系统
              </span>
            )}
            <div className="property-field-row-actions">
              <button type="button" title="编辑字段" onClick={() => onEdit(definition)}>
                <Pencil size={14} />
              </button>
              {!definition.locked && (
                <button type="button" className="danger-icon-button" title="删除字段" onClick={() => onRemove(definition)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FieldDefinitionEditor({
  definition,
  index,
  fieldCount,
  onUpdate,
  onMove,
  onRemove,
  onChangeType,
  onRemoveOption,
  onMoveOption,
  onApplyDefault,
  defaultApplicationPending,
  defaultApplicationNotice,
}: {
  definition: ProjectPropertyDefinition;
  index: number;
  fieldCount: number;
  onUpdate: (updater: (definition: ProjectPropertyDefinition) => ProjectPropertyDefinition) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onChangeType: (type: PropertyFieldType) => void;
  onRemoveOption: (option: PropertyOption) => void;
  onMoveOption: (optionId: string, direction: -1 | 1) => void;
  onApplyDefault: () => void;
  defaultApplicationPending: boolean;
  defaultApplicationNotice: string;
}) {
  return (
    <div className="property-detail-content">
      <div className="property-detail-heading">
        <div className="property-detail-title">
          <span>{fieldTypeIcon(definition.type)}</span>
          <div>
            <h3>{definition.label}</h3>
            <small>{definition.locked ? "系统字段" : "自定义字段"}</small>
          </div>
        </div>
        <div className="property-detail-actions">
          <button type="button" title="上移" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp size={15} />
          </button>
          <button type="button" title="下移" disabled={index === fieldCount - 1} onClick={() => onMove(1)}>
            <ArrowDown size={15} />
          </button>
          {!definition.locked && (
            <button type="button" className="danger-icon-button" title="移除字段" onClick={onRemove}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="property-detail-form">
        <div className="property-definition-grid">
          <label>
            <span>字段名称</span>
            <input
              value={definition.label}
              disabled={definition.locked}
              onChange={(event) => onUpdate((current) => ({ ...current, label: event.target.value }))}
            />
          </label>
          <label>
            <span>字段类型</span>
            <select
              value={definition.type}
              disabled={definition.locked}
              onChange={(event) => onChangeType(event.target.value as PropertyFieldType)}
            >
              {FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="property-description-field">
          <span>说明</span>
          <input
            value={definition.description ?? ""}
            disabled={definition.locked}
            placeholder="可选"
            onChange={(event) => onUpdate((current) => ({ ...current, description: event.target.value }))}
          />
        </label>

        <label className="property-key-field">
          <span>YAML 键</span>
          <input value={definition.key} disabled />
        </label>

        {(definition.type === "select" || definition.type === "multiSelect") && (
          <div className="property-options-editor">
            <div className="property-section-heading">
              <span>预设选项</span>
              <small>{definition.options?.length ?? 0}</small>
            </div>
            <div className="property-option-list">
              {(definition.options ?? []).map((option, optionIndex) => (
                <div key={option.id} className="property-option-row">
                  <input
                    type="color"
                    value={option.color || "#8e8e93"}
                    aria-label={`${option.label}颜色`}
                    disabled={definition.locked}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        options: (current.options ?? []).map((item) =>
                          item.id === option.id ? { ...item, color: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <input
                    value={option.label}
                    disabled={definition.locked}
                    onChange={(event) =>
                      onUpdate((current) => ({
                        ...current,
                        options: (current.options ?? []).map((item) =>
                          item.id === option.id ? { ...item, label: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  {!definition.locked && (
                    <div className="property-option-actions">
                      <button type="button" title="上移选项" disabled={optionIndex === 0} onClick={() => onMoveOption(option.id, -1)}>
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        title="下移选项"
                        disabled={optionIndex === (definition.options?.length ?? 0) - 1}
                        onClick={() => onMoveOption(option.id, 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button type="button" title="删除选项" onClick={() => onRemoveOption(option)}>
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!definition.locked && (
              <button
                type="button"
                className="property-add-option-button"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    options: [...(current.options ?? []), createPropertyOption("", current.options?.length ?? 0)],
                  }))
                }
              >
                <Plus size={13} /> 添加选项
              </button>
            )}
          </div>
        )}

        <div className="property-default-section">
          <DefaultValueControl definition={definition} onChange={(value) => onUpdate((current) => ({ ...current, defaultValue: value }))} />
          <label className="property-show-empty-control">
            <span>空值时显示</span>
            <input
              type="checkbox"
              checked={definition.showWhenEmpty ?? true}
              onChange={(event) => onUpdate((current) => ({ ...current, showWhenEmpty: event.target.checked }))}
            />
          </label>
          <button type="button" className="property-apply-default-button" disabled={defaultApplicationPending} onClick={onApplyDefault}>
            {defaultApplicationPending ? "保存后将应用到已有文稿" : "应用到已有空值文稿"}
          </button>
          {defaultApplicationNotice && <p className="property-default-notice">{defaultApplicationNotice}</p>}
        </div>
      </div>
    </div>
  );
}

export function NewFieldEditor({
  name,
  type,
  onNameChange,
  onTypeChange,
  onAdd,
}: {
  name: string;
  type: PropertyFieldType;
  onNameChange: (name: string) => void;
  onTypeChange: (type: PropertyFieldType) => void;
  onAdd: () => void;
}) {
  return (
    <div className="property-detail-content property-new-field-detail">
      <div className="property-detail-heading">
        <div className="property-detail-title">
          <span>
            <Plus size={17} />
          </span>
          <div>
            <h3>新增字段</h3>
            <small>自定义字段</small>
          </div>
        </div>
      </div>
      <div className="property-new-field-form">
        <label>
          <span>字段名称</span>
          <input value={name} placeholder="例如：公众号发布" autoFocus onChange={(event) => onNameChange(event.target.value)} />
        </label>
        <div className="property-type-picker">
          <span>字段类型</span>
          <div>
            {FIELD_TYPES.map((fieldType) => (
              <button
                key={fieldType.value}
                type="button"
                className={type === fieldType.value ? "selected" : ""}
                onClick={() => onTypeChange(fieldType.value)}
              >
                {fieldTypeIcon(fieldType.value)}
                <span>{fieldType.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="primary-button property-confirm-add" disabled={!name.trim()} onClick={onAdd}>
          <Plus size={14} /> 添加字段
        </button>
      </div>
    </div>
  );
}

function fieldTypeIcon(type: PropertyFieldType) {
  if (type === "number") return <Hash size={15} />;
  if (type === "checkbox") return <CheckSquare2 size={15} />;
  if (type === "date") return <CalendarDays size={15} />;
  if (type === "url") return <Link2 size={15} />;
  if (type === "select") return <List size={15} />;
  if (type === "multiSelect") return <ListChecks size={15} />;
  if (type === "tags") return <Tags size={15} />;
  return <Type size={15} />;
}

function DefaultValueControl({
  definition,
  onChange,
}: {
  definition: ProjectPropertyDefinition;
  onChange: (value: MetadataValue | undefined) => void;
}) {
  const value = definition.defaultValue;
  if (definition.type === "checkbox") {
    return (
      <label className="property-default-checkbox">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        新文稿默认勾选
      </label>
    );
  }
  if (definition.type === "select") {
    return (
      <label>
        <span>默认值</span>
        <select value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)}>
          <option value="">无</option>
          {(definition.options ?? []).map((option) => (
            <option key={option.id} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (definition.type === "number") {
    return (
      <label>
        <span>默认值</span>
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        />
      </label>
    );
  }
  if (definition.type === "date") {
    return (
      <label>
        <span>默认值</span>
        <input type="date" value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} />
      </label>
    );
  }
  if (definition.type === "multiSelect") {
    const selected = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return (
      <div className="property-default-multi-select">
        <span>默认值</span>
        <div>
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
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (definition.type === "tags") {
    const tags = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    return (
      <label>
        <span>默认标签</span>
        <input
          value={tags.join(", ")}
          placeholder="使用逗号分隔"
          onChange={(event) =>
            onChange(
              Array.from(
                new Set(
                  event.target.value
                    .split(/[,，]/)
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                ),
              ),
            )
          }
        />
      </label>
    );
  }
  return (
    <label>
      <span>默认值</span>
      <input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} />
    </label>
  );
}
