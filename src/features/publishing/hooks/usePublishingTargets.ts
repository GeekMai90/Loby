/**
 * [INPUT]: 依赖 React、publishing native API 与应用级发布目标纯模型
 * [OUTPUT]: 对外提供 usePublishingTargets，负责加载、保存与同步当前设备的发布目标仓库
 * [POS]: publishing feature 的应用级目标状态协调边界，由 app 组合并向设置和分享入口下发
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useState } from "react";
import { loadPublishingTargets, savePublishingTargets } from "@/features/publishing/model/api";
import {
  createDefaultPublishingTargetStore,
  replacePublishingTarget,
  type PublishingTarget,
  type PublishingTargetStore,
} from "@/features/publishing/model/publishingTargets";

export function usePublishingTargets(libraryPath: string) {
  const [store, setStore] = useState<PublishingTargetStore>(createDefaultPublishingTargetStore);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!libraryPath.trim()) {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    setError("");
    void loadPublishingTargets(libraryPath)
      .then((nextStore) => {
        if (cancelled) return;
        setStore(nextStore);
        setReady(true);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryPath]);

  const saveTarget = useCallback(
    async (target: PublishingTarget) => {
      const nextStore = replacePublishingTarget(store, target);
      const savedStore = await savePublishingTargets(nextStore);
      setStore(savedStore);
      setError("");
      return savedStore;
    },
    [store],
  );

  return { store, ready, error, saveTarget };
}
