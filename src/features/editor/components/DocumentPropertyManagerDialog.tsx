/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shadcn/ui 基础控件、编辑器模块、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 DocumentPropertyManagerDialog，管理项目级新文稿目标默认值与按项目隔离的自定义属性
 * [POS]: 编辑器 feature 的文稿属性定义管理单元；系统属性锁定结构但允许编辑创建时默认值
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ChevronLeft, CircleHelp, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  applyDefinitionDefaultsToSheets,
  createPropertyDefinition,
  createPropertyOption,
  normalizeProjectDocumentPropertyDefinitions,
  reorderDocumentPropertyDefinitions,
} from "@/features/editor/model/documentProperties";
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
} from "@/features/library/model/propertyDefinitionMigrations";
import { nowTimestamp } from "@/shared/lib/dates";
import type { RailDropPosition } from "@/features/library/model/sheetSorting";
import type { MetadataValue, DocumentPropertyDefinition, PropertyFieldType, PropertyOption, WritingProject } from "@/shared/types";
import { DiscardChangesDialog, FieldChangeDialog } from "@/features/editor/components/document-properties/DocumentPropertyDialogs";
import {
  FieldDefinitionEditor,
  FieldListScreen,
  NewFieldEditor,
} from "@/features/editor/components/document-properties/DocumentPropertyViews";
import type { PendingFieldChange } from "@/features/editor/components/document-properties/types";

const NEW_FIELD_ID = "__new-field__";

interface DocumentPropertyManagerDialogProps {
  open: boolean;
  project: WritingProject | undefined;
  onClose: () => void;
  onSave: (project: WritingProject) => void;
}

