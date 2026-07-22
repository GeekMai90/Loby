/**
 * [INPUT]: 依赖 liquid-glass-react、clsx、React 运行时
 * [OUTPUT]: 对外提供 SidebarGlassPanel
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import LiquidGlass from "liquid-glass-react";
import clsx from "clsx";
import type { ReactNode } from "react";

export function SidebarGlassPanel({ children, variant }: { children: ReactNode; variant: "library" | "sheet" }) {
  if (variant === "library") {
    return (
      <div className="sidebar-glass-shell sidebar-glass-shell-library">
        <div className="sidebar-glass-material" aria-hidden="true" />
        <div className="sidebar-glass-content">{children}</div>
      </div>
    );
  }

  return (
    <div className={clsx("sidebar-glass-shell", `sidebar-glass-shell-${variant}`)}>
      <LiquidGlass
        className="sidebar-liquid-glass"
        displacementScale={18}
        blurAmount={0.09}
        saturation={220}
        aberrationIntensity={3.4}
        elasticity={0.1}
        cornerRadius={18}
        padding="0"
        overLight
        mode="standard"
        style={{ position: "relative", top: 0, left: 0, width: "100%", height: "100%" }}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}
