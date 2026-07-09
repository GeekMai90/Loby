import clsx from "clsx";
import { ChevronDown, ChevronUp, Copy, Download, FilePlus2, Printer, Save } from "lucide-react";
import type { ImageDependencySummary } from "../lib/imageAssets";
import { getPublishingChecklist } from "../lib/projectModel";
import { countWords } from "../lib/text";
import type { WritingProject, WritingSheet } from "../types";

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
  const readinessChecklist = [
    { label: "已选择发布卡片", ok: selectedSheets.length > 0 },
    { label: "正文有标题结构", ok: hasHeading },
    { label: "合并字数不为空", ok: selectedWordCount > 0 },
    { label: "本地配图可导出", ok: imageSummary.missing.length === 0 },
    { label: "目标平台已设置", ok: project.targetPlatform.trim() !== "" && project.targetPlatform !== "未指定" },
  ];
  const publishingChecklist = getPublishingChecklist(project);
  const finishedPublishingTasks = publishingChecklist.filter((item) => item.done).length;

  return (
    <div className="panel-stack">
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
          <strong>{project.sheets.length - publishableSheets.length}</strong>
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
        <div className="export-sheet-list" aria-label="选择并排序要导出的稿件卡片">
          {selectedSheets.map((sheet, index) => (
            <div key={sheet.id} className="export-sheet-row selected">
              <label>
                <input type="checkbox" checked onChange={() => onToggleSheet(sheet.id)} />
                <span>
                  <strong>
                    {index + 1}. {sheet.title}
                  </strong>
                  <small>
                    {sheet.type} · {sheet.status} · {countWords(sheet.body)} 字
                  </small>
                </span>
              </label>
              <div className="export-order-actions">
                <button className="icon-button" onClick={() => onMoveSheet(sheet.id, -1)} disabled={index === 0} title="上移导出顺序">
                  <ChevronUp size={14} />
                </button>
                <button
                  className="icon-button"
                  onClick={() => onMoveSheet(sheet.id, 1)}
                  disabled={index === selectedSheets.length - 1}
                  title="下移导出顺序"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          ))}
          {unselectedSheets.length > 0 && <p className="export-list-label">未选择</p>}
          {unselectedSheets.map((sheet) => (
            <div key={sheet.id} className="export-sheet-row">
              <label>
                <input type="checkbox" checked={false} onChange={() => onToggleSheet(sheet.id)} />
                <span>
                  <strong>{sheet.title}</strong>
                  <small>
                    {sheet.type} · {sheet.status} · {countWords(sheet.body)} 字
                  </small>
                </span>
              </label>
            </div>
          ))}
          {publishableSheets.length === 0 && <p className="muted-text">当前项目没有可发布卡片。</p>}
        </div>
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

      <section className="panel-section">
        <h2>发布检查</h2>
        <div className="publish-checklist">
          {readinessChecklist.map((item) => (
            <div key={item.label} className={clsx("checklist-row", item.ok && "checked")}>
              <span>{item.ok ? "✓" : "!"}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
        <div className="publishing-task-header">
          <strong>发布任务</strong>
          <small>
            {finishedPublishingTasks} / {publishingChecklist.length}
          </small>
        </div>
        <div className="publish-task-list">
          {publishingChecklist.map((item) => (
            <label key={item.id} className={clsx("publish-task-row", item.done && "checked")}>
              <input type="checkbox" checked={item.done} onChange={() => onTogglePublishingChecklistItem(item.id)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
        <button className="primary-button full-width" onClick={onCreatePublishVersion} disabled={selectedSheets.length === 0}>
          <FilePlus2 size={16} /> 保存为发布版本
        </button>
      </section>

      <section className="panel-section export-preview">
        <h2>Markdown 预览</h2>
        <pre>{markdown.slice(0, 1600)}</pre>
      </section>

      <section className="panel-section export-preview">
        <h2>HTML 预览</h2>
        <pre>{htmlBusy ? "HTML 正在生成..." : html.slice(0, 1000)}</pre>
      </section>

      <section className="panel-section export-preview">
        <h2>公众号 HTML</h2>
        <pre>{wechatHtml.slice(0, 1200)}</pre>
      </section>

      <section className="panel-section export-preview">
        <h2>小红书拆条</h2>
        <pre>{xhsDraft.slice(0, 1200)}</pre>
      </section>
    </div>
  );
}
