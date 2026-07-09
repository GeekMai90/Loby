import type { AiDocumentReference, AiMountedContext, ChatContextPreview, WritingProject, WritingSheet } from "../types";

export function buildChatContextPreviews(contexts: AiMountedContext[], showDocumentContext: boolean): ChatContextPreview[] {
  return contexts.map((context) => ({
    id: context.id,
    type: context.type,
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
        subtitle: [project.title, group?.title, sheet.type].filter(Boolean).join(" / "),
        type: sheet.type,
        status: sheet.status,
        summary: sheet.summary,
        content: sheet.body,
      };
    });
  });
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
