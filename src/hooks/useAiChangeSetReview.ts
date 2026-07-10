import type { EditorView } from "@codemirror/view";
import { useEffect, useMemo, useState, type RefObject } from "react";
import type { AiChangeSet, WritingSheet } from "../types";
import {
  acceptAiChangeSet,
  filterReviewPanelChangeSets,
  filterVisibleAiChangeSetIds,
  rejectAiChangeSet,
  shouldOpenAiChangeSetTarget,
  validateAiChangeSetApply,
  validateAiChangeSetRollback,
} from "../lib/aiChangeSets";
import { nowTimestamp } from "../lib/dates";
import { createSheetVersionSnapshot } from "../lib/sheetVersions";

interface UseAiChangeSetReviewOptions {
  aiChangeSets: AiChangeSet[];
  activeSheet: WritingSheet | undefined;
  activeSheetId: string;
  editorRef: RefObject<EditorView | null>;
  getSheetById: (sheetId: string) => WritingSheet | undefined;
  updateSheet: (sheetId: string, updater: (sheet: WritingSheet) => WritingSheet) => void;
  updateChangeSet: (changeSetId: string, updater: (changeSet: AiChangeSet) => AiChangeSet) => void;
  onOpenChangeSetTarget: (sheetId: string) => void;
  onInspectorOpenChange: (open: boolean) => void;
}

export function useAiChangeSetReview({
  aiChangeSets,
  activeSheet,
  activeSheetId,
  editorRef,
  getSheetById,
  updateSheet,
  updateChangeSet,
  onOpenChangeSetTarget,
  onInspectorOpenChange,
}: UseAiChangeSetReviewOptions) {
  const [shownChangeSetIds, setShownChangeSetIds] = useState<string[]>([]);
  const activeSheetChangeSets = useMemo(
    () => aiChangeSets.filter((changeSet) => changeSet.sheetId === activeSheetId && changeSet.status !== "rejected"),
    [aiChangeSets, activeSheetId],
  );
  const reviewPanelChangeSets = useMemo(() => filterReviewPanelChangeSets(aiChangeSets, activeSheetId), [aiChangeSets, activeSheetId]);
  const shownChangeSets = activeSheetChangeSets.filter((changeSet) => shownChangeSetIds.includes(changeSet.id));
  const activeSheetReviewChanges = shownChangeSets.flatMap((changeSet) => changeSet.changes);

  useEffect(() => {
    setShownChangeSetIds((current) => filterVisibleAiChangeSetIds(current, activeSheetChangeSets));
  }, [activeSheetChangeSets]);

  useEffect(() => {
    setShownChangeSetIds([]);
  }, [activeSheetId]);

  function preserveEditorViewportAfter(update: () => void) {
    const view = editorRef.current;
    const scrollTop = view?.scrollDOM.scrollTop ?? 0;
    const scrollLeft = view?.scrollDOM.scrollLeft ?? 0;
    update();
    if (!view) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const nextView = editorRef.current;
        if (!nextView) return;
        nextView.scrollDOM.scrollTop = scrollTop;
        nextView.scrollDOM.scrollLeft = scrollLeft;
      });
    });
  }

  function createChangeSet(changeSet: AiChangeSet): AiChangeSet {
    const applyGuard = validateAiChangeSetApply(getSheetById(changeSet.sheetId), changeSet);
    if (!applyGuard.ok) {
      if (getSheetById(changeSet.sheetId) && shouldOpenAiChangeSetTarget(changeSet, activeSheetId)) {
        onOpenChangeSetTarget(changeSet.sheetId);
      }
      onInspectorOpenChange(true);
      return {
        ...changeSet,
        error: applyGuard.message,
      };
    }
    const acceptedChangeSet = acceptAiChangeSet(changeSet);
    preserveEditorViewportAfter(() => {
      updateSheet(changeSet.sheetId, (sheet) => ({
        ...sheet,
        versions: [createSheetVersionSnapshot(sheet, "ai", `AI 修改「${changeSet.summary}」前自动保存`), ...(sheet.versions ?? [])].slice(
          0,
          20,
        ),
        body: changeSet.proposedBody,
        updatedAt: nowTimestamp(),
      }));
      setShownChangeSetIds((current) => current.filter((changeSetId) => changeSetId !== changeSet.id));
    });
    if (shouldOpenAiChangeSetTarget(changeSet, activeSheetId)) {
      onOpenChangeSetTarget(changeSet.sheetId);
    }
    onInspectorOpenChange(true);
    return acceptedChangeSet;
  }

  function showChanges(changeSetId: string) {
    preserveEditorViewportAfter(() => {
      setShownChangeSetIds((current) => (current.includes(changeSetId) ? current : [...current, changeSetId]));
    });
  }

  function hideChanges(changeSetId: string) {
    preserveEditorViewportAfter(() => {
      setShownChangeSetIds((current) => current.filter((id) => id !== changeSetId));
    });
  }

  function rollbackChangeSet(changeSetId: string) {
    const changeSet = aiChangeSets.find((item) => item.id === changeSetId);
    if (!changeSet) return;
    const targetSheet = activeSheet;
    const guard = validateAiChangeSetRollback(targetSheet, changeSet);
    if (!guard.ok) {
      updateChangeSet(changeSetId, (item) => ({ ...item, error: guard.message }));
      return;
    }
    if (!targetSheet) return;
    preserveEditorViewportAfter(() => {
      updateSheet(targetSheet.id, (sheet) => ({
        ...sheet,
        versions: [
          createSheetVersionSnapshot(sheet, "restore", `回退 AI 修改「${changeSet.summary}」前自动保存`),
          ...(sheet.versions ?? []),
        ].slice(0, 20),
        body: changeSet.baseBody,
        updatedAt: nowTimestamp(),
      }));
      setShownChangeSetIds((current) => current.filter((id) => id !== changeSetId));
      updateChangeSet(changeSetId, rejectAiChangeSet);
    });
  }

  function rejectChangeSet(changeSetId: string) {
    preserveEditorViewportAfter(() => {
      setShownChangeSetIds((current) => current.filter((id) => id !== changeSetId));
      updateChangeSet(changeSetId, rejectAiChangeSet);
    });
  }

  return {
    activeSheetChangeSets,
    reviewPanelChangeSets,
    activeSheetReviewChanges,
    shownChangeSetIds,
    createChangeSet,
    showChanges,
    hideChanges,
    rollbackChangeSet,
    rejectChangeSet,
  };
}
