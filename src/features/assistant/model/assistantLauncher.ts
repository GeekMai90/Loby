/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 WORD_COUNT_AUTO_REVEAL_DURATION_MS、nextWordCountMilestone、resolveAssistantGoalMotionState
 * [POS]: AI 助手 feature 的领域模型边界，集中 AI 助手 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
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
