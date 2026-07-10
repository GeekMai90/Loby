import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const POINTER_SHOW_DELAY = 420;
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
  const showTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearShowTimer() {
      if (showTimerRef.current === null) return;
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    function hideTooltip() {
      clearShowTimer();
      setActiveTooltip(null);
      setPosition(null);
    }

    function scheduleTooltip(target: HTMLElement, label: string, delay: number) {
      clearShowTimer();
      setActiveTooltip(null);
      setPosition(null);
      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        if (!target.isConnected) return;
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
      if (event.key === "Escape") hideTooltip();
    }

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", hideTooltip);
    window.addEventListener("resize", hideTooltip);
    window.addEventListener("scroll", hideTooltip, true);
    return () => {
      clearShowTimer();
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
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
      className="app-tooltip"
      data-placement={position?.placement}
      role="tooltip"
      style={
        {
          left: position?.left ?? 0,
          top: position?.top ?? 0,
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
  if (!target || !target.closest(".nibva-window")) return null;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
