/**
 * [INPUT]: 依赖共享 Progress、AI 助手 Orb 与 Unsplash 推荐/手动搜索阶段契约
 * [OUTPUT]: 对外提供复用 AI 标识、当前阶段与进度条的 Unsplash 准备态视图
 * [POS]: media feature 的准备态呈现单元；完整复用并等比放大主界面 AI 入口视觉，不发起 AI 或网络请求
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Progress } from "@/components/ui/progress";
import { AiAssistantOrb } from "@/features/assistant/components/AiAssistantOrb";

export type UnsplashPreparationStage = "analyzing" | "translating" | "searching";
export type UnsplashPreparationVariant = "recommendation" | "manual-search";

interface UnsplashPreparationViewProps {
  stage: UnsplashPreparationStage;
  aiEnabled: boolean;
  variant?: UnsplashPreparationVariant;
}

export function UnsplashPreparationView({ stage, aiEnabled, variant = "recommendation" }: UnsplashPreparationViewProps) {
  const presentation = resolvePreparationPresentation(stage, aiEnabled, variant);

  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-border/70 bg-muted/20 px-6 py-10"
      role="status"
      aria-label={`${presentation.label}，${presentation.value}%`}
    >
      <div className="flex w-full max-w-80 flex-col items-center">
        <span className="grid size-16 place-items-center" aria-hidden="true">
          <span className="assistant-launcher grid size-10 scale-125 place-items-center">
            <AiAssistantOrb />
          </span>
        </span>
        <p className="mt-5 mb-0 text-sm font-medium">{presentation.title}</p>

        <div className="mt-7 w-full">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{presentation.label}</span>
            <span className="tabular-nums">{presentation.value}%</span>
          </div>
          <Progress className="mt-2 h-1.5" value={presentation.value} aria-label={presentation.label} />
        </div>
      </div>
    </div>
  );
}

function resolvePreparationPresentation(stage: UnsplashPreparationStage, aiEnabled: boolean, variant: UnsplashPreparationVariant) {
  if (variant === "manual-search") {
    if (stage === "translating") {
      return {
        title: "正在准备搜索结果",
        value: 36,
        label: "正在翻译搜索词…",
      };
    }

    return {
      title: "正在为你寻找合适的图片",
      value: 82,
      label: "正在搜索 Unsplash…",
    };
  }

  if (!aiEnabled) {
    return {
      title: "正在准备封面图片",
      value: 82,
      label: "正在搜索 Unsplash…",
    };
  }

  if (stage === "analyzing") {
    return {
      title: "AI 正在为文章寻找合适的封面方向",
      value: 36,
      label: "正在分析文章内容…",
    };
  }

  return {
    title: "AI 正在为文章寻找合适的封面方向",
    value: 82,
    label: "正在搜索 Unsplash…",
  };
}
