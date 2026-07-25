/**
 * [INPUT]: 依赖 shared 公共契约、文本统计与写作活动模块
 * [OUTPUT]: 对外提供 ProjectInformation、getProjectInformation
 * [POS]: 写作库 feature 的领域模型边界，集中 写作库 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject } from "@/shared/types";
import { countWords } from "@/shared/lib/text";
import { normalizeProjectGoal, projectGoalProgress, projectGoalValue } from "@/features/writing-activity/model/writingGoals";

export interface ProjectInformation {
  articleCount: number;
  totalWords: number;
  projectGoal: {
    enabled: boolean;
    unit: "words" | "articles";
    current: number;
    target: number;
    progress: number;
  };
  articleGoal: {
    enabled: boolean;
    configuredCount: number;
    achievedCount: number;
    progress: number;
  };
}

export function getProjectInformation(project: WritingProject): ProjectInformation {
  const activeSheets = project.sheets.filter((sheet) => !sheet.archivedAt);
  const activeProject = { ...project, sheets: activeSheets };
  const totalWords = activeSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
  const goal = normalizeProjectGoal(project);
  const sheetsWithGoal = activeSheets.filter((sheet) => sheet.targetWords > 0);
  const achievedCount = sheetsWithGoal.filter((sheet) => countWords(sheet.body) >= sheet.targetWords).length;

  return {
    articleCount: activeSheets.length,
    totalWords,
    projectGoal: {
      enabled: goal.enabled,
      unit: goal.unit,
      current: goal.enabled ? projectGoalValue(activeProject) : 0,
      target: goal.target,
      progress: goal.enabled ? projectGoalProgress(activeProject) : 0,
    },
    articleGoal: {
      enabled: sheetsWithGoal.length > 0,
      configuredCount: sheetsWithGoal.length,
      achievedCount,
      progress: sheetsWithGoal.length > 0 ? Math.round((achievedCount / sheetsWithGoal.length) * 100) : 0,
    },
  };
}
