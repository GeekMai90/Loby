import { FolderOpen, Library, PenLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LibrarySetupForm } from "./LibrarySetupForm";

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
    <main className="library-onboarding">
      <section className="library-onboarding-intro">
        <div className="library-onboarding-brand">N</div>
        <p className="library-onboarding-eyebrow">欢迎使用 Nibva</p>
        <h1>先为你的文字，准备一个家。</h1>
        <p className="library-onboarding-lead">写作库是一个完全属于你的本地文件夹。项目、Markdown 文稿和素材都保存在里面。</p>
        <div className="library-onboarding-benefits">
          <span>
            <ShieldCheck size={17} /> 本地优先，文件始终可见
          </span>
          <span>
            <Library size={17} /> 可建立多个独立写作库
          </span>
          <span>
            <PenLine size={17} /> 随时切换不同写作场景
          </span>
        </div>
      </section>

      <section className="library-onboarding-card">
        <header>
          <span>第 1 步</span>
          <h2>创建第一个写作库</h2>
          <p>名称用于 Nibva 内显示；存储位置可以使用默认目录，也可以由你决定。</p>
        </header>
        <LibrarySetupForm
          defaultParentPath={defaultParentPath}
          submitLabel="创建并开始写作"
          busy={busy}
          onChooseParent={onChooseParent}
          onSubmit={createLibrary}
        />
        <div className="library-onboarding-existing">
          <span>已经有 Nibva 写作库？</span>
          <button type="button" disabled={busy} onClick={openExistingLibrary}>
            <FolderOpen size={15} /> 打开已有文件夹
          </button>
        </div>
        {openError && <p className="library-setup-error">{openError}</p>}
      </section>
    </main>
  );
}
