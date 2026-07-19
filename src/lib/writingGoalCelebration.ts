export const WRITING_GOAL_CELEBRATED_EVENT = "loby:writing-goal-celebrated";

export interface WritingGoalCelebratedDetail {
  sheetId: string;
  targetWords: number;
}

export function announceWritingGoalCelebrated(detail: WritingGoalCelebratedDetail) {
  window.dispatchEvent(new CustomEvent<WritingGoalCelebratedDetail>(WRITING_GOAL_CELEBRATED_EVENT, { detail }));
}
