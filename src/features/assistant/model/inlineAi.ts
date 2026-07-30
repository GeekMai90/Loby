/**
 * [INPUT]: 依赖 shared/types 的 ChatMessage 与编辑器选区正文快照
 * [OUTPUT]: 对外提供 inline 选区/结果/待编辑/交接契约，以及主助手消息构造与回答/编辑结果解析能力
 * [POS]: inline AI 到主助手的交接协议层，构造选区上下文并解析回答/编辑意图，不直接修改正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ChatMessage } from "@/shared/types";

export interface InlineAiSelection {
  sheetId: string;
  sheetTitle: string;
  baseBody: string;
  from: number;
  to: number;
  text: string;
}

export type InlineAiResult =
  | {
      resultType: "answer";
      content: string;
    }
  | {
      resultType: "edit";
      replacement: string;
      summary: string;
    };

export interface InlineAiPendingEdit extends InlineAiSelection {
  prompt: string;
  replacement: string;
  summary: string;
  proposedBody: string;
}

export interface InlineAiHandoff {
  prompt: string;
  selection: InlineAiSelection;
  result: InlineAiResult;
}

export function buildInlineAiHandoffMessages(handoff: InlineAiHandoff, projectId: string | undefined, timestamp: number): ChatMessage[] {
  const normalizedSelection = handoff.selection.text.replace(/\s+/g, " ").trim();
  const excerpt = normalizedSelection.length > 44 ? `${normalizedSelection.slice(0, 44)}...` : normalizedSelection;
  return [
    {
      id: `inline-user-${timestamp}`,
      role: "user",
      content: handoff.prompt,
      contexts: [
        {
          id: `selection:${handoff.selection.sheetId}:${timestamp}`,
          type: "selection",
          contentMode: "snapshot",
          sheetId: handoff.selection.sheetId,
          projectId,
          title: handoff.selection.sheetTitle || "选中的文字范围",
          subtitle: "编辑器内联选区",
          excerpt,
          content: handoff.selection.text,
          visible: true,
        },
      ],
    },
    {
      id: `inline-assistant-${timestamp + 1}`,
      role: "assistant",
      content:
        handoff.result.resultType === "answer"
          ? handoff.result.content
          : [handoff.result.summary, "", "修改后选区：", handoff.result.replacement].join("\n"),
    },
  ];
}

export function buildInlineAiPrompt(prompt: string): string {
  return [
    "你正在处理落笔（Loby）编辑器中的选区请求。只处理当前选中的文字，不执行文件、终端或外部工具操作。",
    "请只返回一个 ```loby-inline-ai 代码块，代码块中是合法 JSON，不要在代码块外补充说明。",
    "回答型格式：",
    '{"resultType":"answer","content":"展示给用户的结果"}',
    "编辑型格式：",
    '{"resultType":"edit","replacement":"用于替换选区的完整文字","summary":"一句话概括修改"}',
    "分类规则：",
    "- 翻译、解释、提取、分析、列出建议等请求默认为 answer，只展示结果，不改正文。",
    "- 润色、改写、缩短、扩写、调整语气、纠错等明确要求修改原文的请求使用 edit。",
    "- 只有用户明确说替换、改成、写回或直接修改正文时，翻译请求才使用 edit。",
    "- edit 的 replacement 只能包含替换后的选区文字，不能包含解释、引号或 Markdown 代码围栏。",
    `用户指令：${prompt.trim()}`,
  ].join("\n");
}

export function parseInlineAiResult(raw: string, prompt: string): InlineAiResult {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("AI 没有返回内容。");

  const parsed = parseInlineAiJson(trimmed);
  if (parsed?.resultType === "answer" && typeof parsed.content === "string" && parsed.content.trim()) {
    return { resultType: "answer", content: parsed.content.trim() };
  }
  if (parsed?.resultType === "edit" && typeof parsed.replacement === "string" && parsed.replacement.trim()) {
    return {
      resultType: "edit",
      replacement: parsed.replacement,
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "已更新选区",
    };
  }

  const fallback = stripInlineAiFence(trimmed);
  if (inferInlineAiResultType(prompt) === "edit") {
    return { resultType: "edit", replacement: fallback, summary: "已更新选区" };
  }
  return { resultType: "answer", content: fallback };
}

export function inferInlineAiResultType(prompt: string): InlineAiResult["resultType"] {
  const normalized = prompt.replace(/\s+/g, "");
  const translationRequest = /(翻译|译成|translate)/i.test(normalized);
  const explicitReplacement = /(替换|改成|改为|写回|直接改|直接修改|更新正文|放回正文)/.test(normalized);
  if (translationRequest && !explicitReplacement) return "answer";
  if (explicitReplacement) return "edit";
  if (/(润色|改写|重写|缩短|改短|扩写|续写|纠错|修正|优化表达|调整语气|更正式|更口语|更简洁|更生动)/.test(normalized)) {
    return "edit";
  }
  return "answer";
}

function parseInlineAiJson(raw: string): Record<string, unknown> | null {
  const fenceMatch = raw.match(/```(?:loby-inline-ai|json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenceMatch?.[1] ?? raw).trim();
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stripInlineAiFence(raw: string): string {
  const match = raw.match(/```(?:loby-inline-ai|json)?\s*([\s\S]*?)\s*```/i);
  return (match?.[1] ?? raw).trim();
}
