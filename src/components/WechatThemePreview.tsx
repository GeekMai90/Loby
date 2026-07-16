import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildWechatPreviewDocument } from "../lib/publishing/wechatPreview";
import type { WechatRenderResult } from "../lib/publishing/wechatRenderer";
import type { WechatThemeManifest } from "../lib/publishing/wechatThemes";

interface WechatThemePreviewProps {
  result: WechatRenderResult | null;
  theme: WechatThemeManifest;
  busy: boolean;
  error: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function WechatThemePreview({ result, theme, busy, error, zoom, onZoomChange }: WechatThemePreviewProps) {
  const document = buildWechatPreviewDocument(result?.html ?? "", theme.tokens.pageBackground);
  return (
    <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#EEF0F3]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/8 bg-white/65 px-3 text-[11px] text-[#73767D] backdrop-blur-xl">
        <span>{busy ? "正在更新预览…" : error || `${theme.name} · 手机宽度预览`}</span>
        <div className="flex items-center gap-1 rounded-lg border border-black/8 bg-white/80 p-0.5">
          <Button variant="ghost" size="icon-xs" onClick={() => onZoomChange(Math.max(0.7, zoom - 0.1))} title="缩小预览">
            <Minus />
          </Button>
          <span className="w-9 text-center text-[10px] tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-xs" onClick={() => onZoomChange(Math.min(1.3, zoom + 0.1))} title="放大预览">
            <Plus />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-8 py-7">
        <div
          className="mx-auto w-[390px] origin-top overflow-hidden rounded-[30px] border border-black/10 bg-white shadow-[0_18px_55px_rgb(0_0_0_/_14%)]"
          style={{ transform: `scale(${zoom})`, marginBottom: `${(zoom - 1) * 800}px` }}
        >
          <div className="flex h-7 items-center justify-center bg-white">
            <span className="h-1.5 w-16 rounded-full bg-black/12" />
          </div>
          <iframe title="公众号主题实时预览" className="block h-[760px] w-full border-0 bg-white" srcDoc={document} sandbox="" />
        </div>
      </div>
    </main>
  );
}
