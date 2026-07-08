import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface AssistantModelSettingsMenuProps {
  modelOptions: { value: string; label: string }[];
  reasoningOptions: { value: string; label: string }[];
  agentModel: string;
  agentReasoningEffort: string;
  agentQuickMode: boolean;
  quickModeSupported: boolean;
  onModelChange: (value: string) => void;
  onReasoningEffortChange: (value: string) => void;
  onQuickModeChange: (enabled: boolean) => void;
}

export function AssistantModelSettingsMenu({
  modelOptions,
  reasoningOptions,
  agentModel,
  agentReasoningEffort,
  agentQuickMode,
  quickModeSupported,
  onModelChange,
  onReasoningEffortChange,
  onQuickModeChange,
}: AssistantModelSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"model" | "speed" | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, submenuSide: "left" as "left" | "right" });
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedModel = modelOptions.find((option) => option.value === agentModel) ?? modelOptions[0] ?? { value: agentModel, label: agentModel };
  const selectedReasoning =
    reasoningOptions.find((option) => option.value === agentReasoningEffort) ??
    reasoningOptions[0] ??
    { value: agentReasoningEffort, label: agentReasoningEffort };

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      setSubmenu(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setSubmenu(null);
    }
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    function updatePosition() {
      const trigger = wrapRef.current?.getBoundingClientRect();
      if (!trigger) return;

      const gap = 8;
      const panelWidth = 184;
      const submenuWidth = 200;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 260;
      const canOpenMainToRight = trigger.left + panelWidth <= viewportWidth - gap;
      const left = canOpenMainToRight
        ? trigger.left
        : Math.max(gap, Math.min(trigger.right - panelWidth, viewportWidth - panelWidth - gap));
      const top = Math.max(gap, Math.min(trigger.top - menuHeight - gap, viewportHeight - menuHeight - gap));
      const submenuSide = left + panelWidth + gap + submenuWidth <= viewportWidth - gap ? "right" : "left";

      setMenuPosition((current) =>
        current.top === top && current.left === left && current.submenuSide === submenuSide
          ? current
          : { top, left, submenuSide },
      );
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, submenu]);

  function closeMenu() {
    setOpen(false);
    setSubmenu(null);
  }

  const menu =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="assistant-model-menu"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            <div className="assistant-model-menu-panel">
              <div className="assistant-model-menu-label">推理</div>
              {reasoningOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={clsx(option.value === selectedReasoning.value && "active")}
                  onMouseEnter={() => setSubmenu(null)}
                  onClick={() => {
                    onReasoningEffortChange(option.value);
                    closeMenu();
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === selectedReasoning.value && <Check size={14} />}
                </button>
              ))}
              <div className="assistant-model-menu-separator" />
              <button
                type="button"
                className={clsx("has-submenu", submenu === "model" && "open")}
                onMouseEnter={() => setSubmenu("model")}
                onClick={() => setSubmenu((current) => (current === "model" ? null : "model"))}
              >
                <span>{selectedModel.label}</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className={clsx("has-submenu", submenu === "speed" && "open")}
                disabled={!quickModeSupported}
                title={quickModeSupported ? "速度" : "当前模型不支持快速模式"}
                onMouseEnter={() => {
                  if (quickModeSupported) setSubmenu("speed");
                }}
                onClick={() => {
                  if (quickModeSupported) setSubmenu((current) => (current === "speed" ? null : "speed"));
                }}
              >
                <span>速度</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {submenu === "model" && (
              <div className={clsx("assistant-model-menu-panel assistant-model-submenu", menuPosition.submenuSide)}>
                <div className="assistant-model-menu-label">模型</div>
                {modelOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={clsx(option.value === selectedModel.value && "active")}
                    onClick={() => {
                      onModelChange(option.value);
                      closeMenu();
                    }}
                  >
                    <span>{option.label}</span>
                    {option.value === selectedModel.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}

            {submenu === "speed" && (
              <div className={clsx("assistant-model-menu-panel assistant-model-submenu", menuPosition.submenuSide)}>
                <div className="assistant-model-menu-label">速度</div>
                <button
                  type="button"
                  className={clsx(!agentQuickMode && "active")}
                  onClick={() => {
                    onQuickModeChange(false);
                    closeMenu();
                  }}
                >
                  <span>标准</span>
                  {!agentQuickMode && <Check size={14} />}
                </button>
                <button
                  type="button"
                  className={clsx(agentQuickMode && "active")}
                  onClick={() => {
                    onQuickModeChange(true);
                    closeMenu();
                  }}
                >
                  <span>快速</span>
                  {agentQuickMode && <Check size={14} />}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="assistant-model-settings" ref={wrapRef}>
      <button
        type="button"
        className="assistant-model-trigger"
        onClick={() => {
          setOpen((current) => !current);
          setSubmenu(null);
        }}
        title={`${selectedModel.label} · ${selectedReasoning.label}${agentQuickMode ? " · 快速" : ""}`}
      >
        <span className="assistant-model-trigger-model">{formatCompactModelLabel(selectedModel.label)}</span>
        <span className="assistant-model-trigger-reasoning">{selectedReasoning.label}</span>
        <ChevronDown size={12} />
      </button>
      {menu}
    </div>
  );
}

function formatCompactModelLabel(label: string) {
  const normalized = label.trim();
  if (!normalized) return "模型";
  return normalized
    .replace(/^gpt[-\s]?/i, "")
    .replace(/-/g, " ")
    .replace(/\bcodex\b/i, "Codex");
}
