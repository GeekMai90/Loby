import { renderMarkdownHtml } from "../export";
import { getWechatTheme, type WechatThemeId, type WechatThemeTokens } from "./wechatThemes";

export interface WechatRenderInput {
  title: string;
  markdown: string;
  summary?: string;
  date?: string;
  tags?: string[];
  themeId: WechatThemeId;
}

export interface WechatRenderResult {
  title: string;
  html: string;
  textCount: number;
  readingMinutes: number;
}

export async function renderWechatArticle(input: WechatRenderInput): Promise<WechatRenderResult> {
  const theme = getWechatTheme(input.themeId).tokens;
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
    `<section data-nibva-publish="wechat" data-theme="${input.themeId}" style="width:100%;margin:0;padding:8px 4px 12px;box-sizing:border-box;background:${theme.pageBackground};font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:${theme.pageText};line-height:1.75;letter-spacing:0.3px;overflow-x:hidden;">`,
    buildHero(sourceTitle, input, theme),
    theme.heroStyle === "editorial" ? buildReadingStats(textCount, readingMinutes, theme) : "",
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

function styleArticleElements(root: HTMLElement, theme: WechatThemeTokens) {
  let sectionIndex = 0;
  root
    .querySelectorAll<HTMLElement>("h2,h3,h4,p,blockquote,ul,ol,li,pre,img,hr,table,thead,th,td,a,strong,em,mark,code")
    .forEach((element) => {
      const tag = element.tagName.toLowerCase();
      if (tag === "h2") {
        sectionIndex += 1;
        const number = String(sectionIndex).padStart(2, "0");
        if (theme.headingStyle === "part") {
          element.style.cssText = "margin:36px 8px 16px;padding:0;display:flex;align-items:flex-start;";
          element.innerHTML = `<span style="display:block;width:38px;flex:0 0 38px;font-size:28px;font-weight:850;line-height:1;color:${theme.accent};">${number}</span><span style="width:1px;min-height:38px;background:${theme.borderStrong};margin:0 12px;"></span><span style="padding-top:1px;font-size:24px;font-weight:850;color:${theme.headingTitle};line-height:1.25;flex:1;">${element.innerHTML}</span>`;
        } else {
          element.style.cssText = "margin:38px 8px 18px;padding:0;";
          element.innerHTML = `<span style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:10px;font-weight:700;letter-spacing:2.2px;color:${theme.headingLabel};">SECTION ${number}</span><span style="flex:1;height:1px;background:linear-gradient(to right,${theme.borderStrong},transparent);"></span></span><span style="display:block;font-size:25px;font-weight:760;color:${theme.headingTitle};line-height:1.28;">${element.innerHTML}</span>`;
        }
      } else if (tag === "h3") {
        element.style.cssText = `margin:25px 8px 12px;padding:0;font-size:18px;font-weight:760;color:${theme.headingTitle};line-height:1.5;`;
        if (theme.headingStyle === "editorial") element.style.borderBottom = `2px solid ${theme.accent}`;
      } else if (tag === "h4") {
        element.style.cssText = `margin:24px 8px 10px;font-size:15px;font-weight:700;color:${theme.headingTitle};line-height:1.4;`;
      } else if (tag === "p") {
        const inQuote = Boolean(element.closest("blockquote"));
        element.style.cssText = inQuote
          ? `margin:0;font-size:15px;color:${theme.quoteText};line-height:1.9;text-align:left;`
          : `padding:0 8px;margin:0 0 18px;font-size:15px;color:${theme.paragraphText};line-height:1.9;text-align:justify;`;
      } else if (tag === "blockquote") {
        element.style.cssText =
          theme.quoteStyle === "editorial"
            ? `margin:2px 8px 26px;padding:4px 0 4px 18px;background:transparent;border:none;border-left:2px solid ${theme.quoteBorder};`
            : `margin:0 8px 24px;padding:14px;background:${theme.quoteBackground};border:1px dashed ${theme.quoteBorder};border-radius:16px;box-shadow:${theme.shadowSoft};`;
      } else if (tag === "ul" || tag === "ol") {
        element.style.cssText = `margin:0 8px 20px;padding-left:24px;color:${theme.listText};`;
      } else if (tag === "li") {
        element.style.cssText = `margin:0 0 10px;font-size:15px;color:${theme.listText};line-height:1.85;`;
      } else if (tag === "pre") {
        element.style.cssText = `margin:0 8px 24px;padding:16px;overflow:auto;border:1px solid ${theme.border};border-radius:10px;background:${theme.surfaceAlt};color:${theme.inlineCodeText};font-size:13px;line-height:1.8;white-space:pre-wrap;`;
      } else if (tag === "img") {
        element.style.cssText = `display:block;max-width:calc(100% - 16px);height:auto;margin:24px auto;border:1px solid ${theme.imageBorder};border-radius:14px;padding:4px;background:${theme.imageBackground};box-shadow:${theme.shadowSoft};`;
      } else if (tag === "hr") {
        element.style.cssText = `margin:32px 8px;border:0;height:1px;background:linear-gradient(to right,transparent,${theme.borderStrong},transparent);`;
      } else if (tag === "table") {
        element.style.cssText = `width:calc(100% - 16px);margin:0 8px 24px;border-collapse:collapse;background:${theme.tableBackground};`;
      } else if (tag === "thead") {
        element.style.background = theme.tableHeadBackground;
      } else if (tag === "th" || tag === "td") {
        element.style.cssText = `padding:10px 12px;border:1px solid ${theme.tableBorder};text-align:left;font-size:13px;color:${theme.paragraphText};line-height:1.7;`;
      } else if (tag === "a") {
        element.style.cssText = `color:${theme.linkText};text-decoration:none;font-weight:600;border-bottom:1px solid ${theme.quoteBorder};`;
      } else if (tag === "strong") {
        element.style.cssText = `color:${theme.emphasisText};font-weight:700;`;
      } else if (tag === "em") {
        element.style.cssText = `color:${theme.headingTitle};font-style:italic;`;
      } else if (tag === "mark") {
        element.style.cssText = `background:${theme.markBackground};color:${theme.markText};padding:0 4px;border-radius:4px;font-weight:600;`;
      } else if (tag === "code" && element.parentElement?.tagName.toLowerCase() !== "pre") {
        element.style.cssText = `background:${theme.inlineCodeBackground};color:${theme.inlineCodeText};padding:2px 6px;border-radius:4px;font-size:13px;`;
      }
    });
}

function buildHero(title: string, input: WechatRenderInput, theme: WechatThemeTokens): string {
  const summary = escapeHtml(input.summary?.trim() || "一篇来自 Nibva 的文章");
  const date = escapeHtml(input.date || formatDate());
  const tags = input.tags?.filter(Boolean).slice(0, 4) ?? [];
  if (theme.heroStyle === "editorial") {
    return `<section style="margin:0 0 32px;padding:30px 26px 22px;background:linear-gradient(180deg,${theme.surface} 0%,${theme.surfaceAlt} 62%,${theme.pageBackground} 100%);border-radius:${theme.radius};"><section style="display:flex;justify-content:space-between;margin-bottom:18px;"><span style="font-size:10px;font-weight:700;letter-spacing:2.4px;color:${theme.accent};">麦先生说</span><span style="font-size:10px;color:${theme.mutedText};">${date}</span></section><p style="max-width:86%;font-size:30px;font-weight:740;color:${theme.headingTitle};margin:0;line-height:1.34;">${renderInlineTitle(title, theme)}</p><section style="display:flex;gap:18px;margin-top:20px;"><span style="width:42px;height:2px;background:${theme.accent};margin-top:10px;"></span><p style="flex:1;font-size:14px;color:${theme.mutedText};margin:0;line-height:1.95;">${summary}</p></section></section>`;
  }
  const tagHtml = tags
    .map(
      (tag) =>
        `<span style="padding:1px 6px;border-radius:3px;font-size:8px;color:#fff;background:rgba(255,255,255,0.18);">${escapeHtml(tag)}</span>`,
    )
    .join("");
  return `<section style="margin:0 0 24px;background:${theme.surface};border:1.5px solid ${theme.quoteBorder};border-radius:${theme.radius};overflow:hidden;box-shadow:${theme.shadow};"><section style="padding:24px 18px 20px;"><section style="display:flex;align-items:center;gap:8px;margin-bottom:22px;"><span style="width:6px;height:6px;background:${theme.accent};border-radius:50%;"></span><span style="font-size:11px;font-weight:700;letter-spacing:3px;color:${theme.accent};">麦先生说</span><span style="flex:1;height:1px;background:linear-gradient(to right,${theme.quoteBorder},transparent);"></span><span style="font-size:10px;color:${theme.mutedText};">${date}</span></section><p style="font-size:28px;font-weight:900;color:${theme.headingTitle};margin:0;line-height:1.16;">${renderInlineTitle(title, theme)}</p><section style="width:48px;height:3px;background:linear-gradient(to right,${theme.accent},${theme.accentSoft});margin:16px 0 12px;"></section><p style="font-size:13px;color:${theme.mutedText};margin:0;line-height:1.7;">${summary}</p></section>${tagHtml ? `<section style="background:linear-gradient(135deg,${theme.accent},${theme.accentSoft});padding:10px 18px;display:flex;gap:5px;">${tagHtml}</section>` : ""}</section>`;
}

function buildReadingStats(textCount: number, minutes: number, theme: WechatThemeTokens): string {
  return `<section style="margin:0 10px 26px;text-align:center;"><section style="display:inline-flex;padding:10px 16px;border:1px solid ${theme.border};border-radius:999px;background:${theme.surfaceAlt};"><p style="margin:0;font-size:12px;font-weight:700;color:${theme.paragraphText};">全文约 ${textCount.toLocaleString("zh-CN")} 字 · 预计阅读 ${minutes} 分钟</p></section></section>`;
}

function buildFooter(theme: WechatThemeTokens): string {
  if (theme.footerStyle === "signature") {
    return `<section style="padding:24px 10px 8px;text-align:center;"><section style="width:72px;height:1px;background:linear-gradient(to right,transparent,${theme.borderStrong},transparent);margin:0 auto 16px;"></section><p style="margin:0 0 10px;font-size:15px;font-weight:600;color:${theme.headingTitle};">写到这里，刚好停下。</p><p style="margin:0 0 6px;font-size:11px;letter-spacing:1.8px;color:${theme.mutedText};font-weight:700;">@麦先生说</p><p style="margin:0;font-size:10px;letter-spacing:2.6px;color:${theme.mutedText};font-weight:700;">A LIFE OF GROWTH</p></section>`;
  }
  return `<section style="padding:18px 4px 6px;"><section style="border:1px solid ${theme.border};border-radius:24px;background:${theme.surfaceAlt};box-shadow:${theme.shadow};padding:24px 18px 20px;text-align:center;"><p style="margin:0 0 6px;font-size:10px;letter-spacing:1.8px;color:${theme.mutedText};font-weight:700;">@麦先生说</p><p style="margin:0 0 16px;font-size:18px;font-weight:900;color:${theme.headingTitle};">如果对你有用，欢迎点赞、分享、推荐</p><p style="margin:0;font-size:20px;letter-spacing:16px;color:${theme.accent};">♡ ↗ ✦</p></section></section>`;
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

function formatDate(): string {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("/", "-");
}
