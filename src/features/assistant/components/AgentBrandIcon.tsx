/**
 * [INPUT]: 依赖 @lobehub/icons 的官方 SVG 品牌组件、shared AgentProvider 契约与 React SVG 运行时
 * [OUTPUT]: 对外提供 AgentProviderIcon 与带品牌图标的行内文本组合
 * [POS]: assistant components 的 AI 品牌视觉适配器，供连接管理与 composer 当前连接识别例外共用 1em SVG 映射
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import AnthropicMono from "@lobehub/icons/es/Anthropic/components/Mono";
import DeepSeekColor from "@lobehub/icons/es/DeepSeek/components/Color";
import KimiMono from "@lobehub/icons/es/Kimi/components/Mono";
import MinimaxColor from "@lobehub/icons/es/Minimax/components/Color";
import OpenAIMono from "@lobehub/icons/es/OpenAI/components/Mono";
import QwenColor from "@lobehub/icons/es/Qwen/components/Color";
import type { ReactNode } from "react";
import type { AgentProvider } from "@/shared/types";
import { cn } from "@/shared/lib/utils";

interface AgentProviderIconProps {
  provider: AgentProvider;
  size?: number | string;
  className?: string;
}

export function AgentProviderIcon({ provider, size = "1em", className }: AgentProviderIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
      data-agent-provider-icon={provider}
    >
      {providerGlyph(provider, size)}
    </span>
  );
}

export function AgentBrandLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function providerGlyph(provider: AgentProvider, size: number | string) {
  switch (provider) {
    case "chatgpt-subscription":
    case "openai-api":
      return <OpenAIMono aria-hidden="true" size={size} />;
    case "anthropic-api":
      return <AnthropicMono aria-hidden="true" color="var(--brand-anthropic)" size={size} />;
    case "qwen-api":
      return <QwenColor aria-hidden="true" size={size} />;
    case "minimax-api":
      return <MinimaxColor aria-hidden="true" size={size} />;
    case "deepseek-api":
      return <DeepSeekColor aria-hidden="true" size={size} />;
    case "kimi-api":
      return <KimiMono aria-hidden="true" size={size} />;
    default:
      return <CustomProviderIcon size={size} />;
  }
}

function CustomProviderIcon({ size }: { size: number | string }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <path d="M8.5 6.5 3 12l5.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <path d="m15.5 6.5 5.5 5.5-5.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
      <path d="m14 4-4 16" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" />
    </svg>
  );
}
