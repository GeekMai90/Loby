import { renderMarkdownHtml } from "../export";
import { getWechatTheme, type WechatThemeBaseStyle, type WechatThemeId, type WechatThemeManifest } from "./wechatThemes";

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
  compatibilityWarnings: string[];
}

interface TemplateContext {
  title: string;
  summary: string;
  date: string;
  author: string;
  tagsHtml: string;
  textCount: string;
  readingMinutes: string;
}

interface ProtectedWechatContent {
  text: Map<string, string>;
  links: Map<string, string>;
  images: Map<string, { src: string; alt: string }>;
  order: string[];
}

const REMOVED_ELEMENTS = "script,style,iframe,object,embed,link,meta,base,input";
const UNWRAPPED_ELEMENTS = "form,button,textarea,select";

export async function renderWechatArticle(input: WechatRenderInput): Promise<WechatRenderResult> {
  const theme = input.theme ?? getWechatTheme(input.themeId);
  const rawHtml = await renderMarkdownHtml(input.markdown);
  const sourceDocument = new DOMParser().parseFromString(`<main id="nibva-wechat-source">${rawHtml}</main>`, "text/html");
  const sourceRoot = sourceDocument.querySelector<HTMLElement>("#nibva-wechat-source");
  if (!sourceRoot) throw new Error("公众号排版渲染失败");

  const sourceTitle = sourceRoot.querySelector("h1")?.textContent?.trim() || input.title || "未命名文稿";
  sourceRoot.querySelector("h1")?.remove();
  const text = (sourceRoot.textContent || "").replace(/\s+/g, " ").trim();
  const textCount = countReadableText(text);
  const readingMinutes = Math.max(1, Math.ceil(textCount / 400));
  const summary = input.summary?.trim() || "一篇来自 Nibva 的文章";
  const date = input.date || formatDate();
  const tags = input.tags?.filter(Boolean).slice(0, 4) ?? [];

  const documentNode = new DOMParser().parseFromString(
    `<section data-nibva-publish="wechat" data-theme="${escapeHtml(theme.id)}"><header data-nibva-role="article-header"><p data-nibva-role="article-title">${renderInlineTitle(sourceTitle)}</p><p data-nibva-role="article-summary">${escapeHtml(summary)}</p></header><section data-nibva-role="article-body">${sourceRoot.innerHTML}</section></section>`,
    "text/html",
  );
  const root = documentNode.querySelector<HTMLElement>('[data-nibva-publish="wechat"]');
  if (!root) throw new Error("公众号主题容器创建失败");

  const context: TemplateContext = {
    title: escapeHtml(sourceTitle),
    summary: escapeHtml(summary),
    date: escapeHtml(date),
    author: "麦先生说",
    tagsHtml: tags.map((tag) => `<span class="nibva-theme-tag">${escapeHtml(tag)}</span>`).join(""),
    textCount: textCount.toLocaleString("zh-CN"),
    readingMinutes: String(readingMinutes),
  };
  const compatibilityWarnings: string[] = [];
  applyHtmlTransforms(root, theme, context, compatibilityWarnings);
  sanitizeWechatHtml(root, compatibilityWarnings);
  inlineWechatThemeCss(documentNode, root, theme, compatibilityWarnings);
  sanitizeWechatHtml(root, compatibilityWarnings);

  return {
    title: sourceTitle,
    html: root.outerHTML,
    textCount,
    readingMinutes,
    compatibilityWarnings: [...new Set(compatibilityWarnings)],
  };
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

function applyHtmlTransforms(root: HTMLElement, theme: WechatThemeManifest, context: TemplateContext, warnings: string[]) {
  const protectedContent = protectWechatArticleContent(root);
  for (const transform of theme.custom?.htmlTransforms ?? []) {
    const candidate = root.cloneNode(true) as HTMLElement;
    let targets: Element[];
    try {
      targets = [...(candidate.matches(transform.selector) ? [candidate] : []), ...candidate.querySelectorAll(transform.selector)];
    } catch {
      warnings.push(`无法应用选择器：${transform.selector}`);
      continue;
    }
    targets.forEach((target, index) => {
      const html = renderTransformHtml(transform.html, context, target, index);
      if (!html && transform.html.includes("{{tagsHtml}}")) return;
      if (transform.operation === "prepend") target.insertAdjacentHTML("afterbegin", html);
      else if (transform.operation === "append") target.insertAdjacentHTML("beforeend", html);
      else if (transform.operation === "replace-inner") target.innerHTML = html;
      else if (target === candidate) replaceRootPresentation(candidate, html);
      else target.outerHTML = html;
    });
    sanitizeWechatHtml(candidate, warnings);
    const contentIssue = getWechatArticleContentIssue(candidate, protectedContent);
    if (contentIssue) {
      warnings.push(`已忽略会删除、复制、重排或改写文章内容的 HTML 变换：${transform.selector}（${contentIssue}）`);
      continue;
    }
    copyElementPresentation(root, candidate);
  }
  removeWechatContentProtection(root);
}

function renderTransformHtml(template: string, context: TemplateContext, target: Element, index: number): string {
  if (template.includes("{{tagsHtml}}") && !context.tagsHtml) return "";
  const replacements: Record<string, string> = {
    title: context.title,
    summary: context.summary,
    date: context.date,
    author: escapeHtml(context.author),
    tagsHtml: context.tagsHtml,
    textCount: context.textCount,
    readingMinutes: context.readingMinutes,
    content: target.innerHTML,
    text: escapeHtml(target.textContent || ""),
    index: String(index + 1),
    index2: String(index + 1).padStart(2, "0"),
  };
  return template.replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (match, key: string) => replacements[key] ?? match);
}

