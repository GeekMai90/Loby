import LiquidGlass from "liquid-glass-react";
import clsx from "clsx";
import { useRef, type ComponentPropsWithoutRef, type RefObject } from "react";

interface LiquidGlassButtonProps extends ComponentPropsWithoutRef<"button"> {
  active?: boolean;
  tone?: "default" | "danger";
}

function LiquidGlassButtonSurface({ mouseContainer }: { mouseContainer: RefObject<HTMLElement | null> }) {
  return (
    <span className="liquid-glass-button-surface" aria-hidden="true">
      <LiquidGlass
        className="liquid-glass-button-surface-effect"
        displacementScale={22}
        blurAmount={0.08}
        saturation={180}
        aberrationIntensity={2.4}
        elasticity={0.18}
        cornerRadius={999}
        mouseContainer={mouseContainer}
        padding="0"
        mode="standard"
        style={{ position: "absolute", top: "50%", left: "50%", width: "100%", height: "100%" }}
      >
        <span className="liquid-glass-button-surface-fill" />
      </LiquidGlass>
    </span>
  );
}

export function LiquidGlassButton({
  active = false,
  tone = "default",
  className,
  children,
  type = "button",
  ...props
}: LiquidGlassButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      {...props}
      ref={buttonRef}
      type={type}
      className={clsx("liquid-glass-button", active && "is-active", tone === "danger" && "is-danger", className)}
    >
      <LiquidGlassButtonSurface mouseContainer={buttonRef} />
      <span className="liquid-glass-button-inner" aria-hidden="true">
        {children}
      </span>
    </button>
  );
}
