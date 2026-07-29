/**
 * [INPUT]: 依赖 shared AI action、消息与 agent run 契约
 * [OUTPUT]: 对外提供单轮及跨轮生成图片来源关联、多图 action 合并/展开、运行产物收集、run/action 展示去重，以及移除旧格式提示的稳定路径提升
 * [POS]: AI 助手图片成果的身份归一化边界，让缓存源产物在确认前跨消息保持身份，并将同轮多图提升为一个可原子执行的批量动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AgentRunActivity, AiAction, ChatMessage } from "@/shared/types";

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

export function consolidateGeneratedImageActions(actions: AiAction[]): AiAction[] {
  const imageActions = actions.filter((action) => action.type === "insertImage");
  if (imageActions.length < 2 || !shareImageActionTarget(imageActions)) return actions;

  const firstImageIndex = actions.findIndex((action) => action.type === "insertImage");
  const first = imageActions[0];
  const batch: AiAction = {
    ...first,
    type: "insertImages",
    title: `插入 ${imageActions.length} 张图片`,
    summary: `将生成的 ${imageActions.length} 张图片分别插入文稿中的指定位置。`,
    payload: {
      items: imageActions.map((action) => ({
        ...action.payload,
        title: action.title,
        summary: action.summary,
        sourceArtifactPath: action.sourceArtifactPath,
      })),
    },
    sourceArtifactPath: undefined,
  };
  return actions.flatMap((action, index) => {
    if (index === firstImageIndex) return [batch];
    return action.type === "insertImage" ? [] : [action];
  });
}

export function expandImageActions(action: AiAction): AiAction[] {
  if (action.type === "insertImage") return [action];
  if (action.type !== "insertImages") return [];
  const items = Array.isArray(action.payload.items) ? action.payload.items : [];
  return items.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const payload = { ...(item as Record<string, unknown>) };
    const sourceArtifactPath = stringValue(payload.sourceArtifactPath);
    const title = stringValue(payload.title) || `插入图片 ${index + 1}`;
    const summary = stringValue(payload.summary) || action.summary;
    delete payload.sourceArtifactPath;
    delete payload.title;
    delete payload.summary;
    return [
      {
        ...action,
        id: `${action.id}-image-${index + 1}`,
        type: "insertImage" as const,
        title,
        summary,
        payload,
        sourceArtifactPath: sourceArtifactPath || undefined,
      },
    ];
  });
}

export function collectConversationImageArtifactActivities(messages: ChatMessage[]): AgentRunActivity[] {
  return messages.flatMap((message) => message.run?.activities ?? []).filter((activity) => isLocalImagePath(activity.artifactPath));
}

export function linkConversationGeneratedImageActions(messages: ChatMessage[]): ChatMessage[] {
  const precedingActivities: AgentRunActivity[] = [];
  return messages.map((message) => {
    precedingActivities.push(...(message.run?.activities ?? []).filter((activity) => isLocalImagePath(activity.artifactPath)));
    return message.actions
      ? { ...message, actions: consolidateGeneratedImageActions(linkGeneratedImageActions(message.actions, precedingActivities)) }
      : message;
  });
}

export function collectVisibleRunImageArtifactPaths(activities: AgentRunActivity[], renderableActions: AiAction[] = []): string[] {
  const artifactPaths = collectRunImageArtifactPaths(activities);
  if (artifactPaths.length === 0 || renderableActions.length === 0) return artifactPaths;

  const linkedActions = linkGeneratedImageActions(renderableActions.flatMap(expandImageActions), activities);
  const actionSourcePaths = new Set(linkedActions.map((action) => action.sourceArtifactPath?.trim() || "").filter(isLocalImagePath));
  return artifactPaths.filter((path) => !actionSourcePaths.has(path));
}

function shareImageActionTarget(actions: AiAction[]) {
  const first = actions[0];
  if (first.status !== "proposed") return false;
  return actions.every(
    (action) =>
      action.status === "proposed" && action.targetProjectId === first.targetProjectId && action.targetSheetId === first.targetSheetId,
  );
}

export function collectRunImageArtifactPaths(activities: AgentRunActivity[]): string[] {
  return Array.from(new Set(activities.map((activity) => activity.artifactPath?.trim() || "").filter(isLocalImagePath)));
}

export function promoteGeneratedImageAction(action: AiAction, durablePath: string): AiAction {
  const portablePayload = { ...action.payload };
  delete portablePayload.format;
  return {
    ...action,
    payload: { ...portablePayload, path: durablePath },
    sourceArtifactPath: undefined,
  };
}

function findSourceArtifactPath(action: AiAction, artifactPaths: string[], activities: AgentRunActivity[]) {
  const actionPath = stringValue(action.payload.path);
  if (isLocalImagePath(actionPath) && artifactPaths.includes(actionPath)) return actionPath;

  const actionFilename = getFilename(actionPath);
  if (!actionFilename) return "";
  return (
    artifactPaths.find((artifactPath) => getFilename(artifactPath) === actionFilename) ||
    artifactPaths.find((artifactPath) =>
      activities.some((activity) => activity.command.includes(artifactPath) && activity.command.includes(actionFilename)),
    ) ||
    ""
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
