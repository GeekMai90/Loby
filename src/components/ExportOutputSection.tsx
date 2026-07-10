import { Copy, Download, Printer, Save } from "lucide-react";
import type { ImageDependencySummary } from "../lib/imageAssets";
import type { WritingSheet } from "../types";
import { ExportSheetList } from "./ExportSheetList";

interface ExportOutputSectionProps {
  publishableSheets: WritingSheet[];
  selectedSheets: WritingSheet[];
  unselectedSheets: WritingSheet[];
  selectedWordCount: number;
  materialSheetCount: number;
  imageSummary: ImageDependencySummary;
  saveStatus: string;
  htmlBusy: boolean;
  onToggleSheet: (sheetId: string) => void;
  onMoveSheet: (sheetId: string, direction: -1 | 1) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
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

export function ExportOutputSection({
  publishableSheets,
  selectedSheets,
  unselectedSheets,
  selectedWordCount,
  materialSheetCount,
  imageSummary,
  saveStatus,
  htmlBusy,
  onToggleSheet,
  onMoveSheet,
  onSelectAll,
  onSelectNone,
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
}: ExportOutputSectionProps) {
  return (
    <section className="panel-section">
      <h2>组合输出</h2>
      <div className="metric-row">
        <span>已选卡片</span>
        <strong>
          {selectedSheets.length} / {publishableSheets.length}
        </strong>
      </div>
      <div className="metric-row">
        <span>合并字数</span>
        <strong>{selectedWordCount}</strong>
      </div>
      <div className="metric-row">
        <span>素材卡片</span>
        <strong>{materialSheetCount}</strong>
      </div>
      <div className="metric-row">
        <span>本地配图</span>
        <strong>
          {imageSummary.bundled} / {imageSummary.local}
        </strong>
      </div>
      {imageSummary.external > 0 && (
        <p className="muted-text export-save-status">外链图片 {imageSummary.external} 张，导出时不会复制到本地 bundle。</p>
      )}
      {imageSummary.missing.length > 0 && (
        <p className="muted-text export-save-status">缺失图片：{imageSummary.missing.slice(0, 3).join("、")}</p>
      )}
      <div className="button-row export-actions">
        <button className="secondary-button" onClick={onSelectAll}>
          全选
        </button>
        <button className="secondary-button" onClick={onSelectNone}>
          清空
        </button>
      </div>
      <ExportSheetList
        publishableSheets={publishableSheets}
        selectedSheets={selectedSheets}
        unselectedSheets={unselectedSheets}
        onToggleSheet={onToggleSheet}
        onMoveSheet={onMoveSheet}
      />
      <div className="button-row">
        <button className="primary-button" onClick={onDownloadMarkdown} disabled={selectedSheets.length === 0}>
          <Download size={16} /> Markdown
        </button>
        <button className="secondary-button" onClick={onDownloadHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
          {htmlBusy ? "HTML 生成中" : "HTML"}
        </button>
      </div>
      <div className="button-row export-actions">
        <button className="secondary-button" onClick={onDownloadPlainText} disabled={selectedSheets.length === 0}>
          纯文本
        </button>
        <button className="secondary-button" onClick={onDownloadWechatHtml} disabled={selectedSheets.length === 0}>
          公众号 HTML
        </button>
        <button className="secondary-button" onClick={onDownloadXhsDraft} disabled={selectedSheets.length === 0}>
          小红书草稿
        </button>
      </div>
      <div className="export-save-block">
        <p className="muted-text">复制 / 打印</p>
        <div className="button-row export-actions">
          <button className="secondary-button" onClick={onCopyMarkdown} disabled={selectedSheets.length === 0}>
            <Copy size={16} /> MD
          </button>
          <button className="secondary-button" onClick={onCopyHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
            HTML
          </button>
          <button className="secondary-button" onClick={onCopyWechatHtml} disabled={selectedSheets.length === 0}>
            公众号
          </button>
          <button className="secondary-button" onClick={onCopyXhsDraft} disabled={selectedSheets.length === 0}>
            小红书
          </button>
          <button className="secondary-button" onClick={onOpenPrintPreview} disabled={selectedSheets.length === 0 || htmlBusy}>
            <Printer size={16} /> PDF
          </button>
        </div>
      </div>
      <div className="export-save-block">
        <p className="muted-text">保存到项目 exports</p>
        <div className="button-row export-actions">
          <button className="secondary-button" onClick={onSaveMarkdown} disabled={selectedSheets.length === 0}>
            <Save size={16} /> MD
          </button>
          <button className="secondary-button" onClick={onSaveHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
            HTML
          </button>
          <button className="secondary-button" onClick={onSavePlainText} disabled={selectedSheets.length === 0}>
            TXT
          </button>
          <button className="secondary-button" onClick={onSaveWechatHtml} disabled={selectedSheets.length === 0}>
            公众号
          </button>
          <button className="secondary-button" onClick={onSaveXhsDraft} disabled={selectedSheets.length === 0}>
            小红书
          </button>
        </div>
        {saveStatus && <p className="muted-text export-save-status">{saveStatus}</p>}
      </div>
    </section>
  );
}
