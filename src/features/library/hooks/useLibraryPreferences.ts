/**
 * [INPUT]: 依赖 React 运行时、写作库模块、shared 公共契约
 * [OUTPUT]: 对外提供 useLibraryPreferences
 * [POS]: 写作库 feature 的React 协调边界，封装 写作库 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadLibraryPreferences, saveLibraryPreferences } from "@/features/library/model/persistence";
import { cloneLibraryPreferences, normalizeLibraryPreferences } from "@/features/library/model/libraryPreferences";
import type { LibraryPreferences } from "@/shared/types";

interface PendingSave {
  path: string;
  preferences: LibraryPreferences;
}

export function useLibraryPreferences(options: {
  libraryPath: string;
  persistenceReady: boolean;
  fallback: LibraryPreferences;
  preferences: LibraryPreferences;
  onHydrate: (preferences: LibraryPreferences) => void;
}) {
  const { libraryPath, persistenceReady, fallback, preferences, onHydrate } = options;
  const [hydratedPath, setHydratedPath] = useState("");
  const fallbackRef = useRef(fallback);
  const onHydrateRef = useRef(onHydrate);
  const pendingRef = useRef<PendingSave | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);

  useEffect(() => {
    onHydrateRef.current = onHydrate;
  }, [onHydrate]);

  const flushPending = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) void saveLibraryPreferences(pending.preferences, pending.path).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!persistenceReady || !libraryPath) return;
    flushPending();
    let cancelled = false;
    setHydratedPath("");
    loadLibraryPreferences(libraryPath)
      .then((stored) => {
        if (cancelled) return;
        const normalized = stored ? normalizeLibraryPreferences(stored, fallbackRef.current) : cloneLibraryPreferences(fallbackRef.current);
        onHydrateRef.current(normalized);
        setHydratedPath(libraryPath);
      })
      .catch(() => {
        if (cancelled) return;
        onHydrateRef.current(cloneLibraryPreferences(fallbackRef.current));
        setHydratedPath(libraryPath);
      });
    return () => {
      cancelled = true;
    };
  }, [flushPending, libraryPath, persistenceReady]);

  useEffect(() => {
    if (!persistenceReady || hydratedPath !== libraryPath) return;
    pendingRef.current = { path: libraryPath, preferences: cloneLibraryPreferences(preferences) };
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => flushPending(), 250);
  }, [flushPending, hydratedPath, libraryPath, persistenceReady, preferences]);

  useEffect(
    () => () => {
      flushPending();
    },
    [flushPending],
  );

  return { ready: Boolean(libraryPath) && hydratedPath === libraryPath };
}
