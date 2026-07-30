/**
 * [INPUT]: 依赖 Animate UI Tabs、lucide-react 与发布可见范围契约
 * [OUTPUT]: 对外提供 PublishDocumentSummary，以统一标题层级和紧凑可见范围选择呈现发布确认信息
 * [POS]: publishing feature 的渠道无关确认摘要，在 GitHub 与墨问发布确认态共享文稿信息和低视觉权重的公开/私密选择
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Globe2, LockKeyhole } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import type { MowenVisibility } from "@/features/publishing/model/api";

const VISIBILITY_TABS = [
  { value: "public", label: "公开", icon: Globe2 },
  { value: "private", label: "私密", icon: LockKeyhole },
] as const;

interface PublishDocumentSummaryProps {
  title: string;
  detail: string;
  visibility: MowenVisibility;
  visibilityLabel: string;
  onVisibilityChange: (visibility: MowenVisibility) => void;
}

export function PublishDocumentSummary({ title, detail, visibility, visibilityLabel, onVisibilityChange }: PublishDocumentSummaryProps) {
  return (
    <div className="mt-6">
      <div className="px-0.5">
        <strong className="block truncate text-subtitle">{title}</strong>
        <small className="mt-1 block truncate text-caption text-muted-foreground">{detail}</small>
      </div>
      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border/70 pt-4">
        <span className="text-app-base font-medium">可见范围</span>
        <Tabs value={visibility} onValueChange={(value) => onVisibilityChange(value as MowenVisibility)} className="w-32 shrink-0">
          <TabsList className="grid h-8 w-full grid-cols-2" aria-label={visibilityLabel}>
            {VISIBILITY_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1 px-1.5 text-caption [&_svg:not([class*='size-'])]:size-3.5">
                  <Icon aria-hidden="true" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
