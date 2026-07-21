import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

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

export function BorderGlow({ active, className, duration = 3.2, colors = ["#c084fc", "#f472b6", "#38bdf8"] }: BorderGlowProps) {
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
