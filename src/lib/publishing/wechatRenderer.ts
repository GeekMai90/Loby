import { renderMarkdownHtml } from "../export";
import { getWechatTheme, type WechatThemeId, type WechatThemeManifest, type WechatThemeTokens } from "./wechatThemes";

export interface WechatRenderInput {
  title: string;
  markdown: string;
  summary?: string;
  date?: string;
  tags?: string[];
  themeId: WechatThemeId;
  theme?: WechatThemeManifest;
}

export interface WechatRenderResult {
  title: string;
  html: string;
  textCount: number;
  readingMinutes: number;
}

export async function renderWechatArticle(input: WechatRenderInput): Promise<WechatRenderResult> {
  const theme = input.theme ?? getWechatTheme(input.themeId);
  const tokens = theme.tokens;
  const rawHtml = await renderMarkdownHtml(input.markdown);
  const documentNode = new DOMParser().parseFromString(`<main id="nibva-wechat-root">${rawHtml}</main>`, "text/html");
  const root = documentNode.querySelector<HTMLElement>("#nibva-wechat-root");
  if (!root) throw new Error("公众号排版渲染失败");

  const sourceTitle = root.querySelector("h1")?.textContent?.trim() || input.title || "未命名文稿";
  root.querySelector("h1")?.remove();
  const text = (root.textContent || "").replace(/\s+/g, " ").trim();
  const textCount = countReadableText(text);
  const readingMinutes = Math.max(1, Math.ceil(textCount / 400));
  styleArticleElements(root, theme);

  const html = [
    `<section data-nibva-publish="wechat" data-theme="${theme.id}" style="width:100%;margin:0;padding:8px 4px 12px;box-sizing:border-box;background:${tokens.pageBackground};font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:${tokens.pageText};line-height:1.75;letter-spacing:0.3px;overflow-x:hidden;">`,
    buildHero(sourceTitle, input, theme),
    theme.brand.showReadingStats ? buildReadingStats(textCount, readingMinutes, tokens) : "",
    `<section style="padding-bottom:8px;">${root.innerHTML}</section>`,
    buildFooter(theme),
    "</section>",
  ].join("");

  return { title: sourceTitle, html, textCount, readingMinutes };
}

