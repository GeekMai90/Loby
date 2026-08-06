/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、编辑器模块
 * [OUTPUT]: 对外提供 DocumentSearchMode、DocumentSearchSection
 * [POS]: 编辑器 feature 的界面组合单元，连接 编辑器 状态与共享 UI；查找模式标题沿用媒体和历史版本的标题行几何并使用透明表面，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, CircleX, Search } from "lucide-react";
import type { SearchResultItem } from "@/features/editor/model/documentFunctionRail";

export type DocumentSearchMode = "find" | "replace";

interface DocumentSearchSectionProps {
  searchMode: DocumentSearchMode;
  findText: string;
  replaceText: string;
  searchResults: SearchResultItem[];
  activeSearchResultIndex: number;
  onSelectSearchMode: (mode: DocumentSearchMode) => void;
  onFindTextChange: (value: string) => void;
  onReplaceTextChange: (value: string) => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onRevealRelativeSearchResult: (direction: -1 | 1) => void;
  onRevealSearchResult: (result: SearchResultItem, index: number) => void;
}

export function DocumentSearchSection({
  searchMode,
  findText,
  replaceText,
  searchResults,
  activeSearchResultIndex,
  onSelectSearchMode,
  onFindTextChange,
  onReplaceTextChange,
  onReplaceOne,
  onReplaceAll,
  onRevealRelativeSearchResult,
  onRevealSearchResult,
}: DocumentSearchSectionProps) {
  return (
    <section>
      <div className="mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" surface="transparent" className="-ml-2 h-auto px-2 py-0 text-[15px] leading-tight font-bold">
              {searchMode === "find" ? "查找" : "查找和替换"}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuRadioGroup value={searchMode} onValueChange={(mode) => onSelectSearchMode(mode as DocumentSearchMode)}>
              <DropdownMenuRadioItem value="find">查找</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="replace">查找和替换</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <label className="relative mb-2.5 block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          className={findText ? "pr-9 pl-8" : "pl-8"}
          value={findText}
          placeholder="文档中的文本"
          onChange={(event) => onFindTextChange(event.target.value)}
        />
        {findText && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => onFindTextChange("")}
            aria-label="清除搜索"
          >
            <CircleX size={16} />
          </Button>
        )}
      </label>
      {searchMode === "replace" && (
        <>
          <label className="relative mb-2.5 block">
            <ArrowRight className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              className="pl-8"
              value={replaceText}
              placeholder="替换为"
              onChange={(event) => onReplaceTextChange(event.target.value)}
            />
          </label>
          <div className="mb-3 grid grid-cols-2 gap-2.5">
            <Button variant="outline" disabled={!findText || searchResults.length === 0} onClick={onReplaceOne}>
              替换
            </Button>
            <Button variant="outline" disabled={!findText || searchResults.length === 0} onClick={onReplaceAll}>
              全部替换
            </Button>
          </div>
        </>
      )}
      <div className="mt-0.5 flex min-h-7.5 items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">
          {findText ? `${searchResults.length} 个结果` : "输入关键词开始查找"}
        </span>
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full"
            disabled={searchResults.length === 0}
            onClick={() => onRevealRelativeSearchResult(-1)}
            aria-label="上一个结果"
          >
            <ArrowUp size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full"
            disabled={searchResults.length === 0}
            onClick={() => onRevealRelativeSearchResult(1)}
            aria-label="下一个结果"
          >
            <ArrowDown size={16} />
          </Button>
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.75">
        {searchResults.map((result, index) => (
          <Button
            key={result.id}
            type="button"
            variant={index === activeSearchResultIndex ? "secondary" : "ghost"}
            className="h-auto w-full grid-cols-[38px_minmax(0,1fr)] justify-start gap-2 px-2 py-2.5 text-left whitespace-normal"
            onClick={() => onRevealSearchResult(result, index)}
          >
            <small className="text-xs text-muted-foreground">L{result.line}</small>
            <span className="min-w-0 overflow-hidden text-ellipsis text-[13px] leading-5">
              {result.before}
              <strong className="font-bold text-foreground">{result.match}</strong>
              {result.after}
            </span>
          </Button>
        ))}
        {findText && searchResults.length === 0 && (
          <p className="mt-2 text-[13px] leading-[1.45] text-muted-foreground">没有找到匹配内容。</p>
        )}
      </div>
    </section>
  );
}
