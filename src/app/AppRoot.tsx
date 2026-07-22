/**
 * [INPUT]: 依赖 React 运行时、shadcn/ui 基础控件、禅模式模块、发布模块
 * [OUTPUT]: 对外提供 AppRoot
 * [POS]: app 组合层，持有跨功能状态所有权并组合主要界面，不下沉领域实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import App from "@/app/App";
import { Toaster } from "@/components/ui/sonner";
import { ZenModeBackgroundWindow } from "@/features/zen-mode/components/ZenModeBackgroundWindow";
import { ZenModeWindow } from "@/features/zen-mode/components/ZenModeWindow";
import { isWechatThemeStudioWindow } from "@/features/publishing/model/wechatThemeStudioWindow";
import { getZenModeWindowKind } from "@/features/zen-mode/model/zenMode";

const WechatThemeStudioWindow = lazy(() =>
  import("@/features/publishing/components/WechatThemeStudioWindow").then((module) => ({ default: module.WechatThemeStudioWindow })),
);

export function AppRoot() {
  const zenModeWindowKind = getZenModeWindowKind();
  if (zenModeWindowKind === "background") return <ZenModeBackgroundWindow />;
  if (zenModeWindowKind === "editor") return <ZenModeWindow />;
  if (isWechatThemeStudioWindow()) {
    return (
      <Suspense fallback={null}>
        <WechatThemeStudioWindow />
      </Suspense>
    );
  }
  return (
    <>
      <App />
      <Toaster position="top-center" duration={4000} offset={{ top: 20 }} />
    </>
  );
}
