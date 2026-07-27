/**
 * [INPUT]: 依赖 Loby Agent Runtime 的稳定 activity 契约
 * [OUTPUT]: 对外提供 buildRunDisplayActivities，归并同一工具生命周期并把回复步骤放到末尾
 * [POS]: AI 助手 feature 的运行展示边界，不解析 Provider 私有事件或本地命令文本
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity } from "@/shared/types";

export function buildRunDisplayActivities(activities: AgentRunActivity[]): AgentRunActivity[] {
  const visible = activities.map(presentActivity).filter(isVisibleActivity);
  const merged = visible.reduce<AgentRunActivity[]>((result, activity) => {
    const previous = result.at(-1);
    if (previous && previous.id === activity.id) {
      result[result.length - 1] = mergeActivity(previous, activity);
    } else {
      result.push(activity);
    }
    return result;
  }, []);
  const responses = merged.filter((activity) => activity.title === "生成回复");
  return [...merged.filter((activity) => activity.title !== "生成回复"), ...responses];
}

function presentActivity(activity: AgentRunActivity): AgentRunActivity {
  const rawType = activity.rawType.toLowerCase();
  const reasoning = rawType.includes("reasoning") || activity.title.includes("思考过程");
  return {
    ...activity,
    title: reasoning
      ? "整理思路"
      : rawType.includes("agentmessage") || activity.title.includes("生成回复")
        ? "生成回复"
        : rawType.includes("imagegeneration") || activity.title.includes("生成图片")
          ? "生成图片"
          : rawType.includes("websearch") || activity.title.includes("搜索资料")
            ? "搜索资料"
            : activity.title,
    text: activity.text || (reasoning ? activity.output : ""),
    output: reasoning && !activity.text ? "" : activity.output,
  };
}

function isVisibleActivity(activity: AgentRunActivity) {
  return Boolean(
    activity.title.trim() || activity.text.trim() || activity.output.trim() || activity.artifactPath || activity.status === "failed",
  );
}

function mergeActivity(previous: AgentRunActivity, current: AgentRunActivity): AgentRunActivity {
  return {
    ...previous,
    ...current,
    title: current.title || previous.title,
    status: current.status || previous.status,
    command: current.command || previous.command,
    output: current.output || previous.output,
    text: current.text || previous.text,
    artifactPath: current.artifactPath || previous.artifactPath,
    exitCode: current.exitCode ?? previous.exitCode,
  };
}
