/**
 * [INPUT]: 依赖 shared AI action 与 agent run 契约
 * [OUTPUT]: 对外提供生成图片来源关联、运行产物收集与跨 run/action 展示去重
 * [POS]: AI 助手图片成果的身份归一化边界，让临时生成路径与持久化图片动作共享同一来源标识
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity, AiAction } from "@/shared/types";

const LOCAL_IMAGE_PATTERN = /^\/.*\.(?:png|jpe?g|webp|gif)$/i;

export function linkGeneratedImageActions(actions: AiAction[], activities: AgentRunActivity[]): AiAction[] {
  const artifactPaths = collectRunImageArtifactPaths(activities);
  if (artifactPaths.length === 0) return actions;

  return actions.map((action) => {
    if (action.type !== "insertImage" || isLocalImagePath(action.sourceArtifactPath)) return action;
    const sourceArtifactPath = findSourceArtifactPath(action, artifactPaths, activities);
    return sourceArtifactPath ? { ...action, sourceArtifactPath } : action;
  });
}

export function collectVisibleRunImageArtifactPaths(activities: AgentRunActivity[], renderableActions: AiAction[] = []): string[] {
  const artifactPaths = collectRunImageArtifactPaths(activities);
  if (artifactPaths.length === 0 || renderableActions.length === 0) return artifactPaths;

  const linkedActions = linkGeneratedImageActions(renderableActions, activities);
  const actionSourcePaths = new Set(linkedActions.map((action) => action.sourceArtifactPath?.trim() || "").filter(isLocalImagePath));
  return artifactPaths.filter((path) => !actionSourcePaths.has(path));
}

export function collectRunImageArtifactPaths(activities: AgentRunActivity[]): string[] {
  return Array.from(new Set(activities.map((activity) => activity.artifactPath?.trim() || "").filter(isLocalImagePath)));
}

function findSourceArtifactPath(action: AiAction, artifactPaths: string[], activities: AgentRunActivity[]) {
  const actionPath = stringValue(action.payload.path);
  if (isLocalImagePath(actionPath) && artifactPaths.includes(actionPath)) return actionPath;

  const actionFilename = getFilename(actionPath);
  if (!actionFilename) return "";
  return (
    artifactPaths.find((artifactPath) =>
      activities.some((activity) => activity.command.includes(artifactPath) && activity.command.includes(actionFilename)),
    ) || ""
  );
}

function getFilename(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) || "";
}

function isLocalImagePath(path: string | undefined): path is string {
  return Boolean(path && LOCAL_IMAGE_PATTERN.test(path.trim()));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