export async function copyWechatHtml(html: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([stripHtml(html)], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(html);
}

function styleArticleElements(root: HTMLElement, theme: WechatThemeManifest) {
  const tokens = theme.tokens;
  let sectionIndex = 0;
  root
    .querySelectorAll<HTMLElement>("h2,h3,h4,p,blockquote,ul,ol,li,pre,img,hr,table,thead,th,td,a,strong,em,mark,code")
    .forEach((element) => {
      const tag = element.tagName.toLowerCase();
      if (tag === "h2") {
        sectionIndex += 1;
        const number = String(sectionIndex).padStart(2, "0");
        if (theme.components.heading === "part") {
          element.style.cssText = "margin:36px 8px 16px;padding:0;display:flex;align-items:flex-start;";
          element.innerHTML = `<span style="display:block;width:38px;flex:0 0 38px;font-size:28px;font-weight:850;line-height:1;color:${tokens.accent};">${number}</span><span style="width:1px;min-height:38px;background:${tokens.borderStrong};margin:0 12px;"></span><span style="padding-top:1px;font-size:24px;font-weight:850;color:${tokens.headingTitle};line-height:1.25;flex:1;">${element.innerHTML}</span>`;
        } else {
          element.style.cssText = "margin:38px 8px 18px;padding:0;";
          element.innerHTML = `<span style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:10px;font-weight:700;letter-spacing:2.2px;color:${tokens.headingLabel};">SECTION ${number}</span><span style="flex:1;height:1px;background:linear-gradient(to right,${tokens.borderStrong},transparent);"></span></span><span style="display:block;font-size:25px;font-weight:760;color:${tokens.headingTitle};line-height:1.28;">${element.innerHTML}</span>`;
        }
      } else if (tag === "h3") {
        element.style.cssText = `margin:25px 8px 12px;padding:0;font-size:18px;font-weight:760;color:${tokens.headingTitle};line-height:1.5;`;
        if (theme.components.heading === "editorial") element.style.borderBottom = `2px solid ${tokens.accent}`;
      } else if (tag === "h4") {
        element.style.cssText = `margin:24px 8px 10px;font-size:15px;font-weight:700;color:${tokens.headingTitle};line-height:1.4;`;
      } else if (tag === "p") {
        const inQuote = Boolean(element.closest("blockquote"));
        element.style.cssText = inQuote
          ? `margin:0;font-size:15px;color:${tokens.quoteText};line-height:1.9;text-align:left;`
          : `padding:0 8px;margin:0 0 18px;font-size:15px;color:${tokens.paragraphText};line-height:1.9;text-align:justify;`;
      } else if (tag === "blockquote") {
        element.style.cssText =
          theme.components.quote === "editorial"
            ? `margin:2px 8px 26px;padding:4px 0 4px 18px;background:transparent;border:none;border-left:2px solid ${tokens.quoteBorder};`
            : `margin:0 8px 24px;padding:14px;background:${tokens.quoteBackground};border:1px dashed ${tokens.quoteBorder};border-radius:16px;box-shadow:${tokens.shadowSoft};`;
      } else if (tag === "ul" || tag === "ol") {
        element.style.cssText = `margin:0 8px 20px;padding-left:24px;color:${tokens.listText};`;
      } else if (tag === "li") {
        element.style.cssText = `margin:0 0 10px;font-size:15px;color:${tokens.listText};line-height:1.85;`;
      } else if (tag === "pre") {
        element.style.cssText = `margin:0 8px 24px;padding:16px;overflow:auto;border:1px solid ${tokens.border};border-radius:10px;background:${tokens.surfaceAlt};color:${tokens.inlineCodeText};font-size:13px;line-height:1.8;white-space:pre-wrap;`;
      } else if (tag === "img") {
        element.style.cssText = `display:block;max-width:calc(100% - 16px);height:auto;margin:24px auto;border:1px solid ${tokens.imageBorder};border-radius:14px;padding:4px;background:${tokens.imageBackground};box-shadow:${tokens.shadowSoft};`;
      } else if (tag === "hr") {
        element.style.cssText = `margin:32px 8px;border:0;height:1px;background:linear-gradient(to right,transparent,${tokens.borderStrong},transparent);`;
      } else if (tag === "table") {
        element.style.cssText = `width:calc(100% - 16px);margin:0 8px 24px;border-collapse:collapse;background:${tokens.tableBackground};`;
      } else if (tag === "thead") {
        element.style.background = tokens.tableHeadBackground;
      } else if (tag === "th" || tag === "td") {
        element.style.cssText = `padding:10px 12px;border:1px solid ${tokens.tableBorder};text-align:left;font-size:13px;color:${tokens.paragraphText};line-height:1.7;`;
      } else if (tag === "a") {
        element.style.cssText = `color:${tokens.linkText};text-decoration:none;font-weight:600;border-bottom:1px solid ${tokens.quoteBorder};`;
      } else if (tag === "strong") {
        element.style.cssText = `color:${tokens.emphasisText};font-weight:700;`;
      } else if (tag === "em") {
        element.style.cssText = `color:${tokens.headingTitle};font-style:italic;`;
      } else if (tag === "mark") {
        element.style.cssText = `background:${tokens.markBackground};color:${tokens.markText};padding:0 4px;border-radius:4px;font-weight:600;`;
      } else if (tag === "code" && element.parentElement?.tagName.toLowerCase() !== "pre") {
        element.style.cssText = `background:${tokens.inlineCodeBackground};color:${tokens.inlineCodeText};padding:2px 6px;border-radius:4px;font-size:13px;`;
      }
    });
}

function buildHero(title: string, input: WechatRenderInput, theme: WechatThemeManifest): string {
  const tokens = theme.tokens;
  const summary = escapeHtml(input.summary?.trim() || "一篇来自 Nibva 的文章");
  const date = theme.brand.showDate ? escapeHtml(input.date || formatDate()) : "";
  const tags = theme.brand.showTags ? (input.tags?.filter(Boolean).slice(0, 4) ?? []) : [];
  const author = escapeHtml(theme.brand.author);
  if (theme.components.hero === "editorial") {
    return `<section style="margin:0 0 32px;padding:30px 26px 22px;background:linear-gradient(180deg,${tokens.surface} 0%,${tokens.surfaceAlt} 62%,${tokens.pageBackground} 100%);border-radius:${tokens.radius};"><section style="display:flex;justify-content:space-between;margin-bottom:18px;"><span style="font-size:10px;font-weight:700;letter-spacing:2.4px;color:${tokens.accent};">${author}</span>${date ? `<span style="font-size:10px;color:${tokens.mutedText};">${date}</span>` : ""}</section><p style="max-width:86%;font-size:30px;font-weight:740;color:${tokens.headingTitle};margin:0;line-height:1.34;">${renderInlineTitle(title, tokens)}</p><section style="display:flex;gap:18px;margin-top:20px;"><span style="width:42px;height:2px;background:${tokens.accent};margin-top:10px;"></span><p style="flex:1;font-size:14px;color:${tokens.mutedText};margin:0;line-height:1.95;">${summary}</p></section></section>`;
  }
  const tagHtml = tags
    .map(
      (tag) =>
        `<span style="padding:1px 6px;border-radius:3px;font-size:8px;color:#fff;background:rgba(255,255,255,0.18);">${escapeHtml(tag)}</span>`,
    )
    .join("");
  return `<section style="margin:0 0 24px;background:${tokens.surface};border:1.5px solid ${tokens.quoteBorder};border-radius:${tokens.radius};overflow:hidden;box-shadow:${tokens.shadow};"><section style="padding:24px 18px 20px;"><section style="display:flex;align-items:center;gap:8px;margin-bottom:22px;"><span style="width:6px;height:6px;background:${tokens.accent};border-radius:50%;"></span><span style="font-size:11px;font-weight:700;letter-spacing:3px;color:${tokens.accent};">${author}</span><span style="flex:1;height:1px;background:linear-gradient(to right,${tokens.quoteBorder},transparent);"></span>${date ? `<span style="font-size:10px;color:${tokens.mutedText};">${date}</span>` : ""}</section><p style="font-size:28px;font-weight:900;color:${tokens.headingTitle};margin:0;line-height:1.16;">${renderInlineTitle(title, tokens)}</p><section style="width:48px;height:3px;background:linear-gradient(to right,${tokens.accent},${tokens.accentSoft});margin:16px 0 12px;"></section><p style="font-size:13px;color:${tokens.mutedText};margin:0;line-height:1.7;">${summary}</p></section>${tagHtml ? `<section style="background:linear-gradient(135deg,${tokens.accent},${tokens.accentSoft});padding:10px 18px;display:flex;gap:5px;">${tagHtml}</section>` : ""}</section>`;
}

function buildReadingStats(textCount: number, minutes: number, theme: WechatThemeTokens): string {
  return `<section style="margin:0 10px 26px;text-align:center;"><section style="display:inline-flex;padding:10px 16px;border:1px solid ${theme.border};border-radius:999px;background:${theme.surfaceAlt};"><p style="margin:0;font-size:12px;font-weight:700;color:${theme.paragraphText};">全文约 ${textCount.toLocaleString("zh-CN")} 字 · 预计阅读 ${minutes} 分钟</p></section></section>`;
}

function buildFooter(theme: WechatThemeManifest): string {
  const tokens = theme.tokens;
  const author = escapeHtml(formatAuthorHandle(theme.brand.author));
  const footerText = escapeHtml(theme.brand.footerText);
  if (theme.components.footer === "signature") {
    return `<section style="padding:24px 10px 8px;text-align:center;"><section style="width:72px;height:1px;background:linear-gradient(to right,transparent,${tokens.borderStrong},transparent);margin:0 auto 16px;"></section><p style="margin:0 0 10px;font-size:15px;font-weight:600;color:${tokens.headingTitle};">${footerText}</p><p style="margin:0 0 6px;font-size:11px;letter-spacing:1.8px;color:${tokens.mutedText};font-weight:700;">${author}</p><p style="margin:0;font-size:10px;letter-spacing:2.6px;color:${tokens.mutedText};font-weight:700;">A LIFE OF GROWTH</p></section>`;
  }
  return `<section style="padding:18px 4px 6px;"><section style="border:1px solid ${tokens.border};border-radius:24px;background:${tokens.surfaceAlt};box-shadow:${tokens.shadow};padding:24px 18px 20px;text-align:center;"><p style="margin:0 0 6px;font-size:10px;letter-spacing:1.8px;color:${tokens.mutedText};font-weight:700;">${author}</p><p style="margin:0 0 16px;font-size:18px;font-weight:900;color:${tokens.headingTitle};">${footerText}</p><p style="margin:0;font-size:20px;letter-spacing:16px;color:${tokens.accent};">♡ ↗ ✦</p></section></section>`;
}

function renderInlineTitle(value: string, theme: WechatThemeTokens): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${theme.accent};font-weight:900;">$1</strong>`);
}

function countReadableText(value: string): number {
  return (value.match(/[\u3400-\u9fff]/g) || []).length + (value.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
}

function stripHtml(value: string): string {
  return new DOMParser().parseFromString(value, "text/html").body.textContent || "";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatAuthorHandle(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function formatDate(): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", "-");
}