export function DocumentPropertyManagerDialog({ open, project, onClose, onSave }: DocumentPropertyManagerDialogProps) {
  const initializedProjectIdRef = useRef<string | null>(null);
  const [draftDefinitions, setDraftDefinitions] = useState<DocumentPropertyDefinition[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<PropertyFieldType>("text");
  const [pendingFieldChange, setPendingFieldChange] = useState<PendingFieldChange | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState("");
  const [removedValueKeys, setRemovedValueKeys] = useState<string[]>([]);
  const [optionValueMigrations, setOptionValueMigrations] = useState<OptionValueMigration[]>([]);
  const [typeValueMigrations, setTypeValueMigrations] = useState<TypeValueMigration[]>([]);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);

  useEffect(() => {
    if (!open || !project) {
      initializedProjectIdRef.current = null;
      return;
    }
    if (initializedProjectIdRef.current === project.id) return;
    initializedProjectIdRef.current = project.id;
    const definitions = normalizeProjectDocumentPropertyDefinitions(project.documentPropertyDefinitions);
    setDraftDefinitions(definitions);
    setSelectedFieldId("");
    setNewFieldName("");
    setNewFieldType("text");
    setPendingFieldChange(null);
    setPendingReplacement("");
    setRemovedValueKeys([]);
    setOptionValueMigrations([]);
    setTypeValueMigrations([]);
    setDiscardConfirmationOpen(false);
  }, [open, project]);

  const originalDefinitions = useMemo(() => normalizeProjectDocumentPropertyDefinitions(project?.documentPropertyDefinitions), [project]);
  if (!open || !project) return null;
  const currentProject = project;
  const selectedDefinition = draftDefinitions.find((definition) => definition.id === selectedFieldId);
  const hasUnsavedChanges =
    JSON.stringify(draftDefinitions) !== JSON.stringify(originalDefinitions) ||
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

  function updateDefinition(id: string, updater: (definition: DocumentPropertyDefinition) => DocumentPropertyDefinition) {
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
    setDraftDefinitions((current) => reorderDocumentPropertyDefinitions(current, sourceId, targetId, position));
  }

  function addField() {
    if (!newFieldName.trim()) return;
    const definition = createPropertyDefinition(newFieldName, newFieldType, draftDefinitions);
    setDraftDefinitions((current) => [...current, definition]);
    setSelectedFieldId(definition.id);
    setNewFieldName("");
    setNewFieldType("text");
  }

  function cancelNewField() {
    setNewFieldName("");
    setNewFieldType("text");
    setSelectedFieldId("");
  }

  function removeDefinition(definition: DocumentPropertyDefinition) {
    if (definition.locked) return;
    const usage = countFieldUsage(currentProject, definition.key);
    if (usage > 0) {
      setPendingFieldChange({ kind: "removeField", definition, usage });
      return;
    }
    commitRemoveDefinition(definition, false);
  }

  function commitRemoveDefinition(definition: DocumentPropertyDefinition, deleteValues: boolean) {
    const index = draftDefinitions.findIndex((item) => item.id === definition.id);
    const nextSelection = draftDefinitions[index + 1]?.id ?? draftDefinitions[index - 1]?.id ?? NEW_FIELD_ID;
    setDraftDefinitions((current) => current.filter((item) => item.id !== definition.id));
    setOptionValueMigrations((current) => current.filter((migration) => migration.fieldKey !== definition.key));
    setTypeValueMigrations((current) => current.filter((migration) => migration.fieldKey !== definition.key));
    if (deleteValues) setRemovedValueKeys((current) => (current.includes(definition.key) ? current : [...current, definition.key]));
    setSelectedFieldId(nextSelection);
    setPendingFieldChange(null);
  }

  function changeType(definition: DocumentPropertyDefinition, type: PropertyFieldType) {
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

  function commitTypeChange(definition: DocumentPropertyDefinition, type: PropertyFieldType, mode: "convert" | "clear") {
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

  function removeOption(definition: DocumentPropertyDefinition, option: PropertyOption) {
    const usage = countOptionUsage(currentProject, definition.key, option.label);
    if (usage > 0) {
      const replacement = (definition.options ?? []).find((item) => item.id !== option.id)?.label ?? "";
      setPendingReplacement(replacement);
      setPendingFieldChange({ kind: "removeOption", definition, option, usage });
      return;
    }
    commitRemoveOption(definition, option);
  }

  function moveOption(definition: DocumentPropertyDefinition, optionId: string, direction: -1 | 1) {
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

  function commitRemoveOption(definition: DocumentPropertyDefinition, option: PropertyOption, replacement?: string) {
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

  function save() {
    const normalizedDefinitions = normalizeProjectDocumentPropertyDefinitions(
      draftDefinitions.map((definition) =>
        normalizeDefinitionForSave(
          originalDefinitions.find((item) => item.id === definition.id),
          definition,
        ),
      ),
    );
    const normalizedOptionMigrations = resolveOptionMigrationTargets(optionValueMigrations, normalizedDefinitions);
    let sourceSheets = currentProject.sheets.map((sheet) =>
      applyPendingValueMigrations(sheet, normalizedOptionMigrations, typeValueMigrations, normalizedDefinitions),
    );
    sourceSheets = removeSheetPropertyValues(sourceSheets, removedValueKeys);
    const migratedSheets = sourceSheets.map((sheet) => migrateSheetValues(sheet, originalDefinitions, normalizedDefinitions));
    const sheets = applyDefinitionDefaultsToSheets(migratedSheets, normalizedDefinitions);
    onSave({
      ...currentProject,
      documentPropertyDefinitions: normalizedDefinitions,
      sheets,
      updatedAt: nowTimestamp(),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(660px,calc(100vh-64px))] w-[min(700px,calc(100vw-64px))] max-w-none flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl shadow-scrim-strong sm:max-w-none max-sm:h-[calc(100vh-24px)] max-sm:w-[calc(100vw-24px)]"
      >
        <header className="flex min-h-[72px] shrink-0 items-center justify-between border-b border-border/70 px-6">
          <div className="flex min-w-0 items-center gap-2">
            {selectedFieldId && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="返回属性列表"
                onClick={() => (selectedFieldId === NEW_FIELD_ID ? cancelNewField() : setSelectedFieldId(""))}
              >
                <ChevronLeft />
              </Button>
            )}
            <DialogTitle id="property-manager-title" className="min-w-0 truncate text-[17px] font-bold tracking-normal">
              文稿属性管理
            </DialogTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title="了解文稿属性"
                  aria-label="了解文稿属性"
                >
                  <CircleHelp size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent variant="solid" side="bottom" align="start" sideOffset={8} className="w-80 p-4">
                <h3 className="text-[13px] font-semibold">什么是文稿属性？</h3>
                <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                  文稿属性用于为当前项目中的文稿记录结构化信息，方便统一管理写作状态和发布信息。
                </p>
                <ul className="mt-3 grid gap-2.5 text-[11px] leading-4.5">
                  <li>
                    <strong className="font-semibold">按项目隔离</strong>
                    <span className="ml-1 text-muted-foreground">当前定义适用于这个项目中的文稿，不属于项目本身的属性。</span>
                  </li>
                  <li>
                    <strong className="font-semibold">系统属性</strong>
                    <span className="ml-1 text-muted-foreground">目标字数的结构由系统管理，这里只设置当前项目中新文稿的默认值。</span>
                  </li>
                  <li>
                    <strong className="font-semibold">自定义属性</strong>
                    <span className="ml-1 text-muted-foreground">可以新增、编辑和排序，顺序会同步到文稿属性面板。</span>
                  </li>
                  <li>
                    <strong className="font-semibold">默认值</strong>
                    <span className="ml-1 text-muted-foreground">保存后会用于新文稿，并补充到已有的空值文稿。</span>
                  </li>
                </ul>
              </PopoverContent>
            </Popover>
            <DialogDescription className="sr-only">管理当前项目的新文稿目标字数、自定义属性、选项和默认值。</DialogDescription>
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
              isNew={!originalDefinitions.some((definition) => definition.id === selectedDefinition.id)}
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
            />
          ) : selectedFieldId === NEW_FIELD_ID ? (
            <NewFieldEditor name={newFieldName} type={newFieldType} onNameChange={setNewFieldName} onTypeChange={setNewFieldType} />
          ) : (
            <FieldListScreen
              definitions={draftDefinitions}
              onEdit={(definition) => setSelectedFieldId(definition.id)}
              onRemove={removeDefinition}
              onReorder={reorderDefinitions}
            />
          )}
        </div>

        <footer className={`flex min-h-[64px] shrink-0 items-center gap-4 px-6 ${selectedFieldId ? "justify-end" : "justify-between"}`}>
          {!selectedFieldId && (
            <Button type="button" onClick={() => setSelectedFieldId(NEW_FIELD_ID)}>
              <Plus /> 新增属性
            </Button>
          )}
          <div className="flex items-center gap-2">
            {selectedFieldId === NEW_FIELD_ID ? (
              <>
                <Button type="button" variant="outline" onClick={cancelNewField}>
                  取消
                </Button>
                <Button type="button" disabled={!newFieldName.trim()} onClick={addField}>
                  下一步
                </Button>
              </>
            ) : selectedFieldId ? (
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