function replaceRootPresentation(root: HTMLElement, html: string) {
  const template = root.ownerDocument.createElement("template");
  template.innerHTML = html.trim();
  const replacement = template.content.firstElementChild;
  const meaningfulNodes = Array.from(template.content.childNodes).filter(
    (node) => node.nodeType !== Node.TEXT_NODE || Boolean(node.textContent?.trim()),
  );
  if (!(replacement instanceof HTMLElement) || meaningfulNodes.length !== 1) {
    root.innerHTML = html;
    return;
  }
  const themeId = root.getAttribute("data-theme") ?? "";
  for (const attribute of Array.from(root.attributes)) root.removeAttribute(attribute.name);
  for (const attribute of Array.from(replacement.attributes)) root.setAttribute(attribute.name, attribute.value);
  root.setAttribute("data-nibva-publish", "wechat");
  root.setAttribute("data-theme", themeId);
  root.innerHTML = replacement.innerHTML;
}

function protectWechatArticleContent(root: HTMLElement): ProtectedWechatContent {
  const text = new Map<string, string>();
  const links = new Map<string, string>();
  const images = new Map<string, { src: string; alt: string }>();
  const protectedRoots = root.querySelectorAll<HTMLElement>(
    '[data-nibva-role="article-title"], [data-nibva-role="article-summary"], [data-nibva-role="article-body"]',
  );
  let textIndex = 0;
  let linkIndex = 0;
  let imageIndex = 0;

  for (const protectedRoot of protectedRoots) {
    const walker = protectedRoot.ownerDocument.createTreeWalker(protectedRoot, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.data.trim()) textNodes.push(node);
    }
    for (const node of textNodes) {
      const id = `text-${textIndex++}`;
      const wrapper = protectedRoot.ownerDocument.createElement("span");
      wrapper.dataset.nibvaContentToken = id;
      wrapper.textContent = node.data;
      text.set(id, node.data);
      node.replaceWith(wrapper);
    }
  }

  for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-nibva-role="article-body"] a')) {
    const id = `link-${linkIndex++}`;
    link.dataset.nibvaProtectedLink = id;
    links.set(id, link.getAttribute("href") ?? "");
  }
  for (const image of root.querySelectorAll<HTMLImageElement>('[data-nibva-role="article-body"] img')) {
    const id = `image-${imageIndex++}`;
    image.dataset.nibvaProtectedImage = id;
    images.set(id, { src: image.getAttribute("src") ?? "", alt: image.getAttribute("alt") ?? "" });
  }

  return { text, links, images, order: protectedContentOrder(root) };
}

