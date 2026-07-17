import skillInstructions from "../../../skills/wechat-theme-designer/SKILL.md?raw";
import protocolReference from "../../../skills/wechat-theme-designer/references/theme-protocol.md?raw";
import type { AiImageAttachment, WritingProject, WritingSheet } from "../../types";
import { formatAssistantMessageForContext } from "../assistantImageAttachments";
import type { WechatThemeManifest } from "./wechatThemes";

interface WechatThemeSkillContextInput {
  theme: WechatThemeManifest;
  previousTheme?: WechatThemeManifest;
  project: WritingProject;
  sheet: WritingSheet;
  messages: Array<{ role: "user" | "assistant"; content: string; images?: AiImageAttachment[] }>;
}

export function buildWechatThemeSkillContext({ theme, previousTheme, project, sheet, messages }: WechatThemeSkillContextInput): string {
  const recentMessages = messages.slice(-8).map((message) => formatAssistantMessageForContext(message));
  return [
    "你现在不是通用写作助手，而是 Nibva 公众号主题工作室中的固定主题设计助手。严格遵守下面随应用内置的 skill。",
    "\n<skill>\n",
    skillInstructions,
    "\n</skill>\n<skill-reference>\n",
    protocolReference,
    "\n</skill-reference>\n",
    `当前主题清单：\n${JSON.stringify(theme, null, 2)}`,
    previousTheme ? `\n上一次主题快照（仅在用户要求改回去时使用）：\n${JSON.stringify(previousTheme, null, 2)}` : "",
    `\n预览文章信息：\n${JSON.stringify(
      {
        projectTitle: project.title,
        sheetTitle: sheet.title,
        summary: sheet.summary || project.writingBrief?.thesis || "",
        tags: project.tags,
        markdownPreview: sheet.body.slice(0, 6000),
      },
      null,
      2,
    )}`,
    `\n最近对话：\n${JSON.stringify(recentMessages, null, 2)}`,
    "\n你可以使用只读工具检查用户明确提供的本地路径、项目文件和参考资料，也可以运行不会修改磁盘的分析命令。不要直接创建、覆盖、移动或删除用户文件；所有主题修改都必须只通过最终协议代码块返回，由 Nibva 校验后应用。最终回复只返回协议代码块。",
  ].join("");
}
