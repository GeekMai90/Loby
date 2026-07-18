import clsx from "clsx";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const POINTER_SHOW_DELAY = 700;
const FOCUS_SHOW_DELAY = 120;
const TOOLTIP_GAP = 8;
const VIEWPORT_INSET = 8;

interface ActiveTooltip {
  label: string;
  target: HTMLElement;
}

interface TooltipPosition {
  left: number;
  placement: "top" | "bottom";
  top: number;
}

export function AppTooltip() {
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearShowTimer() {
      if (showTimerRef.current === null) return;
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    function hideTooltip() {
      clearShowTimer();
      activeTargetRef.current = null;
      setActiveTooltip(null);
      setPosition(null);
    }

    function scheduleTooltip(target: HTMLElement, label: string, delay: number) {
      clearShowTimer();
      activeTargetRef.current = null;
      setActiveTooltip(null);
      setPosition(null);
      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (!isTooltipTargetAvailable(target)) return;
        activeTargetRef.current = target;
        setActiveTooltip({ label, target });
      }, delay);
    }

    function handlePointerOver(event: PointerEvent) {
      const resolved = resolveTooltipTarget(event.target);
      if (!resolved) return;
      if (event.relatedTarget instanceof Node && resolved.target.contains(event.relatedTarget)) return;
      scheduleTooltip(resolved.target, resolved.label, POINTER_SHOW_DELAY);
    }

    function handlePointerOut(event: PointerEvent) {
      const target = findTooltipTarget(event.target);
      if (!target) return;
      if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
      hideTooltip();
    }

    function handleFocusIn(event: FocusEvent) {
      const resolved = resolveTooltipTarget(event.target);
      if (resolved) scheduleTooltip(resolved.target, resolved.label, FOCUS_SHOW_DELAY);
    }

    function handleFocusOut(event: FocusEvent) {
      if (findTooltipTarget(event.target)) hideTooltip();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") hideTooltip();
    }

    function handleDocumentMutation() {
      const target = activeTargetRef.current;
      if (target && !isTooltipTargetAvailable(target)) hideTooltip();
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
    document.addEventListener("pointerdown", hideTooltip, true);
    document.addEventListener("click", hideTooltip, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", hideTooltip);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);
    return () => {
      clearShowTimer();
      mutationObserver.disconnect();
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", hideTooltip, true);
      document.removeEventListener("click", hideTooltip, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", hideTooltip);
      window.removeEventListener("resize", hideTooltip);
      window.removeEventListener("scroll", hideTooltip, true);
    };
  }, []);

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!activeTooltip || !tooltip) return;
    const targetBounds = activeTooltip.target.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();
    const centeredLeft = targetBounds.left + targetBounds.width / 2 - tooltipBounds.width / 2;
    const left = clamp(centeredLeft, VIEWPORT_INSET, window.innerWidth - tooltipBounds.width - VIEWPORT_INSET);
    const bottomTop = targetBounds.bottom + TOOLTIP_GAP;
    const fitsBelow = bottomTop + tooltipBounds.height <= window.innerHeight - VIEWPORT_INSET;
    const placement = fitsBelow ? "bottom" : "top";
    const preferredTop = fitsBelow ? bottomTop : targetBounds.top - tooltipBounds.height - TOOLTIP_GAP;
    const top = clamp(preferredTop, VIEWPORT_INSET, window.innerHeight - tooltipBounds.height - VIEWPORT_INSET);
    setPosition({ left, placement, top });
  }, [activeTooltip]);

  if (!activeTooltip) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={clsx(
        "app-tooltip pointer-events-none fixed z-20000 inline-flex w-fit max-w-[min(240px,calc(100vw-16px))] items-center rounded-md bg-foreground px-3 py-1.5 text-xs leading-[1.35] font-medium text-background",
        position && "is-positioned",
      )}
      data-placement={position?.placement}
      role="tooltip"
      style={
        {
          left: position?.left ?? -10_000,
          top: position?.top ?? -10_000,
          visibility: position ? "visible" : "hidden",
        } as CSSProperties
      }
    >
      {activeTooltip.label}
    </div>,
    document.body,
  );
}

function resolveTooltipTarget(eventTarget: EventTarget | null) {
  const target = findTooltipTarget(eventTarget);
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

function findTooltipTarget(eventTarget: EventTarget | null) {
  return eventTarget instanceof Element ? eventTarget.closest<HTMLElement>("[data-tooltip], [title]") : null;
}

function isTooltipTargetAvailable(target: HTMLElement) {
  return target.isConnected && !target.closest("[data-tooltip-disabled]") && target.getClientRects().length > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
