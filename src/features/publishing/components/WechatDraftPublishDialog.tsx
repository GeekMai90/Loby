/**
 * [INPUT]: 依赖 shadcn/ui、公众号草稿纯视图、文稿图片解析、主题渲染器、草稿 API/进度映射与 shared 写作契约
 * [OUTPUT]: 对外提供 WechatDraftPublishDialog，承载带文稿/主题/封面摘要的公众号草稿确认、真实进度、错误恢复与远端身份回写
 * [POS]: publishing feature 的公众号草稿发布控制器；预览窗口只负责选主题和打开本模态窗，网络副作用留在用户确认之后
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { parseImageReferences } from "@/features/library/model/imageAssets";
import { WechatDraftPublishView, type WechatDraftPublishState } from "@/features/publishing/components/WechatDraftPublishView";
import { collectWechatLocalImages, sheetWechatTags } from "@/features/publishing/model/wechatPreview";
import { isDesktopPublishingAvailable, loadWechatDraftSettings, publishWechatDraft } from "@/features/publishing/model/api";
import { wechatDraftProgressPresentation } from "@/features/publishing/model/progress";
import { prepareWechatDraftHtml, renderWechatArticle } from "@/features/publishing/model/wechatRenderer";
import {
  prepareWechatDraftRenderInput,
  WECHAT_OFFICIAL_ACCOUNT_TARGET_ID,
  wechatDraftPublication,
} from "@/features/publishing/model/wechatDraft";
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";
import type { WechatDraftPublication, WritingProject, WritingSheet } from "@/shared/types";

interface WechatDraftPublishDialogProps {
  open: boolean;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  theme: WechatThemeManifest;
  onClose: () => void;
  onOpenSettings: () => void;
  onPublished: (targetId: string, publication: WechatDraftPublication) => void;
}

export function WechatDraftPublishDialog({
  open,
  project,
  sheet,
  libraryPath,
  theme,
  onClose,
  onOpenSettings,
  onPublished,
}: WechatDraftPublishDialogProps) {
  const desktopAvailable = isDesktopPublishingAvailable();
  const [state, setState] = useState<WechatDraftPublishState>("ready");
  const [progress, setProgress] = useState(8);
  const [progressLabel, setProgressLabel] = useState("正在检查微信公众号连接与 IP 白名单…");
  const [errorMessage, setErrorMessage] = useState("");
  const [configuredAppId, setConfiguredAppId] = useState("");
  const previousOpenRef = useRef(open);
  const localImages = useMemo(() => collectWechatLocalImages(sheet.body, libraryPath, project, sheet), [libraryPath, project, sheet]);
  const savedPublication = sheet.publications?.[WECHAT_OFFICIAL_ACCOUNT_TARGET_ID];
  const publication = savedPublication?.targetKind === "wechatOfficialAccount" ? savedPublication : undefined;
  const wasPublished = Boolean(publication?.mediaId && publication.appId === configuredAppId);
  const busy = state === "publishing";

  useEffect(() => {
    const opening = open && !previousOpenRef.current;
    previousOpenRef.current = open;
    if (!open) return;
    if (opening) {
      setState("ready");
      setProgress(8);
      setProgressLabel("正在检查微信公众号连接与 IP 白名单…");
      setErrorMessage("");
    }
    let cancelled = false;
    void loadWechatDraftSettings()
      .then((settings) => {
        if (!cancelled) setConfiguredAppId(settings.configured ? settings.appId : "");
      })
      .catch(() => {
        if (!cancelled) setConfiguredAppId("");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function pushDraft() {
    setState("publishing");
    setProgress(8);
    setProgressLabel("正在检查微信公众号连接与 IP 白名单…");
    setErrorMessage("");
    try {
      const settings = await loadWechatDraftSettings();
      if (!settings.configured) throw new Error("请先在“设置 → 发布 → 发布目标”中添加微信公众号。");
      const input = prepareWechatDraftRenderInput(libraryPath, project, sheet, settings.appId, theme, sheetWechatTags(sheet));
      const layout = await renderWechatArticle({
        title: input.title,
        markdown: input.markdown,
        tags: input.tags,
        themeId: input.themeId,
        theme: input.theme,
      });
      const response = await publishWechatDraft({ ...input.requestBase, html: prepareWechatDraftHtml(layout.html) }, (event) => {
        const presentation = wechatDraftProgressPresentation(event);
        setProgress(presentation.value);
        setProgressLabel(presentation.label);
      });
      const nextPublication = wechatDraftPublication(input.requestBase.sourceId, response);
      setConfiguredAppId(settings.appId);
      setProgress(100);
      setProgressLabel(response.updated ? "公众号草稿已更新" : "公众号草稿已创建");
      setState("success");
      onPublished(WECHAT_OFFICIAL_ACCOUNT_TARGET_ID, nextPublication);
    } catch (cause) {
      setState("error");
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(520px,calc(100vw-48px))] gap-0 p-5 sm:max-w-[min(520px,calc(100vw-48px))]"
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <header className="flex min-h-8 items-center gap-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg">推送到公众号草稿箱</DialogTitle>
            <DialogDescription className="sr-only">确认当前主题、文章和封面后推送到微信公众号草稿箱。</DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={onClose} title="关闭">
            <X />
          </Button>
        </header>

        <WechatDraftPublishView
          state={state}
          title={sheet.title.trim() || project.title}
          characterCount={sheet.body.length}
          imageCount={parseImageReferences(sheet.body).length}
          themeName={theme.name}
          coverDetail={localImages.length > 0 ? "第一张本地图片" : "尚未找到本地图片"}
          wasPublished={wasPublished}
          progress={progress}
          progressLabel={progressLabel}
          errorMessage={errorMessage}
          errorNeedsSettings={wechatErrorNeedsSettings(errorMessage)}
          desktopAvailable={desktopAvailable}
          onCancel={onClose}
          onPublish={() => void pushDraft()}
          onOpenSettings={() => {
            onClose();
            onOpenSettings();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function wechatErrorNeedsSettings(message: string): boolean {
  return /设置 → 发布 → 发布目标|未找到微信公众号 AppSecret|AppID 无效|AppSecret 无效/i.test(message);
}
