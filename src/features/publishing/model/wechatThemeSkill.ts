/**
 * [INPUT]: 依赖 ..、shared 公共契约、AI 助手模块、发布模块
 * [OUTPUT]: 对外提供 WechatThemeContextMode、WECHAT_THEME_CONTEXT_VERSION、buildWechatThemeSkillContext、shouldIncludePreviousWechatTheme、resolveWechatThemeContextMode、sanitizeWechatThemeMarkdownPreview
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import skillInstructions from "../../../../skills/wechat-theme-designer/SKILL.md?raw";
import protocolReference from "../../../../skills/wechat-theme-designer/references/theme-protocol.md?raw";
import type { AiImageAttachment, WritingProject, WritingSheet } from "@/shared/types";
import { formatAssistantMessageForContext } from "@/features/assistant/model/assistantImageAttachments";
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";
import { sheetWechatTags } from "@/features/publishing/model/wechatPreview";

export type WechatThemeContextMode = "bootstrap" | "resume" | "resync";
export const WECHAT_THEME_CONTEXT_VERSION = 2;

interface WechatThemeSkillContextInput {
  theme: WechatThemeManifest;
  previousTheme?: WechatThemeManifest;
  project: WritingProject;
  sheet: WritingSheet;
  messages: Array<{ role: "user" | "assistant"; content: string; images?: AiImageAttachment[] }>;
  mode?: WechatThemeContextMode;
}

const INLINE_IMAGE_DATA_URI = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+/gi;
const RESTORE_REQUEST = /(?:撤销|恢复|还原|回退|退回|改回|上一版|上一个版本|之前的版本|undo|revert|restore)/i;

export function buildWechatThemeSkillContext({
  theme,
  previousTheme,
  project,
  sheet,
  messages,
  mode = "bootstrap",
}: WechatThemeSkillContextInput): string {
  if (mode === "resume") {
    return [
      "继续当前公众号主题设计对话。沿用本线程已经提供的主题 skill、协议、当前主题和预览结构，只处理本轮用户消息。",
      `当前主题版本：${theme.updatedAt}。`,
      "普通问答只返回 message；只有确实需要修改主题时才返回 themePatch。最终仍只返回 loby-wechat-theme-result 协议代码块。",
    ].join("\n");
  }

  const recentMessages = messages.slice(-6).map((message) => formatAssistantMessageForContext(message));
  const bootstrap = mode === "bootstrap";
  return [
    "你现在不是通用写作助手，而是落笔（Loby）公众号主题工作室中的固定主题设计助手。",
    bootstrap ? "严格遵守下面随应用内置的 skill 和主题结果协议。" : "当前主题已在线程外发生变化，以下清单是新的唯一准确信息。",
    bootstrap ? `\n<skill>\n${skillInstructions}\n</skill>\n<skill-reference>\n${protocolReference}\n</skill-reference>\n` : "\n",
    `当前主题清单：\n${JSON.stringify(theme, null, 2)}`,
    previousTheme ? `\n用户可能要求恢复旧版本，上一版主题快照：\n${JSON.stringify(previousTheme, null, 2)}` : "",
    bootstrap ? `\n预览文章摘要：\n${JSON.stringify(buildWechatThemeArticleDigest(project, sheet), null, 2)}` : "",
    bootstrap && recentMessages.length > 0 ? `\n未绑定 Codex 线程的最近对话：\n${JSON.stringify(recentMessages, null, 2)}` : "",
    "\n你可以使用只读工具检查用户明确提供的本地路径、项目文件和参考资料，也可以运行不会修改磁盘的分析命令。不要直接创建、覆盖、移动或删除用户文件；所有主题修改都必须通过最终协议返回，由落笔合并、校验后应用。最终回复只返回协议代码块。",
  ].join("");
}

export function shouldIncludePreviousWechatTheme(prompt: string): boolean {
  return RESTORE_REQUEST.test(prompt);
}

export function resolveWechatThemeContextMode(
  conversation: { agentThreadId?: string; themeContextUpdatedAt?: string; themeContextVersion?: number },
  theme: Pick<WechatThemeManifest, "updatedAt">,
): WechatThemeContextMode {
  if (!conversation.agentThreadId) return "bootstrap";
  if (conversation.themeContextVersion !== WECHAT_THEME_CONTEXT_VERSION) return "bootstrap";
  return conversation.themeContextUpdatedAt === theme.updatedAt ? "resume" : "resync";
}

export function sanitizeWechatThemeMarkdownPreview(markdown: string, limit = 2000): string {
  return markdown.replace(INLINE_IMAGE_DATA_URI, "loby-inline-image://preview").slice(0, limit);
}

function buildWechatThemeArticleDigest(project: WritingProject, sheet: WritingSheet) {
  const outline = sheet.body
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .slice(0, 20)
    .map((match) => ({ level: match[1].length, text: match[2].trim().slice(0, 120) }));
  return {
    projectTitle: project.title,
    sheetTitle: sheet.title,
    tags: sheetWechatTags(sheet),
    outline,
    markdownSample: sanitizeWechatThemeMarkdownPreview(sheet.body),
  };
}
