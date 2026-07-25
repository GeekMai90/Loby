/**
 * [INPUT]: 依赖 React 运行时、lucide-react、shadcn/ui 基础控件与 shared 快捷键契约
 * [OUTPUT]: 对外提供靠右近全高、支持搜索过滤的 KeyboardShortcutsDialog
 * [POS]: 设置 feature 的快捷键浏览表面，复用应用 Dialog 语义但拥有 Linear 式右侧面板布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { APP_SHORTCUT_GROUPS, APP_SHORTCUT_LIST, formatAppShortcut, formatAppShortcutKeys } from "@/shared/lib/keyboardShortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleGroups = useMemo(
    () =>
      APP_SHORTCUT_GROUPS.map((group) => ({
        ...group,
        shortcuts: APP_SHORTCUT_LIST.filter((shortcut) => {
          if (shortcut.group !== group.id) return false;
          if (!normalizedQuery) return true;
          return [shortcut.title, shortcut.description, group.title, formatAppShortcut(shortcut)]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery);
        }),
      })).filter((group) => group.shortcuts.length > 0),
    [normalizedQuery],
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchInputRef.current?.focus({ preventScroll: true });
        }}
        className="top-4 right-4 bottom-4 left-auto flex h-auto w-[min(360px,calc(100vw-2rem))] max-w-[min(360px,calc(100vw-2rem))] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl sm:max-w-[min(360px,calc(100vw-2rem))] data-open:zoom-in-100 data-closed:zoom-out-100"
      >
        <header className="flex min-h-16 flex-none items-center justify-between gap-4 px-6">
          <DialogTitle className="text-title font-bold tracking-[-0.02em]">键盘快捷键</DialogTitle>
          <DialogDescription className="sr-only">搜索并查看落笔中的全部键盘快捷键。</DialogDescription>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" title="关闭快捷键">
              <X aria-hidden="true" />
              <span className="sr-only">关闭</span>
            </Button>
          </DialogClose>
        </header>

        <div className="flex-none px-6 pb-2">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索快捷键"
              aria-label="搜索快捷键"
              className="h-10 rounded-xl bg-background pr-3 pl-9 shadow-xs"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-7">
          {visibleGroups.length > 0 ? (
            <div className="flex flex-col gap-7">
              {visibleGroups.map((group) => (
                <section key={group.id} className="min-w-0">
                  <h3 className="mb-2 text-subtitle font-semibold text-foreground">{group.title}</h3>
                  <div className="flex flex-col">
                    {group.shortcuts.map((shortcut) => (
                      <div key={shortcut.id} className="flex min-h-8 items-center justify-between gap-5 py-1">
                        <span className="min-w-0 truncate text-app-base text-foreground">{shortcut.title}</span>
                        <span className="flex shrink-0 items-center gap-0.5" aria-label={formatAppShortcut(shortcut)}>
                          {formatAppShortcutKeys(shortcut).map((key, index) => (
                            <kbd
                              key={`${key}-${index}`}
                              className="inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-md border border-border bg-transparent px-1 font-sans text-caption font-medium text-muted-foreground"
                            >
                              {key}
                            </kbd>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid min-h-48 place-items-center text-body text-muted-foreground">没有找到匹配的快捷键</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
