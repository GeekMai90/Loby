import { ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { LibrarySetupForm } from "./LibrarySetupForm";
import { Button } from "@/components/ui/button";
import lobyAppIcon from "../../src-tauri/icons/icon.png";

interface LibraryOnboardingProps {
  defaultParentPath: string;
  onChooseParent: () => Promise<string | null>;
  onCreateLibrary: (name: string, parentPath?: string) => Promise<void>;
  onOpenExistingLibrary: () => Promise<void>;
  onDismiss?: () => void;
}

export function LibraryOnboarding({
  defaultParentPath,
  onChooseParent,
  onCreateLibrary,
  onOpenExistingLibrary,
  onDismiss,
}: LibraryOnboardingProps) {
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
    <main className="relative flex size-full flex-col overflow-y-auto bg-background px-8 pt-16 pb-7 text-foreground max-[760px]:px-6 max-[760px]:pt-12 max-[760px]:pb-6">
      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-3 right-5 z-10"
          title="关闭欢迎界面"
          aria-label="关闭欢迎界面"
          onClick={onDismiss}
        >
          <X size={18} />
        </Button>
      )}
      <section className="mx-auto my-auto flex w-full max-w-125 flex-col items-center">
        <img className="mb-7 size-[162px] shrink-0 object-contain max-[760px]:size-[140px]" src={lobyAppIcon} alt="" draggable={false} />
        <h1 className="m-0 text-center text-[36px] leading-tight font-semibold tracking-[-0.04em]">欢迎来到落笔</h1>
        <p className="mt-4 mb-0 text-center text-[22px] leading-8 font-semibold tracking-[-0.02em]">让每一次落笔，都更接近自己。</p>
        <p className="mt-2 mb-0 text-center text-base leading-7 text-muted-foreground">
          你的文字会以 Markdown 文件保存在本地，始终属于你。
        </p>
        <LibrarySetupForm
          defaultParentPath={defaultParentPath}
          submitLabel="开始写作"
          busy={busy}
          onChooseParent={onChooseParent}
          onSubmit={createLibrary}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-12 w-full rounded-xl text-base"
          disabled={busy}
          onClick={openExistingLibrary}
        >
          打开已有写作库
        </Button>
        {openError && <p className="mt-2 mb-0 w-full text-sm text-destructive">{openError}</p>}
      </section>
      <p className="mx-auto mt-8 mb-0 flex flex-none items-center justify-center gap-2 text-center text-[15px] leading-6 text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 text-foreground/75" />
        <span>你的文件始终属于你，可随时访问、备份与迁移。</span>
      </p>
    </main>
  );
}
