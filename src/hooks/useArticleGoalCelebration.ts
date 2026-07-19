import { useEffect, useRef } from "react";
import type { WritingActivityStore, WritingSheet } from "../types";
import { countWords } from "../lib/text";
import { hasCelebratedTarget } from "../lib/writingGoals";

interface GoalSnapshot {
  sheetId: string;
  target: number;
  count: number;
}

export function useArticleGoalCelebration(options: {
  sheet: WritingSheet | undefined;
  activity: WritingActivityStore;
  ready: boolean;
  enabled: boolean;
  onCelebrateTarget: (sheetId: string, target: number) => void;
}) {
  const { sheet, activity, ready, enabled, onCelebrateTarget } = options;
  const previousRef = useRef<GoalSnapshot | null>(null);

  useEffect(() => {
    if (!sheet || sheet.targetWords <= 0 || (sheet.type !== "正文" && sheet.type !== "章节")) {
      previousRef.current = null;
      return;
    }
    const current = { sheetId: sheet.id, target: sheet.targetWords, count: countWords(sheet.body) };
    const previous = previousRef.current;
    previousRef.current = current;
    if (
      !ready ||
      !previous ||
      previous.sheetId !== current.sheetId ||
      previous.target !== current.target ||
      previous.count >= current.target ||
      current.count < current.target ||
      hasCelebratedTarget(activity, current.sheetId, current.target)
    ) {
      return;
    }

    onCelebrateTarget(current.sheetId, current.target);
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void import("canvas-confetti").then(({ default: confetti }) => {
      const options = {
        particleCount: 34,
        spread: 55,
        startVelocity: 34,
        ticks: 150,
        gravity: 0.9,
        scalar: 0.8,
        disableForReducedMotion: true,
        zIndex: 200,
      } as const;
      confetti({ ...options, angle: 58, origin: { x: 0.04, y: 0.96 } });
      confetti({ ...options, angle: 122, origin: { x: 0.96, y: 0.96 } });
    });
  }, [activity, enabled, onCelebrateTarget, ready, sheet]);
}
