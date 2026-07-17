import { useEffect, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyWechatHtml } from "../lib/publishing/wechatRenderer";
import { LiquidGlassButton } from "./LiquidGlassButton";

type CopyStatus = "idle" | "copying" | "copied" | "error";

interface WechatCopyButtonProps {
  html?: string;
  busy?: boolean;
  appearance?: "default" | "liquid-glass";
  iconOnly?: boolean;
}

export function WechatCopyButton({ html, busy, appearance = "default", iconOnly = false }: WechatCopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => setStatus("idle"), [html]);
  useEffect(() => {
    if (status !== "copied") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copyLayout() {
    if (!html || busy) return;
    setStatus("copying");
    try {
      await copyWechatHtml(html);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const label = status === "copying" ? "复制中…" : status === "copied" ? "已复制" : status === "error" ? "复制失败，请重试" : "复制排版";
  const title = status === "error" ? label : "复制后可粘贴到公众号编辑器查看效果";
  const icon = status === "copied" ? <Check /> : <Clipboard />;
  const disabled = !html || busy || status === "copying";

  if (appearance === "liquid-glass") {
    return (
      <LiquidGlassButton
        disabled={disabled}
        tone={status === "error" ? "danger" : "default"}
        active={status === "error"}
        title={title}
        aria-label={label}
        aria-live="polite"
        data-wechat-copy-button="icon"
        data-no-window-drag
        onClick={() => void copyLayout()}
      >
        {icon}
      </LiquidGlassButton>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={status === "error" ? "destructive" : "outline"}
      className="bg-background/80"
      disabled={disabled}
      title={title}
      aria-label={iconOnly ? label : undefined}
      aria-live="polite"
      data-no-window-drag
      onClick={() => void copyLayout()}
    >
      {icon}
      {!iconOnly && label}
    </Button>
  );
}
