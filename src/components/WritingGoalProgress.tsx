import { useId } from "react";

interface WritingGoalProgressProps {
  wordCount: number;
  targetWords: number;
}

const VIEW_SIZE = 38;
const CENTER = VIEW_SIZE / 2;
const RADIUS = 14.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WritingGoalProgress({ wordCount, targetWords }: WritingGoalProgressProps) {
  const ringId = useId().replaceAll(":", "");
  const glassGradientId = `writing-goal-glass-${ringId}`;
  const progressGradientId = `writing-goal-progress-${ringId}`;
  const hasGoal = targetWords > 0;
  const progress = hasGoal ? Math.min(1, wordCount / targetWords) : 0;
  const label = hasGoal
    ? `当前文稿 ${wordCount} 字，目标 ${targetWords} 字，完成 ${Math.round(progress * 100)}%`
    : `当前文稿 ${wordCount} 字`;

  return (
    <div
      className="writing-goal-progress-trigger relative grid size-[38px] place-items-center rounded-full text-foreground/65"
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
