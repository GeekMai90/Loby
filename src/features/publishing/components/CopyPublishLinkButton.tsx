/**
 * [INPUT]: 依赖 React 状态、shadcn Button 与浏览器剪贴板适配
 * [OUTPUT]: 对外提供 CopyPublishLinkButton
 * [POS]: publishing feature 的发布结果操作，隔离链接复制副作用并提供复制中、成功和失败反馈
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { copyTextToClipboard } from "@/features/publishing/model/exportBrowser";

type CopyStatus = "idle" | "copying" | "copied" | "error";

export function CopyPublishLinkButton({ url }: { url: string }) {
  const [status, setStatus] = useState<CopyStatus>("idle");

  useEffect(() => setStatus("idle"), [url]);
  useEffect(() => {
    if (status !== "copied") return;
    const timer = window.setTimeout(() => setStatus("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!url) return null;

  async function copyLink() {
    setStatus("copying");
    try {
      await copyTextToClipboard(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const label = status === "copying" ? "复制中…" : status === "copied" ? "已复制" : status === "error" ? "复制失败" : "复制链接";

  return (
    <Button type="button" variant="outline" disabled={status === "copying"} aria-live="polite" onClick={() => void copyLink()}>
      {label}
    </Button>
  );
}
