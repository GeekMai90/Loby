import { FolderOpen, Library, PenLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LibrarySetupForm } from "./LibrarySetupForm";
import { Button } from "@/components/ui/button";

interface LibraryOnboardingProps {
  defaultParentPath: string;
  onChooseParent: () => Promise<string | null>;
  onCreateLibrary: (name: string, parentPath?: string) => Promise<void>;
  onOpenExistingLibrary: () => Promise<void>;
}

export function LibraryOnboarding({ defaultParentPath, onChooseParent, onCreateLibrary, onOpenExistingLibrary }: LibraryOnboardingProps) {
  const [busy, setBusy] = useState(false);
  const [openError, setOpenError] = useState("");

  async function createLibrary(name: string, parentPath?: string) {
    setBusy(true);
    try {
      await onCreateLibrary(name, parentPath);
    } finally {
      setBusy(false);
    }
  }

  async function openExistingLibrary() {
    setBusy(true);
    setOpenError("");
    try {
      await onOpenExistingLibrary();
    } catch (cause) {
      setOpenError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid size-full grid-cols-[minmax(340px,1fr)_minmax(420px,520px)] items-center gap-[clamp(52px,8vw,120px)] bg-[radial-gradient(circle_at_20%_20%,rgb(0_113_227_/_8%),transparent_34%),var(--app-bg)] px-[clamp(56px,9vw,140px)] pt-22 pb-16 text-foreground max-[1120px]:grid-cols-[1fr_440px] max-[1120px]:gap-12 max-[1120px]:px-12">
      <section className="max-w-145">
        <div className="mb-7.5 grid size-13.5 place-items-center rounded-2xl bg-linear-to-br from-[#1685f8] to-[#0066d6] text-[28px] font-bold text-white shadow-xl shadow-blue-600/20">
          N
        </div>
        <p className="mb-3 text-[13px] font-bold tracking-[0.08em] text-primary">欢迎使用 Nibva</p>
        <h1 className="m-0 max-w-130 text-[clamp(36px,4vw,56px)] leading-[1.08] font-bold tracking-[-0.045em]">
          先为你的文字，准备一个家。
        </h1>
        <p className="my-6 max-w-130 text-base leading-7 text-muted-foreground">
          写作库是一个完全属于你的本地文件夹。项目、Markdown 文稿和素材都保存在里面。
        </p>
        <div className="flex flex-col gap-3.5">
          <span className="flex items-center gap-2.5 text-sm text-muted-foreground [&_svg]:text-primary">
            <ShieldCheck size={17} /> 本地优先，文件始终可见
          </span>
          <span className="flex items-center gap-2.5 text-sm text-muted-foreground [&_svg]:text-primary">
            <Library size={17} /> 可建立多个独立写作库
          </span>
          <span className="flex items-center gap-2.5 text-sm text-muted-foreground [&_svg]:text-primary">
            <PenLine size={17} /> 随时切换不同写作场景
          </span>
        </div>
      </section>

      <section className="rounded-[22px] border border-border bg-card p-7.5 shadow-2xl">
        <header>
          <span className="text-xs font-bold text-primary">第 1 步</span>
          <h2 className="mt-1.5 mb-2 text-[22px]">创建第一个写作库</h2>
          <p className="m-0 text-[13px] leading-5 text-muted-foreground">
            名称用于 Nibva 内显示；存储位置可以使用默认目录，也可以由你决定。
          </p>
        </header>
        <LibrarySetupForm
          defaultParentPath={defaultParentPath}
          submitLabel="创建并开始写作"
          busy={busy}
          onChooseParent={onChooseParent}
          onSubmit={createLibrary}
        />
        <div className="mt-5 flex justify-center gap-2 text-xs text-muted-foreground">
          <span>已经有 Nibva 写作库？</span>
          <Button type="button" variant="outline" disabled={busy} onClick={openExistingLibrary}>
            <FolderOpen size={15} /> 打开已有文件夹
          </Button>
        </div>
        {openError && <p className="m-0 text-xs text-destructive">{openError}</p>}
      </section>
    </main>
  );
}
