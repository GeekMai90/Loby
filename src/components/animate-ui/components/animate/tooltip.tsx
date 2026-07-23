/**
 * [INPUT]: 依赖 React DOM 事件、Animate UI Tooltip primitives、motion/react-client、popover/muted 主题语义与 shared class 合并工具
 * [OUTPUT]: 对外提供随主题切换表面、自动渲染快捷键 keycap、接管全局 title/data-tooltip 的 TooltipProvider、Tooltip、TooltipTrigger、TooltipContent 及其类型
 * [POS]: components/animate-ui 的应用级 Tooltip 唯一入口；统一 registry 动效、现有声明式目标与项目设计 Token
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";
import * as motion from "motion/react-client";

import {
  TooltipProvider as TooltipProviderPrimitive,
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
  TooltipContent as TooltipContentPrimitive,
  useGlobalTooltip,
  type TooltipProviderProps as TooltipProviderPrimitiveProps,
  type TooltipProps as TooltipPrimitiveProps,
  type TooltipTriggerProps as TooltipTriggerPrimitiveProps,
  type TooltipContentProps as TooltipContentPrimitiveProps,
} from "@/components/animate-ui/primitives/animate/tooltip";
import { cn } from "@/shared/lib/utils";

const TOOLTIP_SURFACE_CLASS =
  "pointer-events-none inline-flex w-fit max-w-[min(240px,calc(100vw-16px))] items-center rounded-md border-[0.5px] border-border bg-popover text-popover-foreground shadow-sm";

const MAC_SHORTCUT_PREFIX_PATTERN = /^([⌘⇧⌥⌃]+)(.+)$/u;
const TOOLTIP_SHORTCUT_PATTERN = /^(.*?)[（(]([^（）()]+)[）)]$/u;

type TooltipProviderProps = TooltipProviderPrimitiveProps & {
  autoTargets?: boolean;
};

function TooltipProvider({ openDelay = 700, closeDelay = 120, autoTargets = false, children, ...props }: TooltipProviderProps) {
  return (
    <TooltipProviderPrimitive openDelay={openDelay} closeDelay={closeDelay} {...props}>
      {children}
      {autoTargets && <AutoTooltipTargets />}
    </TooltipProviderPrimitive>
  );
}

type TooltipProps = TooltipPrimitiveProps;

function Tooltip({ sideOffset = 10, ...props }: TooltipProps) {
  return <TooltipPrimitive sideOffset={sideOffset} {...props} />;
}

type TooltipTriggerProps = TooltipTriggerPrimitiveProps;

function TooltipTrigger({ ...props }: TooltipTriggerProps) {
  return <TooltipTriggerPrimitive {...props} />;
}

type TooltipContentProps = Omit<TooltipContentPrimitiveProps, "asChild"> & {
  children: React.ReactNode;
  layout?: boolean | "position" | "size" | "preserve-aspect";
};

function TooltipContent({ className, children, layout = "preserve-aspect", ...props }: TooltipContentProps) {
  return (
    <TooltipContentPrimitive className={cn(TOOLTIP_SURFACE_CLASS, className)} {...props}>
      <TooltipSurface layout={layout}>{children}</TooltipSurface>
    </TooltipContentPrimitive>
  );
}

function TooltipSurface({
  children,
  layout = "preserve-aspect",
}: {
  children: React.ReactNode;
  layout?: boolean | "position" | "size" | "preserve-aspect";
}) {
  return (
    <>
      <motion.div className="overflow-hidden px-2.5 py-1.5 text-caption leading-[1.35] font-medium text-balance">
        <motion.div layout={layout}>
          <TooltipLabel>{children}</TooltipLabel>
        </motion.div>
      </motion.div>
    </>
  );
}

function TooltipLabel({ children }: { children: React.ReactNode }) {
  if (typeof children !== "string") return children;
  const parsed = parseTooltipShortcut(children);
  if (!parsed) return children;

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span>{parsed.label}</span>
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {parsed.keys.map((key, index) => (
          <kbd
            key={`${key}-${index}`}
            data-slot="tooltip-key"
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-foreground/10 bg-muted px-1 text-caption leading-none font-medium text-foreground shadow-xs"
          >
            {key}
          </kbd>
        ))}
      </span>
    </span>
  );
}

function parseTooltipShortcut(label: string): { label: string; keys: string[] } | null {
  const match = TOOLTIP_SHORTCUT_PATTERN.exec(label.trim());
  if (!match) return null;

  const shortcut = match[2].trim();
  const macShortcut = MAC_SHORTCUT_PREFIX_PATTERN.exec(shortcut);
  const keys = macShortcut
    ? [...Array.from(macShortcut[1]), macShortcut[2]]
    : /^(?:Ctrl|Control|Alt|Shift|Meta|Cmd|Command)\+/iu.test(shortcut)
      ? shortcut
          .split("+")
          .map((key) => key.trim())
          .filter(Boolean)
      : [];

  const title = match[1].trim();
  return title && keys.length > 1 ? { label: title, keys } : null;
}

function AutoTooltipTargets() {
  const { showTooltip, hideTooltip, hideImmediate, setReferenceEl } = useGlobalTooltip();
  const activeTargetRef = React.useRef<HTMLElement | null>(null);
  const targetIdsRef = React.useRef(new WeakMap<HTMLElement, string>());
  const nextTargetIdRef = React.useRef(0);

  React.useEffect(() => {
    function targetId(target: HTMLElement) {
      const existing = targetIdsRef.current.get(target);
      if (existing) return existing;
      nextTargetIdRef.current += 1;
      const id = `auto-tooltip-${nextTargetIdRef.current}`;
      targetIdsRef.current.set(target, id);
      return id;
    }

    function showTarget(target: HTMLElement, label: string) {
      activeTargetRef.current = target;
      setReferenceEl(target);
      showTooltip({
        contentProps: {
          className: TOOLTIP_SURFACE_CLASS,
          children: <TooltipSurface>{label}</TooltipSurface>,
        },
        contentAsChild: false,
        rect: target.getBoundingClientRect(),
        side: "top",
        sideOffset: 8,
        align: "center",
        alignOffset: 0,
        id: targetId(target),
      });
    }

    function hideTarget(immediate = false) {
      activeTargetRef.current = null;
      if (immediate) hideImmediate();
      else hideTooltip();
    }

    function handlePointerOver(event: PointerEvent) {
      const resolved = resolveAutoTooltipTarget(event.target);
      if (!resolved) return;
      if (event.relatedTarget instanceof Node && resolved.target.contains(event.relatedTarget)) return;
      showTarget(resolved.target, resolved.label);
    }

    function handlePointerOut(event: PointerEvent) {
      const target = findAutoTooltipTarget(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      hideTarget();
    }

    function handleFocusIn(event: FocusEvent) {
      const resolved = resolveAutoTooltipTarget(event.target);
      if (resolved) showTarget(resolved.target, resolved.label);
    }

    function handleFocusOut(event: FocusEvent) {
      if (findAutoTooltipTarget(event.target)) hideTarget();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === " ") hideTarget(true);
    }

    function handlePointerDown() {
      hideTarget(true);
    }

    function handleWindowBlur() {
      hideTarget(true);
    }

    function handleDocumentMutation() {
      const target = activeTargetRef.current;
      if (target && !isAutoTooltipTargetAvailable(target)) hideTarget(true);
    }

    const mutationObserver = new MutationObserver(handleDocumentMutation);
    mutationObserver.observe(document.body, {
      attributeFilter: ["aria-hidden", "class", "data-tooltip-disabled", "disabled", "hidden", "style"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      mutationObserver.disconnect();
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [hideImmediate, hideTooltip, setReferenceEl, showTooltip]);

  return null;
}

function resolveAutoTooltipTarget(eventTarget: EventTarget | null) {
  const target = findAutoTooltipTarget(eventTarget);
  if (!target || target.closest("[data-tooltip-disabled]") || !target.closest(".loby-window, [data-app-tooltip-scope]")) return null;
  const nativeTitle = target.getAttribute("title")?.trim();
  const label = nativeTitle || target.dataset.tooltip?.trim();
  if (!label) return null;
  if (nativeTitle) {
    target.dataset.tooltip = nativeTitle;
    target.removeAttribute("title");
    if (target.matches("button") && (!target.hasAttribute("aria-label") || target.dataset.tooltipGeneratedAria === "true")) {
      target.setAttribute("aria-label", nativeTitle);
      target.dataset.tooltipGeneratedAria = "true";
    }
  }
  return { label, target };
}

function findAutoTooltipTarget(eventTarget: EventTarget | null) {
  return eventTarget instanceof Element ? eventTarget.closest<HTMLElement>("[data-tooltip], [title]") : null;
}

function isAutoTooltipTargetAvailable(target: HTMLElement) {
  return target.isConnected && !target.closest("[data-tooltip-disabled]") && target.getClientRects().length > 0;
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  type TooltipProviderProps,
  type TooltipProps,
  type TooltipTriggerProps,
  type TooltipContentProps,
};
