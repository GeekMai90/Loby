/**
 * [INPUT]: 依赖 CodeMirror 6、React 运行时、shared 公共契约、AI 助手模块、编辑器模块、写作库标准 Markdown 图片能力
 * [OUTPUT]: 对外提供带目标校验、快照恢复、图片稳定路径提升及标准 Markdown 多图单事务写入的 useAiActionExecutor
 * [POS]: AI 助手 feature 的作者确认执行边界，在编辑器写入前固化可重试事实；忽略历史动作的图片格式提示并统一生成可移植引用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { EditorView } from "@codemirror/view";
import { useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { AiAction, AiActionEffect, WritingProject, WritingSheet } from "@/shared/types";
import {
  validateAiActionTarget,
  validateCreatedSheetRevertEffect,
  validateSheetVersionRestoreEffect,
} from "@/features/assistant/model/aiActionEffects";
import {
  buildEditorAiImageBatchInsertion,
  buildEditorAiImageInsertion,
  buildEditorAiTextInsertion,
} from "@/features/assistant/model/aiActionInsertion";
import { canApplyAiAction, canRejectAiAction } from "@/features/assistant/model/aiActionState";
import { validateAiActionPayload } from "@/features/assistant/model/aiActionValidation";
import { normalizeAiInsertionTarget, resolveFallbackInsertionRange } from "@/features/assistant/model/aiInsertionTarget";
import { nowTimestamp } from "@/shared/lib/dates";
import {
  buildImageReferenceDocumentInsertion,
  buildMarkdownTextDocumentInsertion,
  insertImageReferenceBlocks,
  insertMarkdownTextBlock,
  replaceEditorDocumentBody,
} from "@/features/editor/model/editorInsertions";
import { createMarkdownImageReference, resolveInsertedMarkdownImagePath } from "@/features/library/model/imageAssets";
import { importProjectImagePaths, saveProjectExport } from "@/features/library/model/persistence";
import { createSheetVersionSnapshot } from "@/features/library/model/sheetVersions";
import { createSheetId } from "@/features/library/model/documentId";
import { countWords } from "@/shared/lib/text";
import { createSheetWithProjectDefaults } from "@/features/editor/model/documentProperties";
import { expandImageActions, promoteGeneratedImageAction } from "@/features/assistant/model/agentImageArtifacts";

interface AppliedAiActionResult {
  result: string;
  effect?: AiActionEffect;
  payload?: Record<string, unknown>;
}

interface UseAiActionExecutorOptions {
  aiActions: AiAction[];
  projects: WritingProject[];
  activeProject: WritingProject | undefined;
  activeSheet: WritingSheet | undefined;
  activeProjectId: string;
  activeSheetId: string;
  resolvedActiveGroupId: string;
  libraryPath: string;
  editorRef: RefObject<EditorView | null>;
  updateProject: (projectId: string, updater: (project: WritingProject) => WritingProject) => void;
  updateSheet: (sheetId: string, updater: (sheet: WritingSheet) => WritingSheet) => void;
  updateAction: (actionId: string, updater: (action: AiAction) => AiAction) => void;
  onActiveProjectChange: (projectId: string) => void;
  onActiveSheetChange: (sheetId: string) => void;
  onActiveGroupChange: (groupId: string) => void;
  onActiveGroupIdsByProjectChange: Dispatch<SetStateAction<Record<string, string>>>;
  onSheetSearchChange: (search: string) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onLibraryStatusChange: (message: string) => void;
  onResourcesChanged: () => void;
}

function stringPayload(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberPayload(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

export function useAiActionExecutor({
  aiActions,
  projects,
  activeProject,
  activeSheet,
  activeProjectId,
  activeSheetId,
  resolvedActiveGroupId,
  libraryPath,
  editorRef,
  updateProject,
  updateSheet,
  updateAction,
  onActiveProjectChange,
  onActiveSheetChange,
  onActiveGroupChange,
  onActiveGroupIdsByProjectChange,
  onSheetSearchChange,
  onInspectorOpenChange,
  onLibraryStatusChange,
  onResourcesChanged,
}: UseAiActionExecutorOptions) {
  const applyingAiActionIdsRef = useRef<Set<string>>(new Set());

  async function applyAiAction(actionId: string) {
    if (applyingAiActionIdsRef.current.has(actionId)) return;
    const action = aiActions.find((item) => item.id === actionId);
    if (!action || !canApplyAiAction(action.status)) return;
    const validation = validateAiActionPayload(action);
    if (validation.issues.length > 0) {
      const message = validation.issues.join(" ");
      onLibraryStatusChange(`AI 动作无法执行：${message}`);
      updateAction(actionId, (item) => ({ ...item, status: "failed", result: undefined, error: message, effect: undefined }));
      return;
    }
    applyingAiActionIdsRef.current.add(actionId);
    updateAction(actionId, (item) => ({ ...item, status: "applying", result: undefined, error: undefined, effect: undefined }));
    try {
      const targetGuard = validateAiActionTarget(action, { activeProject, activeSheet });
      if (!targetGuard.ok) throw new Error(targetGuard.message);
      let applied: AppliedAiActionResult;
      if (action.type === "createSheet") {
        applied = applyCreateSheetAction(action);
      } else if (action.type === "insertText") {
        applied = applyInsertTextAction(action);
      } else if (action.type === "insertImage") {
        applied = await applyInsertImageAction(action);
      } else if (action.type === "insertImages") {
        applied = await applyInsertImageBatchAction(action);
      } else {
        applied = await applySaveExportAction(action);
      }
      updateAction(actionId, (item) => ({
        ...item,
        status: "applied",
        result: applied.result,
        effect: applied.effect,
        payload: applied.payload ?? item.payload,
        error: undefined,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onLibraryStatusChange(`AI 动作执行失败：${message}`);
      updateAction(actionId, (item) => ({ ...item, status: "failed", result: undefined, error: message, effect: undefined }));
    } finally {
      applyingAiActionIdsRef.current.delete(actionId);
    }
  }

  function rejectAiAction(actionId: string) {
    updateAction(actionId, (item) =>
      canRejectAiAction(item.status) ? { ...item, status: "rejected", result: undefined, error: undefined, effect: undefined } : item,
    );
  }

  function revertAiAction(actionId: string) {
    const action = aiActions.find((item) => item.id === actionId);
    const effect = action?.effect;
    if (!action || action.status !== "applied" || !effect) return;
    if (effect.type === "createdSheet") {
      revertCreatedSheetAction(actionId, effect);
      return;
    }

    const guard = validateSheetVersionRestoreEffect(projects, effect);
    if (!guard.ok) {
      const message = guard.message;
      onLibraryStatusChange(message);
      updateAction(actionId, (item) => ({ ...item, error: message }));
      return;
    }
    const { ownerProject, restoreVersion } = guard.target;

    updateProject(ownerProject.id, (project) => ({
      ...project,
      updatedAt: nowTimestamp(),
      sheets: project.sheets.map((sheet) =>
        sheet.id === effect.sheetId
          ? {
              ...sheet,
              versions: [
                createSheetVersionSnapshot(sheet, "restore", `撤销 AI 动作「${action.title}」前自动保存`),
                ...(sheet.versions ?? []),
              ].slice(0, 20),
              body: restoreVersion.body,
              updatedAt: nowTimestamp(),
            }
          : sheet,
      ),
    }));
    onActiveProjectChange(ownerProject.id);
    onActiveSheetChange(effect.sheetId);
    const result = `已撤销，恢复到「${effect.sheetTitle}」的插入前版本。`;
    onLibraryStatusChange(result);
    updateAction(actionId, (item) => ({ ...item, status: "reverted", result, error: undefined }));
  }

  function revertCreatedSheetAction(actionId: string, effect: Extract<AiActionEffect, { type: "createdSheet" }>) {
    const guard = validateCreatedSheetRevertEffect(projects, effect);
    if (!guard.ok) {
      const message = guard.message;
      onLibraryStatusChange(message);
      updateAction(actionId, (item) => ({ ...item, error: message }));
      return;
    }
    const { ownerProject } = guard.target;

    const remainingSheets = ownerProject.sheets.filter((sheet) => sheet.id !== effect.sheetId);
    updateProject(ownerProject.id, (project) => ({
      ...project,
      updatedAt: nowTimestamp(),
      sheets: project.sheets.filter((sheet) => sheet.id !== effect.sheetId),
    }));
    if (activeProjectId === ownerProject.id && activeSheetId === effect.sheetId) {
      onActiveSheetChange(remainingSheets[0]?.id ?? "");
    }
    const result = `已撤销，删除 AI 创建的文稿「${effect.sheetTitle}」。`;
    onLibraryStatusChange(result);
    updateAction(actionId, (item) => ({ ...item, status: "reverted", result, error: undefined }));
  }

  function applyCreateSheetAction(action: AiAction): AppliedAiActionResult {
    if (!activeProject) throw new Error("当前没有可写入的项目。");
    const now = nowTimestamp();
    const title = stringPayload(action.payload.title) || action.title.replace(/^创建文稿：/, "").trim() || "AI 建议文稿";
    const body = stringPayload(action.payload.body);
    const description = stringPayload(action.payload.description) || stringPayload(action.payload.summary) || action.summary;
    const groupId = stringPayload(action.payload.groupId) || resolvedActiveGroupId || activeProject.groups?.[0]?.id || "";
    const targetWords = numberPayload(action.payload.targetWords) || Math.max(countWords(body), 1000);
    const sheet = createSheetWithProjectDefaults(activeProject, {
      id: createSheetId(),
      title,
      groupId,
      targetWords,
      description,
      body,
      updatedAt: now,
    });
    updateProject(activeProject.id, (project) => ({
      ...project,
      updatedAt: now,
      sheets: [...project.sheets, sheet],
    }));
    if (groupId) {
      onActiveGroupChange(groupId);
      onActiveGroupIdsByProjectChange((current) => ({ ...current, [activeProject.id]: groupId }));
    }
    onActiveSheetChange(sheet.id);
    onSheetSearchChange("");
    onInspectorOpenChange(true);
    const result = `已在当前项目中创建「${title}」。`;
    onLibraryStatusChange(result);
    return {
      result,
      effect: {
        type: "createdSheet",
        projectId: activeProject.id,
        sheetId: sheet.id,
        sheetTitle: title,
        description,
        body,
        targetWords,
      },
    };
  }

  function applyInsertTextAction(action: AiAction): AppliedAiActionResult {
    if (!activeSheet) throw new Error("当前没有可插入文本的文稿。");
    const text = stringPayload(action.payload.text) || stringPayload(action.payload.markdown) || stringPayload(action.payload.content);
    if (!text.trim()) throw new Error("插入文本动作缺少 text。");
    const view = editorRef.current;
    const target = normalizeAiInsertionTarget(action.payload.target);
    let appliedBody = "";
    const snapshot = createSheetVersionSnapshot(activeSheet, "ai", `AI 插入「${action.title}」前自动保存`);
    if (view) {
      const insertion = buildEditorAiTextInsertion({
        sheetBody: activeSheet.body,
        editorBody: view.state.doc.sliceString(0),
        selection: view.state.selection.main,
        target,
        anchor: action.payload.anchor,
        text,
      });
      if (!insertion.ok) throw new Error(insertion.message);
      const nextBody = insertMarkdownTextBlock(view, text, insertion.range.from, insertion.range.to);
      if (!nextBody) throw new Error("插入文本失败。");
      if (nextBody !== insertion.insertion.body) throw new Error("插入文本后的正文校验失败，请重试。");
      appliedBody = insertion.insertion.body;
    } else {
      const fallback = resolveFallbackInsertionRange(target, activeSheet.body, action.payload.anchor);
      if (!fallback.ok) throw new Error(fallback.message);
      const insertion = buildMarkdownTextDocumentInsertion(activeSheet.body, fallback.range.from, fallback.range.to, text);
      if (!insertion) throw new Error("插入文本失败。");
      appliedBody = insertion.body;
    }
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      versions: [snapshot, ...(sheet.versions ?? [])].slice(0, 20),
      body: appliedBody,
      updatedAt: nowTimestamp(),
    }));
    const result = `已向「${activeSheet.title}」插入 AI 文本，并自动保存插入前版本。`;
    onLibraryStatusChange(result);
    return {
      result,
      effect: { type: "sheetVersionRestore", sheetId: activeSheet.id, sheetTitle: activeSheet.title, versionId: snapshot.id, appliedBody },
    };
  }

  async function applyInsertImageAction(action: AiAction): Promise<AppliedAiActionResult> {
    if (!activeSheet) throw new Error("当前没有可插入图片的文稿。");
    let path = stringPayload(action.payload.path);
    if (!path) throw new Error("图片动作缺少 path。");
    const alt = stringPayload(action.payload.alt) || action.title.replace(/^插入图片：/, "").trim();
    const sourceArtifactPath = stringPayload(action.sourceArtifactPath);
    if (sourceArtifactPath) {
      if (!activeProject) throw new Error("当前没有可导入图片的项目。");
      const [imported] = await importProjectImagePaths(libraryPath, activeProject, [sourceArtifactPath]);
      if (!imported) throw new Error("生成图片没有成功导入当前写作库。");
      path = resolveInsertedMarkdownImagePath(imported.path, libraryPath, activeProject, activeSheet);
      updateAction(action.id, (item) => promoteGeneratedImageAction(item, path));
      onResourcesChanged();
    }
    const reference = createMarkdownImageReference(path, alt);
    const view = editorRef.current;
    const target = normalizeAiInsertionTarget(action.payload.target);
    let appliedBody = "";
    const snapshot = createSheetVersionSnapshot(activeSheet, "ai", `AI 插入图片「${alt || path}」前自动保存`);
    if (view) {
      const insertion = buildEditorAiImageInsertion({
        sheetBody: activeSheet.body,
        editorBody: view.state.doc.sliceString(0),
        selection: view.state.selection.main,
        target,
        anchor: action.payload.anchor,
        reference,
      });
      if (!insertion.ok) throw new Error(insertion.message);
      const nextBody = insertImageReferenceBlocks(view, [reference], insertion.range.from, insertion.range.to);
      if (!nextBody) throw new Error("插入图片引用失败。");
      if (nextBody !== insertion.insertion.body) throw new Error("插入图片后的正文校验失败，请重试。");
      appliedBody = insertion.insertion.body;
    } else {
      const fallback = resolveFallbackInsertionRange(target, activeSheet.body, action.payload.anchor);
      if (!fallback.ok) throw new Error(fallback.message);
      const insertion = buildImageReferenceDocumentInsertion(activeSheet.body, fallback.range.from, fallback.range.to, [reference]);
      if (!insertion) throw new Error("插入图片引用失败。");
      appliedBody = insertion.body;
    }
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      versions: [snapshot, ...(sheet.versions ?? [])].slice(0, 20),
      body: appliedBody,
      updatedAt: nowTimestamp(),
    }));
    const result = `已向「${activeSheet.title}」插入图片引用：${alt || path}`;
    onLibraryStatusChange(result);
    return {
      result,
      effect: { type: "sheetVersionRestore", sheetId: activeSheet.id, sheetTitle: activeSheet.title, versionId: snapshot.id, appliedBody },
      payload: withoutImageReferenceFormat({ ...action.payload, path }),
    };
  }

  async function applyInsertImageBatchAction(action: AiAction): Promise<AppliedAiActionResult> {
    if (!activeSheet) throw new Error("当前没有可插入图片的文稿。");
    if (!activeProject) throw new Error("当前没有可导入图片的项目。");
    const imageActions = expandImageActions(action);
    if (imageActions.length < 2) throw new Error("批量图片动作至少需要两张有效图片。");
    const view = editorRef.current;
    const initialEditorBody = view?.state.doc.sliceString(0) ?? activeSheet.body;
    const initialSelection = view?.state.selection.main ?? {
      from: initialEditorBody.length,
      to: initialEditorBody.length,
      head: initialEditorBody.length,
    };
    const preflight = planImageBatchInsertion(activeSheet.body, initialEditorBody, initialSelection, imageActions);
    if (!preflight.ok) throw new Error(preflight.message);

    const sourcePaths = imageActions.map((item) => stringPayload(item.sourceArtifactPath)).filter(Boolean);
    const imported = sourcePaths.length > 0 ? await importProjectImagePaths(libraryPath, activeProject, sourcePaths) : [];
    if (imported.length !== sourcePaths.length) throw new Error("生成图片没有全部成功导入当前写作库。");

    let importedIndex = 0;
    const durableImageActions = imageActions.map((item) => {
      const sourceArtifactPath = stringPayload(item.sourceArtifactPath);
      if (!sourceArtifactPath) return item;
      const resource = imported[importedIndex++];
      if (!resource) throw new Error("生成图片导入结果不完整。");
      const path = resolveInsertedMarkdownImagePath(resource.path, libraryPath, activeProject, activeSheet);
      return promoteGeneratedImageAction(item, path);
    });
    const durableItems = durableImageActions.map((item) =>
      withoutImageReferenceFormat({ ...item.payload, title: item.title, summary: item.summary }),
    );
    const durablePayload = { ...action.payload, items: durableItems };
    if (sourcePaths.length > 0) {
      updateAction(action.id, (item) => ({ ...item, payload: durablePayload }));
      onResourcesChanged();
    }

    const currentEditorBody = view?.state.doc.sliceString(0) ?? activeSheet.body;
    const currentSelection = view?.state.selection.main ?? initialSelection;
    const insertion = planImageBatchInsertion(activeSheet.body, currentEditorBody, currentSelection, durableImageActions);
    if (!insertion.ok) throw new Error(insertion.message);
    const snapshot = createSheetVersionSnapshot(activeSheet, "ai", `AI 插入 ${durableImageActions.length} 张图片前自动保存`);
    if (view) {
      const nextBody = replaceEditorDocumentBody(view, insertion.insertion.body, insertion.insertion.cursor);
      if (nextBody !== insertion.insertion.body) throw new Error("批量插入图片后的正文校验失败，请重试。");
    }
    updateSheet(activeSheet.id, (sheet) => ({
      ...sheet,
      versions: [snapshot, ...(sheet.versions ?? [])].slice(0, 20),
      body: insertion.insertion.body,
      updatedAt: nowTimestamp(),
    }));
    const result = `已向「${activeSheet.title}」插入 ${durableImageActions.length} 张图片，并自动保存插入前版本。`;
    onLibraryStatusChange(result);
    return {
      result,
      effect: {
        type: "sheetVersionRestore",
        sheetId: activeSheet.id,
        sheetTitle: activeSheet.title,
        versionId: snapshot.id,
        appliedBody: insertion.insertion.body,
      },
      payload: durablePayload,
    };
  }

  async function applySaveExportAction(action: AiAction): Promise<AppliedAiActionResult> {
    if (!activeProject) throw new Error("当前没有可导出的项目。");
    const filename = stringPayload(action.payload.filename) || `${activeProject.title || "loby-export"}.md`;
    const content = stringPayload(action.payload.content);
    if (!content.trim()) throw new Error("导出动作缺少 content。");
    const savedPath = await saveProjectExport(libraryPath, activeProject, filename, content);
    const result = `已保存 AI 导出：${savedPath}`;
    onLibraryStatusChange(result);
    onResourcesChanged();
    return { result };
  }

  return { applyAiAction, rejectAiAction, revertAiAction };
}

function planImageBatchInsertion(
  sheetBody: string,
  editorBody: string,
  selection: { from: number; to: number; head?: number },
  imageActions: AiAction[],
) {
  return buildEditorAiImageBatchInsertion({
    sheetBody,
    editorBody,
    selection,
    items: imageActions.map((item) => {
      const path = stringPayload(item.payload.path);
      const alt = stringPayload(item.payload.alt) || item.title.replace(/^插入图片：/, "").trim();
      return {
        target: item.payload.target,
        anchor: item.payload.anchor,
        reference: createMarkdownImageReference(path, alt),
      };
    }),
  });
}

function withoutImageReferenceFormat(payload: Record<string, unknown>): Record<string, unknown> {
  const portablePayload = { ...payload };
  delete portablePayload.format;
  return portablePayload;
}
