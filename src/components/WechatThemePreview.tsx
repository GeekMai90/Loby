import { Minus, Monitor, Plus, Smartphone } from "lucide-react";
import useMeasure from "react-use-measure";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildWechatPreviewDocument } from "../lib/publishing/wechatPreview";
import type { WechatRenderResult } from "../lib/publishing/wechatRenderer";
import {
  resolveWechatThemePreviewHeight,
  WECHAT_THEME_PREVIEW_FRAMES,
  type WechatThemePreviewViewport,
} from "../lib/publishing/wechatThemePreviewModel";
import type { WechatThemeManifest } from "../lib/publishing/wechatThemes";

interface WechatThemePreviewProps {
  result: WechatRenderResult | null;
  theme: WechatThemeManifest;
  busy: boolean;
  error: string;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  viewport: WechatThemePreviewViewport;
  onViewportChange: (viewport: WechatThemePreviewViewport) => void;
}

export function WechatThemePreview({
  result,
  theme,
  busy,
  error,
  zoom,
  onZoomChange,
  viewport,
  onViewportChange,
}: WechatThemePreviewProps) {
  const document = buildWechatPreviewDocument(result?.html ?? "", theme.baseStyle.colors.pageBackground);
  const frame = WECHAT_THEME_PREVIEW_FRAMES[viewport];
  const compatibilityStatus = result?.compatibilityWarnings.length
    ? ` · ${result.compatibilityWarnings.length} 项兼容性提示`
    : " · 公众号兼容输出";
  const [previewAreaRef, previewAreaBounds] = useMeasure();
  const frameHeight = resolveWechatThemePreviewHeight(previewAreaBounds.height, zoom, frame.height);
  return (
    <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#EEF0F3]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-black/8 bg-white/65 px-3 text-[11px] text-[#73767D] backdrop-blur-xl">
        <span className="min-w-0 truncate" title={result?.compatibilityWarnings.join("\n")}>
          {busy ? "正在更新预览…" : error || `${theme.name} · ${frame.status}${compatibilityStatus}`}
        </span>
        <div className="ml-3 flex shrink-0 items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewport}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="预览尺寸"
            className="bg-white/80"
            onValueChange={(value) => {
              if (value === "mobile" || value === "desktop") onViewportChange(value);
            }}
          >
            <ToggleGroupItem value="mobile" aria-label="手机端预览">
              <Smartphone />
              {WECHAT_THEME_PREVIEW_FRAMES.mobile.label}
            </ToggleGroupItem>
            <ToggleGroupItem value="desktop" aria-label="电脑端预览">
              <Monitor />
              {WECHAT_THEME_PREVIEW_FRAMES.desktop.label}
            </ToggleGroupItem>
          </ToggleGroup>
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
      </div>
      <div ref={previewAreaRef} className="min-h-0 flex-1 overflow-auto p-6">
        <div
          className="relative mx-auto shrink-0"
          data-preview-viewport={viewport}
          style={{ width: frame.width * zoom, height: frameHeight * zoom }}
        >
          <iframe
            title={`公众号主题${frame.status}`}
            className="absolute inset-0 block border-0 bg-white"
            style={{ width: frame.width, height: frameHeight, transform: `scale(${zoom})`, transformOrigin: "top left" }}
            srcDoc={document}
            sandbox=""
          />
        </div>
      </div>
    </main>
  );
}
