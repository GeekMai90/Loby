import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface WritingGoalProgressProps {
  wordCount: number;
  targetWords: number;
  editable: boolean;
  onTargetWordsChange: (targetWords: number) => void;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WritingGoalProgress({ wordCount, targetWords, editable, onTargetWordsChange }: WritingGoalProgressProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(targetWords);
  const hasGoal = targetWords > 0;
  const progress = hasGoal ? Math.min(1, wordCount / targetWords) : 0;

  useEffect(() => setDraft(targetWords), [targetWords]);

  const trigger = hasGoal ? (
    <button
      type="button"
      className="relative grid size-12 place-items-center rounded-full text-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`当前文稿 ${wordCount} 字，目标 ${targetWords} 字，完成 ${Math.round(progress * 100)}%`}
      title={`${wordCount.toLocaleString("zh-CN")} / ${targetWords.toLocaleString("zh-CN")} 字`}
      disabled={!editable}
    >
      <svg className="absolute inset-0 size-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="text-primary transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="relative max-w-9 truncate text-[9px] leading-none font-semibold tabular-nums">
        {wordCount.toLocaleString("zh-CN")}
      </span>
    </button>
  ) : (
    <button
      type="button"
      className="rounded-full bg-card/60 px-1.5 py-0.5 text-[11px] leading-tight font-medium whitespace-nowrap text-foreground/45 shadow-xs outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none"
      aria-label={`当前文稿 ${wordCount} 字`}
      title={editable ? "设置当前文稿目标" : "当前文稿字数"}
      disabled={!editable}
    >
      {wordCount.toLocaleString("zh-CN")} 字
    </button>
  );

  if (!editable) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft <= 0) return;
            onTargetWordsChange(Math.round(draft));
            setOpen(false);
          }}
        >
          <div>
            <p className="text-sm font-semibold">单篇文章目标</p>
            <p className="mt-1 text-xs text-muted-foreground">按当前实际总字数计算，包括输入、粘贴和 AI 插入的内容。</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              step={1}
              value={draft || ""}
              placeholder="例如 1000"
              onChange={(event) => setDraft(Math.max(0, Number(event.target.value) || 0))}
              autoFocus
            />
            <span className="text-sm text-muted-foreground">字</span>
          </div>
          <div className="flex justify-end gap-2">
            {hasGoal && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onTargetWordsChange(0);
                  setOpen(false);
                }}
              >
                清除目标
              </Button>
            )}
            <Button type="submit" disabled={draft <= 0}>
              保存
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
