/**
 * [INPUT]: 依赖 React 运行时、shared 公共契约、写作活动模块、canvas-confetti
 * [OUTPUT]: 对外提供 useArticleGoalCelebration
 * [POS]: 写作活动 feature 的React 协调边界，封装 写作活动 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useRef } from "react";
import type { WritingActivityStore, WritingSheet } from "@/shared/types";
import { showAppToast } from "@/shared/lib/appToast";
import { countWords } from "@/shared/lib/text";
import { hasCelebratedTarget } from "@/features/writing-activity/model/writingGoals";

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
