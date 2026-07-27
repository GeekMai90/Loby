/**
 * [INPUT]: 依赖 Vitest、shared 会话契约与 Conversation Context Planner
 * [OUTPUT]: 验证长会话压缩、原生角色保留、工作状态投影、检查点复用和模型窗口预算
 * [POS]: AI 助手上下文规划的回归测试，守住“压缩投影不删除事实”的长期多轮边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/shared/types";
import {
  estimateConversationTokens,
  modelContextWindowTokens,
  planConversationContext,
} from "@/features/assistant/model/conversationContextPlanner";

describe("conversationContextPlanner", () => {
  it("compacts an old 20-turn conversation while retaining early constraints and recent native roles", () => {
    const messages = Array.from({ length: 20 }, (_, index) => {
      const turn = index + 1;
      return [
        message(
          `user-${turn}`,
          "user",
          turn === 1 ? "以后所有标题都不要使用感叹号，这是长期约束。" : `第 ${turn} 轮用户要求：${"细节".repeat(200)}`,
        ),
        message(`assistant-${turn}`, "assistant", `第 ${turn} 轮答复：${"分析".repeat(200)}`),
      ];
    }).flat();

    const plan = planConversationContext({
      context: "当前文稿：测试",
      prompt: "继续处理",
      messages,
      provider: "openai-compatible",
      model: "custom",
      contextWindowTokens: 4_096,
      outputReserveTokens: 1_024,
      now: "2026-07-27T10:00:00.000Z",
    });

    expect(plan.checkpoint?.summary).toContain("所有标题都不要使用感叹号");
    expect(plan.context).toContain("较早对话压缩检查点");
    expect(plan.messages.at(-2)?.role).toBe("user");
    expect(plan.messages.at(-1)?.role).toBe("assistant");
    expect(plan.messages.at(-1)?.content).toContain("第 20 轮答复");
    expect(plan.stats.compactedMessageCount).toBeGreaterThan(0);
    expect(messages).toHaveLength(40);
  });

  it("projects pending actions, change sets and artifacts into provider-visible state", () => {
    const plan = planConversationContext({
      context: "当前文稿：测试",
      prompt: "继续",
      messages: [
        message("user-1", "user", "生成并插入配图"),
        {
          ...message("assistant-1", "assistant", "已经生成图片，等待确认。"),
          actions: [
            {
              id: "action-1",
              type: "insertImage",
              status: "proposed",
              title: "确认插入",
              summary: "插入到一级标题之后",
              payload: {},
              createdAt: "2026-07-27T10:00:00.000Z",
            },
          ],
          run: {
            status: "completed",
            activities: [
              {
                id: "image-1",
                rawType: "artifact",
                title: "图片已生成",
                status: "completed",
                command: "",
                output: "",
                text: "",
                exitCode: null,
                artifactPath: "/tmp/generated.png",
              },
            ],
            usage: null,
          },
        },
      ],
      provider: "openai-api",
      model: "gpt-5.6-terra",
    });

    expect(plan.messages[1].content).toContain("确认插入｜proposed");
    expect(plan.messages[1].content).toContain("图片已生成：/tmp/generated.png");
  });

  it("reuses an unchanged checkpoint and exposes conservative provider windows", () => {
    const input = {
      context: "上下文",
      prompt: "继续",
      messages: Array.from({ length: 12 }, (_, index) => message(`user-${index}`, "user", "内容".repeat(120))),
      provider: "openai-compatible" as const,
      model: "custom",
      contextWindowTokens: 2_048,
      outputReserveTokens: 512,
      now: "2026-07-27T10:00:00.000Z",
    };
    const first = planConversationContext(input);
    const second = planConversationContext({ ...input, previousCheckpoint: first.checkpoint, now: "2026-07-28T10:00:00.000Z" });

    expect(second.checkpoint).toBe(first.checkpoint);
    expect(modelContextWindowTokens("anthropic-api", "claude-sonnet-5")).toBe(200_000);
    expect(modelContextWindowTokens("openai-api", "gpt-5.6-terra")).toBe(128_000);
    expect(estimateConversationTokens("中文abcd")).toBeGreaterThan(2);
  });

  it("hard-bounds oversized current context, prompt and recent turns", () => {
    const plan = planConversationContext({
      context: `项目规则\n${"上下文".repeat(20_000)}`,
      prompt: `当前要求\n${"提示".repeat(10_000)}`,
      messages: [message("user-1", "user", "历史问题".repeat(10_000)), message("assistant-1", "assistant", "历史回答".repeat(10_000))],
      provider: "openai-compatible",
      model: "custom",
      contextWindowTokens: 8_192,
      outputReserveTokens: 2_048,
    });

    expect(plan.context).toContain("中间内容已按模型窗口截断");
    expect(plan.prompt).toContain("中间内容已按模型窗口截断");
    expect(plan.stats.estimatedInputTokens).toBeLessThanOrEqual(plan.stats.inputBudgetTokens);
  });
});

function message(id: string, role: "user" | "assistant", content: string): ChatMessage {
  return { id, role, content };
}
