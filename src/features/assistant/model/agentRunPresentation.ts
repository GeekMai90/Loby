/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 buildRunDisplayActivities，将原始事件归并为无空重复的用户可读步骤
 * [POS]: AI 助手 feature 的运行展示归并边界，保留真实里程碑并消除同一工具生命周期的协议噪声
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity } from "@/shared/types";

const SKILL_LABELS: Record<string, string> = {
  "every-editorial-cover": "Every 封面",
  imagegen: "图片生成",
};

export function buildRunDisplayActivities(activities: AgentRunActivity[]): AgentRunActivity[] {
  const displayActivities = removeEmptyReasoningDuplicates(activities.map(presentActivity).filter(isDisplayActivity));
  const mergedActivities = displayActivities.reduce<AgentRunActivity[]>((result, activity) => {
    const previous = result.at(-1);
    if (previous && canMergeActivities(previous, activity)) {
      result[result.length - 1] = mergeActivities(previous, activity);
      return result;
    }
    result.push(activity);
    return result;
  }, []);

  return moveResponseToEnd(ensureImageGenerationStep(mergeImageGenerationLifecycle(mergedActivities)));
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

  const skillName = extractSkillName(command);
  if (skillName) return skillActivityTitle(skillName);

  if (normalizedCommand.includes("image_gen__imagegen") || normalizedCommand.includes("imagegen")) return "生成图片";
  if (isGeneratedImageCopy(normalizedCommand)) return "保存生成的图片";

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
  return (
    previous.title === "等待处理" ||
    previous.title === "整理思路" ||
    previous.title === "生成图片" ||
    (previous.title.startsWith("读取") && previous.title.endsWith("技能"))
  );
}

function mergeActivities(previous: AgentRunActivity, current: AgentRunActivity): AgentRunActivity {
  return {
    ...previous,
    status: current.status || previous.status,
    command: previous.command || current.command,
    output: previous.output || current.output,
    text: previous.text || current.text,
    exitCode: current.exitCode ?? previous.exitCode,
    artifactPath: current.artifactPath || previous.artifactPath,
  };
}

function removeEmptyReasoningDuplicates(activities: AgentRunActivity[]) {
  const hasDetailedReasoning = activities.some((activity) => activity.title === "整理思路" && hasActivityDetails(activity));
  if (hasDetailedReasoning) {
    return activities.filter((activity) => activity.title !== "整理思路" || hasActivityDetails(activity));
  }

  const lastEmptyReasoningId = [...activities]
    .reverse()
    .find((activity) => activity.title === "整理思路" && !hasActivityDetails(activity))?.id;
  return activities.filter(
    (activity) => activity.title !== "整理思路" || hasActivityDetails(activity) || activity.id === lastEmptyReasoningId,
  );
}

function hasActivityDetails(activity: AgentRunActivity) {
  return Boolean(activity.text.trim() || activity.command.trim() || activity.output.trim());
}

function mergeImageGenerationLifecycle(activities: AgentRunActivity[]) {
  const result: AgentRunActivity[] = [];
  let pendingGenerationIndex = -1;

  for (const activity of activities) {
    if (activity.title !== "生成图片") {
      result.push(activity);
      continue;
    }

    if (activity.artifactPath && pendingGenerationIndex >= 0) {
      result[pendingGenerationIndex] = mergeActivities(result[pendingGenerationIndex], activity);
      pendingGenerationIndex = -1;
      continue;
    }

    result.push(activity);
    if (!activity.artifactPath && !isFailureActivity(activity)) pendingGenerationIndex = result.length - 1;
  }

  return result;
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
  return command.match(/[\\/]skills[\\/](?:\.system[\\/])?([^\\/'"\s]+)[\\/]SKILL\.md/i)?.[1] || "";
}

function skillActivityTitle(skillName: string) {
  const label = SKILL_LABELS[skillName] || skillName;
  return skillName === "imagegen" ? `读取${label}技能` : `读取 ${label}技能`;
}

function isGeneratedImageCopy(command: string) {
  return command.includes("generated_images") && /\b(cp|copy|mv)\b/.test(command);
}

function looksLikeReadCommand(command: string) {
  return /\b(rg|grep|sed|head|tail|less|read)\b/.test(command);
}
