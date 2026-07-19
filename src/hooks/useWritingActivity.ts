import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadWritingActivity, saveWritingActivity } from "../lib/persistence";
import {
  deriveWritingCheckIns,
  EMPTY_WRITING_ACTIVITY,
  mergeWritingCheckIns,
  normalizeWritingActivity,
  withCelebratedTarget,
  writingDates,
  writingStreaks,
} from "../lib/writingGoals";
import type { WritingActivityStore, WritingProject } from "../types";

export function useWritingActivity(options: { projects: WritingProject[]; libraryPath: string; persistenceReady: boolean }) {
  const { projects, libraryPath, persistenceReady } = options;
  const [activity, setActivity] = useState<WritingActivityStore>(EMPTY_WRITING_ACTIVITY);
  const [hydratedPath, setHydratedPath] = useState("");
  const previousProjectsRef = useRef(projects);

  useEffect(() => {
    if (!persistenceReady || !libraryPath) return;
    let cancelled = false;
    setHydratedPath("");
    loadWritingActivity(libraryPath)
      .then((stored) => {
        if (cancelled) return;
        const normalized = normalizeWritingActivity(stored);
        setActivity(normalized);
        setHydratedPath(libraryPath);
      })
      .catch(() => {
        if (cancelled) return;
        setActivity(EMPTY_WRITING_ACTIVITY);
        setHydratedPath(libraryPath);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryPath, persistenceReady]);

  useEffect(() => {
    const previousProjects = previousProjectsRef.current;
    previousProjectsRef.current = projects;
    if (!persistenceReady || hydratedPath !== libraryPath) return;
    setActivity((current) => {
      const checkIns = mergeWritingCheckIns(current.checkIns, deriveWritingCheckIns(projects, undefined, previousProjects));
      return checkIns.length === current.checkIns.length && checkIns.every((item, index) => item === current.checkIns[index])
        ? current
        : { ...current, checkIns };
    });
  }, [hydratedPath, libraryPath, persistenceReady, projects]);

  useEffect(() => {
    if (!persistenceReady || hydratedPath !== libraryPath) return;
    void saveWritingActivity(activity, libraryPath);
  }, [activity, hydratedPath, libraryPath, persistenceReady]);

  const recordCelebratedTarget = useCallback((sheetId: string, target: number) => {
    setActivity((current) => withCelebratedTarget(current, sheetId, target));
  }, []);
  const dates = useMemo(() => writingDates(activity.checkIns), [activity.checkIns]);
  const streaks = useMemo(() => writingStreaks(dates), [dates]);

  return { activity, dates, streaks, ready: Boolean(libraryPath) && hydratedPath === libraryPath, recordCelebratedTarget };
}
