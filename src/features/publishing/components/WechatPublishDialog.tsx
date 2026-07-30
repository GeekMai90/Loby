/**
 * [INPUT]: 依赖 lucide-react、React 运行时、shadcn/ui 基础控件、公众号主题/图床/草稿发布模型与 shared 写作契约
 * [OUTPUT]: 对外提供 WechatPublishDialog，组合主题预览、复制排版、图床上传与微信公众号草稿推送
 * [POS]: 发布 feature 的公众号预览界面；用户点击后才触发微信连接检查，并把草稿身份交还应用持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, Loader2, Palette, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { renderWechatArticle, type WechatRenderResult } from "@/features/publishing/model/wechatRenderer";
import {
  collectWechatLocalImages,
  resolveWechatPreviewImagesWithOverrides,
  sheetWechatTags,
} from "@/features/publishing/model/wechatPreview";
import { loadWechatImageHostSettings, uploadWechatImages } from "@/features/publishing/model/wechatImageHost";
import type { WechatThemePreviewViewport } from "@/features/publishing/model/wechatThemePreviewModel";
import { WECHAT_THEME_SAMPLE_PROJECT } from "@/features/publishing/model/wechatThemeSampleArticle";
import { DEFAULT_WECHAT_THEME_ID, getWechatTheme, WECHAT_THEMES, type WechatThemeId } from "@/features/publishing/model/wechatThemes";
import {
  loadWechatThemeStore,
  openWechatThemeStudio,
  saveWechatThemePreferences,
  type WechatThemePreferences,
} from "@/features/publishing/model/wechatThemeStore";
import type { WritingProject, WritingSheet } from "@/shared/types";
import type { WechatDraftPublication } from "@/shared/types";
import { loadWechatDraftSettings, publishWechatDraft, type WechatDraftPublishProgress } from "@/features/publishing/model/api";
import {
  prepareWechatDraftRenderInput,
  WECHAT_OFFICIAL_ACCOUNT_TARGET_ID,
  wechatDraftPublication,
} from "@/features/publishing/model/wechatDraft";
import { WechatCopyButton } from "@/features/publishing/components/WechatCopyButton";
import { WechatImageHostButton, type WechatImageHostButtonStatus } from "@/features/publishing/components/WechatImageHostButton";
import { WechatThemeCatalog } from "@/features/publishing/components/WechatThemeCatalog";
import { WechatThemePreview, type WechatPreviewContentMode } from "@/features/publishing/components/WechatThemePreview";

interface WechatPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
  onOpenImageHostingSettings: () => void;
  onPublished: (targetId: string, publication: WechatDraftPublication) => void;
}

export function WechatPublishDialog({
  open,
  project,
  sheet,
  libraryPath,
  onClose,
  onOpenImageHostingSettings,
  onPublished,
}: WechatPublishDialogProps) {
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
  const [draftStatus, setDraftStatus] = useState<"idle" | "publishing" | "success" | "error">("idle");
  const [draftMessage, setDraftMessage] = useState("");
  const previewProject = sampleArticleActive ? WECHAT_THEME_SAMPLE_PROJECT : project;
  const previewSheet = sampleArticleActive ? WECHAT_THEME_SAMPLE_PROJECT.sheets[0]! : sheet;
  const tags = useMemo(() => sheetWechatTags(previewSheet), [previewSheet]);
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
      setDraftStatus("idle");
      setDraftMessage("");
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

  async function pushToWechatDraft() {
    if (draftStatus === "publishing" || busy || sampleArticleActive) return;
    setDraftStatus("publishing");
    setDraftMessage("正在检查微信公众号连接与 IP 白名单…");
    try {
      const settings = await loadWechatDraftSettings();
      if (!settings.configured) throw new Error("请先在“设置 → 发布 → 发布目标”中添加微信公众号。");
      const input = prepareWechatDraftRenderInput(libraryPath, project, sheet, settings.appId, selectedTheme, sheetWechatTags(sheet));
      const draftLayout = await renderWechatArticle({
        title: input.title,
        markdown: input.markdown,
        tags: input.tags,
        themeId: input.themeId,
        theme: input.theme,
      });
      const response = await publishWechatDraft({ ...input.requestBase, html: draftLayout.html }, (progress) => {
        setDraftMessage(wechatDraftProgressLabel(progress));
      });
      const publication = wechatDraftPublication(input.requestBase.sourceId, response);
      onPublished(WECHAT_OFFICIAL_ACCOUNT_TARGET_ID, publication);
      setDraftStatus("success");
      setDraftMessage(response.updated ? "公众号草稿已更新，请到公众号草稿箱检查并发布。" : "已推送到公众号草稿箱，请检查后自行发布。");
    } catch (cause) {
      setDraftStatus("error");
      setDraftMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && draftStatus !== "publishing" && onClose()}>
      <DialogContent
        className="grid h-[min(1224px,calc(100vh-16px))] min-h-0 w-[min(1120px,calc(100vw-24px))] max-w-none grid-cols-[clamp(190px,18vw,250px)_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none max-md:grid-cols-1"
        data-app-tooltip-scope
        data-wechat-publish-dialog
        onOpenAutoFocus={(event) => event.preventDefault()}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">微信公众号排版预览</DialogTitle>
        <DialogDescription className="sr-only">选择公众号主题，预览并复制带内联样式的 HTML。</DialogDescription>

        <aside className="flex min-h-0 flex-col border-r border-[var(--separator)] bg-background p-3.5 max-md:hidden">
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
            <WechatCopyButton
              html={result?.html}
              busy={busy || imageUploadStatus === "uploading" || draftStatus === "publishing"}
              iconOnly
            />
            <Button
              type="button"
              variant={draftStatus === "error" ? "destructive" : "ghost"}
              size="icon"
              disabled={!result || busy || sampleArticleActive || draftStatus === "publishing"}
              data-tooltip={sampleArticleActive ? "示例文章不能推送" : draftStatus === "publishing" ? draftMessage : "推送到公众号草稿箱"}
              aria-label="推送到公众号草稿箱"
              data-wechat-draft-button
              data-no-window-drag
              onClick={() => void pushToWechatDraft()}
            >
              {draftStatus === "publishing" ? <Loader2 className="animate-spin" /> : draftStatus === "success" ? <Check /> : <Send />}
            </Button>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-tooltip="关闭"
                aria-label="关闭"
                data-wechat-close-button
                data-no-window-drag
                disabled={draftStatus === "publishing"}
              >
                <X />
              </Button>
            </DialogClose>
          </div>
          <span className="sr-only" role="status" aria-live="polite">
            {imageUploadMessage}
          </span>
          {draftMessage ? (
            <div
              className={`absolute right-4 bottom-4 z-20 max-w-[min(560px,calc(100%-32px))] rounded-lg border bg-background/95 px-3 py-2 text-xs leading-5 shadow-lg backdrop-blur ${
                draftStatus === "error" ? "border-destructive/40 text-destructive" : "border-border text-foreground"
              }`}
              role={draftStatus === "error" ? "alert" : "status"}
              aria-live="polite"
              data-wechat-draft-message
            >
              {draftMessage}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function wechatDraftProgressLabel(progress: WechatDraftPublishProgress): string {
  switch (progress.stage) {
    case "checkingConnection":
      return "正在检查微信公众号连接与 IP 白名单…";
    case "uploadingImages":
      return `正在上传正文图片 ${progress.completed}/${progress.total}…`;
    case "uploadingCover":
      return "正在上传正文第一张图片作为封面…";
    case "creating":
      return "正在创建公众号草稿…";
    case "updating":
      return "正在更新公众号草稿…";
    case "finished":
      return "公众号草稿已保存。";
  }
}
