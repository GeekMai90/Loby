/**
 * [INPUT]: 依赖 React 运行时、写作库模块、写作活动模块、shared 公共契约
 * [OUTPUT]: 对外提供 useWritingActivity
 * [POS]: 写作活动 feature 的React 协调边界，封装 写作活动 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadWritingActivity, saveWritingActivity } from "@/features/library/model/persistence";
import {
  deriveWritingCheckIns,
  EMPTY_WRITING_ACTIVITY,
  mergeWritingCheckIns,
  normalizeWritingActivity,
  withCelebratedTarget,
  writingDates,
  writingStreaks,
} from "@/features/writing-activity/model/writingGoals";
import type { WritingActivityStore, WritingProject } from "@/shared/types";

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