function getWechatArticleContentIssue(root: HTMLElement, protectedContent: ProtectedWechatContent): string | null {
  const nextOrder = protectedContentOrder(root);
  if (!sameStringArray(protectedContent.order, nextOrder)) return "内容顺序发生变化";
  for (const [id, value] of protectedContent.text) {
    const matches = root.querySelectorAll<HTMLElement>(`[data-nibva-content-token="${id}"]`);
    if (matches.length !== 1) return `文本片段 ${id} 数量发生变化`;
    if (matches[0].textContent !== value) return `文本片段 ${id} 被改写`;
  }
  for (const [id, href] of protectedContent.links) {
    const matches = root.querySelectorAll<HTMLAnchorElement>(`a[data-nibva-protected-link="${id}"]`);
    if (matches.length !== 1 || (matches[0].getAttribute("href") ?? "") !== href) return `链接 ${id} 被修改`;
  }
  for (const [id, expected] of protectedContent.images) {
    const matches = root.querySelectorAll<HTMLImageElement>(`img[data-nibva-protected-image="${id}"]`);
    if (
      matches.length !== 1 ||
      (matches[0].getAttribute("src") ?? "") !== expected.src ||
      (matches[0].getAttribute("alt") ?? "") !== expected.alt
    ) {
      return `图片 ${id} 被修改`;
    }
  }
  return null;
}

function protectedContentOrder(root: HTMLElement): string[] {
  const order: string[] = [];
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.dataset.nibvaContentToken) order.push(`text:${element.dataset.nibvaContentToken}`);
    if (element.dataset.nibvaProtectedLink) order.push(`link:${element.dataset.nibvaProtectedLink}`);
    if (element.dataset.nibvaProtectedImage) order.push(`image:${element.dataset.nibvaProtectedImage}`);
  }
  return order;
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function copyElementPresentation(target: HTMLElement, source: HTMLElement) {
  for (const attribute of Array.from(target.attributes)) target.removeAttribute(attribute.name);
  for (const attribute of Array.from(source.attributes)) target.setAttribute(attribute.name, attribute.value);
  target.innerHTML = source.innerHTML;
}

function removeWechatContentProtection(root: HTMLElement) {
  for (const wrapper of root.querySelectorAll<HTMLElement>("[data-nibva-content-token]")) {
    wrapper.replaceWith(root.ownerDocument.createTextNode(wrapper.textContent ?? ""));
  }
  for (const link of root.querySelectorAll<HTMLElement>("[data-nibva-protected-link]")) {
    link.removeAttribute("data-nibva-protected-link");
  }
  for (const image of root.querySelectorAll<HTMLElement>("[data-nibva-protected-image]")) {
    image.removeAttribute("data-nibva-protected-image");
  }
}

function inlineWechatThemeCss(documentNode: Document, root: HTMLElement, theme: WechatThemeManifest, warnings: string[]) {
  const variables = themeCssVariables(theme.baseStyle);
  const css = resolveThemeVariables(`${buildBaseThemeCss(theme.baseStyle)}\n${theme.custom?.css ?? ""}`, variables);
  const styleElement = documentNode.createElement("style");
  styleElement.textContent = css;
  documentNode.head.append(styleElement);
  const rules = styleElement.sheet?.cssRules;
  if (!rules) {
    warnings.push("当前环境无法解析主题 CSS。");
    styleElement.remove();
    return;
  }
  inlineCssRules(root, rules, warnings);
  styleElement.remove();
}

