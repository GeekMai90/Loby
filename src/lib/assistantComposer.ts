import type { AiDocumentReference, AiMountedContext, CodexModelCatalog, CodexSkill } from "../types";

interface ImeKeyboardEvent {
  isComposing?: boolean;
  keyCode?: number;
}

export function isImeCompositionKey(event: ImeKeyboardEvent, compositionActive = false) {
  return compositionActive || event.isComposing === true || event.keyCode === 229;
}

export function getSkillSlashTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)\/([^\s/]*)$/);
  if (!match || typeof match.index !== "number") return null;
  const slashOffset = match[0].lastIndexOf("/");
  const from = match.index + slashOffset;
  return {
    from,
    to: cursor,
    query: match[1] ?? "",
  };
}

export function getDocumentMentionTrigger(value: string, cursor: number) {
  const beforeCursor = value.slice(0, cursor);
  const match = beforeCursor.match(/(?:^|\s)@([^\s@/]*)$/);
  if (!match || typeof match.index !== "number") return null;
  const mentionOffset = match[0].lastIndexOf("@");
  const from = match.index + mentionOffset;
  return {
    from,
    to: cursor,
    query: match[1] ?? "",
  };
}

export function filterSkillSuggestions(skills: CodexSkill[], query: string, mountedSkills: CodexSkill[]) {
  const mountedPaths = new Set(mountedSkills.map((skill) => skill.path));
  const needle = query.trim().toLowerCase();
  return skills
    .filter((skill) => !mountedPaths.has(skill.path))
    .map((skill, index) => ({ skill, index, score: scoreSkillSuggestion(skill, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.skill);
}

export function filterDocumentSuggestions(documents: AiDocumentReference[], query: string, mountedContexts: AiMountedContext[]) {
  const mountedSheetIds = new Set(mountedContexts.filter((context) => context.type === "document").map((context) => context.sheetId));
  const needle = query.trim().toLowerCase();
  return documents
    .filter((document) => !mountedSheetIds.has(document.sheetId))
    .map((document, index) => ({ document, index, score: scoreDocumentSuggestion(document, needle) }))
    .filter((item) => item.score !== null)
    .sort((left, right) => (left.score ?? 0) - (right.score ?? 0) || left.index - right.index)
    .map((item) => item.document);
}

export function getReasoningLevels(catalog: CodexModelCatalog | null, modelSlug: string, current: string) {
  const model = catalog?.models.find((item) => item.slug === modelSlug);
  const levels = model?.supportedReasoningLevels.map((level) => level.effort).filter(Boolean) ?? [];
  const withCurrent = current && !levels.includes(current) ? [...levels, current] : levels;
  return withCurrent.length > 0 ? withCurrent : ["low", "medium", "high"];
}

export function buildModelOptions(catalog: CodexModelCatalog | null, current: string) {
  const options =
    catalog?.models.map((model) => ({
      value: model.slug,
      label: model.displayName || model.slug,
    })) ?? [];
  if (current && !options.some((option) => option.value === current)) {
    return [...options, { value: current, label: current }];
  }
  return options.length > 0 ? options : [{ value: current || "auto", label: current || "auto" }];
}

export function formatReasoningLevel(level: string) {
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
    xhigh: "极高",
  };
  return labels[level] ?? level;
}

export function modelSupportsQuickMode(catalog: CodexModelCatalog | null, modelSlug: string) {
  const model = catalog?.models.find((item) => item.slug === modelSlug);
  return Boolean(model?.additionalSpeedTiers.includes("fast") || model?.serviceTiers.some((tier) => tier.id === "priority"));
}

function scoreDocumentSuggestion(document: AiDocumentReference, needle: string) {
  if (!needle) return 10;
  const title = document.title.toLowerCase();
  const subtitle = document.subtitle.toLowerCase();
  const summary = document.summary.toLowerCase();
  if (title.startsWith(needle)) return 0;
  if (title.includes(needle)) return 1;
  if (subtitle.includes(needle)) return 2;
  if (summary.includes(needle)) return 3;
  return null;
}

function scoreSkillSuggestion(skill: CodexSkill, needle: string) {
  const name = skill.name.toLowerCase();
  const id = skill.id.toLowerCase();
  const description = skill.description.toLowerCase();
  if (!needle) return 10;
  if (name.startsWith(needle)) return 0;
  if (id.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  if (id.includes(needle)) return 3;
  if (description.includes(needle)) return 4;
  return null;
}
