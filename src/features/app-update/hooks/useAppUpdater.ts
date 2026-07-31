/**
 * [INPUT]: 依赖 React、Tauri updater/process plugins、shared Toast 与 app 注入的安装前持久化边界
 * [OUTPUT]: 对外提供 useAppUpdater、AppUpdatePhase 与公开发布页常量
 * [POS]: app-update feature 的状态所有者；封装自动/手动检查、签名更新包下载、安装进度与应用重启
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { showAppToast } from "@/shared/lib/appToast";

export const LOBY_RELEASES_URL = "https://github.com/GeekMai90/Loby-Releases/releases";

export type AppUpdatePhase = "idle" | "checking" | "available" | "downloading" | "installing";

interface UseAppUpdaterOptions {
  beforeInstall: () => Promise<void>;
}

interface AppUpdaterState {
  phase: AppUpdatePhase;
  availableVersion: string;
  progress: number | null;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

export function useAppUpdater({ beforeInstall }: UseAppUpdaterOptions): AppUpdaterState {
  const [phase, setPhase] = useState<AppUpdatePhase>("idle");
  const [availableVersion, setAvailableVersion] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const updateRef = useRef<Update | null>(null);
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const autoCheckStartedRef = useRef(false);

  const checkForUpdates = useCallback(async (manual = true) => {
    if (checkingRef.current || installingRef.current) return;
    if (!isTauri()) {
      if (manual) {
        showAppToast({
          variant: "info",
          title: "仅桌面版支持更新",
          description: "请在落笔桌面应用中检查更新。",
        });
      }
      return;
    }

    checkingRef.current = true;
    setPhase("checking");
    try {
      const nextUpdate = await check();
      if (!nextUpdate) {
        if (updateRef.current) await updateRef.current.close().catch(() => undefined);
        updateRef.current = null;
        setAvailableVersion("");
        setProgress(null);
        setPhase("idle");
        if (manual) {
          showAppToast({
            variant: "success",
            title: "已是最新版本",
            description: "当前安装的落笔无需更新。",
          });
        }
        return;
      }

      if (updateRef.current && updateRef.current !== nextUpdate) {
        await updateRef.current.close().catch(() => undefined);
      }
      updateRef.current = nextUpdate;
      setAvailableVersion(nextUpdate.version);
      setProgress(null);
      setPhase("available");
      if (manual) {
        showAppToast({
          variant: "info",
          title: `发现落笔 ${nextUpdate.version}`,
          description: "导航栏底部已经显示更新按钮。",
        });
      }
    } catch (error) {
      setPhase(updateRef.current ? "available" : "idle");
      if (manual) {
        showAppToast({
          variant: "error",
          title: "暂时无法检查更新",
          description: updateErrorMessage(error),
        });
      }
    } finally {
      checkingRef.current = false;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update || installingRef.current) return;

    installingRef.current = true;
    setPhase("downloading");
    setProgress(0);
    let downloadedBytes = 0;
    let contentLength: number | undefined;

    try {
      await beforeInstall();
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength;
          setProgress(contentLength ? 0 : null);
          return;
        }
        if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (contentLength) setProgress(Math.min(99, Math.round((downloadedBytes / contentLength) * 100)));
          return;
        }
        setProgress(100);
        setPhase("installing");
      });
      setPhase("installing");
      await relaunch();
    } catch (error) {
      setPhase("available");
      setProgress(null);
      showAppToast({
        variant: "error",
        title: "更新安装失败",
        description: updateErrorMessage(error),
      });
    } finally {
      installingRef.current = false;
    }
  }, [beforeInstall]);

  useEffect(() => {
    if (autoCheckStartedRef.current) return;
    autoCheckStartedRef.current = true;
    void checkForUpdates(false);
  }, [checkForUpdates]);

  useEffect(
    () => () => {
      void updateRef.current?.close().catch(() => undefined);
    },
    [],
  );

  return { phase, availableVersion, progress, checkForUpdates, downloadAndInstall };
}

function updateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.trim() || "请检查网络连接后重试。";
}