function inlineCssRules(root: HTMLElement, rules: CSSRuleList, warnings: string[]) {
  const declarations = new Map<StyleableElement, CssDeclaration[]>();
  const pseudoDeclarations = new Map<StyleableElement, Record<PseudoPosition, CssDeclaration[]>>();
  let sourceOrder = 0;

  for (const element of styleableElements(root)) {
    const inline = cssDeclarations(element.style, [1, 0, 0, 0], sourceOrder);
    sourceOrder += inline.length;
    if (inline.length > 0) declarations.set(element, inline);
  }

  for (const rule of Array.from(rules)) {
    if ("selectorText" in rule && "style" in rule) {
      const styleRule = rule as CSSStyleRule;
      for (const selector of splitSelectors(styleRule.selectorText)) {
        const pseudoMatch = selector.match(/::(before|after)\s*$/);
        const unsupportedPseudo = !pseudoMatch && selector.includes("::");
        if (unsupportedPseudo) {
          warnings.push(`公众号输出无法编译伪元素选择器：${selector}`);
          continue;
        }
        const matchSelector = pseudoMatch ? selector.slice(0, pseudoMatch.index).trim() : selector;
        let targets: Element[];
        try {
          targets = [...(root.matches(matchSelector) ? [root] : []), ...root.querySelectorAll(matchSelector)];
        } catch {
          warnings.push(`无法编译 CSS 选择器：${selector}`);
          continue;
        }
        const specificity = cssSpecificity(selector);
        const nextDeclarations = cssDeclarations(styleRule.style, specificity, sourceOrder);
        sourceOrder += nextDeclarations.length;
        for (const target of targets) {
          if (!isStyleableElement(target)) continue;
          if (pseudoMatch) {
            const position = pseudoMatch[1] as PseudoPosition;
            const targetDeclarations = pseudoDeclarations.get(target) ?? { before: [], after: [] };
            targetDeclarations[position].push(...nextDeclarations);
            pseudoDeclarations.set(target, targetDeclarations);
          } else {
            const targetDeclarations = declarations.get(target) ?? [];
            targetDeclarations.push(...nextDeclarations);
            declarations.set(target, targetDeclarations);
          }
        }
      }
    } else {
      warnings.push(`公众号输出忽略了样式规则：${rule.cssText.slice(0, 80)}`);
    }
  }

  applyCollectedCssDeclarations(root, declarations, pseudoDeclarations, warnings);
}

type StyleableElement = HTMLElement | SVGElement;
type CssSpecificity = [number, number, number, number];
type PseudoPosition = "before" | "after";

interface CssDeclaration {
  property: string;
  value: string;
  priority: string;
  specificity: CssSpecificity;
  sourceOrder: number;
}

function styleableElements(root: HTMLElement): StyleableElement[] {
  return [root, ...Array.from(root.querySelectorAll("*")).filter(isStyleableElement)];
}

function isStyleableElement(element: Element): element is StyleableElement {
  return element instanceof HTMLElement || (typeof SVGElement !== "undefined" && element instanceof SVGElement);
}

function cssDeclarations(styles: CSSStyleDeclaration, specificity: CssSpecificity, sourceOrder: number): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (let index = 0; index < styles.length; index += 1) {
    const property = styles.item(index);
    declarations.push({
      property,
      value: styles.getPropertyValue(property),
      priority: styles.getPropertyPriority(property),
      specificity,
      sourceOrder: sourceOrder + index,
    });
  }
  return declarations;
}

function applyCssDeclarations(
  target: CSSStyleDeclaration,
  declarations: CssDeclaration[],
  inheritedVariables: Map<string, string>,
  unresolved: Set<string>,
): Map<string, string> {
  if (declarations.length === 0) return new Map(inheritedVariables);
  const sorted = [...declarations].sort(compareCssDeclarations);
  const variables = new Map(inheritedVariables);
  for (const declaration of sorted) {
    if (declaration.property.startsWith("--")) variables.set(declaration.property, declaration.value);
  }
  target.cssText = "";
  for (const declaration of sorted) {
    if (declaration.property.startsWith("--")) continue;
    const value = resolveCssVariableFunctions(declaration.value, variables, new Set(), unresolved);
    target.setProperty(declaration.property, value, declaration.priority);
  }
  return variables;
}

function compareCssDeclarations(left: CssDeclaration, right: CssDeclaration): number {
  const importantDifference = Number(left.priority === "important") - Number(right.priority === "important");
  if (importantDifference !== 0) return importantDifference;
  for (let index = 0; index < left.specificity.length; index += 1) {
    const difference = left.specificity[index] - right.specificity[index];
    if (difference !== 0) return difference;
  }
  return left.sourceOrder - right.sourceOrder;
}

