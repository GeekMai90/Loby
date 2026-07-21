export const WORD_COUNT_AUTO_REVEAL_DURATION_MS = 2800;

export function nextWordCountMilestone(previousWordCount: number, wordCount: number, highestRevealedMilestone: number): number | null {
  if (wordCount <= previousWordCount) return null;
  const milestone = Math.floor(wordCount / 100) * 100;
  if (milestone < 100 || milestone <= highestRevealedMilestone) return null;
  return milestone;
}

export function resolveAssistantGoalMotionState(wordCount: number, targetWords: number) {
  if (targetWords <= 0) return "idle";
  const progress = wordCount / targetWords;
  if (progress >= 1) return "complete";
  if (progress >= 0.95) return "final";
  if (progress >= 0.85) return "near";
  return "active";
}
