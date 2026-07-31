/**
 * [INPUT]: 依赖 React 运行时传入的显示文本与当前搜索词
 * [OUTPUT]: 对外提供可复用的搜索命中高亮文本渲染器
 * [POS]: 写作库搜索结果的视觉投影边界，供全局搜索与列表卡片共享，不拥有搜索状态或筛选规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { ReactNode } from "react";

interface SearchHighlightProps {
  text: string;
  query: string;
}

export function SearchHighlight({ text, query }: SearchHighlightProps): ReactNode {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  if (terms.length === 0) return text;

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return parts.map((part, index) =>
    terms.some((term) => part.toLocaleLowerCase() === term.toLocaleLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded bg-primary/15 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}
