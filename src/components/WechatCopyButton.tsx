import { useEffect, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyWechatHtml } from "../lib/publishing/wechatRenderer";

type CopyStatus = "idle" | "copying" | "copied" | "error";

interface WechatCopyButtonProps {
  html?: string;
  busy?: boolean;
}

export function WechatCopyButton({ html, busy }: WechatCopyButtonProps) {
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

  return (
    <Button
      type="button"
      size="sm"
      variant={status === "error" ? "destructive" : "outline"}
      className="bg-background/80"
      disabled={!html || busy || status === "copying"}
      title={status === "error" ? "复制失败，请重试" : "复制后可粘贴到公众号编辑器查看效果"}
      aria-live="polite"
      data-no-window-drag
      onClick={() => void copyLayout()}
    >
      {status === "copied" ? <Check /> : <Clipboard />}
      {status === "copying" ? "复制中…" : status === "copied" ? "已复制" : status === "error" ? "复制失败" : "复制排版"}
    </Button>
  );
}
