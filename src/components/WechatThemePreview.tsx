import { Monitor, Smartphone } from "lucide-react";
import useMeasure from "react-use-measure";
import { buildWechatPreviewDocument } from "../lib/publishing/wechatPreview";
import type { WechatRenderResult } from "../lib/publishing/wechatRenderer";
import {
  resolveWechatThemePreviewHeight,
  WECHAT_THEME_PREVIEW_FRAMES,
  type WechatThemePreviewViewport,
} from "../lib/publishing/wechatThemePreviewModel";
import type { WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "./FunctionSegmentedTabs";

const PREVIEW_ZOOM = 1;
const PREVIEW_VIEWPORT_TABS: Array<FunctionSegmentedTab<WechatThemePreviewViewport>> = [
  { value: "mobile", label: WECHAT_THEME_PREVIEW_FRAMES.mobile.label, ariaLabel: "手机端预览", icon: Smartphone },
  { value: "desktop", label: WECHAT_THEME_PREVIEW_FRAMES.desktop.label, ariaLabel: "电脑端预览", icon: Monitor },
];

interface WechatThemePreviewProps {
  result: WechatRenderResult | null;
  theme: WechatThemeManifest;
  busy: boolean;
  error: string;
  viewport: WechatThemePreviewViewport;
  onViewportChange: (viewport: WechatThemePreviewViewport) => void;
}

export function WechatThemePreview({ result, theme, busy, error, viewport, onViewportChange }: WechatThemePreviewProps) {
  const document = buildWechatPreviewDocument(result?.html ?? "", theme.baseStyle.colors.pageBackground);
  const frame = WECHAT_THEME_PREVIEW_FRAMES[viewport];
  const [previewAreaRef, previewAreaBounds] = useMeasure();
  const frameHeight = resolveWechatThemePreviewHeight(previewAreaBounds.height, PREVIEW_ZOOM, frame.height);
  const compatibilityWarningCount = result?.compatibilityWarnings.length ?? 0;
  const previewNotice = busy ? "正在更新预览…" : error || (compatibilityWarningCount ? `${compatibilityWarningCount} 项兼容性提示` : "");

  return (
    <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#EEF0F3]">
      {previewNotice && (
        <div
          className={`pointer-events-none absolute top-3 left-3 z-10 max-w-[calc(100%_-_24px)] rounded-full border px-2.5 py-1 text-[11px] shadow-sm backdrop-blur-xl ${
            error ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-black/8 bg-white/85 text-[#73767D]"
          }`}
          title={error || result?.compatibilityWarnings.join("\n")}
        >
          {previewNotice}
        </div>
      )}
      <div className="absolute top-3 left-1/2 z-10 w-40 -translate-x-1/2">
        <FunctionSegmentedTabs
          value={viewport}
          tabs={PREVIEW_VIEWPORT_TABS}
          ariaLabel="预览尺寸"
          showLabels
          onValueChange={onViewportChange}
        />
      </div>
      <div ref={previewAreaRef} className="min-h-0 flex-1 overflow-hidden px-6 pt-16 pb-6">
        <div
          className="relative mx-auto shrink-0"
          data-preview-viewport={viewport}
          style={{ width: frame.width * PREVIEW_ZOOM, height: frameHeight * PREVIEW_ZOOM }}
        >
          <iframe
            title={`公众号主题${frame.status}`}
            className="absolute inset-0 block border-0 bg-white"
            style={{ width: frame.width, height: frameHeight, transform: `scale(${PREVIEW_ZOOM})`, transformOrigin: "top left" }}
            srcDoc={document}
            sandbox=""
          />
        </div>
      </div>
    </main>
  );
}
