/**
 * [INPUT]: 依赖 React 运行时、Animate UI Tooltip、shadcn/ui 基础控件、禅模式模块、发布模块
 * [OUTPUT]: 对外提供带全窗口统一 Tooltip 上下文的 AppRoot
 * [POS]: app 组合层，选择窗口入口并装配跨窗口 Tooltip，不下沉领域实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense, type ReactNode } from "react";
import App from "@/app/App";
import { TooltipProvider } from "@/components/animate-ui/components/animate/tooltip";
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
  if (zenModeWindowKind === "background")
    return (
      <AnimateTooltipScope>
        <ZenModeBackgroundWindow />
      </AnimateTooltipScope>
    );
  if (zenModeWindowKind === "editor")
    return (
      <AnimateTooltipScope>
        <ZenModeWindow />
      </AnimateTooltipScope>
    );
  if (isWechatThemeStudioWindow()) {
    return (
      <AnimateTooltipScope>
        <Suspense fallback={null}>
          <WechatThemeStudioWindow />
        </Suspense>
      </AnimateTooltipScope>
    );
  }
  return (
    <AnimateTooltipScope>
      <App />
      <Toaster position="top-center" duration={4000} offset={{ top: 20 }} />
    </AnimateTooltipScope>
  );
}

function AnimateTooltipScope({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider openDelay={700} closeDelay={120} autoTargets>
      {children}
    </TooltipProvider>
  );
}
