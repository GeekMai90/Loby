import { BookOpenText, Code2, Moon, Monitor, Newspaper, Smartphone, Sun } from "lucide-react";
import { useState } from "react";
import useMeasure from "react-use-measure";
import iphone17ProSilverFrameUrl from "../assets/iphone-17-pro-silver.svg";
import { buildWechatPreviewDocument, type WechatPreviewColorScheme } from "../lib/publishing/wechatPreview";
import type { WechatRenderResult } from "../lib/publishing/wechatRenderer";
import {
  resolveWechatMobileDeviceScale,
  resolveWechatThemePreviewHeight,
  WECHAT_MOBILE_DEVICE_FRAME,
  WECHAT_THEME_PREVIEW_FRAMES,
  type WechatThemePreviewViewport,
} from "../lib/publishing/wechatThemePreviewModel";
import type { WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "./FunctionSegmentedTabs";
import { LiquidGlassButton } from "./LiquidGlassButton";

const PREVIEW_ZOOM = 1;
const PREVIEW_VIEWPORT_TABS: Array<FunctionSegmentedTab<WechatThemePreviewViewport>> = [
  { value: "mobile", label: WECHAT_THEME_PREVIEW_FRAMES.mobile.label, ariaLabel: "手机端预览", icon: Smartphone },
  { value: "desktop", label: WECHAT_THEME_PREVIEW_FRAMES.desktop.label, ariaLabel: "电脑端预览", icon: Monitor },
];
const PREVIEW_COLOR_SCHEME_TABS: Array<FunctionSegmentedTab<WechatPreviewColorScheme>> = [
  { value: "light", label: "亮色", ariaLabel: "亮色预览", icon: Sun },
  { value: "dark", label: "暗色", ariaLabel: "暗色预览", icon: Moon },
];
export type WechatPreviewContentMode = "rich" | "html";

interface WechatThemePreviewProps {
  result: WechatRenderResult | null;
  theme: WechatThemeManifest;
  busy: boolean;
  error: string;
  viewport: WechatThemePreviewViewport;
  onViewportChange: (viewport: WechatThemePreviewViewport) => void;
  contentMode?: WechatPreviewContentMode;
  onContentModeChange?: (mode: WechatPreviewContentMode) => void;
  sampleArticleActive?: boolean;
  onSampleArticleActiveChange?: (active: boolean) => void;
}

export function WechatThemePreview({
  result,
  theme,
  busy,
  error,
  viewport,
  onViewportChange,
  contentMode = "rich",
  onContentModeChange,
  sampleArticleActive = false,
  onSampleArticleActiveChange,
}: WechatThemePreviewProps) {
  const [colorScheme, setColorScheme] = useState<WechatPreviewColorScheme>("light");
  const sourceModeEnabled = Boolean(onContentModeChange);
  const showingHtml = sourceModeEnabled && contentMode === "html";
  const desktopDocument = buildWechatPreviewDocument(result?.html ?? "", theme.baseStyle.colors.pageBackground, { colorScheme });
  const mobileDocument = buildWechatPreviewDocument(result?.html ?? "", theme.baseStyle.colors.pageBackground, {
    safeAreaTop: WECHAT_MOBILE_DEVICE_FRAME.safeAreaTop,
    safeAreaBottom: WECHAT_MOBILE_DEVICE_FRAME.safeAreaBottom,
    colorScheme,
  });
  const frame = WECHAT_THEME_PREVIEW_FRAMES[viewport];
  const [previewAreaRef, previewAreaBounds] = useMeasure();
  const frameHeight = resolveWechatThemePreviewHeight(previewAreaBounds.height, PREVIEW_ZOOM, frame.height);
  const mobilePreviewMeasured = previewAreaBounds.width > 0 && previewAreaBounds.height > 0;
  const mobileDeviceScale = resolveWechatMobileDeviceScale(previewAreaBounds.width, previewAreaBounds.height);
  const compatibilityWarningCount = result?.compatibilityWarnings.length ?? 0;
  const previewNotice = busy ? "正在更新预览…" : error || (compatibilityWarningCount ? `${compatibilityWarningCount} 项兼容性提示` : "");
  const nextContentMode = contentMode === "rich" ? "html" : "rich";
  const nextColorScheme = colorScheme === "light" ? "dark" : "light";
  const contentToggleLabel = nextContentMode === "html" ? "切换到 HTML 源码" : "切换到富文本预览";
  const colorToggleLabel = nextColorScheme === "dark" ? "切换到暗色预览" : "切换到亮色预览";

  return (
    <main className="relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#EEF0F3]" data-preview-color-scheme={colorScheme}>
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
      {!showingHtml && (
        <div className="absolute top-3 left-1/2 z-10 w-40 -translate-x-1/2">
          <FunctionSegmentedTabs
            value={viewport}
            tabs={PREVIEW_VIEWPORT_TABS}
            ariaLabel="预览尺寸"
            showLabels
            onValueChange={onViewportChange}
          />
        </div>
      )}
      {sourceModeEnabled && (
        <div className="wechat-preview-tool-rail absolute top-1/2 right-4 z-10 -translate-y-1/2" role="toolbar" aria-label="预览工具">
          {onSampleArticleActiveChange && (
            <LiquidGlassButton
              active={sampleArticleActive}
              data-tooltip={sampleArticleActive ? "恢复当前文章预览" : "使用示例文章预览"}
              aria-label={sampleArticleActive ? "恢复当前文章预览" : "使用示例文章预览"}
              aria-pressed={sampleArticleActive}
              onClick={() => onSampleArticleActiveChange(!sampleArticleActive)}
            >
              <BookOpenText />
            </LiquidGlassButton>
          )}
          <LiquidGlassButton
            active={contentMode === "html"}
            data-tooltip={contentToggleLabel}
            aria-label={contentToggleLabel}
            onClick={() => onContentModeChange?.(nextContentMode)}
          >
            {contentMode === "rich" ? <Newspaper /> : <Code2 />}
          </LiquidGlassButton>
          <LiquidGlassButton
            active={colorScheme === "dark"}
            data-tooltip={colorToggleLabel}
            aria-label={colorToggleLabel}
            onClick={() => setColorScheme(nextColorScheme)}
          >
            {colorScheme === "light" ? <Sun /> : <Moon />}
          </LiquidGlassButton>
        </div>
      )}
      {!sourceModeEnabled && !showingHtml && (
        <div className="absolute right-4 bottom-4 z-10 w-32">
          <FunctionSegmentedTabs
            value={colorScheme}
            tabs={PREVIEW_COLOR_SCHEME_TABS}
            ariaLabel="预览主题"
            showLabels
            onValueChange={setColorScheme}
          />
        </div>
      )}
      <div ref={previewAreaRef} className={`min-h-0 flex-1 overflow-hidden px-6 pb-4 ${showingHtml ? "pt-6" : "pt-14"}`}>
        {showingHtml ? (
          <pre
            className="mx-auto h-full max-w-4xl overflow-auto rounded-xl border border-black/8 bg-white p-5 pb-20 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-[#29303A] shadow-sm"
            data-preview-content="html"
          >
            {result?.html ?? "正在生成…"}
          </pre>
        ) : viewport === "mobile" ? (
          <MobileDevicePreview document={mobileDocument} scale={mobileDeviceScale} measured={mobilePreviewMeasured} />
        ) : (
          <div
            className="relative mx-auto shrink-0"
            data-preview-viewport={viewport}
            style={{ width: frame.width * PREVIEW_ZOOM, height: frameHeight * PREVIEW_ZOOM }}
          >
            <iframe
              aria-label={`公众号主题${frame.status}`}
              data-tooltip-disabled
              className="absolute inset-0 block border-0 bg-white"
              style={{ width: frame.width, height: frameHeight, transform: `scale(${PREVIEW_ZOOM})`, transformOrigin: "top left" }}
              srcDoc={desktopDocument}
              sandbox=""
            />
          </div>
        )}
      </div>
    </main>
  );
}

function MobileDevicePreview({ document, scale, measured }: { document: string; scale: number; measured: boolean }) {
  const frameWidth = WECHAT_MOBILE_DEVICE_FRAME.sourceWidth * WECHAT_MOBILE_DEVICE_FRAME.sourceScale;
  const frameHeight = WECHAT_MOBILE_DEVICE_FRAME.sourceHeight * WECHAT_MOBILE_DEVICE_FRAME.sourceScale;
  const screenLeft = WECHAT_MOBILE_DEVICE_FRAME.sourceScreenLeft * WECHAT_MOBILE_DEVICE_FRAME.sourceScale;
  const screenTop = WECHAT_MOBILE_DEVICE_FRAME.sourceScreenTop * WECHAT_MOBILE_DEVICE_FRAME.sourceScale;
  const screenWidth = WECHAT_MOBILE_DEVICE_FRAME.sourceScreenWidth * WECHAT_MOBILE_DEVICE_FRAME.sourceScale;
  const screenHeight = WECHAT_MOBILE_DEVICE_FRAME.sourceScreenHeight * WECHAT_MOBILE_DEVICE_FRAME.sourceScale;

  return (
    <div
      className={`relative mx-auto shrink-0 ${measured ? "visible" : "invisible"}`}
      data-preview-viewport="mobile"
      data-device-frame="iphone-17-pro-silver"
      style={{ width: frameWidth * scale, height: frameHeight * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
      >
        <div
          className="absolute overflow-hidden bg-white"
          style={{ left: screenLeft, top: screenTop, width: screenWidth, height: screenHeight, borderRadius: 68 }}
        >
          <iframe
            aria-label="公众号主题 iPhone 17 Pro 预览"
            data-tooltip-disabled
            className="block size-full border-0 bg-white"
            style={{ width: screenWidth, height: screenHeight }}
            srcDoc={document}
            sandbox=""
          />
        </div>
        <img
          src={iphone17ProSilverFrameUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 block size-full select-none"
        />
      </div>
    </div>
  );
}
