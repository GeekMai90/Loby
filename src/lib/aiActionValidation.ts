import type { AiAction } from "../types";

export interface AiActionValidation {
  issues: string[];
}

export function validateAiActionPayload(action: AiAction): AiActionValidation {
  const payload = action.payload;
  const issues: string[] = [];
  if (action.type === "createSheet") {
    return createSheetTitle(action) ? valid() : invalid("缺少新文稿标题，请让 AI 补充 title。");
  }

  if (action.type === "insertText") {
    const text = stringValue(payload.text) || stringValue(payload.markdown) || stringValue(payload.content);
    if (!text) issues.push("缺少要插入的文本，请让 AI 补充 text。");
    issues.push(...validateInsertionTarget(payload));
    return { issues };
  }

  if (action.type === "insertImage") {
    const path = stringValue(payload.path);
    if (!path) {
      issues.push("缺少图片路径，请让 AI 补充 path。");
    } else {
      issues.push(...validateImageReferencePath(path));
    }
    issues.push(...validateInsertionTarget(payload));
    return { issues };
  }

  if (action.type === "saveExport") {
    if (!stringValue(payload.content)) issues.push("缺少导出内容，请让 AI 补充 content。");
    const filename = stringValue(payload.filename);
    if (filename) issues.push(...validateExportFilename(filename));
    return { issues };
  }

  return valid();
}

function createSheetTitle(action: AiAction): string {
  if (stringValue(action.payload.title)) return stringValue(action.payload.title);
  if (!action.title.startsWith("创建文稿：")) return "";
  return action.title.replace(/^创建文稿：/, "").trim();
}

function valid(): AiActionValidation {
  return { issues: [] };
}

function invalid(issue: string): AiActionValidation {
  return { issues: [issue] };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateImageReferencePath(path: string): string[] {
  if (hasControlCharacters(path)) return ["图片路径不能包含换行或控制字符。"];
  if (path.includes("\\")) return ["图片路径请使用正斜杠 /，不要使用反斜杠。"];
  if (/^[a-z]:/i.test(path)) return ["图片路径不能是系统绝对路径。"];
  if (path.startsWith("/") || path.startsWith("~")) return ["图片路径不能是系统绝对路径。"];
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^https?:\/\//i.test(path)) {
    return ["图片路径只允许项目相对路径或 http/https 图片链接。"];
  }
  if (/^https?:\/\//i.test(path)) return [];

  const normalized = normalizeRelativePath(path);
  if (!normalized) return ["图片路径不是有效的相对路径。"];
  if (normalized.startsWith("../assets/") || normalized.startsWith("assets/") || normalized.startsWith("./assets/")) return [];
  if (!normalized.includes("/") && isLikelyImageFilename(normalized)) return [];
  return ["图片路径必须指向项目 assets 目录、当前目录图片文件，或 http/https 图片链接。"];
}

function validateExportFilename(filename: string): string[] {
  if (hasControlCharacters(filename)) return ["导出文件名不能包含换行或控制字符。"];
  if (filename.includes("/") || filename.includes("\\") || filename === "." || filename === "..") {
    return ["导出文件名不能包含路径，只能是文件名。"];
  }
  return [];
}

function validateInsertionTarget(payload: Record<string, unknown>): string[] {
  const target = payload.target;
  if (target === undefined || target === null || target === "") return [];
  if (typeof target !== "string") return ["插入位置 target 只允许 cursor、selection、end 或 anchor。"];
  const normalized = target.trim();
  if (!normalized || normalized === "cursor" || normalized === "selection" || normalized === "end") return [];
  if (normalized === "anchor") return validateInsertionAnchor(payload.anchor);
  return ["插入位置 target 只允许 cursor、selection、end 或 anchor。"];
}

function validateInsertionAnchor(anchor: unknown): string[] {
  if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)) return ["锚点定位需要提供 anchor 对象。"];
  const type = stringValue((anchor as Record<string, unknown>).type);
  if (!type) return ["锚点定位需要提供 anchor.type。"];
  if (
    type === "paragraphFromEnd" ||
    type === "paragraphFromStart" ||
    type === "afterHeading" ||
    type === "beforeHeading" ||
    type === "afterText" ||
    type === "beforeText"
  ) {
    return [];
  }
  return ["anchor.type 只允许 paragraphFromEnd、paragraphFromStart、afterHeading、beforeHeading、afterText 或 beforeText。"];
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function normalizeRelativePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) {
        parts.push(part);
        continue;
      }
      if (parts.at(-1) === "..") {
        parts.push(part);
        continue;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

function isLikelyImageFilename(filename: string): boolean {
  return /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(filename);
}