function applyCollectedCssDeclarations(
  root: HTMLElement,
  declarations: Map<StyleableElement, CssDeclaration[]>,
  pseudoDeclarations: Map<StyleableElement, Record<PseudoPosition, CssDeclaration[]>>,
  warnings: string[],
) {
  const unresolved = new Set<string>();

  function visit(element: StyleableElement, inheritedVariables: Map<string, string>) {
    const children = Array.from(element.children).filter(isStyleableElement);
    const variables = applyCssDeclarations(element.style, declarations.get(element) ?? [], inheritedVariables, unresolved);
    if (element.style.length === 0) element.removeAttribute("style");
    const pseudo = pseudoDeclarations.get(element);
    if (pseudo) {
      materializePseudoDeclarations(element, "before", pseudo.before, variables, unresolved, warnings);
      materializePseudoDeclarations(element, "after", pseudo.after, variables, unresolved, warnings);
    }
    for (const child of children) visit(child, variables);
  }

  visit(root, new Map());
  for (const name of unresolved) warnings.push(`公众号输出无法解析 CSS 变量：${name}`);
}

function materializePseudoDeclarations(
  target: StyleableElement,
  position: PseudoPosition,
  declarations: CssDeclaration[],
  inheritedVariables: Map<string, string>,
  unresolved: Set<string>,
  warnings: string[],
) {
  if (declarations.length === 0) return;
  const decoration = target.ownerDocument.createElement("span");
  decoration.setAttribute("aria-hidden", "true");
  applyCssDeclarations(decoration.style, declarations, inheritedVariables, unresolved);
  const content = parseCssContent(decoration.style.getPropertyValue("content"));
  if (content === null) {
    warnings.push("公众号输出无法保留没有纯文本内容的伪元素。");
    return;
  }
  decoration.textContent = content;
  decoration.style.removeProperty("content");
  if (position === "before") target.prepend(decoration);
  else target.append(decoration);
}

function cssSpecificity(selector: string): CssSpecificity {
  const withoutStrings = selector.replace(/(['"])(?:\\.|(?!\1).)*\1/g, "");
  const withoutWhere = withoutStrings.replace(/:where\([^)]*\)/g, "");
  const ids = withoutWhere.match(/#[\w-]+/g)?.length ?? 0;
  const classes = withoutWhere.match(/\.[\w-]+/g)?.length ?? 0;
  const attributes = withoutWhere.match(/\[[^\]]+\]/g)?.length ?? 0;
  const pseudoClasses = withoutWhere.match(/:(?!:)[\w-]+(?:\([^)]*\))?/g)?.length ?? 0;
  const pseudoElements = withoutWhere.match(/::[\w-]+/g)?.length ?? 0;
  const stripped = withoutWhere.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, " ").replace(/[>+~,*]/g, " ");
  const elements = stripped.match(/(?:^|\s)([a-zA-Z][\w-]*)/g)?.length ?? 0;
  return [0, ids, classes + attributes + pseudoClasses, elements + pseudoElements];
}

function resolveCssVariableFunctions(value: string, variables: Map<string, string>, stack: Set<string>, unresolved: Set<string>): string {
  let result = value;
  let searchFrom = 0;
  while (true) {
    const start = result.indexOf("var(", searchFrom);
    if (start < 0) return result;
    const end = findClosingParenthesis(result, start + 3);
    if (end < 0) return result;
    const expression = result.slice(start + 4, end);
    const [namePart, fallback] = splitCssVariableExpression(expression);
    const name = namePart.trim();
    const raw = variables.get(name);
    let replacement: string | null = null;
    if (raw !== undefined && !stack.has(name)) {
      const nextStack = new Set(stack);
      nextStack.add(name);
      replacement = resolveCssVariableFunctions(raw, variables, nextStack, unresolved);
    } else if (fallback !== null) {
      replacement = resolveCssVariableFunctions(fallback.trim(), variables, stack, unresolved);
    }
    if (replacement === null) {
      unresolved.add(name);
      searchFrom = end + 1;
      continue;
    }
    result = `${result.slice(0, start)}${replacement}${result.slice(end + 1)}`;
    searchFrom = start + replacement.length;
  }
}

