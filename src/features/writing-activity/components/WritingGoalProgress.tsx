/**
 * [INPUT]: 依赖 React 运行时、写作活动模块
 * [OUTPUT]: 对外提供 WritingGoalProgress
 * [POS]: 写作活动 feature 的界面组合单元，连接写作活动状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useId, useState } from "react";
import { WRITING_GOAL_CELEBRATED_EVENT, type WritingGoalCelebratedDetail } from "@/features/writing-activity/model/writingGoalCelebration";

interface WritingGoalProgressProps {
  sheetId: string;
  wordCount: number;
  targetWords: number;
}

const VIEW_SIZE = 38;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 14.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WritingGoalProgress({ sheetId, wordCount, targetWords }: WritingGoalProgressProps) {
  const ringId = useId().replaceAll(":", "");
  const [celebrating, setCelebrating] = useState(false);
  const glassGradientId = `writing-goal-glass-${ringId}`;
  const progressGradientId = `writing-goal-progress-${ringId}`;
  const hasGoal = targetWords > 0;
  const progress = hasGoal ? Math.min(1, wordCount / targetWords) : 0;
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
      className="writing-goal-progress-trigger relative grid size-[38px] place-items-center rounded-full text-foreground/65"
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
      <svg className="absolute inset-0 size-[38px] -rotate-90" viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} aria-hidden="true">
        <defs>
          <linearGradient id={glassGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop className="writing-goal-ring-glass-start" offset="0%" />
            <stop className="writing-goal-ring-glass-middle" offset="48%" />
            <stop className="writing-goal-ring-glass-end" offset="100%" />
          </linearGradient>
          <linearGradient id={progressGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop className="writing-goal-ring-progress-start" offset="0%" />
            <stop className="writing-goal-ring-progress-end" offset="100%" />
          </linearGradient>
        </defs>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke={`url(#${glassGradientId})`}
          strokeWidth="3.25"
          className="writing-goal-ring-glass"
        />
        {hasGoal && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={`url(#${progressGradientId})`}
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className="writing-goal-ring-progress transition-[stroke-dashoffset] duration-300"
          />
        )}
      </svg>
      <span className="relative max-w-7 truncate text-[8px] leading-none font-semibold tabular-nums">
        {wordCount.toLocaleString("zh-CN")}
      </span>
    </div>
  );
}
