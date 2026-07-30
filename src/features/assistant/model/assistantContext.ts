/**
 * [INPUT]: 依赖 shared 公共契约
 * [OUTPUT]: 对外提供 buildChatContextPreviews、resolveMountedContextsFromPreviews、buildMountedContexts、buildAvailableDocuments、normalizeSelectionContextText、getChatContextContentMode、getChatContextContentModeLabel、getChatContextContentModeDescription 等公开能力
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { AiDocumentReference, AiMountedContext, ChatContextPreview, WritingProject, WritingSheet } from "@/shared/types";

export function buildChatContextPreviews(contexts: AiMountedContext[], showDocumentContext: boolean): ChatContextPreview[] {
  return contexts.map((context) => ({
    id: context.id,
    type: context.type,
    contentMode: context.type === "document" ? "live" : "snapshot",
    sheetId: context.sheetId,
    projectId: context.projectId,
    title: context.title,
    subtitle: context.subtitle,
    excerpt: context.type === "document" ? context.title : truncateContextExcerpt(context.content),
    content: context.type === "selection" ? context.content : undefined,
    visible: context.type === "document" ? showDocumentContext : true,
  }));
}

export function resolveMountedContextsFromPreviews(
  previews: ChatContextPreview[],
  activeSheet: WritingSheet,
  availableDocuments: AiDocumentReference[],
): AiMountedContext[] {
  return previews
    .map((preview): AiMountedContext | null => {
      if (preview.type === "document") {
        const sheetId = preview.sheetId || preview.id.replace(/^document:/, "");
        const document = availableDocuments.find((item) => item.sheetId === sheetId);
        if (!document) return null;
        // Document contexts are live references: replaying an edited message should read
        // the current local sheet body instead of persisting full-body snapshots in chat history.
        return {
          id: `document:${document.sheetId}`,
          type: "document",
          projectId: document.projectId,
          sheetId: document.sheetId,
          title: document.title || preview.title || "未命名文档",
          subtitle: document.sheetId === activeSheet.id ? "当前文稿" : document.subtitle,
          content: document.content,
        };
      }

      // Selection contexts are snapshots: the selected text may no longer exist in
      // the editor by the time a user edits and resends an older message.
      const content = preview.content || preview.excerpt;
      if (!content.trim()) return null;
      return {
        id: preview.id || `selection:${activeSheet.id}`,
        type: "selection",
        projectId: preview.projectId,
        sheetId: preview.sheetId || activeSheet.id,
        title: preview.title || buildSelectionTitle(content),
        subtitle: preview.subtitle || "选区",
        content,
      };
    })
    .filter((context): context is AiMountedContext => Boolean(context));
}

export function buildMountedContexts(
  activeSheet: WritingSheet | undefined,
  availableDocuments: AiDocumentReference[],
  mountedSheetIds: string[],
  mountedSelectionText: string,
): AiMountedContext[] {
  const contexts: AiMountedContext[] = [];
  for (const sheetId of mountedSheetIds) {
    const document = availableDocuments.find((item) => item.sheetId === sheetId);
    if (!document) continue;
    contexts.push({
      id: `document:${document.sheetId}`,
      type: "document",
      projectId: document.projectId,
      sheetId: document.sheetId,
      title: document.title || "未命名文档",
      subtitle: document.sheetId === activeSheet?.id ? "当前文稿" : document.subtitle,
      content: document.content,
    });
  }

  if (activeSheet && mountedSelectionText) {
    contexts.push({
      id: `selection:${activeSheet.id}`,
      type: "selection",
      projectId: undefined,
      sheetId: activeSheet.id,
      title: buildSelectionTitle(mountedSelectionText),
      subtitle: "选区",
      content: mountedSelectionText,
    });
  }

  return contexts;
}

export function buildAvailableDocuments(projects: WritingProject[]): AiDocumentReference[] {
  return projects.flatMap((project) => {
    const groups = project.groups ?? [];
    return project.sheets.map((sheet) => {
      const group = groups.find((item) => item.id === sheet.groupId);
      return {
        id: `${project.id}:${sheet.id}`,
        projectId: project.id,
        sheetId: sheet.id,
        title: sheet.title || "未命名文档",
        subtitle: [project.title, group?.title].filter(Boolean).join(" / "),
        summary: sheet.description,
        content: sheet.body,
      };
    });
  });
}

export function normalizeSelectionContextText(text: string): string {
  return text.trim();
}

export function getChatContextContentMode(context: ChatContextPreview): "live" | "snapshot" {
  if (context.contentMode) return context.contentMode;
  return context.type === "document" ? "live" : "snapshot";
}

export function getChatContextContentModeLabel(context: ChatContextPreview): string {
  return getChatContextContentMode(context) === "live" ? "实时" : "快照";
}

export function getChatContextContentModeDescription(context: ChatContextPreview): string {
  return getChatContextContentMode(context) === "live" ? "编辑重发时会读取当前本地文稿内容" : "编辑重发时会使用发送时保存的选区文字";
}

export function getChatContextDisplayLabel(context: ChatContextPreview): string {
  return context.type === "document" ? context.title : context.excerpt || context.title;
}

export function getChatContextDisplayDescription(context: ChatContextPreview): string {
  return [
    `${context.type === "document" ? "文档" : "选区"}：${getChatContextDisplayLabel(context)}`,
    context.subtitle ? `来源：${context.subtitle}` : "",
    getChatContextContentModeDescription(context),
  ]
    .filter(Boolean)
    .join("\n");
}

export function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function truncateContextExcerpt(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= 44) return normalized;
  return `${normalized.slice(0, 44)}...`;
}

function buildSelectionTitle(text: string): string {
  const firstLine = text.replace(/\s+/g, " ").trim();
  if (!firstLine) return "选中的文字范围";
  return firstLine.length > 24 ? `${firstLine.slice(0, 24)}...` : firstLine;
}