function findClosingParenthesis(value: string, openIndex: number): number {
  let depth = 0;
  let quote = "";
  for (let index = openIndex; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitCssVariableExpression(value: string): [string, string | null] {
  let depth = 0;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === "," && depth === 0) return [value.slice(0, index), value.slice(index + 1)];
  }
  return [value, null];
}

function sanitizeWechatHtml(root: HTMLElement, warnings: string[]) {
  const removed = root.querySelectorAll(REMOVED_ELEMENTS);
  if (removed.length > 0) warnings.push(`已移除 ${removed.length} 个微信公众号不支持的可执行或嵌入元素。`);
  removed.forEach((element) => element.remove());

  const unwrapped = root.querySelectorAll(UNWRAPPED_ELEMENTS);
  if (unwrapped.length > 0) warnings.push(`已降级 ${unwrapped.length} 个微信公众号不支持的交互容器，并保留其中内容。`);
  unwrapped.forEach((element) => element.replaceWith(...Array.from(element.childNodes)));
  for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || ((name === "href" || name === "src") && /^javascript:/i.test(value))) {
        element.removeAttribute(attribute.name);
        warnings.push("已移除不可在微信公众号中执行的脚本属性。");
      }
    }
    for (const property of Array.from(element.style)) {
      const value = element.style.getPropertyValue(property);
      if (/expression\s*\(|javascript\s*:/i.test(value)) {
        element.style.removeProperty(property);
        warnings.push(`已移除不可在微信公众号中执行的 CSS：${property}`);
      }
    }
  }
}

function buildBaseThemeCss(base: WechatThemeBaseStyle): string {
  const { typography, layout } = base;
  return `
[data-nibva-publish="wechat"] {
  width:100%; margin:0; padding:8px 4px 12px; box-sizing:border-box;
  background:var(--nibva-page-background); color:var(--nibva-body-text);
  font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
  line-height:${typography.bodyLineHeight}; letter-spacing:0.3px; overflow-x:hidden;
}
[data-nibva-role="article-header"], [data-nibva-role="article-body"] { margin-left:${layout.contentPadding}px; margin-right:${layout.contentPadding}px; }
[data-nibva-role="article-title"] { font-size:${typography.articleTitleSize}px; color:var(--nibva-title-text); }
[data-nibva-role="article-summary"] { color:var(--nibva-body-text); }
[data-nibva-role="article-body"] h2 { margin:${layout.sectionSpacing}px 0 16px; padding:0; font-size:${typography.h2Size}px; font-weight:850; color:var(--nibva-title-text); }
[data-nibva-role="article-body"] h3 { margin:${Math.max(16, layout.sectionSpacing * 0.7)}px 0 12px; padding:0; font-size:${typography.h3Size}px; font-weight:760; line-height:1.5; color:var(--nibva-title-text); }
[data-nibva-role="article-body"] h4 { margin:${Math.max(14, layout.sectionSpacing * 0.65)}px 0 10px; font-size:${typography.h4Size}px; font-weight:700; line-height:1.4; color:var(--nibva-title-text); }
[data-nibva-role="article-body"] p { margin:0 0 ${typography.paragraphSpacing}px; padding:0; font-size:${typography.bodySize}px; line-height:${typography.bodyLineHeight}; color:var(--nibva-body-text); text-align:justify; }
[data-nibva-role="article-body"] blockquote { margin:0 0 ${Math.max(16, typography.paragraphSpacing + 6)}px; }
[data-nibva-role="article-body"] blockquote p { margin:0; text-align:left; }
[data-nibva-role="article-body"] ul, [data-nibva-role="article-body"] ol { margin:0 0 ${typography.paragraphSpacing}px; padding-left:24px; color:var(--nibva-body-text); }
[data-nibva-role="article-body"] li { margin:0 0 10px; font-size:${typography.bodySize}px; line-height:${typography.bodyLineHeight}; }
[data-nibva-role="article-body"] strong { color:var(--nibva-emphasis-text); font-weight:700; }
[data-nibva-role="article-body"] a { color:var(--nibva-link-text); text-decoration:none; font-weight:600; }
[data-nibva-role="article-body"] mark { padding:0 4px; border-radius:4px; background:var(--nibva-mark-color); color:var(--nibva-body-text); font-weight:600; }
[data-nibva-role="article-body"] img { display:block; max-width:100%; height:auto; margin:24px auto; padding:4px; border-radius:${layout.imageRadius}px; box-shadow:${themeShadow(layout.shadowStrength)}; }
[data-nibva-role="article-body"] pre { margin:0 0 24px; padding:16px; overflow:auto; border:1px solid rgba(127,127,127,0.2); border-radius:${Math.min(layout.radius, 10)}px; background:rgba(127,127,127,0.08); font-size:${Math.max(11, typography.bodySize - 2)}px; line-height:1.8; white-space:pre-wrap; }
[data-nibva-role="article-body"] code { padding:2px 6px; border-radius:4px; background:rgba(127,127,127,0.1); font-size:${Math.max(11, typography.bodySize - 2)}px; }
[data-nibva-role="article-body"] pre code { padding:0; background:transparent; }
[data-nibva-role="article-body"] table { width:100%; margin:0 0 24px; border-collapse:collapse; }
[data-nibva-role="article-body"] th, [data-nibva-role="article-body"] td { padding:10px 12px; border:1px solid rgba(127,127,127,0.2); text-align:left; font-size:${Math.max(11, typography.bodySize - 2)}px; line-height:1.7; color:var(--nibva-body-text); }
[data-nibva-role="article-body"] hr { margin:${layout.sectionSpacing}px 0; border:0; height:1px; background:rgba(127,127,127,0.25); }
`;
}

