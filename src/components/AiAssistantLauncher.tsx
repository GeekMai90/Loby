import { Button } from "@/components/ui/button";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { nextWordCountMilestone, resolveAssistantGoalMotionState, WORD_COUNT_AUTO_REVEAL_DURATION_MS } from "../lib/assistantLauncher";

interface AiAssistantLauncherProps {
  sheetId: string;
  wordCount: number;
  targetWords: number;
  onOpen: () => void;
}

export function AiAssistantLauncher({ sheetId, wordCount, targetWords, onOpen }: AiAssistantLauncherProps) {
  const labelId = useId();
  const prefersReducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [automaticReveal, setAutomaticReveal] = useState(false);
  const countStateRef = useRef({
    sheetId,
    wordCount,
    highestRevealedMilestone: Math.floor(wordCount / 100) * 100,
  });
  const hideTimerRef = useRef<number | undefined>(undefined);
  const visible = hovered || focused || automaticReveal;
  const goalMotionState = resolveAssistantGoalMotionState(wordCount, targetWords);

  useEffect(() => {
    const countState = countStateRef.current;
    if (countState.sheetId !== sheetId) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
      countStateRef.current = {
        sheetId,
        wordCount,
        highestRevealedMilestone: Math.floor(wordCount / 100) * 100,
      };
      setAutomaticReveal(false);
      return;
    }

    const milestone = nextWordCountMilestone(countState.wordCount, wordCount, countState.highestRevealedMilestone);
    countState.wordCount = wordCount;
    if (milestone === null) return;

    countState.highestRevealedMilestone = milestone;
    setAutomaticReveal(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setAutomaticReveal(false);
      hideTimerRef.current = undefined;
    }, WORD_COUNT_AUTO_REVEAL_DURATION_MS);
  }, [sheetId, wordCount]);

  useEffect(
    () => () => {
      window.clearTimeout(hideTimerRef.current);
    },
    [],
  );

  return (
    <div
      className="assistant-launcher-control"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <AnimatePresence initial={false}>
        {visible ? (
          <motion.output
            id={labelId}
            key="word-count"
            className="assistant-word-count"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.72, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.68, filter: "blur(3px)" }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.26, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-live={automaticReveal ? "polite" : "off"}
          >
            {wordCount.toLocaleString("zh-CN")} 字
          </motion.output>
        ) : null}
      </AnimatePresence>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="assistant-launcher size-10 rounded-full p-0 active:translate-y-0"
        data-goal-state={goalMotionState}
        onClick={onOpen}
        aria-label={`打开 AI 助手，当前文稿 ${wordCount.toLocaleString("zh-CN")} 字`}
        aria-describedby={visible ? labelId : undefined}
      >
        <span className="assistant-launcher-glass" aria-hidden="true">
          <span className="assistant-launcher-fluid" />
        </span>
      </Button>
    </div>
  );
}
