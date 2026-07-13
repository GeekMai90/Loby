import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import clsx from "clsx";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { getProjectIconOption, PROJECT_COLOR_OPTIONS, PROJECT_ICON_OPTIONS, type NewProjectDraft } from "../constants/projectAppearance";

interface NewProjectDialogProps {
  open: boolean;
  draft: NewProjectDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  title?: string;
  submitLabel?: string;
  showAppearanceControls?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
}

export function NewProjectDialog({
  open,
  draft,
  inputRef,
  title = "新建项目",
  submitLabel = "创建",
  showAppearanceControls = true,
  onClose,
  onSubmit,
  onDraftChange,
}: NewProjectDialogProps) {
  const selectedIcon = getProjectIconOption(draft.icon);
  const SelectedProjectIcon = selectedIcon.Icon;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-120">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <DialogHeader className="flex-row items-center gap-3">
            <div
              className="grid size-11 shrink-0 place-items-center rounded-xl"
              style={{ color: draft.iconColor, backgroundColor: `${draft.iconColor}18` }}
            >
              <SelectedProjectIcon size={22} />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="sr-only">设置项目名称、图标和颜色。</DialogDescription>
            </div>
          </DialogHeader>

          <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
            <span>名称</span>
            <Input
              ref={inputRef}
              autoFocus
              value={draft.title}
              onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          {showAppearanceControls && (
            <>
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground">图标</span>
                <div className="grid max-h-36 grid-cols-8 gap-1.75 overflow-auto pr-0.5">
                  {PROJECT_ICON_OPTIONS.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant={draft.icon === option.id ? "secondary" : "outline"}
                      size="icon"
                      aria-pressed={draft.icon === option.id}
                      onClick={() => onDraftChange((current) => ({ ...current, icon: option.id }))}
                      title={option.label}
                    >
                      <option.Icon size={18} />
                    </Button>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-muted-foreground">图标颜色</span>
                <div className="grid grid-cols-12 justify-items-center gap-2">
                  {PROJECT_COLOR_OPTIONS.map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className={clsx(
                        "size-6.5 rounded-full border-2 border-white p-0 shadow-[0_0_0_1px_rgb(60_60_67/14%),0_1px_2px_rgb(0_0_0/8%)]",
                        draft.iconColor === option.value && "shadow-[0_0_0_2px_var(--ring),0_1px_2px_rgb(0_0_0/8%)]",
                      )}
                      aria-pressed={draft.iconColor === option.value}
                      onClick={() => onDraftChange((current) => ({ ...current, iconColor: option.value }))}
                      title={option.label}
                      style={{ backgroundColor: option.value }}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          <DialogFooter className="mt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
