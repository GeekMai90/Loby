import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare2,
  ChevronLeft,
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
import { useEffect, useMemo, useState } from "react";
import {
  applyDefinitionDefaultToSheet,
  countSheetsMissingPropertyValue,
  createPropertyDefinition,
  createPropertyOption,
  isEmptyMetadataValue,
} from "../lib/documentProperties";
import {
  applyPendingValueMigrations,
  migrateSheetValues,
  normalizeDefinitionForSave,
  removeSheetPropertyValues,
  resolveOptionMigrationTargets,
  replaceOptionValue,
  convertMetadataValue,
  type OptionValueMigration,
  type TypeValueMigration,
} from "../lib/propertyDefinitionMigrations";
import { nowTimestamp } from "../lib/dates";
import type { MetadataValue, ProjectPropertyDefinition, PropertyFieldType, PropertyOption, WritingProject } from "../types";

const FIELD_TYPES: Array<{ value: PropertyFieldType; label: string }> = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "checkbox", label: "Checkbox" },
  { value: "date", label: "日期" },
  { value: "url", label: "URL" },
  { value: "select", label: "单选" },
  { value: "multiSelect", label: "多选" },
  { value: "tags", label: "标签" },
];

const NEW_FIELD_ID = "__new-field__";

type PendingFieldChange =
  | { kind: "removeField"; definition: ProjectPropertyDefinition; usage: number }
  | { kind: "removeOption"; definition: ProjectPropertyDefinition; option: PropertyOption; usage: number }
  | {
      kind: "changeType";
      definition: ProjectPropertyDefinition;
      nextType: PropertyFieldType;
      usage: number;
      incompatible: number;
    };

interface PendingDefaultApplication {
  definition: ProjectPropertyDefinition;
  count: number;
}

interface ProjectFieldManagerDialogProps {
  open: boolean;
  project: WritingProject | undefined;
  onClose: () => void;
  onSave: (project: WritingProject) => void;
}

