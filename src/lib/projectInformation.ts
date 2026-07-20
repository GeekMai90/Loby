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
  const activeProject = { ...project, sheets: activeSheets };
  const totalWords = activeSheets.reduce((total, sheet) => total + countWords(sheet.body), 0);
  const goal = normalizeProjectGoal(project);
  const articleGoalTarget = projectArticleGoalTarget(activeProject);
  const achievedCount = articleGoalTarget > 0 ? activeSheets.filter((sheet) => countWords(sheet.body) >= articleGoalTarget).length : 0;

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
      enabled: articleGoalTarget > 0,
      targetWords: articleGoalTarget,
      achievedCount,
      progress: activeSheets.length > 0 ? Math.round((achievedCount / activeSheets.length) * 100) : 0,
    },
  };
}
