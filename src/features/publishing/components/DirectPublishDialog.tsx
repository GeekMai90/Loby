/**
 * [INPUT]: 依赖 lucide-react、React 运行时、发布模块、写作库模块、shared 公共契约、shadcn/ui 基础控件
 * [OUTPUT]: 对外提供 DirectPublishDialog，并只把文稿自身摘要映射为 WordPress 可选 excerpt
 * [POS]: 发布 feature 的界面组合单元，连接发布状态与共享 UI，不以项目描述填充文章元数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { BookOpenText, CheckCircle2, ExternalLink, KeyRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { renderMarkdownHtml } from "@/features/publishing/model/export";
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "@/features/library/model/imageAssets";
import {
  hasPublishingSecret,
  isDesktopPublishingAvailable,
  publishMowenNote,
  publishWordPressPost,
  savePublishingSecret,
  validateSavedMowenApiKey,
  type MowenVisibility,
} from "@/features/publishing/model/api";
import { buildMowenDocument } from "@/features/publishing/model/mowenPayload";
import { mowenProgressPresentation } from "@/features/publishing/model/progress";
import type { WritingProject, WritingSheet } from "@/shared/types";
import { MowenPublishView, type MowenPublishState } from "@/features/publishing/components/MowenPublishView";

type DirectPublishChannel = "wordpress" | "mowen";

interface DirectPublishDialogProps {
  open: boolean;
  channel: DirectPublishChannel;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
  onOpenSettings: () => void;
}

interface WordPressConfig {
  siteUrl: string;
  username: string;
}

const WORDPRESS_CONFIG_KEY = "loby.publish.wordpress.config";

export function DirectPublishDialog({ open, channel, project, sheet, libraryPath, onClose, onOpenSettings }: DirectPublishDialogProps) {
  const [wordpressConfig, setWordpressConfig] = useState<WordPressConfig>(() => loadWordPressConfig());
  const [secret, setSecret] = useState("");
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [publishNow, setPublishNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [resultLink, setResultLink] = useState("");
  const [mowenState, setMowenState] = useState<MowenPublishState>("ready");
  const [mowenProgress, setMowenProgress] = useState(6);
  const [mowenProgressLabel, setMowenProgressLabel] = useState("正在检查墨问 API…");
  const [mowenVisibility, setMowenVisibility] = useState<MowenVisibility>("public");
  const desktopAvailable = isDesktopPublishingAvailable();
  const isWordPress = channel === "wordpress";
  const account = channel === "wordpress" ? wordpressConfig.username.trim() : "default";
  const title = sheet.title.trim() || project.title;
  useEffect(() => {
    if (!open || !isWordPress || !account) {
      setHasSavedSecret(false);
      return;
    }
    let cancelled = false;
    hasPublishingSecret(channel, account)
      .then((value) => {
        if (cancelled) return;
        setHasSavedSecret(value);
      })
      .catch(() => {
        if (cancelled) return;
        setHasSavedSecret(false);
      });
    return () => {
      cancelled = true;
    };
  }, [account, channel, isWordPress, open]);

  useEffect(() => {
    if (!open) return;
    setStatus("");
    setResultLink("");
    setSecret("");
    setMowenState("ready");
    setMowenProgress(6);
    setMowenProgressLabel("正在检查墨问 API…");
    setMowenVisibility("public");
  }, [channel, open]);

  if (!open) return null;
  const channelLabel = isWordPress ? "WordPress 博客" : "墨问笔记";

  async function publish() {
    if (!desktopAvailable) {
      const message = "请在落笔桌面应用中完成直接发布。";
      setStatus(message);
      if (!isWordPress) setMowenState("error");
      return;
    }
    setBusy(true);
    setStatus("");
    setResultLink("");
    if (!isWordPress) {
      setMowenState("publishing");
      setMowenProgress(6);
      setMowenProgressLabel("正在检查墨问 API…");
    }
    try {
      if (isWordPress && secret.trim()) {
        await savePublishingSecret(channel, account, secret.trim());
        setHasSavedSecret(true);
      }
      if (isWordPress) {
        const nextConfig = {
          siteUrl: wordpressConfig.siteUrl.trim(),
          username: wordpressConfig.username.trim(),
        };
        localStorage.setItem(WORDPRESS_CONFIG_KEY, JSON.stringify(nextConfig));
        const prepared = preparePublicationImages(sheet.body, libraryPath, project, sheet);
        const content = await renderMarkdownHtml(removeMatchingH1(prepared.markdown, title));
        const result = await publishWordPressPost({
          ...nextConfig,
          title,
          content,
          excerpt: sheet.summary.trim(),
          status: publishNow ? "publish" : "draft",
          images: prepared.images,
        });
        setResultLink(result.link);
        setStatus(`WordPress ${publishNow ? "文章已发布" : "草稿已创建"}（ID ${result.id}）。`);
      } else {
        await validateSavedMowenApiKey();
        setMowenProgress(12);
        setMowenProgressLabel("正在整理文稿…");
        const prepared = preparePublicationImages(sheet.body, libraryPath, project, sheet, true);
        await publishMowenNote(
          {
            body: buildMowenDocument(title, prepared.markdown) as unknown as Record<string, unknown>,
            tags: documentTags(sheet),
            visibility: mowenVisibility,
            images: prepared.images,
          },
          (progress) => {
            const presentation = mowenProgressPresentation(progress);
            setMowenProgress(presentation.value);
            setMowenProgressLabel(presentation.label);
          },
        );
        setMowenProgress(100);
        setMowenProgressLabel(mowenVisibility === "public" ? "发布完成" : "保存完成");
        setMowenState("success");
      }
      setSecret("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus(message);
      if (!isWordPress) setMowenState("error");
    } finally {
      setBusy(false);
    }
  }

  const missingWordPressFields = isWordPress && (!wordpressConfig.siteUrl.trim() || !wordpressConfig.username.trim());
  const missingSecret = isWordPress && !secret.trim() && !hasSavedSecret;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !busy && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={`${isWordPress ? "min-h-73.5 " : ""}max-w-[min(520px,calc(100vw-48px))] gap-0 p-5 sm:max-w-[min(520px,calc(100vw-48px))]`}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <header className={`flex items-center gap-3 ${isWordPress ? "" : "min-h-8"}`}>
          {isWordPress && (
            <span className="grid size-9.5 place-items-center rounded-xl bg-[var(--brand-wordpress-soft)] text-brand-wordpress">
              <BookOpenText size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {isWordPress && <p className="mb-0.5 text-[10px] text-muted-foreground">发布当前文稿</p>}
            <DialogTitle id="direct-publish-title" className="text-lg">
              {isWordPress ? channelLabel : "发布到墨问笔记"}
            </DialogTitle>
            <DialogDescription className="sr-only">确认当前文稿信息并发布到所选渠道。</DialogDescription>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={onClose} title="关闭">
            <X />
          </Button>
        </header>

        {isWordPress ? (
          <>
            <div className="my-4 rounded-lg border border-border bg-muted/40 p-3">
              <strong className="block truncate text-[13px]">{title}</strong>
              <small className="mt-1 block truncate text-[10px] text-muted-foreground">
                {sheet.summary || `${sheet.body.length} 个字符`}
              </small>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">站点地址</span>
                <Input
                  value={wordpressConfig.siteUrl}
                  onChange={(event) => setWordpressConfig((current) => ({ ...current, siteUrl: event.target.value }))}
                  placeholder="https://example.com/blog"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">用户名</span>
                <Input
                  value={wordpressConfig.username}
                  onChange={(event) => setWordpressConfig((current) => ({ ...current, username: event.target.value }))}
                  placeholder="WordPress 用户名"
                />
              </label>
              <SecretField
                label="应用密码"
                value={secret}
                saved={hasSavedSecret}
                placeholder="WordPress Application Password"
                onChange={setSecret}
              />
            </div>
          </>
        ) : (
          <MowenPublishView
            state={mowenState}
            title={title}
            characterCount={sheet.body.length}
            progress={mowenProgress}
            progressLabel={mowenProgressLabel}
            errorMessage={status}
            errorNeedsSettings={mowenErrorNeedsSettings(status)}
            visibility={mowenVisibility}
            onVisibilityChange={setMowenVisibility}
            onCancel={onClose}
            onPublish={publish}
            onOpenSettings={onOpenSettings}
          />
        )}

        {isWordPress && (
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
            <Checkbox checked={publishNow} onCheckedChange={(checked) => setPublishNow(checked === true)} />
            <span className="min-w-0">
              <strong className="block text-[11px]">立即公开发布</strong>
              <small className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">
                关闭时会先创建私有草稿，便于你检查后再发布。
              </small>
            </span>
          </label>
        )}

        {isWordPress && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <KeyRound size={14} />
            <span>密钥保存在落笔应用数据目录中，不会写入项目文件或浏览器存储。</span>
          </div>
        )}
        {isWordPress && !desktopAvailable && (
          <p className="mt-2.5 rounded-lg bg-[var(--status-warning-soft)] px-2.5 py-2 text-[10px] text-status-warning">
            浏览器预览模式不会发送内容；请在落笔桌面应用中发布。
          </p>
        )}
        {isWordPress && status && (
          <p className={`mt-2.5 text-[10px] ${status.includes("已") ? "text-status-success" : "text-destructive"}`}>{status}</p>
        )}
        {isWordPress && resultLink && (
          <a
            className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
            href={resultLink}
            target="_blank"
            rel="noreferrer"
          >
            打开已创建的文章 <ExternalLink size={13} />
          </a>
        )}

        {isWordPress && (
          <footer className="mt-4.5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="button" disabled={busy || missingWordPressFields || missingSecret} onClick={() => void publish()}>
              {busy ? "正在发布…" : publishNow ? "确认公开发布" : "创建草稿"}
            </Button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}

function documentTags(sheet: WritingSheet): string[] {
  return sheet.tags.filter((tag) => Boolean(tag.trim()));
}

function SecretField({
  label,
  value,
  saved,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  saved: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold text-muted-foreground">
        {label}{" "}
        {saved && (
          <small className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold text-status-success">
            <CheckCircle2 size={12} /> 已保存
          </small>
        )}
      </span>
      <Input
        type="password"
        value={value}
        autoComplete="new-password"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function loadWordPressConfig(): WordPressConfig {
  try {
    const value = JSON.parse(localStorage.getItem(WORDPRESS_CONFIG_KEY) || "null") as Partial<WordPressConfig> | null;
    return { siteUrl: value?.siteUrl || "", username: value?.username || "" };
  } catch {
    return { siteUrl: "", username: "" };
  }
}

function mowenErrorNeedsSettings(message: string): boolean {
  return /API Key|未找到墨问|\b401\b|\b403\b/i.test(message);
}

function preparePublicationImages(
  markdown: string,
  libraryPath: string,
  project: WritingProject,
  sheet: WritingSheet,
  mowenMarkers = false,
) {
  let preparedMarkdown = renderObsidianImagesAsMarkdown(markdown);
  const references = parseImageReferences(preparedMarkdown);
  const images: Array<{ source: string; alt: string; placeholder: string }> = [];
  references.forEach((reference) => {
    const external = /^https?:\/\//i.test(reference.path);
    if (external && !mowenMarkers) return;
    const source = external ? reference.path : resolveSheetImageSourcePath(libraryPath, project, sheet, reference.path);
    if (!source) throw new Error(`找不到本地图片：${reference.path}`);
    const index = images.length;
    const placeholder = mowenMarkers ? `@@MOWEN_ATTACHMENT:${index}@@` : `https://loby.invalid/publish-image-${index}`;
    preparedMarkdown = preparedMarkdown.replace(
      reference.raw,
      mowenMarkers ? `\n${placeholder}\n` : reference.raw.replace(reference.path, placeholder),
    );
    images.push({ source, alt: reference.alt || `图片 ${index + 1}`, placeholder });
  });
  return { markdown: preparedMarkdown, images };
}

function removeMatchingH1(markdown: string, title: string) {
  const lines = markdown.split("\n");
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index >= 0 && lines[index].replace(/^#\s+/, "").trim() === title) lines.splice(index, 1);
  return lines.join("\n").trim();
}
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
