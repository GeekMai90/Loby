/**
 * [INPUT]: 依赖 shared 公共契约与写作库标准 Markdown 图片格式化能力
 * [OUTPUT]: 对外提供 AiActionPreview、buildAiActionPreview，统一描述单项与批量动作并按实际写入格式预览图片
 * [POS]: AI 助手 action 摘要边界，为确认卡提供稳定且不泄漏内部 payload 的字段
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiAction } from "@/shared/types";
import { countWords } from "@/shared/lib/text";
import { expandImageActions } from "@/features/assistant/model/agentImageArtifacts";
import { createMarkdownImageReference } from "@/features/library/model/imageAssets";

export interface AiActionPreview {
  fields: Array<[string, string]>;
  excerpt: string;
}

export function buildAiActionPreview(action: AiAction): AiActionPreview {
  const payload = action.payload;
  if (action.type === "createSheet") {
    const body = stringValue(payload.body);
    return {
      fields: compactFields([
        ["项目", action.targetProjectTitle ?? ""],
        ["标题", stringValue(payload.title) || actionTitleTarget(action.title, "创建文稿：")],
        ["摘要", stringValue(payload.description) || stringValue(payload.summary)],
        ["目标字数", stringValue(payload.targetWords)],
        ["正文", body ? `${countWords(body)} 字` : ""],
      ]),
      excerpt: excerpt(body),
    };
  }

  if (action.type === "insertImage") {
    const path = stringValue(payload.path);
    const alt = stringValue(payload.alt);
    return {
      fields: compactFields([
        ["目标文稿", action.targetSheetTitle ?? ""],
        ["位置", insertionTargetLabel(stringValue(payload.target), payload.anchor)],
        ["路径", path],
        ["Alt", alt],
      ]),
      excerpt: path ? createMarkdownImageReference(path, alt) : "",
    };
  }

  if (action.type === "insertImages") {
    const imageActions = expandImageActions(action);
    return {
      fields: compactFields([
        ["目标文稿", action.targetSheetTitle ?? ""],
        ["图片", `${imageActions.length} 张`],
        ["位置", imageActions.map((item) => insertionTargetLabel(stringValue(item.payload.target), item.payload.anchor)).join("；")],
      ]),
      excerpt: "",
    };
  }

  if (action.type === "insertText") {
    const text = stringValue(payload.text) || stringValue(payload.markdown) || stringValue(payload.content);
    return {
      fields: compactFields([
        ["目标文稿", action.targetSheetTitle ?? ""],
        ["位置", insertionTargetLabel(stringValue(payload.target), payload.anchor)],
        ["标题", stringValue(payload.title)],
        ["文本", text ? `${countWords(text)} 字` : ""],
      ]),
      excerpt: excerpt(text),
    };
  }

  const content = stringValue(payload.content);
  return {
    fields: compactFields([
      ["项目", action.targetProjectTitle ?? ""],
      ["文件名", stringValue(payload.filename)],
      ["格式", stringValue(payload.format)],
      ["内容", content ? `${countWords(content)} 字` : ""],
    ]),
    excerpt: excerpt(content),
  };
}

function insertionTargetLabel(target: string, anchor: unknown): string {
  if (target === "end") return "文稿末尾";
  if (target === "selection") return "当前选区（执行时必须仍有选区）";
  if (target === "anchor") return anchorLabel(anchor);
  return "当前光标";
}

function anchorLabel(anchor: unknown): string {
  if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) return "锚点位置";
  const payload = anchor as Record<string, unknown>;
  const type = stringValue(payload.type);
  const index = numberValue(payload.index);
  const position = stringValue(payload.position) === "before" ? "之前" : "之后";
  if (type === "paragraphFromEnd" && index > 0) return `倒数第 ${index} 段${position}`;
  if (type === "paragraphFromStart" && index > 0) return `第 ${index} 段${position}`;
  if (type === "afterHeading" || type === "beforeHeading") {
    const heading = stringValue(payload.heading) || stringValue(payload.text);
    return heading ? `标题「${heading}」${type === "beforeHeading" ? "之前" : "之后"}` : "标题锚点";
  }
  if (type === "afterText" || type === "beforeText") {
    const text = stringValue(payload.text);
    return text ? `文本「${truncate(text, 18)}」${type === "beforeText" ? "之前" : "之后"}` : "文本锚点";
  }
  return "锚点位置";
}

function compactFields(fields: Array<[string, string]>): Array<[string, string]> {
  return fields.filter((field): field is [string, string] => Boolean(field[1]));
}

function actionTitleTarget(title: string, prefix: string): string {
  return title.startsWith(prefix) ? title.replace(prefix, "").trim() : "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : 0;
  return Number.isFinite(number) ? number : 0;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function excerpt(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > 120 ? `${normalized.slice(0, 120)}...` : normalized;
}
