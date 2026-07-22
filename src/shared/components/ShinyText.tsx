/**
 * [INPUT]: 依赖 React 运行时、index.css 共享动效 Token 与 shared 公共契约
 * [OUTPUT]: 对外提供 ShinyText
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/shared/lib/utils";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  delay?: number;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  className?: string;
}

export function ShinyText({
  text,
  disabled = false,
  speed = 2,
  delay = 0,
  color = "var(--shiny-text-default-color)",
  shineColor = "var(--shiny-text-default-shine)",
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = "left",
  className,
}: ShinyTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const directionRef = useRef(direction === "left" ? 1 : -1);
  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;
  const animationDisabled = disabled || prefersReducedMotion;

  useAnimationFrame((time) => {
    if (animationDisabled || paused) {
      lastTimeRef.current = null;
      return;
    }

    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }

    elapsedRef.current += time - lastTimeRef.current;
    lastTimeRef.current = time;

    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsedRef.current % (yoyo ? cycleDuration * 2 : cycleDuration);
    let nextProgress: number;

    if (yoyo && cycleTime >= cycleDuration) {
      const reverseTime = cycleTime - cycleDuration;
      nextProgress = reverseTime < animationDuration ? 100 - (reverseTime / animationDuration) * 100 : 0;
    } else {
      nextProgress = cycleTime < animationDuration ? (cycleTime / animationDuration) * 100 : 100;
    }

    progress.set(directionRef.current === 1 ? nextProgress : 100 - nextProgress);
  });

  useEffect(() => {
    directionRef.current = direction === "left" ? 1 : -1;
    elapsedRef.current = 0;
    progress.set(direction === "left" ? 0 : 100);
  }, [direction, progress]);

  const backgroundPosition = useTransform(progress, (value) => `${150 - value * 2}% center`);
  const gradientStyle: CSSProperties = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: "200% auto",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setPaused(false);
  }, [pauseOnHover]);

  return (
    <motion.span
      className={cn("shiny-text inline-block", className)}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
}
