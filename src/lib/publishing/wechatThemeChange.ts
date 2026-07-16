import { cloneWechatThemeManifest, getWechatThemeValidationIssues } from "./wechatThemeModel";
import type { WechatThemeManifest } from "./wechatThemes";

export interface WechatThemeChange {
  message: string;
  theme: WechatThemeManifest;
}

export function isWechatThemeChangeRequestCurrent(
  request: Pick<WechatThemeManifest, "id" | "updatedAt">,
  active: Pick<WechatThemeManifest, "id" | "updatedAt">,
): boolean {
  return request.id === active.id && request.updatedAt === active.updatedAt;
}

export function parseWechatThemeChange(output: string, currentTheme: WechatThemeManifest, now = new Date()): WechatThemeChange {
  const match = output.trim().match(/^```nibva-wechat-theme-change\s*\n([\s\S]*?)\n```$/);
  if (!match) throw new Error("AI 没有返回有效的公众号主题修改协议。");

  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    throw new Error("AI 返回的主题 JSON 无法解析。");
  }
  if (!isRecord(payload) || typeof payload.message !== "string" || !payload.message.trim() || !("theme" in payload)) {
    throw new Error("AI 返回的主题修改缺少说明或完整主题。");
  }

  const issues = getWechatThemeValidationIssues(payload.theme);
  if (issues.length > 0) throw new Error(`AI 返回的主题未通过校验：${issues[0]}`);
  const nextTheme = cloneWechatThemeManifest(payload.theme as WechatThemeManifest);
  if (
    nextTheme.schemaVersion !== currentTheme.schemaVersion ||
    nextTheme.id !== currentTheme.id ||
    nextTheme.kind !== "personal" ||
    nextTheme.baseThemeId !== currentTheme.baseThemeId ||
    nextTheme.createdAt !== currentTheme.createdAt
  ) {
    throw new Error("AI 修改了主题的只读身份字段，本次修改已拒绝。");
  }

  nextTheme.updatedAt = now.toISOString();
  return { message: payload.message.trim(), theme: nextTheme };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
