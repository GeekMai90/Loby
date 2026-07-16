import { lazy, Suspense } from "react";
import App from "./App";
import { ZenModeBackgroundWindow } from "./components/ZenModeBackgroundWindow";
import { ZenModeWindow } from "./components/ZenModeWindow";
import { isWechatThemeStudioWindow } from "./lib/publishing/wechatThemeStudioWindow";
import { getZenModeWindowKind } from "./lib/zenMode";

const WechatThemeStudioWindow = lazy(() =>
  import("./components/WechatThemeStudioWindow").then((module) => ({ default: module.WechatThemeStudioWindow })),
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
  return <App />;
}
