import { ChevronLeft, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  applyDefinitionDefaultToSheet,
  countSheetsMissingPropertyValue,
  createPropertyDefinition,
  createPropertyOption,
  isEmptyMetadataValue,
  reorderProjectPropertyDefinitions,
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
import type { RailDropPosition } from "../lib/sheetSorting";
import type { MetadataValue, ProjectPropertyDefinition, PropertyFieldType, PropertyOption, WritingProject } from "../types";
import { ApplyDefaultDialog, DiscardChangesDialog, FieldChangeDialog } from "./project-fields/ProjectFieldDialogs";
import { FieldDefinitionEditor, FieldListScreen, NewFieldEditor } from "./project-fields/ProjectFieldViews";
import type { PendingDefaultApplication, PendingFieldChange } from "./project-fields/types";

const NEW_FIELD_ID = "__new-field__";

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
      if (index < 0 || current[index].locked) return current;
      const nextIndex = index + direction;
      const firstCustomIndex = current.findIndex((definition) => !definition.locked);
      const minimumIndex = firstCustomIndex < 0 ? current.length : firstCustomIndex;
      if (nextIndex < minimumIndex || nextIndex >= current.length) return current;
      const next = [...current];
      const [definition] = next.splice(index, 1);
      next.splice(nextIndex, 0, definition);
      return next;
    });
  }

  function reorderDefinitions(sourceId: string, targetId: string, position: RailDropPosition) {
    setDraftDefinitions((current) => reorderProjectPropertyDefinitions(current, sourceId, targetId, position));
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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(660px,calc(100vh-64px))] w-[min(760px,calc(100vw-64px))] max-w-none flex-col gap-0 overflow-hidden rounded-[22px] p-0 shadow-2xl shadow-black/12 sm:max-w-none max-sm:h-[calc(100vh-24px)] max-sm:w-[calc(100vw-24px)]"
      >
        <header className="flex min-h-[72px] shrink-0 items-center justify-between border-b border-border/70 px-6">
          <div className="flex min-w-0 items-center gap-2">
            {selectedFieldId && (
              <Button type="button" variant="ghost" size="icon-sm" title="返回属性列表" onClick={() => setSelectedFieldId("")}>
                <ChevronLeft />
              </Button>
            )}
            <DialogTitle id="property-manager-title" className="min-w-0 truncate text-[17px] font-bold tracking-normal">
              {currentProject.title}项目文稿属性
            </DialogTitle>
            <DialogDescription className="sr-only">管理当前项目的文稿自定义属性、选项和默认值。</DialogDescription>
          </div>
          <div className="ml-4 flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon-sm" title="关闭" onClick={requestClose}>
              <X />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          {selectedDefinition ? (
            <FieldDefinitionEditor
              definition={selectedDefinition}
              index={draftDefinitions.findIndex((item) => item.id === selectedDefinition.id)}
              minimumIndex={Math.max(
                0,
                draftDefinitions.findIndex((definition) => !definition.locked),
              )}
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
              onReorder={reorderDefinitions}
            />
          )}
        </div>

        <footer className={`flex min-h-[64px] shrink-0 items-center gap-4 px-6 ${selectedFieldId ? "justify-end" : "justify-between"}`}>
          {!selectedFieldId && (
            <Button
              type="button"
              onClick={() => {
                setDefaultApplicationNotice("");
                setSelectedFieldId(NEW_FIELD_ID);
              }}
            >
              <Plus /> 新增属性
            </Button>
          )}
          <div className="flex items-center gap-2">
            {selectedFieldId ? (
              <Button type="button" onClick={() => setSelectedFieldId("")}>
                完成
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={requestClose}>
                  取消
                </Button>
                <Button type="button" onClick={save}>
                  保存
                </Button>
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
      </DialogContent>
    </Dialog>
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
