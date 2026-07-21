import { Palette, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { renderWechatArticle, type WechatRenderResult } from "../lib/publishing/wechatRenderer";
import { collectWechatLocalImages, resolveWechatPreviewImagesWithOverrides, sheetWechatTags } from "../lib/publishing/wechatPreview";
import { loadWechatImageHostSettings, uploadWechatImages } from "../lib/publishing/wechatImageHost";
import type { WechatThemePreviewViewport } from "../lib/publishing/wechatThemePreviewModel";
import { WECHAT_THEME_SAMPLE_PROJECT } from "../lib/publishing/wechatThemeSampleArticle";
import { DEFAULT_WECHAT_THEME_ID, getWechatTheme, WECHAT_THEMES, type WechatThemeId } from "../lib/publishing/wechatThemes";
import {
  loadWechatThemeStore,
  openWechatThemeStudio,
  saveWechatThemePreferences,
  type WechatThemePreferences,
} from "../lib/publishing/wechatThemeStore";
import type { WritingProject, WritingSheet } from "../types";
import { WechatCopyButton } from "./WechatCopyButton";
import { WechatImageHostButton, type WechatImageHostButtonStatus } from "./WechatImageHostButton";
import { WechatThemeCatalog } from "./WechatThemeCatalog";
import { WechatThemePreview, type WechatPreviewContentMode } from "./WechatThemePreview";
import { LiquidGlassButton } from "./LiquidGlassButton";

interface WechatPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
  onOpenImageHostingSettings: () => void;
}

