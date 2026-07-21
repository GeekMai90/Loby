import { useEffect, useState, type CSSProperties } from "react";
import { WRITING_GOAL_CELEBRATED_EVENT, type WritingGoalCelebratedDetail } from "../lib/writingGoalCelebration";

interface WritingGoalProgressProps {
  sheetId: string;
  wordCount: number;
  targetWords: number;
}

export function WritingGoalProgress({ sheetId, wordCount, targetWords }: WritingGoalProgressProps) {
  const [celebrating, setCelebrating] = useState(false);
  const hasGoal = targetWords > 0;
  const progress = hasGoal ? Math.min(1, wordCount / targetWords) : 0;
  const progressStyle = { "--writing-goal-progress": `${progress * 100}%` } as CSSProperties;
  const goalState = !hasGoal ? "idle" : progress >= 1 ? "complete" : progress >= 0.95 ? "final" : progress >= 0.85 ? "near" : "active";
  const label = hasGoal
    ? `当前文稿 ${wordCount} 字，目标 ${targetWords} 字，完成 ${Math.round(progress * 100)}%`
    : `当前文稿 ${wordCount} 字`;

  useEffect(() => {
    let resetTimer: number | undefined;
    function handleCelebrated(event: Event) {
      const detail = (event as CustomEvent<WritingGoalCelebratedDetail>).detail;
      if (detail.sheetId !== sheetId || detail.targetWords !== targetWords) return;
      setCelebrating(true);
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => setCelebrating(false), 760);
    }

    window.addEventListener(WRITING_GOAL_CELEBRATED_EVENT, handleCelebrated);
    return () => {
      window.removeEventListener(WRITING_GOAL_CELEBRATED_EVENT, handleCelebrated);
      window.clearTimeout(resetTimer);
    };
  }, [sheetId, targetWords]);

  return (
    <div
      className="assistant-launcher writing-goal-progress-trigger relative grid size-10 place-items-center rounded-full"
      data-goal-state={goalState}
      data-celebrating={celebrating || undefined}
      role={hasGoal ? "progressbar" : "status"}
      aria-label={label}
      aria-valuemin={hasGoal ? 0 : undefined}
      aria-valuemax={hasGoal ? 100 : undefined}
      aria-valuenow={hasGoal ? Math.round(progress * 100) : undefined}
      title={
        hasGoal
          ? `${wordCount.toLocaleString("zh-CN")} / ${targetWords.toLocaleString("zh-CN")} 字`
          : `${wordCount.toLocaleString("zh-CN")} 字`
      }
    >
      <span className="assistant-launcher-glass writing-goal-progress-glass" aria-hidden="true">
        <span className="writing-goal-progress-reservoir">
          <span className="writing-goal-progress-fill" style={progressStyle}>
            <span className="assistant-launcher-fluid writing-goal-progress-fluid" />
          </span>
        </span>
      </span>
      <span className="writing-goal-progress-count pointer-events-none absolute max-w-6 truncate text-[8px] leading-none font-semibold tabular-nums">
        {wordCount.toLocaleString("zh-CN")}
      </span>
    </div>
  );
}
