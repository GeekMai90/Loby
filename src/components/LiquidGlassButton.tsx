import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";

interface LiquidGlassButtonProps extends ComponentPropsWithoutRef<"button"> {
  active?: boolean;
  joined?: boolean;
  tone?: "default" | "danger";
}

export function LiquidGlassButton({
  active = false,
  joined = false,
  tone = "default",
  className,
  children,
  type = "button",
  ...props
}: LiquidGlassButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={clsx("liquid-glass-button", active && "is-active", joined && "is-joined", tone === "danger" && "is-danger", className)}
    >
      <span className="liquid-glass-button-inner" aria-hidden="true">
        {children}
      </span>
    </button>
  );
}

export function LiquidGlassButtonGroup({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div {...props} className={clsx("liquid-glass-button-group", className)}>
      {children}
    </div>
  );
}
