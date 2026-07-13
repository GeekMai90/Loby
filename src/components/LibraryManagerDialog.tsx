import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getVersion } from "@tauri-apps/api/app";
import { Ellipsis, X } from "lucide-react";
import { useEffect, useState } from "react";
import appIconUrl from "../../src-tauri/icons/128x128.png";
import type { WritingLibrary } from "../types";
import { LibraryManagerCreateForm } from "./LibraryManagerCreateForm";

interface LibraryManagerDialogProps {
  open: boolean;
  libraries: WritingLibrary[];
  activeLibrary?: WritingLibrary;
  onClose: () => void;
  onChooseParent: () => Promise<string | null>;
  onCreateLibrary: (name: string, parentPath?: string) => Promise<void>;
  onAddExistingLibrary: () => Promise<void>;
  onSwitchLibrary: (libraryId: string) => Promise<void>;
  onRenameLibrary: (libraryId: string, name: string) => void;
  onMoveLibrary: (libraryId: string) => Promise<void>;
  onRevealLibrary: (libraryId: string) => Promise<void>;
  onRemoveLibrary: (libraryId: string) => boolean;
}

export function LibraryManagerDialog({
  open,
  libraries,
  activeLibrary,
  onClose,
  onChooseParent,
  onCreateLibrary,
  onAddExistingLibrary,
  onSwitchLibrary,
  onRenameLibrary,
  onMoveLibrary,
  onRevealLibrary,
  onRemoveLibrary,
}: LibraryManagerDialogProps) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setMode("list");
      setEditingId("");
      setError("");
      return;
    }
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("0.1.0"));
  }, [open]);

  async function run(task: () => Promise<void>, closeAfter = false) {
    setBusy(true);
    setError("");
    try {
      await task();
      if (closeAfter) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function commitRename(library: WritingLibrary) {
    const name = editingName.trim();
    if (name) onRenameLibrary(library.id, name);
    setEditingId("");
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (!editingId) return;
          event.preventDefault();
          setEditingId("");
        }}
        className="grid h-[min(600px,calc(100vh-64px))] min-h-130 w-[min(900px,calc(100vw-64px))] max-w-[min(900px,calc(100vw-64px))] grid-cols-[minmax(280px,36%)_minmax(0,1fr)] gap-0 overflow-hidden rounded-[22px] border border-border bg-background p-0 shadow-2xl sm:max-w-[min(900px,calc(100vw-64px))]"
      >
        <DialogTitle className="sr-only">管理写作库</DialogTitle>
        <DialogDescription className="sr-only">切换、创建、打开或整理本地写作库。</DialogDescription>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-10" title="关闭">
            <X />
          </Button>
        </DialogClose>

        <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-muted/30 px-3.5 pt-7 pb-4.5">
          <header className="px-2.5 pb-4">
            <strong className="block text-lg font-semibold">写作库</strong>
            <small className="mt-1 block text-sm text-muted-foreground">{libraries.length} 个本地写作库</small>
          </header>
          <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {libraries.map((library) => {
              const active = library.id === activeLibrary?.id;
              return (
                <article key={library.id} className="group flex min-w-0 items-center gap-1 rounded-lg p-1 hover:bg-muted">
                  {editingId === library.id ? (
                    <div className="min-w-0 flex-1 px-1.5 py-1">
                      <Input
                        autoFocus
                        className="h-8"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        onBlur={() => commitRename(library)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename(library);
                          if (event.key === "Escape") setEditingId("");
                        }}
                      />
                      <small className="mt-1 block truncate text-sm text-muted-foreground">{library.path}</small>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-h-14 min-w-0 flex-1 flex-col items-start gap-1 px-2 py-2 text-left"
                      disabled={busy}
                      aria-current={active ? "true" : undefined}
                      onClick={() => {
                        if (!active) void run(() => onSwitchLibrary(library.id), true);
                      }}
                    >
                      <strong className="w-full truncate text-base font-medium">{library.name}</strong>
                      <small className="w-full truncate text-sm font-normal text-muted-foreground">{library.path}</small>
                    </Button>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`${library.name}的更多操作`}>
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditingId(library.id);
                          setEditingName(library.name);
                        }}
                      >
                        重命名写作库
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={busy} onSelect={() => void run(() => onMoveLibrary(library.id))}>
                        移动写作库
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => void run(() => onRevealLibrary(library.id))}>在访达中显示</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={library.id === activeLibrary?.id}
                        title={library.id === activeLibrary?.id ? "请先切换到其他写作库" : "不会删除本地文件"}
                        onSelect={() => void onRemoveLibrary(library.id)}
                      >
                        从写作库列表中移除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </article>
              );
            })}
          </div>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-col items-center overflow-hidden bg-background px-13.5 pt-18 pb-11.5">
          <div className="mb-8.5 flex flex-col items-center">
            <img className="mb-3 size-19.5 rounded-[18px] drop-shadow-lg" src={appIconUrl} alt="Nibva 应用图标" />
            <strong className="text-[23px] font-semibold tracking-tight">Nibva</strong>
            <span className="mt-1 text-xs text-muted-foreground">版本 {appVersion}</span>
          </div>

          <div className="absolute top-61.25 right-13.5 left-13.5 h-87.5 overflow-hidden">
            <div className="relative size-full">
              <section
                className={cn(
                  "absolute inset-0 duration-300 motion-reduce:animate-none",
                  mode === "list" ? "animate-in fade-in slide-in-from-left-8" : "hidden",
                )}
                aria-hidden={mode !== "list"}
              >
                <div className="w-full max-w-120 rounded-xl border border-border bg-muted/30 px-4.5">
                  <div className="flex min-h-21.5 items-center gap-5">
                    <div className="min-w-0 flex-1">
                      <strong className="block text-base font-medium">新建写作库</strong>
                      <small className="mt-1 block text-xs leading-relaxed text-muted-foreground">在指定文件夹下创建一个新的写作库。</small>
                    </div>
                    <Button type="button" className="w-23" onClick={() => setMode("create")}>
                      创建
                    </Button>
                  </div>
                  <div className="flex min-h-21.5 items-center gap-5 border-t border-border">
                    <div className="min-w-0 flex-1">
                      <strong className="block text-base font-medium">打开本地写作库</strong>
                      <small className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        选择已有的本地文件夹并添加到写作库列表。
                      </small>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-23"
                      disabled={busy}
                      onClick={() => void run(onAddExistingLibrary, true)}
                    >
                      打开
                    </Button>
                  </div>
                </div>
              </section>

              <section
                className={cn(
                  "absolute inset-0 duration-300 motion-reduce:animate-none",
                  mode === "create" ? "animate-in fade-in slide-in-from-right-8" : "hidden",
                )}
                aria-hidden={mode !== "create"}
              >
                <LibraryManagerCreateForm
                  key={mode}
                  busy={busy}
                  onBack={() => setMode("list")}
                  onChooseLocation={onChooseParent}
                  onSubmit={(name, parentPath) => run(() => onCreateLibrary(name, parentPath), true)}
                />
              </section>
            </div>
          </div>
          {error && <p className="absolute right-13.5 bottom-2 left-13.5 m-0 text-xs text-destructive">{error}</p>}
        </main>
      </DialogContent>
    </Dialog>
  );
}
