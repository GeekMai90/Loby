import type { WritingProject, WritingSheet } from "../types";
import { getSheetHeadings } from "./markdownOutline";
import { countWords, sheetStats } from "./text";

export function polishText(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      if (line.startsWith("#")) return line;
      return line
        .replace(/很好的/g, "成熟的")
        .replace(/真正重要的/g, "更关键的")
        .replace(/应该/g, "需要")
        .replace(/这里写/g, "这里可以展开");
    })
    .join("\n");
}

export function buildLocalSheetSummary(sheet: WritingSheet): string {
  const headings = getSheetHeadings(sheet.body).slice(0, 6);
  const plainParagraphs = getPlainParagraphs(sheet.body);
  const stats = sheetStats(sheet);
  const opening = plainParagraphs[0] ?? sheet.summary;
  const nextGap = headings.length === 0 ? "补出清晰的 Markdown 标题结构" : "检查各标题之间的转场和论证顺序";

  return [
    "## 稿件摘要",
    "",
    `- 标题：${sheet.title}`,
    `- 类型：${sheet.type}`,
    `- 状态：${sheet.status}`,
    `- 字数：${countWords(sheet.body)} / ${sheet.targetWords}`,
    `- 段落：${stats.paragraphs}，标题：${stats.headings}，预计阅读：${stats.readingMinutes} 分钟`,
    "",
    "## 一句话概括",
    "",
    opening ? `这张卡片目前主要在表达：${opening.slice(0, 120)}${opening.length > 120 ? "..." : ""}` : "这张卡片还没有足够正文，需要先补充核心观点。",
    "",
    "## 当前结构",
    "",
    headings.length > 0
      ? headings.map((heading) => `${"  ".repeat(Math.max(0, heading.level - 1))}- H${heading.level} ${heading.text}`).join("\n")
      : "- 暂无标题结构",
    "",
    "## 下一步",
    "",
    `- ${nextGap}`,
    "- 检查每一段是否服务于同一个写作目标",
    "- 如果准备发布，补充结尾的行动或观点收束",
  ].join("\n");
}

export function buildLocalImageIdeas(project: WritingProject, sheet: WritingSheet): string {
  const keywords = Array.from(new Set([...project.tags, sheet.type, project.targetPlatform].filter(Boolean))).slice(0, 5);
  const title = sheet.title.replace(/^#+\s*/, "");
  const summary = sheet.summary || getPlainParagraphs(sheet.body)[0] || project.description;

  return [
    "## 配图构思",
    "",
    `- 项目：${project.title}`,
    `- 当前稿件：${title}`,
    `- 发布平台：${project.targetPlatform || "未指定"}`,
    `- 关键词：${keywords.join(" / ") || "写作 / 观点 / 结构"}`,
    "",
    "## 封面方向",
    "",
    `1. 干净白底编辑感封面：以「${title}」为核心视觉，使用简洁桌面、纸张、光标或写作工具元素，保留大量留白。`,
    `2. 概念型封面：把主题抽象成一个清晰物件或场景，例如从碎片笔记整理成完整稿件的过程。`,
    "3. 专业工具感封面：突出本地文件、Markdown、AI 辅助和发布流程，但不要做成科技感仪表盘。",
    "",
    "## 正文配图位置",
    "",
    "- 开头后：放一张主题概念图，帮助读者进入语境。",
    "- 结构转折处：放流程图或步骤图，承接论证层次。",
    "- 发布准备前：放清单式图像，强化可执行感。",
    "",
    "## 可交给生图技能的提示词",
    "",
    [
      "clean white Apple-style editorial cover image",
      `topic: ${title}`,
      summary ? `context: ${summary.slice(0, 140)}` : "",
      "minimal, fresh, professional writing software aesthetic",
      "white and light gray surfaces, subtle blue accent, no clutter, no dark dashboard",
    ]
      .filter(Boolean)
      .join(", "),
  ].join("\n");
}

function getPlainParagraphs(markdownSource: string): string[] {
  return markdownSource
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^>\s?/gm, "")
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim(),
    )
    .filter(Boolean);
}
