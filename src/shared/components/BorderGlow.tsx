/**
 * [INPUT]: 依赖 React 运行时、index.css 共享动效 Token 与 shared 公共契约
 * [OUTPUT]: 对外提供 BorderGlow
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { CSSProperties } from "react";
import { cn } from "@/shared/lib/utils";

interface BorderGlowProps {
  active: boolean;
  className?: string;
  duration?: number;
  colors?: [string, string, string];
}

interface BorderGlowStyle extends CSSProperties {
  "--border-glow-duration": string;
  "--border-glow-color-one": string;
  "--border-glow-color-two": string;
  "--border-glow-color-three": string;
}

export function BorderGlow({
  active,
  className,
  duration = 3.2,
  colors = ["var(--border-glow-default-one)", "var(--border-glow-default-two)", "var(--border-glow-default-three)"],
}: BorderGlowProps) {
  const style: BorderGlowStyle = {
    "--border-glow-duration": `${duration}s`,
    "--border-glow-color-one": colors[0],
    "--border-glow-color-two": colors[1],
    "--border-glow-color-three": colors[2],
  };

  return (
    <span
      data-slot="border-glow"
      data-active={active ? "true" : "false"}
      className={cn("assistant-composer-border-glow", className)}
      style={style}
      aria-hidden="true"
    />
  );
}
