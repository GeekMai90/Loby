import { useCallback, useEffect, useRef, useState } from "react";
import { loadLibraryPreferences, saveLibraryPreferences } from "../lib/persistence";
import { cloneLibraryPreferences, normalizeLibraryPreferences } from "../lib/libraryPreferences";
import type { LibraryPreferences } from "../types";

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
