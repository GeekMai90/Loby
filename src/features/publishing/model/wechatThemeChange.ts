/**
 * [INPUT]: 依赖 wechatThemeModel 的 clone/normalize/validate 与 WechatThemeManifest 契约
 * [OUTPUT]: 对外提供 WechatThemeChange、WechatThemeAgentResult、isWechatThemeChangeRequestCurrent、parseWechatThemeAgentResult、parseWechatThemeChange
 * [POS]: 主题助手结果的解析与并发请求守卫，把不可信模型输出收敛为完整可验证 manifest
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  cloneWechatThemeManifest,
  getWechatThemeValidationIssues,
  normalizeWechatThemeManifest,
} from "@/features/publishing/model/wechatThemeModel";
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";

export interface WechatThemeChange {
  message: string;
  theme: WechatThemeManifest;
}

export interface WechatThemeAgentResult {
  message: string;
  theme?: WechatThemeManifest;
}

const RESULT_FENCE = /^```loby-wechat-theme-result\s*\n([\s\S]*?)\n```$/;
const LEGACY_CHANGE_FENCE = /^```loby-wechat-theme-change\s*\n([\s\S]*?)\n```$/;
const PATCH_KEYS = new Set(["name", "description", "swatches", "baseStyle", "custom"]);
const BASE_STYLE_KEYS = new Set(["typography", "colors", "layout"]);
const TYPOGRAPHY_KEYS = new Set(["articleTitleSize", "h2Size", "h3Size", "h4Size", "bodySize", "bodyLineHeight", "paragraphSpacing"]);
const COLOR_KEYS = new Set(["accent", "pageBackground", "titleText", "bodyText", "emphasisText", "linkText", "markColor"]);
const LAYOUT_KEYS = new Set(["contentPadding", "sectionSpacing", "radius", "imageRadius", "shadowStrength"]);
const CUSTOM_KEYS = new Set(["css", "htmlTransforms"]);

export function isWechatThemeChangeRequestCurrent(
  request: Pick<WechatThemeManifest, "id" | "updatedAt">,
  active: Pick<WechatThemeManifest, "id" | "updatedAt">,
): boolean {
  return request.id === active.id && request.updatedAt === active.updatedAt;
}

export function parseWechatThemeAgentResult(output: string, currentTheme: WechatThemeManifest, now = new Date()): WechatThemeAgentResult {
  const source = output.trim();
  const resultMatch = source.match(RESULT_FENCE);
  if (resultMatch) return parsePatchResult(resultMatch[1], currentTheme, now);

  const legacyMatch = source.match(LEGACY_CHANGE_FENCE);
  if (legacyMatch) return parseLegacyChangeResult(legacyMatch[1], currentTheme, now);

  throw new Error("AI 没有返回有效的公众号主题结果协议。");
}

export function parseWechatThemeChange(output: string, currentTheme: WechatThemeManifest, now = new Date()): WechatThemeChange {
  const result = parseWechatThemeAgentResult(output, currentTheme, now);
  if (!result.theme) throw new Error("AI 返回的是说明消息，没有包含主题修改。");
  return { message: result.message, theme: result.theme };
}

function parsePatchResult(source: string, currentTheme: WechatThemeManifest, now: Date): WechatThemeAgentResult {
  let payload: unknown;
  try {
    payload = JSON.parse(source);
  } catch {
    throw new Error("AI 返回的主题结果 JSON 无法解析。");
  }
  if (!isRecord(payload) || typeof payload.message !== "string" || !payload.message.trim()) {
    throw new Error("AI 返回的主题结果缺少说明消息。");
  }
  assertOnlyKeys(payload, new Set(["message", "themePatch"]), "主题结果");
  if (!("themePatch" in payload)) return { message: payload.message.trim() };
  if (!isRecord(payload.themePatch)) throw new Error("AI 返回的主题补丁格式无效。");

  const candidate = applyThemePatch(currentTheme, payload.themePatch);
  const nextTheme = normalizeWechatThemeManifest(candidate);
  if (!nextTheme) {
    const issues = getWechatThemeValidationIssues(candidate);
    throw new Error(`AI 返回的主题补丁未通过校验：${issues[0] ?? "主题格式无效。"}`);
  }
  if (JSON.stringify(nextTheme) === JSON.stringify(currentTheme)) return { message: payload.message.trim() };
  nextTheme.updatedAt = now.toISOString();
  return { message: payload.message.trim(), theme: nextTheme };
}

function applyThemePatch(currentTheme: WechatThemeManifest, patch: Record<string, unknown>): unknown {
  assertOnlyKeys(patch, PATCH_KEYS, "主题补丁");
  const next = cloneWechatThemeManifest(currentTheme) as unknown as Record<string, unknown>;

  for (const key of ["name", "description", "swatches"] as const) {
    if (key in patch) next[key] = patch[key];
  }

  if ("baseStyle" in patch) {
    if (!isRecord(patch.baseStyle)) throw new Error("AI 返回的基础样式补丁格式无效。");
    assertOnlyKeys(patch.baseStyle, BASE_STYLE_KEYS, "基础样式补丁");
    const baseStyle = next.baseStyle as Record<string, unknown>;
    mergeThemeSection(baseStyle, patch.baseStyle, "typography", TYPOGRAPHY_KEYS);
    mergeThemeSection(baseStyle, patch.baseStyle, "colors", COLOR_KEYS);
    mergeThemeSection(baseStyle, patch.baseStyle, "layout", LAYOUT_KEYS);
  }

  if ("custom" in patch) {
    if (patch.custom === null) {
      delete next.custom;
    } else {
      if (!isRecord(patch.custom)) throw new Error("AI 返回的自定义样式补丁格式无效。");
      assertOnlyKeys(patch.custom, CUSTOM_KEYS, "自定义样式补丁");
      const currentCustom = isRecord(next.custom) ? next.custom : { css: "", htmlTransforms: [] };
      next.custom = { ...currentCustom, ...patch.custom };
    }
  }

  return next;
}

function mergeThemeSection(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
  key: "typography" | "colors" | "layout",
  allowedKeys: Set<string>,
) {
  if (!(key in patch)) return;
  const sectionPatch = patch[key];
  if (!isRecord(sectionPatch)) throw new Error(`AI 返回的 ${key} 补丁格式无效。`);
  assertOnlyKeys(sectionPatch, allowedKeys, `${key} 补丁`);
  const currentSection = isRecord(target[key]) ? target[key] : {};
  target[key] = { ...currentSection, ...sectionPatch };
}

function parseLegacyChangeResult(source: string, currentTheme: WechatThemeManifest, now: Date): WechatThemeChange {
  let payload: unknown;
  try {
    payload = JSON.parse(source);
  } catch {
    const repairedChanges = parseSingleExtraClosingBraceCandidates(source)
      .map((candidate) => tryCreateLegacyWechatThemeChange(candidate, currentTheme, now))
      .filter((candidate): candidate is WechatThemeChange => candidate !== null);
    if (repairedChanges.length === 1) return repairedChanges[0];
    throw new Error("AI 返回的主题 JSON 无法解析。");
  }

  return validateLegacyWechatThemeChange(payload, currentTheme, now);
}

function tryCreateLegacyWechatThemeChange(payload: unknown, currentTheme: WechatThemeManifest, now: Date): WechatThemeChange | null {
  try {
    return validateLegacyWechatThemeChange(payload, currentTheme, now);
  } catch {
    return null;
  }
}

function validateLegacyWechatThemeChange(payload: unknown, currentTheme: WechatThemeManifest, now: Date): WechatThemeChange {
  if (!isRecord(payload) || typeof payload.message !== "string" || !payload.message.trim() || !("theme" in payload)) {
    throw new Error("AI 返回的主题修改缺少说明或完整主题。");
  }

  const nextTheme = normalizeWechatThemeManifest(payload.theme);
  if (!nextTheme) {
    const issues = getWechatThemeValidationIssues(payload.theme);
    throw new Error(`AI 返回的主题未通过校验：${issues[0] ?? "主题格式无效。"}`);
  }
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

function assertOnlyKeys(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  const unexpected = Object.keys(value).find((key) => !allowed.has(key));
  if (unexpected) throw new Error(`AI 返回的${label}包含不支持的字段：${unexpected}。`);
}

function parseSingleExtraClosingBraceCandidates(source: string): unknown[] {
  const candidates: unknown[] = [];
  const repairedSources = new Set<string>();
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character !== "}") continue;

    const repairedSource = source.slice(0, index) + source.slice(index + 1);
    if (repairedSources.has(repairedSource)) continue;
    repairedSources.add(repairedSource);
    try {
      candidates.push(JSON.parse(repairedSource));
    } catch {
      // Only keep candidates that become valid JSON after removing one structural closing brace.
    }
  }

  return candidates;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
