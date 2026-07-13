import { Copy, Download, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <section className="rounded-lg border border-border bg-card p-3">
      <h2 className="mb-3 text-sm font-semibold">组合输出</h2>
      <div className="flex items-center justify-between gap-3 py-1 text-xs">
        <span>已选卡片</span>
        <strong>
          {selectedSheets.length} / {publishableSheets.length}
        </strong>
      </div>
      <div className="flex items-center justify-between gap-3 py-1 text-xs">
        <span>合并字数</span>
        <strong>{selectedWordCount}</strong>
      </div>
      <div className="flex items-center justify-between gap-3 py-1 text-xs">
        <span>素材卡片</span>
        <strong>{materialSheetCount}</strong>
      </div>
      <div className="flex items-center justify-between gap-3 py-1 text-xs">
        <span>本地配图</span>
        <strong>
          {imageSummary.bundled} / {imageSummary.local}
        </strong>
      </div>
      {imageSummary.external > 0 && (
        <p className="mt-2 text-xs leading-4.5 break-words text-muted-foreground">
          外链图片 {imageSummary.external} 张，导出时不会复制到本地 bundle。
        </p>
      )}
      {imageSummary.missing.length > 0 && (
        <p className="mt-2 text-xs leading-4.5 break-words text-muted-foreground">
          缺失图片：{imageSummary.missing.slice(0, 3).join("、")}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onSelectAll}>
          全选
        </Button>
        <Button variant="outline" onClick={onSelectNone}>
          清空
        </Button>
      </div>
      <ExportSheetList
        publishableSheets={publishableSheets}
        selectedSheets={selectedSheets}
        unselectedSheets={unselectedSheets}
        onToggleSheet={onToggleSheet}
        onMoveSheet={onMoveSheet}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button onClick={onDownloadMarkdown} disabled={selectedSheets.length === 0}>
          <Download /> Markdown
        </Button>
        <Button variant="outline" onClick={onDownloadHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
          {htmlBusy ? "HTML 生成中" : "HTML"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onDownloadPlainText} disabled={selectedSheets.length === 0}>
          纯文本
        </Button>
        <Button variant="outline" onClick={onDownloadWechatHtml} disabled={selectedSheets.length === 0}>
          公众号 HTML
        </Button>
        <Button variant="outline" onClick={onDownloadXhsDraft} disabled={selectedSheets.length === 0}>
          小红书草稿
        </Button>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs leading-4.5 text-muted-foreground">复制 / 打印</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onCopyMarkdown} disabled={selectedSheets.length === 0}>
            <Copy /> MD
          </Button>
          <Button variant="outline" onClick={onCopyHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
            HTML
          </Button>
          <Button variant="outline" onClick={onCopyWechatHtml} disabled={selectedSheets.length === 0}>
            公众号
          </Button>
          <Button variant="outline" onClick={onCopyXhsDraft} disabled={selectedSheets.length === 0}>
            小红书
          </Button>
          <Button variant="outline" onClick={onOpenPrintPreview} disabled={selectedSheets.length === 0 || htmlBusy}>
            <Printer /> PDF
          </Button>
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs leading-4.5 text-muted-foreground">保存到项目 exports</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onSaveMarkdown} disabled={selectedSheets.length === 0}>
            <Save /> MD
          </Button>
          <Button variant="outline" onClick={onSaveHtml} disabled={selectedSheets.length === 0 || htmlBusy}>
            HTML
          </Button>
          <Button variant="outline" onClick={onSavePlainText} disabled={selectedSheets.length === 0}>
            TXT
          </Button>
          <Button variant="outline" onClick={onSaveWechatHtml} disabled={selectedSheets.length === 0}>
            公众号
          </Button>
          <Button variant="outline" onClick={onSaveXhsDraft} disabled={selectedSheets.length === 0}>
            小红书
          </Button>
        </div>
        {saveStatus && <p className="mt-2 text-xs leading-4.5 break-words text-muted-foreground">{saveStatus}</p>}
      </div>
    </section>
  );
}
