import { Check, Clipboard, Code2, X } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { copyWechatHtml, renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "../lib/imageAssets";
import { isDesktopPublishingAvailable } from "../lib/publishing/api";
import { getWechatTheme, WECHAT_THEMES, type WechatThemeId } from "../lib/publishing/wechatThemes";
import type { WritingProject, WritingSheet } from "../types";

interface WechatPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
}

const THEME_STORAGE_KEY = "nibva.publish.wechat.theme";

export function WechatPublishDialog({ open, project, sheet, libraryPath, onClose }: WechatPublishDialogProps) {
  const [themeId, setThemeId] = useState<WechatThemeId>(() => loadThemeId());
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showSource, setShowSource] = useState(false);
  const summary = sheet.summary || project.writingBrief?.thesis || "";
  const tags = useMemo(() => [...new Set([...project.tags, ...sheetPropertyTags(sheet)])], [project.tags, sheet]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setCopyStatus("");
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    const markdown = resolveWechatPreviewImages(sheet.body, libraryPath, project, sheet);
    renderWechatArticle({ title: sheet.title, markdown, summary, tags, themeId })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((cause) => {
        if (!cancelled) setCopyStatus(`排版失败：${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryPath, open, project, sheet, summary, tags, themeId]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  const selectedTheme = getWechatTheme(themeId);
  const previewDocument = buildPreviewDocument(result?.html ?? "", selectedTheme.tokens.pageBackground);

  async function copyFormattedArticle() {
    if (!result) return;
    setCopyStatus("");
    try {
      await copyWechatHtml(result.html);
      setCopyStatus("已复制排版内容，可以直接粘贴到公众号编辑器。 ");
    } catch (cause) {
      setCopyStatus(`复制失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  return (
    <div className="modal-backdrop wechat-publish-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="wechat-publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wechat-publish-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="wechat-publish-header">
          <div>
            <span>微信公众号排版</span>
            <h2 id="wechat-publish-title">{sheet.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </header>

        <div className="wechat-publish-body">
          <aside className="wechat-theme-sidebar">
            <div className="wechat-publish-section-title">
              <strong>选择版式</strong>
              <small>以后新增主题只需注册到主题库</small>
            </div>
            <div className="wechat-theme-list">
              {WECHAT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  className={theme.id === themeId ? "selected" : ""}
                  onClick={() => setThemeId(theme.id)}
                >
                  <span className="wechat-theme-swatches">
                    {theme.swatches.map((color) => (
                      <i key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span>
                    <strong>{theme.label}</strong>
                    <small>{theme.description}</small>
                  </span>
                  {theme.id === themeId && <Check size={15} />}
                </button>
              ))}
            </div>

            <div className="wechat-publish-summary">
              <span>
                <strong>{result?.textCount.toLocaleString("zh-CN") ?? "—"}</strong> 字
              </span>
              <span>
                <strong>{result?.readingMinutes ?? "—"}</strong> 分钟阅读
              </span>
            </div>

            <div className="wechat-publish-tips">
              <strong>使用方法</strong>
              <ol>
                <li>确认右侧排版和图片</li>
                <li>点击复制排版</li>
                <li>粘贴到公众号编辑器</li>
              </ol>
            </div>
          </aside>

          <main className="wechat-preview-area">
            <div className="wechat-preview-toolbar">
              <span>{busy ? "正在生成预览…" : `${selectedTheme.label} · 手机宽度预览`}</span>
              <button type="button" className={showSource ? "active" : ""} onClick={() => setShowSource((value) => !value)}>
                <Code2 size={14} /> {showSource ? "查看预览" : "查看 HTML"}
              </button>
            </div>
            <div className="wechat-phone-preview">
              {showSource ? (
                <pre>{result?.html ?? "正在生成…"}</pre>
              ) : (
                <iframe title="公众号排版预览" srcDoc={previewDocument} sandbox="" />
              )}
            </div>
          </main>
        </div>

        <footer className="wechat-publish-footer">
          <p>{copyStatus || "复制的是带内联样式的富文本 HTML，可直接粘贴到公众号后台。"}</p>
          <button type="button" className="primary-button" disabled={!result || busy} onClick={copyFormattedArticle}>
            <Clipboard size={15} /> 复制排版
          </button>
        </footer>
      </section>
    </div>
  );
}

function loadThemeId(): WechatThemeId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "cream-paper" ? "cream-paper" : "deep-blue-study";
  } catch {
    return "deep-blue-study";
  }
}

function buildPreviewDocument(html: string, background: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-width:0;background:${background};}body{padding:0;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;}*{box-sizing:border-box;}img{max-width:100%;}</style></head><body>${html}</body></html>`;
}

function sheetPropertyTags(sheet: WritingSheet): string[] {
  const value = sheet.properties?.tags ?? sheet.properties?.标签;
  if (typeof value === "string")
    return value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()));
  return [];
}

function resolveWechatPreviewImages(markdown: string, libraryPath: string, project: WritingProject, sheet: WritingSheet) {
  let resolved = renderObsidianImagesAsMarkdown(markdown);
  if (!isDesktopPublishingAvailable()) return resolved;
  for (const reference of parseImageReferences(resolved)) {
    if (/^https?:\/\//i.test(reference.path)) continue;
    const source = resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) continue;
    resolved = resolved.replace(reference.raw, reference.raw.replace(reference.path, convertFileSrc(source)));
  }
  return resolved;
}