export function ProjectFieldManagerDialog({ open, project, onClose, onSave }: ProjectFieldManagerDialogProps) {
  const [draftDefinitions, setDraftDefinitions] = useState<ProjectPropertyDefinition[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<PropertyFieldType>("text");
  const [defaultApplications, setDefaultApplications] = useState<string[]>([]);
  const [pendingFieldChange, setPendingFieldChange] = useState<PendingFieldChange | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState("");
  const [removedValueKeys, setRemovedValueKeys] = useState<string[]>([]);
  const [optionValueMigrations, setOptionValueMigrations] = useState<OptionValueMigration[]>([]);
  const [typeValueMigrations, setTypeValueMigrations] = useState<TypeValueMigration[]>([]);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [pendingDefaultApplication, setPendingDefaultApplication] = useState<PendingDefaultApplication | null>(null);
  const [defaultApplicationNotice, setDefaultApplicationNotice] = useState("");

  useEffect(() => {
    if (!open || !project) return;
    const definitions = cloneDefinitions(project.propertyDefinitions ?? []);
    setDraftDefinitions(definitions);
    setSelectedFieldId("");
    setNewFieldName("");
    setNewFieldType("text");
    setDefaultApplications([]);
    setPendingFieldChange(null);
    setPendingReplacement("");
    setRemovedValueKeys([]);
    setOptionValueMigrations([]);
    setTypeValueMigrations([]);
    setDiscardConfirmationOpen(false);
    setPendingDefaultApplication(null);
    setDefaultApplicationNotice("");
  }, [open, project]);

  const originalDefinitions = useMemo(() => cloneDefinitions(project?.propertyDefinitions ?? []), [project]);
  if (!open || !project) return null;
  const currentProject = project;
  const selectedDefinition = draftDefinitions.find((definition) => definition.id === selectedFieldId);
  const hasUnsavedChanges =
    JSON.stringify(draftDefinitions) !== JSON.stringify(originalDefinitions) ||
    defaultApplications.length > 0 ||
    removedValueKeys.length > 0 ||
    optionValueMigrations.length > 0 ||
    typeValueMigrations.length > 0 ||
    Boolean(newFieldName.trim());

  function requestClose() {
    if (hasUnsavedChanges) {
      setDiscardConfirmationOpen(true);
      return;
    }
    onClose();
  }

  function updateDefinition(id: string, updater: (definition: ProjectPropertyDefinition) => ProjectPropertyDefinition) {
    setDraftDefinitions((current) => current.map((definition) => (definition.id === id ? updater(definition) : definition)));
  }

  function moveDefinition(id: string, direction: -1 | 1) {
    setDraftDefinitions((current) => {
      const index = current.findIndex((definition) => definition.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [definition] = next.splice(index, 1);
      next.splice(nextIndex, 0, definition);
      return next;
    });
  }

  function addField() {
    if (!newFieldName.trim()) return;
    const definition = createPropertyDefinition(newFieldName, newFieldType, draftDefinitions);
    setDraftDefinitions((current) => [...current, definition]);
    setSelectedFieldId(definition.id);
    setNewFieldName("");
    setNewFieldType("text");
  }

  function removeDefinition(definition: ProjectPropertyDefinition) {
    if (definition.locked) return;
    const usage = countFieldUsage(currentProject, definition.key);
    if (usage > 0) {
      setPendingFieldChange({ kind: "removeField", definition, usage });
      return;
    }
    commitRemoveDefinition(definition, false);
  }

  function commitRemoveDefinition(definition: ProjectPropertyDefinition, deleteValues: boolean) {
    const index = draftDefinitions.findIndex((item) => item.id === definition.id);
    const nextSelection = draftDefinitions[index + 1]?.id ?? draftDefinitions[index - 1]?.id ?? NEW_FIELD_ID;
    setDraftDefinitions((current) => current.filter((item) => item.id !== definition.id));
    setDefaultApplications((current) => current.filter((id) => id !== definition.id));
    setOptionValueMigrations((current) => current.filter((migration) => migration.fieldKey !== definition.key));
    setTypeValueMigrations((current) => current.filter((migration) => migration.fieldKey !== definition.key));
    if (deleteValues) setRemovedValueKeys((current) => (current.includes(definition.key) ? current : [...current, definition.key]));
    setSelectedFieldId(nextSelection);
    setPendingFieldChange(null);
  }

  function changeType(definition: ProjectPropertyDefinition, type: PropertyFieldType) {
    const usage = countFieldUsage(currentProject, definition.key);
    if (usage > 0) {
      const options =
        type === "select" || type === "multiSelect"
          ? definition.options && definition.options.length > 0
            ? definition.options
            : [createPropertyOption("选项 1", 0), createPropertyOption("选项 2", 1)]
          : [];
      const incompatible = currentProject.sheets.filter((sheet) => {
        const value = sheet.properties?.[definition.key];
        return value !== undefined && convertMetadataValue(value, type, options) === undefined;
      }).length;
      setPendingFieldChange({ kind: "changeType", definition, nextType: type, usage, incompatible });
      return;
    }
    commitTypeChange(definition, type, "convert");
  }

  function commitTypeChange(definition: ProjectPropertyDefinition, type: PropertyFieldType, mode: "convert" | "clear") {
    updateDefinition(definition.id, (current) => ({
      ...current,
      type,
      options:
        type === "select" || type === "multiSelect"
          ? current.options && current.options.length > 0
            ? current.options
            : [createPropertyOption("选项 1", 0), createPropertyOption("选项 2", 1)]
          : [],
      defaultValue: defaultValueForType(type),
    }));
    setTypeValueMigrations((current) => [
      ...current.filter((migration) => migration.fieldKey !== definition.key),
      { fieldKey: definition.key, nextType: type, mode },
    ]);
    setPendingFieldChange(null);
  }

  function removeOption(definition: ProjectPropertyDefinition, option: PropertyOption) {
    const usage = countOptionUsage(currentProject, definition.key, option.label);
    if (usage > 0) {
      const replacement = (definition.options ?? []).find((item) => item.id !== option.id)?.label ?? "";
      setPendingReplacement(replacement);
      setPendingFieldChange({ kind: "removeOption", definition, option, usage });
      return;
    }
    commitRemoveOption(definition, option);
  }

  function moveOption(definition: ProjectPropertyDefinition, optionId: string, direction: -1 | 1) {
    updateDefinition(definition.id, (current) => {
      const options = [...(current.options ?? [])];
      const index = options.findIndex((option) => option.id === optionId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= options.length) return current;
      const [option] = options.splice(index, 1);
      options.splice(nextIndex, 0, option);
      return { ...current, options };
    });
  }

  function commitRemoveOption(definition: ProjectPropertyDefinition, option: PropertyOption, replacement?: string) {
    const replacementOption = (definition.options ?? []).find((item) => item.label === replacement);
    updateDefinition(definition.id, (current) => ({
      ...current,
      options: (current.options ?? []).filter((item) => item.id !== option.id),
      defaultValue: replaceOptionValue(current.defaultValue, option.label, replacement),
    }));
    setOptionValueMigrations((current) => [
      ...current.filter((migration) => !(migration.fieldKey === definition.key && migration.from === option.label)),
      { fieldKey: definition.key, from: option.label, to: replacement || undefined, toOptionId: replacementOption?.id },
    ]);
    setPendingFieldChange(null);
    setPendingReplacement("");
  }

  function requestApplyDefault(definition: ProjectPropertyDefinition) {
    if (definition.defaultValue === undefined || isEmptyMetadataValue(definition.defaultValue)) {
      setDefaultApplicationNotice("请先设置一个非空默认值。");
      return;
    }
    const count = countSheetsMissingPropertyValue(currentProject.sheets, definition);
    if (count === 0) {
      setDefaultApplicationNotice("当前项目没有需要填写该默认值的文稿。");
      return;
    }
    setDefaultApplicationNotice("");
    setPendingDefaultApplication({ definition, count });
  }

  function confirmApplyDefault(definition: ProjectPropertyDefinition) {
    setDefaultApplications((current) => (current.includes(definition.id) ? current : [...current, definition.id]));
    setPendingDefaultApplication(null);
    setDefaultApplicationNotice(`保存后将为已有空值文稿填写“${definition.label}”。`);
  }

  function save() {
    const normalizedDefinitions = draftDefinitions.map((definition) =>
      normalizeDefinitionForSave(
        originalDefinitions.find((item) => item.id === definition.id),
        definition,
      ),
    );
    const normalizedOptionMigrations = resolveOptionMigrationTargets(optionValueMigrations, normalizedDefinitions);
    let sourceSheets = currentProject.sheets.map((sheet) =>
      applyPendingValueMigrations(sheet, normalizedOptionMigrations, typeValueMigrations, normalizedDefinitions),
    );
    sourceSheets = removeSheetPropertyValues(sourceSheets, removedValueKeys);
    let sheets = sourceSheets.map((sheet) => migrateSheetValues(sheet, originalDefinitions, normalizedDefinitions));
    for (const definitionId of defaultApplications) {
      const definition = normalizedDefinitions.find((item) => item.id === definitionId);
      if (definition) sheets = sheets.map((sheet) => applyDefinitionDefaultToSheet(sheet, definition));
    }
    onSave({
      ...currentProject,
      propertyDefinitions: normalizedDefinitions,
      sheets,
      updatedAt: nowTimestamp(),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={requestClose}>
      <section
        className="property-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="property-manager-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div className="property-manager-header-title">
            {selectedFieldId && (
              <button type="button" className="icon-button" title="返回字段列表" onClick={() => setSelectedFieldId("")}>
                <ChevronLeft size={18} />
              </button>
            )}
            <div>
              <h2 id="property-manager-title">
                {selectedFieldId === NEW_FIELD_ID ? "新增字段" : selectedDefinition ? "编辑字段" : "文稿字段"}
              </h2>
              <p>{selectedDefinition?.label ?? currentProject.title}</p>
            </div>
          </div>
          <button type="button" className="icon-button" title="关闭" onClick={requestClose}>
            <X size={17} />
          </button>
        </header>

        <div className="property-manager-body">
          {selectedDefinition ? (
            <FieldDefinitionEditor
              definition={selectedDefinition}
              index={draftDefinitions.findIndex((item) => item.id === selectedDefinition.id)}
              fieldCount={draftDefinitions.length}
              onUpdate={(updater) => updateDefinition(selectedDefinition.id, updater)}
              onMove={(direction) => moveDefinition(selectedDefinition.id, direction)}
              onRemove={() => removeDefinition(selectedDefinition)}
              onChangeType={(type) => changeType(selectedDefinition, type)}
              onRemoveOption={(option) => removeOption(selectedDefinition, option)}
              onMoveOption={(optionId, direction) => moveOption(selectedDefinition, optionId, direction)}
              onApplyDefault={() => requestApplyDefault(selectedDefinition)}
              defaultApplicationPending={defaultApplications.includes(selectedDefinition.id)}
              defaultApplicationNotice={defaultApplicationNotice}
            />
          ) : selectedFieldId === NEW_FIELD_ID ? (
            <NewFieldEditor
              name={newFieldName}
              type={newFieldType}
              onNameChange={setNewFieldName}
              onTypeChange={setNewFieldType}
              onAdd={addField}
            />
          ) : (
            <FieldListScreen
              definitions={draftDefinitions}
              onEdit={(definition) => {
                setDefaultApplicationNotice("");
                setSelectedFieldId(definition.id);
              }}
              onRemove={removeDefinition}
              onAdd={() => {
                setDefaultApplicationNotice("");
                setSelectedFieldId(NEW_FIELD_ID);
              }}
            />
          )}
        </div>

        <footer>
          <span>{draftDefinitions.length} 个字段</span>
          <div>
            {selectedFieldId ? (
              <button type="button" className="primary-button" onClick={() => setSelectedFieldId("")}>
                完成
              </button>
            ) : (
              <>
                <button type="button" className="secondary-button" onClick={requestClose}>
                  取消
                </button>
                <button type="button" className="primary-button" onClick={save}>
                  保存
                </button>
              </>
            )}
          </div>
        </footer>
        {pendingFieldChange && (
          <FieldChangeDialog
            change={pendingFieldChange}
            replacement={pendingReplacement}
            onReplacementChange={setPendingReplacement}
            onCancel={() => setPendingFieldChange(null)}
            onRemoveField={(deleteValues) => commitRemoveDefinition(pendingFieldChange.definition, deleteValues)}
            onRemoveOption={(replacement) =>
              pendingFieldChange.kind === "removeOption" &&
              commitRemoveOption(pendingFieldChange.definition, pendingFieldChange.option, replacement)
            }
            onChangeType={(mode) =>
              pendingFieldChange.kind === "changeType" && commitTypeChange(pendingFieldChange.definition, pendingFieldChange.nextType, mode)
            }
          />
        )}
        {discardConfirmationOpen && <DiscardChangesDialog onCancel={() => setDiscardConfirmationOpen(false)} onDiscard={onClose} />}
        {pendingDefaultApplication && (
          <ApplyDefaultDialog
            application={pendingDefaultApplication}
            onCancel={() => setPendingDefaultApplication(null)}
            onConfirm={() => confirmApplyDefault(pendingDefaultApplication.definition)}
          />
        )}
      </section>
    </div>
  );
}

function ApplyDefaultDialog({
  application,
  onCancel,
  onConfirm,
}: {
  application: PendingDefaultApplication;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="property-change-backdrop" role="presentation">
      <section className="property-change-dialog" role="alertdialog" aria-modal="true">
        <header>
          <div>
            <h3>应用默认值</h3>
            <p>将影响 {application.count} 篇文稿</p>
          </div>
          <button type="button" className="icon-button" title="取消" onClick={onCancel}>
            <X size={16} />
          </button>
        </header>
        <div className="property-change-content">
          <p>保存字段后，将为已有文稿中“{application.definition.label}”为空的记录填写当前默认值；已有值不会被覆盖。</p>
          <div className="property-change-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              取消
            </button>
            <button type="button" className="primary-button" onClick={onConfirm}>
              确认应用
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DiscardChangesDialog({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  return (
    <div className="property-change-backdrop" role="presentation">
      <section className="property-change-dialog" role="alertdialog" aria-modal="true">
        <header>
          <div>
            <h3>放弃未保存更改？</h3>
            <p>字段设置尚未保存</p>
          </div>
        </header>
        <div className="property-change-content">
          <p>关闭后，本次对字段、选项和默认值的更改都会丢失。</p>
          <div className="property-change-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              继续编辑
            </button>
            <button type="button" className="secondary-button danger" onClick={onDiscard}>
              放弃更改
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FieldChangeDialog({
  change,
  replacement,
  onReplacementChange,
  onCancel,
  onRemoveField,
  onRemoveOption,
  onChangeType,
}: {
  change: PendingFieldChange;
  replacement: string;
  onReplacementChange: (value: string) => void;
  onCancel: () => void;
  onRemoveField: (deleteValues: boolean) => void;
  onRemoveOption: (replacement?: string) => void;
  onChangeType: (mode: "convert" | "clear") => void;
}) {
  const replacementOptions =
    change.kind === "removeOption" ? (change.definition.options ?? []).filter((option) => option.id !== change.option.id) : [];
  return (
    <div className="property-change-backdrop" role="presentation">
      <section className="property-change-dialog" role="alertdialog" aria-modal="true">
        <header>
          <div>
            <h3>{change.kind === "removeField" ? "移除字段" : change.kind === "removeOption" ? "删除预设选项" : "更改字段类型"}</h3>
            <p>将影响 {change.usage} 篇文稿</p>
          </div>
          <button type="button" className="icon-button" title="取消" onClick={onCancel}>
            <X size={16} />
          </button>
        </header>

        {change.kind === "removeField" && (
          <div className="property-change-content">
            <p>移除“{change.definition.label}”后，可以保留文稿中的原始 YAML 值，也可以同时删除这些值。</p>
            <div className="property-change-actions stacked">
              <button type="button" className="primary-button" onClick={() => onRemoveField(false)}>
                保留 YAML 值并移除
              </button>
              <button type="button" className="secondary-button danger" onClick={() => onRemoveField(true)}>
                删除字段和值
              </button>
            </div>
          </div>
        )}

        {change.kind === "removeOption" && (
          <div className="property-change-content">
            <p>“{change.option.label}”正在被使用。请选择替代选项，或者清空这些文稿中的该值。</p>
            {replacementOptions.length > 0 && (
              <label>
                <span>替换为</span>
                <select value={replacement} onChange={(event) => onReplacementChange(event.target.value)}>
                  {replacementOptions.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="property-change-actions">
              {replacementOptions.length > 0 && (
                <button type="button" className="primary-button" disabled={!replacement} onClick={() => onRemoveOption(replacement)}>
                  替换并删除
                </button>
              )}
              <button type="button" className="secondary-button danger" onClick={() => onRemoveOption()}>
                清空并删除
              </button>
            </div>
          </div>
        )}

        {change.kind === "changeType" && (
          <div className="property-change-content">
            <p>
              “{change.definition.label}”将从{fieldTypeLabel(change.definition.type)}改为{fieldTypeLabel(change.nextType)}。
            </p>
            <p>
              可兼容转换 {change.usage - change.incompatible} 篇，无法转换 {change.incompatible} 篇。无法转换的值会在转换时清空。
            </p>
            <div className="property-change-actions stacked">
              <button type="button" className="primary-button" onClick={() => onChangeType("convert")}>
                转换可兼容值
              </button>
              <button type="button" className="secondary-button danger" onClick={() => onChangeType("clear")}>
                清空现有值
              </button>
            </div>
          </div>
        )}

        <footer>
          <button type="button" className="secondary-button" onClick={onCancel}>
            取消
          </button>
        </footer>
      </section>
    </div>
  );
}

function FieldListScreen({
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

function FieldDefinitionEditor({
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

function NewFieldEditor({
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

function fieldTypeLabel(type: PropertyFieldType) {
  return FIELD_TYPES.find((item) => item.value === type)?.label ?? type;
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

function countFieldUsage(project: WritingProject, key: string) {
  return project.sheets.filter((sheet) => sheet.properties?.[key] !== undefined).length;
}

function countOptionUsage(project: WritingProject, key: string, option: string) {
  return project.sheets.filter((sheet) => {
    const value = sheet.properties?.[key];
    return value === option || (Array.isArray(value) && value.includes(option));
  }).length;
}

function defaultValueForType(type: PropertyFieldType): MetadataValue | undefined {
  if (type === "checkbox") return false;
  if (type === "multiSelect" || type === "tags") return [];
  return undefined;
}

function cloneDefinitions(definitions: ProjectPropertyDefinition[]) {
  return definitions.map((definition) => ({
    ...definition,
    options: (definition.options ?? []).map((option) => ({ ...option })),
    defaultValue: definition.defaultValue === undefined ? undefined : structuredClone(definition.defaultValue),
  }));
}
