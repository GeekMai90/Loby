/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、shared 公共契约
 * [OUTPUT]: 对外提供 KeyboardShortcutsDialog
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_SHORTCUT_GROUPS, APP_SHORTCUT_LIST, formatAppShortcut } from "@/shared/lib/keyboardShortcuts";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[min(720px,calc(100vh-56px))] max-w-[min(680px,calc(100vw-56px))] gap-0 overflow-hidden p-0 sm:max-w-[min(680px,calc(100vw-56px))]">
        <DialogHeader className="border-b border-border px-5.5 pt-5 pb-4.25">
          <DialogTitle className="text-[19px] font-bold tracking-[-0.02em]">键盘快捷键</DialogTitle>
          <DialogDescription className="text-xs">常用操作集中在这里；以后新增快捷键也会自动出现在此处。</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-7 gap-y-5.5 overflow-auto px-5.5 pt-5 pb-6 max-[700px]:grid-cols-1">
          {APP_SHORTCUT_GROUPS.map((group) => {
            const shortcuts = APP_SHORTCUT_LIST.filter((shortcut) => shortcut.group === group.id);
            return (
              <section key={group.id} className="min-w-0">
                <h3 className="mb-1.75 text-[11px] font-bold tracking-[0.04em] text-muted-foreground uppercase">{group.title}</h3>
                <div className="border-t border-border">
                  {shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex min-h-13.5 items-center justify-between gap-4 border-b border-border px-0.5 py-2"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <strong className="truncate text-[13px] font-medium text-foreground">{shortcut.title}</strong>
                        <small className="truncate text-[11px] text-muted-foreground">{shortcut.description}</small>
                      </span>
                      <kbd className="inline-flex h-6.25 min-w-8.5 shrink-0 items-center justify-center rounded-md border border-border bg-muted px-1.75 font-sans text-xs font-semibold text-muted-foreground shadow-xs">
                        {formatAppShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
