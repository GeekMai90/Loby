import { useEffect, useRef } from "react";
import type { WritingActivityStore, WritingSheet } from "../types";
import { showAppToast } from "../lib/appToast";
import { countWords } from "../lib/text";
import { announceWritingGoalCelebrated } from "../lib/writingGoalCelebration";
import { hasCelebratedTarget } from "../lib/writingGoals";

const CONFETTI_LAUNCH_DURATION = 1_350;
const CONFETTI_BURST_INTERVAL = 55;

async function launchGoalConfetti() {
  const { default: confetti } = await import("canvas-confetti");
  const options = {
    particleCount: 3,
    spread: 44,
    startVelocity: 48,
    decay: 0.92,
    ticks: 320,
    gravity: 0.56,
    scalar: 0.84,
    disableForReducedMotion: true,
    zIndex: 200,
  } as const;
  const startedAt = performance.now();
  let lastBurstAt = startedAt - CONFETTI_BURST_INTERVAL;

  function launchFrame(now: number) {
    if (now - lastBurstAt >= CONFETTI_BURST_INTERVAL) {
      lastBurstAt = now;
      confetti({ ...options, angle: 72, origin: { x: 0.04, y: 0.98 } });
      confetti({ ...options, angle: 108, origin: { x: 0.96, y: 0.98 } });
    }
    if (now - startedAt < CONFETTI_LAUNCH_DURATION) {
      window.requestAnimationFrame(launchFrame);
    }
  }

  window.requestAnimationFrame(launchFrame);
}

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
    if (!sheet || sheet.targetWords <= 0) {
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
    announceWritingGoalCelebrated({ sheetId: current.sheetId, targetWords: current.target });
    showAppToast({
      variant: "success",
      title: "写作目标已达成",
      description: `本篇文章已完成 ${current.target.toLocaleString("zh-CN")} 字目标`,
      id: `writing-goal-${current.sheetId}-${current.target}`,
    });
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void launchGoalConfetti();
  }, [activity, enabled, onCelebrateTarget, ready, sheet]);
}
