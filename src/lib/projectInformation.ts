import type { WritingProject } from "../types";
import { projectArticleGoalTarget } from "./documentProperties";
import { countWords } from "./text";
import { normalizeProjectGoal, projectGoalProgress, projectGoalValue } from "./writingGoals";

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
    targetWords: number;
    achievedCount: number;
    progress: number;
  };
}

export function getProjectInformation(project: WritingProject): ProjectInformation {
  const activeSheets = project.sheets.filter((sheet) => !sheet.archivedAt);
  const writingSheets = activeSheets.filter((sheet) => sheet.type === "正文" || sheet.type === "章节");
  const activeProject = { ...project, sheets: activeSheets };
  const totalWords = writingSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
  const goal = normalizeProjectGoal(project);
  const articleGoalTarget = projectArticleGoalTarget(activeProject);
  const achievedCount = articleGoalTarget > 0 ? writingSheets.filter((sheet) => countWords(sheet.body) >= articleGoalTarget).length : 0;

  return {
    articleCount: writingSheets.length,
    totalWords,
    projectGoal: {
      enabled: goal.enabled,
      unit: goal.unit,
      current: goal.enabled ? projectGoalValue(activeProject) : 0,
      target: goal.target,
      progress: goal.enabled ? projectGoalProgress(activeProject) : 0,
    },
    articleGoal: {
      enabled: articleGoalTarget > 0,
      targetWords: articleGoalTarget,
      achievedCount,
      progress: writingSheets.length > 0 ? Math.round((achievedCount / writingSheets.length) * 100) : 0,
    },
  };
}
