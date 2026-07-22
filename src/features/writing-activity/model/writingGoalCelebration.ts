/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 WRITING_GOAL_CELEBRATED_EVENT、WritingGoalCelebratedDetail、announceWritingGoalCelebrated
 * [POS]: 写作活动 feature 的领域模型边界，集中 写作活动 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export const WRITING_GOAL_CELEBRATED_EVENT = "loby:writing-goal-celebrated";

export interface WritingGoalCelebratedDetail {
  sheetId: string;
  targetWords: number;
}

export function announceWritingGoalCelebrated(detail: WritingGoalCelebratedDetail) {
  window.dispatchEvent(new CustomEvent<WritingGoalCelebratedDetail>(WRITING_GOAL_CELEBRATED_EVENT, { detail }));
}
