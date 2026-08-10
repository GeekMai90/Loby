/**
 * [INPUT]: 依赖 React 运行时、主窗口 ready 同步、Windows 自定义标题栏、Animate UI Tooltip、shadcn/ui 基础控件与发布模块
 * [OUTPUT]: 对外提供带首屏同步显示、Windows 窗口 Chrome 和全窗口统一 Tooltip 上下文的 AppRoot
 * [POS]: app 组合层，选择窗口入口并装配跨窗口 Tooltip/平台窗口外壳，不下沉领域实现
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense, type ReactNode } from "react";
import App from "@/app/App";
import { WindowsTitlebar } from "@/app/WindowsTitlebar";
import { TooltipProvider } from "@/components/animate-ui/components/animate/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { isWechatThemeStudioWindow } from "@/features/publishing/model/wechatThemeStudioWindow";
import { useMainWindowReady } from "@/shared/hooks/useMainWindowReady";
import { isWindowsDesktopRuntime } from "@/shared/lib/platform";

const WechatThemeStudioWindow = lazy(() =>
  import("@/features/publishing/components/WechatThemeStudioWindow").then((module) => ({ default: module.WechatThemeStudioWindow })),
);

export function AppRoot() {
  if (isWechatThemeStudioWindow()) {
    return (
      <AnimateTooltipScope>
        <Suspense fallback={null}>
          <WechatThemeStudioWindow />
        </Suspense>
      </AnimateTooltipScope>
    );
  }
  return <MainApplicationWindow />;
}

function MainApplicationWindow() {
  useMainWindowReady();
  const useWindowsTitlebar = isWindowsDesktopRuntime();
  return (
    <AnimateTooltipScope>
      {useWindowsTitlebar ? (
        <div className="windows-app-frame">
          <WindowsTitlebar />
          <div className="windows-app-content">
            <App />
          </div>
        </div>
      ) : (
        <App />
      )}
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
