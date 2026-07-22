/**
 * [INPUT]: 依赖 写作库模块、shared 公共契约、发布模块
 * [OUTPUT]: 对外提供 ExportPanel
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ImageDependencySummary } from "@/features/library/model/imageAssets";
import { getPublishingChecklist } from "@/features/library/model/projectModel";
import { countWords } from "@/shared/lib/text";
import type { WritingProject, WritingSheet } from "@/shared/types";
import {
  ExportOutputSection,
  ExportPreviewSection,
  ExportPublishingSection,
  type ExportReadinessItem,
} from "@/features/publishing/components/ExportPanelSections";

interface ExportPanelProps {
  project: WritingProject;
  publishableSheets: WritingSheet[];
  selectedSheetIds: string[];
  markdown: string;
  html: string;
  htmlBusy: boolean;
  plainText: string;
  wechatHtml: string;
  xhsDraft: string;
  imageSummary: ImageDependencySummary;
  saveStatus: string;
  onToggleSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
  onTogglePublishingChecklistItem: (itemId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onCreatePublishVersion: () => void;
  onDownloadMarkdown: () => void;
  onDownloadHtml: () => void;
  onDownloadPlainText: () => void;
  onDownloadWechatHtml: () => void;
  onDownloadXhsDraft: () => void;
  onSaveMarkdown: () => void;
  onSaveHtml: () => void;
  onSavePlainText: () => void;
  onSaveWechatHtml: () => void;
  onSaveXhsDraft: () => void;
  onCopyMarkdown: () => void;
  onCopyHtml: () => void;
  onCopyWechatHtml: () => void;
  onCopyXhsDraft: () => void;
  onOpenPrintPreview: () => void;
}

export function ExportPanel({
  project,
  publishableSheets,
  selectedSheetIds,
  markdown,
  html,
  htmlBusy,
  wechatHtml,
  xhsDraft,
  imageSummary,
  saveStatus,
  onToggleSheet,
  onMoveSheet,
  onTogglePublishingChecklistItem,
  onSelectAll,
  onSelectNone,
  onCreatePublishVersion,
  onDownloadMarkdown,
  onDownloadHtml,
  onDownloadPlainText,
  onDownloadWechatHtml,
  onDownloadXhsDraft,
  onSaveMarkdown,
  onSaveHtml,
  onSavePlainText,
  onSaveWechatHtml,
  onSaveXhsDraft,
  onCopyMarkdown,
  onCopyHtml,
  onCopyWechatHtml,
  onCopyXhsDraft,
  onOpenPrintPreview,
}: ExportPanelProps) {
  const selectedSheets = selectedSheetIds
    .map((id) => publishableSheets.find((sheet) => sheet.id === id))
    .filter((sheet): sheet is WritingSheet => Boolean(sheet));
  const unselectedSheets = publishableSheets.filter((sheet) => !selectedSheetIds.includes(sheet.id));
  const selectedWordCount = selectedSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
  const hasHeading = selectedSheets.some((sheet) => /^#\s+.+/m.test(sheet.body));
  const readinessChecklist: ExportReadinessItem[] = [
    { label: "已选择发布卡片", ok: selectedSheets.length > 0 },
    { label: "正文有标题结构", ok: hasHeading },
    { label: "合并字数不为空", ok: selectedWordCount > 0 },
    { label: "本地配图可导出", ok: imageSummary.missing.length === 0 },
  ];
  const publishingChecklist = getPublishingChecklist(project);
  const finishedPublishingTasks = publishingChecklist.filter((item) => item.done).length;

  return (
    <div className="flex flex-col gap-[var(--panel-gap)] pr-0.5">
      <ExportOutputSection
        publishableSheets={publishableSheets}
        selectedSheets={selectedSheets}
        unselectedSheets={unselectedSheets}
        selectedWordCount={selectedWordCount}
        imageSummary={imageSummary}
        saveStatus={saveStatus}
        htmlBusy={htmlBusy}
        onToggleSheet={onToggleSheet}
        onMoveSheet={onMoveSheet}
        onSelectAll={onSelectAll}
        onSelectNone={onSelectNone}
        onDownloadMarkdown={onDownloadMarkdown}
        onDownloadHtml={onDownloadHtml}
        onDownloadPlainText={onDownloadPlainText}
        onDownloadWechatHtml={onDownloadWechatHtml}
        onDownloadXhsDraft={onDownloadXhsDraft}
        onSaveMarkdown={onSaveMarkdown}
        onSaveHtml={onSaveHtml}
        onSavePlainText={onSavePlainText}
        onSaveWechatHtml={onSaveWechatHtml}
        onSaveXhsDraft={onSaveXhsDraft}
        onCopyMarkdown={onCopyMarkdown}
        onCopyHtml={onCopyHtml}
        onCopyWechatHtml={onCopyWechatHtml}
        onCopyXhsDraft={onCopyXhsDraft}
        onOpenPrintPreview={onOpenPrintPreview}
      />

      <ExportPublishingSection
        selectedSheets={selectedSheets}
        readinessChecklist={readinessChecklist}
        publishingChecklist={publishingChecklist}
        finishedPublishingTasks={finishedPublishingTasks}
        onTogglePublishingChecklistItem={onTogglePublishingChecklistItem}
        onCreatePublishVersion={onCreatePublishVersion}
      />

      <ExportPreviewSection title="Markdown 预览" body={markdown.slice(0, 1600)} />
      <ExportPreviewSection title="HTML 预览" body={htmlBusy ? "HTML 正在生成..." : html.slice(0, 1000)} />
      <ExportPreviewSection title="公众号 HTML" body={wechatHtml.slice(0, 1200)} />
      <ExportPreviewSection title="小红书拆条" body={xhsDraft.slice(0, 1200)} />
    </div>
  );
}
