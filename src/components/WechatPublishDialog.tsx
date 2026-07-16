import { Check, Clipboard, Code2, Palette } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Toggle } from "@/components/ui/toggle";
import { copyWechatHtml, renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { buildWechatPreviewDocument, resolveWechatPreviewImages, sheetWechatTags } from "../lib/publishing/wechatPreview";
import { getWechatTheme, WECHAT_THEMES, type WechatThemeId } from "../lib/publishing/wechatThemes";
import { loadWechatThemeStore, openWechatThemeStudio, WECHAT_SELECTED_THEME_STORAGE_KEY } from "../lib/publishing/wechatThemeStore";
import type { WritingProject, WritingSheet } from "../types";

interface WechatPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
}

export function WechatPublishDialog({ open, project, sheet, libraryPath, onClose }: WechatPublishDialogProps) {
  const [themeId, setThemeId] = useState<WechatThemeId>(() => loadThemeId());
  const [personalThemes, setPersonalThemes] = useState(() => [] as Awaited<ReturnType<typeof loadWechatThemeStore>>["themes"]);
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showSource, setShowSource] = useState(false);
  const summary = sheet.summary || project.writingBrief?.thesis || "";
  const tags = useMemo(() => sheetWechatTags(project, sheet), [project, sheet]);
  const themes = useMemo(() => [...WECHAT_THEMES, ...personalThemes], [personalThemes]);

  useEffect(() => {
    if (!open) return;
    loadWechatThemeStore()
      .then((store) => {
        setPersonalThemes(store.themes);
        const savedThemeId = loadThemeId();
        const available = [...WECHAT_THEMES, ...store.themes];
        setThemeId(available.some((theme) => theme.id === savedThemeId) ? savedThemeId : "deep-blue-study");
      })
      .catch((cause) => setCopyStatus(`个人主题加载失败：${cause instanceof Error ? cause.message : String(cause)}`));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(true);
    setCopyStatus("");
    localStorage.setItem(WECHAT_SELECTED_THEME_STORAGE_KEY, themeId);
    const markdown = resolveWechatPreviewImages(sheet.body, libraryPath, project, sheet);
    const activeTheme = themes.find((theme) => theme.id === themeId) ?? getWechatTheme(themeId);
    renderWechatArticle({ title: sheet.title, markdown, summary, tags, themeId, theme: activeTheme })
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
  }, [libraryPath, open, project, sheet, summary, tags, themeId, themes]);

  const selectedTheme = themes.find((theme) => theme.id === themeId) ?? getWechatTheme(themeId);
  const previewDocument = buildWechatPreviewDocument(result?.html ?? "", selectedTheme.tokens.pageBackground);

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

  async function customizeTheme() {
    setCopyStatus("");
    try {
      await openWechatThemeStudio({
        libraryPath,
        activeProjectId: project.id,
        activeSheetId: sheet.id,
        selectedThemeId: selectedTheme.id,
      });
      onClose();
    } catch (cause) {
      setCopyStatus(`主题工作室打开失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex h-[min(780px,calc(100vh-40px))] min-h-0 w-[min(1120px,calc(100vw-40px))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <header className="flex min-h-[70px] shrink-0 items-center justify-between gap-5 border-b border-border px-6 py-3.5 pr-14">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-muted-foreground">微信公众号排版</p>
            <DialogTitle className="truncate text-lg">{sheet.title}</DialogTitle>
            <DialogDescription className="sr-only">选择公众号排版主题，预览并复制带内联样式的 HTML。</DialogDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={customizeTheme}>
            <Palette /> 自定义主题
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[270px_minmax(0,1fr)] max-md:grid-cols-1">
          <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-border bg-muted/30 p-3.5 max-md:hidden">
            <div className="px-1 pb-3">
              <strong className="block text-sm font-medium">选择版式</strong>
              <small className="mt-1 block text-xs leading-relaxed text-muted-foreground">选择适合当前文章的公众号版式</small>
            </div>
            <div className="flex flex-col gap-2">
              {themes.map((theme) => (
                <Button
                  key={theme.id}
                  type="button"
                  variant={theme.id === themeId ? "secondary" : "outline"}
                  className="h-auto w-full justify-start gap-2.5 p-2.5 text-left whitespace-normal"
                  onClick={() => setThemeId(theme.id)}
                >
                  <span className="flex size-8 shrink-0 overflow-hidden rounded-lg border border-border">
                    {theme.swatches.map((color) => (
                      <i key={color} className="flex-1" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium">{theme.name}</strong>
                    <small className="mt-0.5 block text-xs leading-snug font-normal text-muted-foreground">{theme.description}</small>
                  </span>
                  {theme.id === themeId && <Check className="text-muted-foreground" />}
                </Button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <span className="rounded-lg border border-border bg-background p-2 text-center text-xs text-muted-foreground">
                <strong className="mb-0.5 block text-base font-medium text-foreground">
                  {result?.textCount.toLocaleString("zh-CN") ?? "—"}
                </strong>{" "}
                字
              </span>
              <span className="rounded-lg border border-border bg-background p-2 text-center text-xs text-muted-foreground">
                <strong className="mb-0.5 block text-base font-medium text-foreground">{result?.readingMinutes ?? "—"}</strong> 分钟阅读
              </span>
            </div>

            <div className="mt-auto border-t border-border px-1 pt-4 text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">使用方法</strong>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>确认右侧排版和图片</li>
                <li>点击复制排版</li>
                <li>粘贴到公众号编辑器</li>
              </ol>
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-col bg-[#eef0f3]">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-black/10 px-4 text-xs text-[#73767d]">
              <span>{busy ? "正在生成预览…" : `${selectedTheme.name} · 手机宽度预览`}</span>
              <Toggle size="sm" pressed={showSource} onPressedChange={setShowSource} className="text-[#64666c]">
                <Code2 /> {showSource ? "查看预览" : "查看 HTML"}
              </Toggle>
            </div>
            <div className="wechat-phone-preview min-h-0 flex-1 overflow-auto p-6">
              {showSource ? (
                <pre>{result?.html ?? "正在生成…"}</pre>
              ) : (
                <iframe title="公众号排版预览" srcDoc={previewDocument} sandbox="" />
              )}
            </div>
          </main>
        </div>

        <footer className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-t border-border px-6 py-3">
          <p className="m-0 text-xs text-muted-foreground">{copyStatus || "复制的是带内联样式的富文本 HTML，可直接粘贴到公众号后台。"}</p>
          <Button type="button" disabled={!result || busy} onClick={copyFormattedArticle}>
            <Clipboard /> 复制排版
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function loadThemeId(): WechatThemeId {
  try {
    return localStorage.getItem(WECHAT_SELECTED_THEME_STORAGE_KEY) || "deep-blue-study";
  } catch {
    return "deep-blue-study";
  }
}