export function WechatPublishDialog({ open, project, sheet, libraryPath, onClose, onOpenImageHostingSettings }: WechatPublishDialogProps) {
  const [themeId, setThemeId] = useState<WechatThemeId>(DEFAULT_WECHAT_THEME_ID);
  const [personalThemes, setPersonalThemes] = useState(() => [] as Awaited<ReturnType<typeof loadWechatThemeStore>>["themes"]);
  const [preferences, setPreferences] = useState<WechatThemePreferences>({
    defaultThemeId: DEFAULT_WECHAT_THEME_ID,
    favoriteThemeIds: [],
  });
  const [themesReady, setThemesReady] = useState(false);
  const [result, setResult] = useState<WechatRenderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewViewport, setPreviewViewport] = useState<WechatThemePreviewViewport>("mobile");
  const [previewContentMode, setPreviewContentMode] = useState<WechatPreviewContentMode>("rich");
  const [sampleArticleActive, setSampleArticleActive] = useState(false);
  const [imageHostSettingsReady, setImageHostSettingsReady] = useState(false);
  const [imageHostConfigured, setImageHostConfigured] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<Record<string, string>>({});
  const [imageUploadStatus, setImageUploadStatus] = useState<WechatImageHostButtonStatus>("idle");
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const previewProject = sampleArticleActive ? WECHAT_THEME_SAMPLE_PROJECT : project;
  const previewSheet = sampleArticleActive ? WECHAT_THEME_SAMPLE_PROJECT.sheets[0]! : sheet;
  const tags = useMemo(() => sheetWechatTags(previewProject, previewSheet), [previewProject, previewSheet]);
  const themes = useMemo(() => [...WECHAT_THEMES, ...personalThemes], [personalThemes]);
  const localImages = useMemo(
    () => collectWechatLocalImages(previewSheet.body, libraryPath, previewProject, previewSheet),
    [libraryPath, previewProject, previewSheet],
  );
  const uploadedLocalImageCount = useMemo(
    () => localImages.filter((image) => Boolean(uploadedImageUrls[image.source])).length,
    [localImages, uploadedImageUrls],
  );

  useEffect(() => {
    if (!open) {
      setThemesReady(false);
      setSampleArticleActive(false);
      setImageHostSettingsReady(false);
      setImageHostConfigured(false);
      setUploadedImageUrls({});
      setImageUploadStatus("idle");
      setImageUploadMessage("");
      return;
    }
    let cancelled = false;
    setThemesReady(false);
    setBusy(true);
    setResult(null);
    setPreviewError("");
    loadWechatThemeStore(libraryPath)
      .then((store) => {
        if (cancelled) return;
        setPersonalThemes(store.themes);
        const available = [...WECHAT_THEMES, ...store.themes];
        const defaultThemeId = available.some((theme) => theme.id === store.preferences.defaultThemeId)
          ? store.preferences.defaultThemeId
          : DEFAULT_WECHAT_THEME_ID;
        const nextPreferences = { ...store.preferences, defaultThemeId };
        setPreferences(nextPreferences);
        setThemeId(defaultThemeId);
        if (defaultThemeId !== store.preferences.defaultThemeId) void saveWechatThemePreferences(libraryPath, nextPreferences);
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
  }, [libraryPath, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImageHostSettingsReady(false);
    void loadWechatImageHostSettings()
      .then((settings) => {
        if (cancelled) return;
        setImageHostConfigured(settings.configured);
        setImageHostSettingsReady(true);
      })
      .catch((cause) => {
        if (cancelled) return;
        setImageHostConfigured(false);
        setImageHostSettingsReady(true);
        setImageUploadStatus("error");
        setImageUploadMessage(`图床设置读取失败：${cause instanceof Error ? cause.message : String(cause)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    setImageUploadStatus("idle");
    setImageUploadMessage("");
  }, [previewProject, previewSheet]);

  useEffect(() => {
    if (!open || !themesReady) return;
    let cancelled = false;
    setBusy(true);
    setPreviewError("");
    const markdown = resolveWechatPreviewImagesWithOverrides(
      previewSheet.body,
      libraryPath,
      previewProject,
      previewSheet,
      uploadedImageUrls,
    );
    const activeTheme = themes.find((theme) => theme.id === themeId) ?? getWechatTheme(themeId);
    renderWechatArticle({ title: previewSheet.title, markdown, tags, themeId, theme: activeTheme })
      .then((next) => {
        if (!cancelled) setResult(next);
      })
      .catch((cause) => {
        if (!cancelled) {
          const message = `排版失败：${cause instanceof Error ? cause.message : String(cause)}`;
          setPreviewError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryPath, open, previewProject, previewSheet, tags, themeId, themes, themesReady, uploadedImageUrls]);

  const selectedTheme = themes.find((theme) => theme.id === themeId) ?? getWechatTheme(themeId);

  function selectTheme(nextThemeId: WechatThemeId) {
    setThemeId(nextThemeId);
  }

  async function toggleFavorite(nextThemeId: WechatThemeId) {
    const favorite = preferences.favoriteThemeIds.includes(nextThemeId);
    const nextPreferences = {
      ...preferences,
      favoriteThemeIds: favorite
        ? preferences.favoriteThemeIds.filter((id) => id !== nextThemeId)
        : [...preferences.favoriteThemeIds, nextThemeId],
    };
    setPreferences(nextPreferences);
    try {
      const store = await saveWechatThemePreferences(libraryPath, nextPreferences);
      setPersonalThemes(store.themes);
      setPreferences(store.preferences);
    } catch (cause) {
      setPreferences(preferences);
      setPreviewError(`收藏主题失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  async function setDefaultTheme(nextThemeId: WechatThemeId) {
    const nextPreferences = { ...preferences, defaultThemeId: nextThemeId };
    setPreferences(nextPreferences);
    try {
      const store = await saveWechatThemePreferences(libraryPath, nextPreferences);
      setPersonalThemes(store.themes);
      setPreferences(store.preferences);
    } catch (cause) {
      setPreferences(preferences);
      setPreviewError(`设置默认主题失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
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

  async function uploadLocalImages() {
    if (!imageHostConfigured) {
      onOpenImageHostingSettings();
      return;
    }
    const pendingImages = localImages.filter((image) => !uploadedImageUrls[image.source]);
    if (pendingImages.length === 0) return;
    setImageUploadStatus("uploading");
    setImageUploadMessage("");
    setBusy(true);
    try {
      const uploaded = await uploadWechatImages(pendingImages.map((image) => ({ source: image.source })));
      setUploadedImageUrls((current) => ({
        ...current,
        ...Object.fromEntries(uploaded.map((image) => [image.source, image.url])),
      }));
      setImageUploadStatus("success");
      setImageUploadMessage(`已上传 ${localImages.length} 张图片，复制排版即可使用。`);
    } catch (cause) {
      setBusy(false);
      setImageUploadStatus("error");
      setImageUploadMessage(`图片上传失败：${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }

  function openImageHostingSettings() {
    onOpenImageHostingSettings();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        className="grid h-[min(1224px,calc(100vh-16px))] min-h-0 w-[min(1120px,calc(100vw-24px))] max-w-none grid-cols-[clamp(190px,18vw,250px)_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none max-md:grid-cols-1"
        data-app-tooltip-scope
        data-wechat-publish-dialog
        onOpenAutoFocus={(event) => event.preventDefault()}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">微信公众号排版预览</DialogTitle>
        <DialogDescription className="sr-only">选择公众号主题，预览并复制带内联样式的 HTML。</DialogDescription>

        <aside className="flex min-h-0 flex-col border-r border-[var(--separator)] bg-[var(--surface)] p-3.5 max-md:hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-1 pb-3">
              <strong className="block text-sm font-medium">主题</strong>
            </div>
            <WechatThemeCatalog
              themes={themes}
              selectedThemeId={themeId}
              preferences={preferences}
              onSelect={selectTheme}
              onToggleFavorite={(id) => void toggleFavorite(id)}
              onSetDefault={(id) => void setDefaultTheme(id)}
            />
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
            sampleArticleActive={sampleArticleActive}
            onSampleArticleActiveChange={setSampleArticleActive}
          />
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2" data-wechat-preview-actions>
            <WechatImageHostButton
              configured={imageHostConfigured}
              settingsReady={imageHostSettingsReady}
              localImageCount={localImages.length}
              uploadedImageCount={uploadedLocalImageCount}
              status={imageUploadStatus}
              message={imageUploadMessage}
              onUpload={() => void uploadLocalImages()}
              onOpenSettings={openImageHostingSettings}
            />
            <WechatCopyButton html={result?.html} busy={busy || imageUploadStatus === "uploading"} appearance="liquid-glass" iconOnly />
            <DialogClose asChild>
              <LiquidGlassButton data-tooltip="关闭" aria-label="关闭" data-wechat-close-button data-no-window-drag>
                <X />
              </LiquidGlassButton>
            </DialogClose>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {imageUploadMessage}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