function themeCssVariables(base: WechatThemeBaseStyle): Record<string, string> {
  return {
    "--nibva-accent": base.colors.accent,
    "--nibva-page-background": base.colors.pageBackground,
    "--nibva-title-text": base.colors.titleText,
    "--nibva-body-text": base.colors.bodyText,
    "--nibva-emphasis-text": base.colors.emphasisText,
    "--nibva-link-text": base.colors.linkText,
    "--nibva-mark-color": base.colors.markColor,
    "--nibva-radius": `${base.layout.radius}px`,
    "--nibva-image-radius": `${base.layout.imageRadius}px`,
    "--nibva-shadow-strength": String(base.layout.shadowStrength),
  };
}

function resolveThemeVariables(css: string, variables: Record<string, string>): string {
  const resolved = css.replace(/var\((--[a-zA-Z0-9-_]+)(?:,\s*([^)]+))?\)/g, (match, name: string) => {
    return variables[name] ?? match;
  });
  return resolved.replace(/calc\(\s*([0-9.]+)\s*\*\s*([0-9.]+)\s*\)/g, (_match, left: string, right: string) => {
    return String(Number(left) * Number(right));
  });
}

function splitSelectors(selectorText: string): string[] {
  const selectors: string[] = [];
  let start = 0;
  let quote = "";
  let escaped = false;
  let parentheses = 0;
  let brackets = 0;
  for (let index = 0; index < selectorText.length; index += 1) {
    const character = selectorText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets = Math.max(0, brackets - 1);
    else if (character === "," && parentheses === 0 && brackets === 0) {
      selectors.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }
  selectors.push(selectorText.slice(start).trim());
  return selectors.filter(Boolean);
}

function parseCssContent(value: string): string | null {
  const content = value.trim();
  if (!content || content === "none" || content === "normal") return null;
  const quoted = content.match(/^(?:"([\s\S]*)"|'([\s\S]*)')$/);
  return quoted ? (quoted[1] ?? quoted[2] ?? "") : content;
}

function themeShadow(strength: number): string {
  if (strength <= 0) return "none";
  return `0 8px 20px rgba(11,18,32,${Math.min(0.18, 0.05 * strength).toFixed(3)})`;
}

function renderInlineTitle(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
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
