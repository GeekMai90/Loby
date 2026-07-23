/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 buildRunDisplayActivities
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity } from "@/shared/types";

const SKILL_LABELS: Record<string, string> = {
  "every-editorial-cover": "Every 封面",
};

export function buildRunDisplayActivities(activities: AgentRunActivity[]): AgentRunActivity[] {
  const displayActivities = activities.map(presentActivity).filter(isDisplayActivity);
  const mergedActivities = displayActivities.reduce<AgentRunActivity[]>((result, activity) => {
    const previous = result.at(-1);
    if (previous && canMergeActivities(previous, activity)) {
      result[result.length - 1] = {
        ...previous,
        status: activity.status || previous.status,
        exitCode: activity.exitCode ?? previous.exitCode,
      };
      return result;
    }
    result.push(activity);
    return result;
  }, []);

  return moveResponseToEnd(ensureImageGenerationStep(mergedActivities));
}

function presentActivity(activity: AgentRunActivity): AgentRunActivity {
  const isReasoning = activity.rawType.includes("reasoning") || activity.title.includes("思考过程");
  const reasoningSummary = isReasoning && !activity.text.trim() ? activity.output.trim() : "";

  return {
    ...activity,
    title: humanizeActivityTitle(activity),
    text: activity.text.trim() || reasoningSummary,
    output: reasoningSummary ? "" : activity.output,
  };
}

function humanizeActivityTitle(activity: AgentRunActivity) {
  const command = activity.command.trim();
  const normalizedCommand = command.toLowerCase();
  const rawType = activity.rawType.toLowerCase();
  const title = activity.title.trim();

  if (rawType.includes("reasoning") || title.includes("思考过程")) return "整理思路";
  if (rawType.includes("agentmessage") || title.includes("生成回复")) return "生成回复";
  if (rawType.includes("imagegeneration") || title.includes("生成图片")) return "生成图片";
  if (rawType.includes("websearch") || title.includes("搜索资料")) return "搜索资料";
  if (rawType.includes("imageview") || title.includes("查看图片")) return "查看图片";
  if (rawType.includes("sleep") || title.includes("等待处理") || title.includes("等待工具")) return "等待处理";

  if (normalizedCommand.includes("image_gen__imagegen") || normalizedCommand.includes("imagegen")) return "生成图片";
  if (isGeneratedImageCopy(normalizedCommand)) return "保存生成的图片";

  const skillName = extractSkillName(command);
  if (skillName) return `读取 ${SKILL_LABELS[skillName] || skillName}技能`;

  if (normalizedCommand.includes("apply_patch")) return "修改文件";
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|check|lint|build|typecheck)\b/.test(normalizedCommand)) return "检查处理结果";
  if (looksLikeReadCommand(normalizedCommand)) return "读取相关资料";
  if (rawType.includes("commandexecution") || title.includes("运行命令")) return "执行操作";
  if (title === "开始工具步骤" || title === "完成工具步骤") return "执行工具";
  return title || "处理任务";
}

function isDisplayActivity(activity: AgentRunActivity) {
  const rawType = activity.rawType.trim();
  const hasDescription = Boolean(activity.text.trim());
  const hasTechnicalDetail = Boolean(activity.command.trim() || activity.output.trim());

  if (rawType === "mcpServer/startupStatus/updated") return false;
  if (isBackgroundActivity(rawType, activity.title) && !hasDescription) return false;

  const isReasoning = rawType.includes("reasoning") || activity.title === "整理思路";
  if (isReasoning && !hasDescription) return false;

  if (activity.title === "执行工具" && !hasDescription && !hasTechnicalDetail) return false;

  return Boolean(activity.title || hasDescription || hasTechnicalDetail);
}

function isBackgroundActivity(rawType: string, title: string) {
  if (
    rawType === "thread/status/changed" ||
    rawType === "thread/start.result" ||
    rawType === "thread/resume.result" ||
    rawType === "thread/settings/updated" ||
    rawType === "turn/started" ||
    rawType.startsWith("turn/completed")
  ) {
    return true;
  }
  return title.includes("Codex 空闲") || title.includes("Codex 正在运行") || title.includes("开始处理") || title.includes("本轮完成");
}

function canMergeActivities(previous: AgentRunActivity, current: AgentRunActivity) {
  if (previous.title !== current.title) return false;
  if (previous.text !== current.text) return false;
  if (isFailureActivity(previous) || isFailureActivity(current)) return false;
  return previous.title === "等待处理" || previous.title === "整理思路" || previous.title === "生成图片";
}

function ensureImageGenerationStep(activities: AgentRunActivity[]) {
  if (activities.some((activity) => activity.title === "生成图片")) return activities;
  const savedImageIndex = activities.findIndex((activity) => activity.title === "保存生成的图片");
  if (savedImageIndex < 0) return activities;

  const savedImageActivity = activities[savedImageIndex];
  return [
    ...activities.slice(0, savedImageIndex),
    {
      id: `${savedImageActivity.id}-image-generation`,
      rawType: "presentation/imageGeneration",
      title: "生成图片",
      status: savedImageActivity.status,
      command: "",
      output: "",
      text: "",
      exitCode: savedImageActivity.exitCode,
    },
    ...activities.slice(savedImageIndex),
  ];
}

function moveResponseToEnd(activities: AgentRunActivity[]) {
  const responseActivities = activities.filter((activity) => activity.title === "生成回复");
  if (!responseActivities.length) return activities;
  return [...activities.filter((activity) => activity.title !== "生成回复"), ...responseActivities];
}

function isFailureActivity(activity: AgentRunActivity) {
  return activity.status === "failed" || (activity.exitCode !== null && activity.exitCode !== 0);
}

function extractSkillName(command: string) {
  return command.match(/[\\/]skills[\\/]([^\\/'"\s]+)[\\/]SKILL\.md/i)?.[1] || "";
}

function isGeneratedImageCopy(command: string) {
  return command.includes("generated_images") && /\b(cp|copy|mv)\b/.test(command);
}

function looksLikeReadCommand(command: string) {
  return /\b(rg|grep|sed|head|tail|less|read)\b/.test(command);
}
