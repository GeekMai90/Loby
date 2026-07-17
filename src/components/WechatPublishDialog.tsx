import { Palette, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { resolveWechatPreviewImages, sheetWechatTags } from "../lib/publishing/wechatPreview";
import type { WechatThemePreviewViewport } from "../lib/publishing/wechatThemePreviewModel";
import {
  DEFAULT_WECHAT_THEME_ID,
  getWechatTheme,
  WECHAT_THEMES,
  type WechatThemeId,
  type WechatThemeManifest,
} from "../lib/publishing/wechatThemes";
import { loadWechatThemeStore, openWechatThemeStudio, WECHAT_SELECTED_THEME_STORAGE_KEY } from "../lib/publishing/wechatThemeStore";
import type { WritingProject, WritingSheet } from "../types";
import { WechatCopyButton } from "./WechatCopyButton";
import { WechatThemePreview, type WechatPreviewContentMode } from "./WechatThemePreview";
import { LiquidGlassButton } from "./LiquidGlassButton";

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
  const [themesReady, setThemesReady] = useState(false);
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewViewport, setPreviewViewport] = useState<WechatThemePreviewViewport>("mobile");
  const [previewContentMode, setPreviewContentMode] = useState<WechatPreviewContentMode>("rich");
  const summary = sheet.summary || project.writingBrief?.thesis || "";
  const tags = useMemo(() => sheetWechatTags(project, sheet), [project, sheet]);
  const themes = useMemo(() => [...WECHAT_THEMES, ...personalThemes], [personalThemes]);

  useEffect(() => {
    if (!open) {
      setThemesReady(false);
      return;
    }
    let cancelled = false;
    setThemesReady(false);
    setBusy(true);
    setResult(null);
    setPreviewError("");
    loadWechatThemeStore()
      .then((store) => {
        if (cancelled) return;
        setPersonalThemes(store.themes);
        const savedThemeId = loadThemeId();
        const available = [...WECHAT_THEMES, ...store.themes];
        setThemeId(available.some((theme) => theme.id === savedThemeId) ? savedThemeId : DEFAULT_WECHAT_THEME_ID);
        setThemesReady(true);
      })
      .catch((cause) => {
        if (cancelled) return;
        setPersonalThemes([]);
        setThemeId(DEFAULT_WECHAT_THEME_ID);
        setPreviewError(`个人主题加载失败：${cause instanceof Error ? cause.message : String(cause)}`);
        setThemesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !themesReady) return;
    let cancelled = false;
    setBusy(true);
    setPreviewError("");
    localStorage.setItem(WECHAT_SELECTED_THEME_STORAGE_KEY, themeId);
    const markdown = resolveWechatPreviewImages(sheet.body, libraryPath, project, sheet);
    const activeTheme = themes.find((theme) => theme.id === themeId) ?? getWechatTheme(themeId);
    renderWechatArticle({ title: sheet.title, markdown, summary, tags, themeId, theme: activeTheme })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((cause) => {
        if (!cancelled) setPreviewError(`排版失败：${cause instanceof Error ? cause.message : String(cause)}`);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryPath, open, project, sheet, summary, tags, themeId, themes, themesReady]);

  const selectedTheme = themes.find((theme) => theme.id === themeId) ?? getWechatTheme(themeId);

  function selectTheme(nextThemeId: WechatThemeId) {
    setThemeId(nextThemeId);
  }

  async function customizeTheme() {
    setPreviewError("");
    try {
      await openWechatThemeStudio({
        libraryPath,
        activeProjectId: project.id,
        activeSheetId: sheet.id,
        selectedThemeId: selectedTheme.id,
      });
      onClose();
    } catch (cause) {
      setPreviewError(`主题工作室打开失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="grid h-[min(1224px,calc(100vh-16px))] min-h-0 w-[min(1120px,calc(100vw-24px))] max-w-none grid-cols-[clamp(190px,18vw,250px)_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none max-md:grid-cols-1"
        data-wechat-publish-dialog
        onOpenAutoFocus={(event) => event.preventDefault()}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">微信公众号排版预览</DialogTitle>
        <DialogDescription className="sr-only">选择公众号主题，预览并复制带内联样式的 HTML。</DialogDescription>

        <aside className="flex min-h-0 flex-col border-r border-border bg-muted/30 p-3.5 max-md:hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-1 pb-3">
              <strong className="block text-sm font-medium">主题</strong>
            </div>
            <div className="flex flex-col gap-2">
              {themes.map((theme) => (
                <Button
                  key={theme.id}
                  type="button"
                  variant={theme.id === themeId ? "default" : "outline"}
                  aria-pressed={theme.id === themeId}
                  data-selected={theme.id === themeId ? "true" : undefined}
                  className="h-12 w-full justify-start gap-2.5 px-2.5 text-left"
                  onClick={() => selectTheme(theme.id)}
                >
                  <span
                    className={`flex size-7 shrink-0 overflow-hidden rounded-md border ${
                      theme.id === themeId ? "border-white/35" : "border-border"
                    }`}
                  >
                    {themePreviewColors(theme).map((color, index) => (
                      <i key={`${color}-${index}`} className="flex-1" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium">{theme.name}</strong>
                  </span>
                </Button>
              ))}
            </div>
          </div>
          <Button type="button" variant="outline" className="mt-3 w-full shrink-0" onClick={customizeTheme}>
            <Palette /> 主题管理
          </Button>
        </aside>

        <div className="relative grid min-h-0 min-w-0">
          <WechatThemePreview
            result={result}
            theme={selectedTheme}
            busy={busy}
            error={previewError}
            viewport={previewViewport}
            onViewportChange={setPreviewViewport}
            contentMode={previewContentMode}
            onContentModeChange={setPreviewContentMode}
          />
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2" data-wechat-preview-actions>
            <WechatCopyButton html={result?.html} busy={busy} appearance="liquid-glass" iconOnly />
            <DialogClose asChild>
              <LiquidGlassButton title="关闭" aria-label="关闭" data-wechat-close-button data-no-window-drag>
                <X />
              </LiquidGlassButton>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function loadThemeId(): WechatThemeId {
  try {
    return localStorage.getItem(WECHAT_SELECTED_THEME_STORAGE_KEY) || DEFAULT_WECHAT_THEME_ID;
  } catch {
    return DEFAULT_WECHAT_THEME_ID;
  }
}

function themePreviewColors(theme: WechatThemeManifest): [string, string, string] {
  return [theme.baseStyle.colors.accent, theme.baseStyle.colors.titleText, theme.baseStyle.colors.pageBackground];
}
