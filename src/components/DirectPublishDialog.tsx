import { BookOpenText, CheckCircle2, ExternalLink, KeyRound, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { renderMarkdownHtml } from "../lib/export";
import { parseImageReferences, renderObsidianImagesAsMarkdown, resolveSheetImageSourcePath } from "../lib/imageAssets";
import {
  hasPublishingSecret,
  isDesktopPublishingAvailable,
  publishMowenNote,
  publishWordPressPost,
  savePublishingSecret,
} from "../lib/publishing/api";
import { buildMowenDocument } from "../lib/publishing/mowenPayload";
import type { WritingProject, WritingSheet } from "../types";

type DirectPublishChannel = "wordpress" | "mowen";

interface DirectPublishDialogProps {
  open: boolean;
  channel: DirectPublishChannel;
  project: WritingProject;
  sheet: WritingSheet;
  libraryPath: string;
  onClose: () => void;
}

interface WordPressConfig {
  siteUrl: string;
  username: string;
}

const WORDPRESS_CONFIG_KEY = "nibva.publish.wordpress.config";

export function DirectPublishDialog({ open, channel, project, sheet, libraryPath, onClose }: DirectPublishDialogProps) {
  const [wordpressConfig, setWordpressConfig] = useState<WordPressConfig>(() => loadWordPressConfig());
  const [secret, setSecret] = useState("");
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [publishNow, setPublishNow] = useState(false);
  const [tagsText, setTagsText] = useState(project.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [resultLink, setResultLink] = useState("");
  const desktopAvailable = isDesktopPublishingAvailable();
  const account = channel === "wordpress" ? wordpressConfig.username.trim() : "default";
  const title = sheet.title.trim() || project.title;
  const tags = useMemo(
    () =>
      tagsText
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsText],
  );

  useEffect(() => {
    if (!open || !account) {
      setHasSavedSecret(false);
      return;
    }
    let cancelled = false;
    hasPublishingSecret(channel, account).then((value) => {
      if (!cancelled) setHasSavedSecret(value);
    });
    return () => {
      cancelled = true;
    };
  }, [account, channel, open]);

  useEffect(() => {
    if (!open) return;
    setStatus("");
    setResultLink("");
    setSecret("");
    setTagsText(project.tags.join(", "));
  }, [channel, open, project.tags]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;
  const isWordPress = channel === "wordpress";
  const Icon = isWordPress ? BookOpenText : Send;
  const channelLabel = isWordPress ? "WordPress 博客" : "墨问笔记";

  async function publish() {
    if (!desktopAvailable) {
      setStatus("请在 Nibva 桌面应用中完成直接发布。");
      return;
    }
    setBusy(true);
    setStatus("");
    setResultLink("");
    try {
      if (secret.trim()) {
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
          excerpt: sheet.summary || project.description,
          status: publishNow ? "publish" : "draft",
          images: prepared.images,
        });
        setResultLink(result.link);
        setStatus(`WordPress ${publishNow ? "文章已发布" : "草稿已创建"}（ID ${result.id}）。`);
      } else {
        const prepared = preparePublicationImages(sheet.body, libraryPath, project, sheet, true);
        const result = await publishMowenNote({
          body: buildMowenDocument(title, prepared.markdown) as unknown as Record<string, unknown>,
          tags,
          autoPublish: publishNow,
          images: prepared.images,
        });
        const noteId = readResultString(result, ["noteId", "id", "data.noteId", "data.id"]);
        setStatus(`墨问${publishNow ? "笔记已发布" : "草稿已创建"}${noteId ? `（noteId ${noteId}）` : ""}。`);
      }
      setSecret("");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const missingWordPressFields = isWordPress && (!wordpressConfig.siteUrl.trim() || !wordpressConfig.username.trim());
  const missingSecret = !secret.trim() && !hasSavedSecret;

  return (
    <div className="modal-backdrop direct-publish-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="direct-publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="direct-publish-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <span className={`direct-publish-icon ${channel}`}>
            <Icon size={18} />
          </span>
          <div>
            <p>发布当前文稿</p>
            <h2 id="direct-publish-title">{channelLabel}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="关闭">
            <X size={17} />
          </button>
        </header>

        <div className="direct-publish-document">
          <strong>{title}</strong>
          <small>{sheet.summary || `${sheet.body.length} 个字符`}</small>
        </div>

        {isWordPress ? (
          <div className="direct-publish-fields">
            <label>
              <span>站点地址</span>
              <input
                value={wordpressConfig.siteUrl}
                onChange={(event) => setWordpressConfig((current) => ({ ...current, siteUrl: event.target.value }))}
                placeholder="https://example.com/blog"
              />
            </label>
            <label>
              <span>用户名</span>
              <input
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
        ) : (
          <div className="direct-publish-fields">
            <SecretField
              label="墨问 API Key"
              value={secret}
              saved={hasSavedSecret}
              placeholder="留空可使用已保存的 Key"
              onChange={setSecret}
            />
            <label>
              <span>标签</span>
              <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="多个标签用逗号分隔" />
            </label>
          </div>
        )}

        <label className="direct-publish-visibility">
          <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
          <span>
            <strong>立即公开发布</strong>
            <small>关闭时会先创建私有草稿，便于你检查后再发布。</small>
          </span>
        </label>

        <div className="direct-publish-security">
          <KeyRound size={14} />
          <span>密钥只保存在 macOS Keychain，不会写入项目文件或浏览器存储。</span>
        </div>
        {!desktopAvailable && <p className="direct-publish-browser-note">浏览器预览模式不会发送内容；请在 Nibva 桌面应用中发布。</p>}
        {status && <p className={status.includes("已") ? "direct-publish-status success" : "direct-publish-status"}>{status}</p>}
        {resultLink && (
          <a href={resultLink} target="_blank" rel="noreferrer">
            打开已创建的文章 <ExternalLink size={13} />
          </a>
        )}

        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="primary-button" disabled={busy || missingWordPressFields || missingSecret} onClick={publish}>
            {busy ? "正在发布…" : publishNow ? "确认公开发布" : "创建草稿"}
          </button>
        </footer>
      </section>
    </div>
  );
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
    <label>
      <span>
        {label}{" "}
        {saved && (
          <small className="secret-saved">
            <CheckCircle2 size={12} /> 已保存在钥匙串
          </small>
        )}
      </span>
      <input
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

function readResultString(value: Record<string, unknown>, paths: string[]): string {
  for (const path of paths) {
    let current: unknown = value;
    for (const segment of path.split(".")) {
      if (!current || typeof current !== "object") break;
      current = (current as Record<string, unknown>)[segment];
    }
    if (typeof current === "string" || typeof current === "number") return String(current);
  }
  return "";
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
    const placeholder = mowenMarkers ? `@@MOWEN_ATTACHMENT:${index}@@` : `https://nibva.invalid/publish-image-${index}`;
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
