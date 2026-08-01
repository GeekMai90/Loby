/**
 * [INPUT]: 依赖 shared 公共契约、文本统计与写作活动模块
 * [OUTPUT]: 对外提供 ProjectInformation、单次扫描正文的 getProjectInformation
 * [POS]: 写作库 feature 的项目统计边界，一次物化文章数/字数/目标进度，避免消费方重复扫描同一批正文
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { WritingProject } from "@/shared/types";
import { sheetWordCount } from "@/shared/lib/text";
import { normalizeProjectGoal, projectGoalProgressForValue } from "@/features/writing-activity/model/writingGoals";

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
  const goal = normalizeProjectGoal(project);
  let totalWords = 0;
  let configuredCount = 0;
  let achievedCount = 0;

  for (const sheet of activeSheets) {
    const wordCount = sheetWordCount(sheet);
    totalWords += wordCount;
    if (sheet.targetWords <= 0) continue;
    configuredCount += 1;
    if (wordCount >= sheet.targetWords) achievedCount += 1;
  }

  const projectGoalCurrent = goal.unit === "articles" ? activeSheets.length : totalWords;

  return {
    articleCount: activeSheets.length,
    totalWords,
    projectGoal: {
      enabled: goal.enabled,
      unit: goal.unit,
      current: goal.enabled ? projectGoalCurrent : 0,
      target: goal.target,
      progress: projectGoalProgressForValue(goal, projectGoalCurrent),
    },
    articleGoal: {
      enabled: configuredCount > 0,
      configuredCount,
      achievedCount,
      progress: configuredCount > 0 ? Math.round((achievedCount / configuredCount) * 100) : 0,
    },
  };
}
