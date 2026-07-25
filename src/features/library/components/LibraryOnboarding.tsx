/**
 * [INPUT]: 依赖 lucide-react、React 运行时、写作库模块、shadcn/ui 基础控件，以及首次设置或手动回看的显式模式
 * [OUTPUT]: 对外提供 LibraryOnboarding，在首次启动时完成写作文件夹设置，在帮助菜单回看时只展示欢迎内容
 * [POS]: 写作库 feature 的欢迎界面，复用品牌首屏但隔离首次设置与应用内回看行为
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { LibrarySetupForm } from "@/features/library/components/LibrarySetupForm";
import { Button } from "@/components/ui/button";
import lobyAppIcon from "@/../src-tauri/icons/icon.png";

interface LibrarySetupOnboardingProps {
  mode?: "setup";
  defaultParentPath: string;
  onChooseParent: () => Promise<string | null>;
  onCreateLibrary: (name: string, parentPath?: string) => Promise<void>;
  onOpenExistingLibrary: () => Promise<void>;
}

interface LibraryWelcomeReplayProps {
  mode: "welcome";
  onDismiss: () => void;
}

type LibraryOnboardingProps = LibrarySetupOnboardingProps | LibraryWelcomeReplayProps;

export function LibraryOnboarding(props: LibraryOnboardingProps) {
  const [busy, setBusy] = useState(false);
  const [openError, setOpenError] = useState("");
  const welcomeReplay = props.mode === "welcome";

  async function createLibrary(name: string, parentPath?: string) {
    if (props.mode === "welcome") return;
    setBusy(true);
    try {
      await props.onCreateLibrary(name, parentPath);
    } finally {
      setBusy(false);
    }
  }

  async function openExistingLibrary() {
    if (props.mode === "welcome") return;
    setBusy(true);
    setOpenError("");
    try {
      await props.onOpenExistingLibrary();
    } catch (cause) {
      setOpenError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex size-full flex-col overflow-y-auto bg-background px-8 pt-16 pb-7 text-foreground max-[760px]:px-6 max-[760px]:pt-12 max-[760px]:pb-6">
      {welcomeReplay && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 z-30 [-webkit-app-region:no-drag]"
          aria-label="关闭欢迎界面"
          title="关闭欢迎界面"
          onClick={props.onDismiss}
        >
          <X />
        </Button>
      )}
      <section className="mx-auto my-auto flex w-full max-w-125 flex-col items-center">
        <img className="mb-7 size-[162px] shrink-0 object-contain max-[760px]:size-[140px]" src={lobyAppIcon} alt="" draggable={false} />
        <h1 className="m-0 text-center text-[36px] leading-tight font-semibold tracking-[-0.04em]">欢迎来到落笔</h1>
        <p className="mt-4 mb-0 text-center text-[22px] leading-8 font-semibold tracking-[-0.02em]">让每一次落笔，都更接近自己。</p>
        <p className="mt-2 mb-0 text-center text-base leading-7 text-muted-foreground">
          你的文字会以 Markdown 文件保存在本地，始终属于你。
        </p>
        {welcomeReplay ? (
          <Button type="button" className="mt-14 h-12 w-full rounded-xl text-base" onClick={props.onDismiss}>
            继续写作
          </Button>
        ) : (
          <>
            <LibrarySetupForm
              defaultParentPath={props.defaultParentPath}
              submitLabel="开始写作"
              busy={busy}
              onChooseParent={props.onChooseParent}
              onSubmit={createLibrary}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-12 w-full rounded-xl text-base"
              disabled={busy}
              onClick={openExistingLibrary}
            >
              打开已有写作文件夹
            </Button>
            {openError && <p className="mt-2 mb-0 w-full text-sm text-destructive">{openError}</p>}
          </>
        )}
      </section>
      <p className="mx-auto mt-8 mb-0 flex flex-none items-center justify-center gap-2 text-center text-[15px] leading-6 text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 text-foreground/75" />
        <span>你的文件始终属于你，可随时访问、备份与迁移。</span>
      </p>
    </main>
  );
}
