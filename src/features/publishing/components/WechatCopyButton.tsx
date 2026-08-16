/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui Button 与公众号 HTML/摘要/标题剪贴板适配器
 * [OUTPUT]: 对外提供 WechatCopyButton
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyWechatArticleToClipboard, copyWechatHtml, type WechatArticleClipboardInput } from "@/features/publishing/model/wechatRenderer";

type CopyStatus = "idle" | "copying" | "copied" | "error";

interface WechatCopyButtonProps {
  html?: string;
  busy?: boolean;
  iconOnly?: boolean;
  article?: Pick<WechatArticleClipboardInput, "description" | "title">;
}

export function WechatCopyButton({ html, busy, iconOnly = false, article }: WechatCopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => setStatus("idle"), [article?.description, article?.title, html]);
  useEffect(() => {
    if (status !== "copied") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copyLayout() {
    if (!html || busy) return;
    setStatus("copying");
    try {
      if (article) await copyWechatArticleToClipboard({ ...article, html });
      else await copyWechatHtml(html);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const idleLabel = article ? "复制摘要、标题与排版" : "复制排版";
  const label = status === "copying" ? "复制中…" : status === "copied" ? "已复制" : status === "error" ? "复制失败，请重试" : idleLabel;
  const title =
    status === "error"
      ? label
      : article
        ? "按摘要、标题、公众号排版顺序复制，可通过剪贴板历史逐条粘贴"
        : "复制后可粘贴到公众号编辑器查看效果";
  const icon = status === "copied" ? <Check /> : <Clipboard />;
  const disabled = !html || busy || status === "copying";

  return (
    <Button
      type="button"
      size={iconOnly ? "icon" : "sm"}
      variant={status === "error" ? "destructive" : iconOnly ? "ghost" : "outline"}
      className={iconOnly ? undefined : "bg-background/80"}
      disabled={disabled}
      title={iconOnly ? undefined : title}
      data-tooltip={iconOnly ? title : undefined}
      aria-label={iconOnly ? label : undefined}
      aria-live="polite"
      data-wechat-copy-button={iconOnly ? "icon" : undefined}
      data-no-window-drag
      onClick={() => void copyLayout()}
    >
      {icon}
      {!iconOnly && label}
    </Button>
  );
}
