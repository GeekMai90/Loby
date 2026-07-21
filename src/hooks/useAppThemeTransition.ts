import { useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { ResolvedAppTheme } from "../types";

export const APP_THEME_TRANSITION_DURATION_MS = 700;

const LEFT_TO_RIGHT_CLIP_PATH = ["inset(0 100% 0 0)", "inset(0 0 0 0)"];

interface UseAppThemeTransitionOptions {
  resolvedTheme: ResolvedAppTheme;
  prefersReducedMotion: boolean;
}

export function useAppThemeTransition({ resolvedTheme, prefersReducedMotion }: UseAppThemeTransitionOptions) {
  const activeTransitionRef = useRef<ViewTransition | null>(null);

  useEffect(
    () => () => {
      activeTransitionRef.current?.skipTransition();
    },
    [],
  );

  return useCallback(
    (nextResolvedTheme: ResolvedAppTheme, applyChange: () => void) => {
      const root = document.documentElement;
      const activeTransition = activeTransitionRef.current;
      if (activeTransition) {
        activeTransitionRef.current = null;
        activeTransition.skipTransition();
      }

      const startViewTransition = document.startViewTransition?.bind(document);
      if (prefersReducedMotion || nextResolvedTheme === resolvedTheme || !startViewTransition) {
        applyChange();
        return;
      }

      let changeApplied = false;
      let transition: ViewTransition;
      try {
        transition = startViewTransition(() => {
          changeApplied = true;
          flushSync(applyChange);
        });
      } catch {
        if (!changeApplied) applyChange();
        return;
      }

      activeTransitionRef.current = transition;
      void transition.ready
        .then(
          () =>
            root.animate(
              { clipPath: LEFT_TO_RIGHT_CLIP_PATH },
              {
                duration: APP_THEME_TRANSITION_DURATION_MS,
                easing: "ease-in-out",
                pseudoElement: "::view-transition-new(root)",
              },
            ).finished,
        )
        .catch(() => undefined);

      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (activeTransitionRef.current !== transition) return;
          activeTransitionRef.current = null;
        });
    },
    [prefersReducedMotion, resolvedTheme],
  );
}
