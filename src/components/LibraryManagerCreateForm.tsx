import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

interface LibraryManagerCreateFormProps {
  busy?: boolean;
  onBack: () => void;
  onChooseLocation: () => Promise<string | null>;
  onSubmit: (name: string, parentPath: string) => Promise<void> | void;
}

export function LibraryManagerCreateForm({ busy = false, onBack, onChooseLocation, onSubmit }: LibraryManagerCreateFormProps) {
  const [name, setName] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [error, setError] = useState("");

  async function chooseLocation() {
    const selected = await onChooseLocation();
    if (!selected) return;
    setParentPath(selected);
    setError("");
  }

  async function submit() {
    const normalizedName = name.trim();
    if (!normalizedName || !parentPath) return;
    setError("");
    try {
      await onSubmit(normalizedName, parentPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div className="size-full px-1">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" disabled={busy} onClick={onBack}>
        <ArrowLeft /> 返回
      </Button>
      <h3 className="mt-0.5 mb-3.5 text-base font-semibold">创建本地写作库</h3>

      <div className="rounded-xl border border-border bg-muted/30 px-3.5">
        <label className="grid min-h-22 grid-cols-[minmax(0,1fr)_minmax(160px,205px)] items-center gap-5">
          <span>
            <strong className="block text-base font-medium">写作库名称</strong>
            <small className="mt-1 block text-xs leading-snug text-muted-foreground">给新的写作库起一个名字。</small>
          </span>
          <Input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="写作库名称" />
        </label>

        <div className="grid min-h-22 grid-cols-[minmax(0,1fr)_minmax(160px,205px)] items-center gap-5 border-t border-border">
          <span>
            <strong className="block text-base font-medium">写作库位置</strong>
            <small className="mt-1 block text-xs leading-snug text-muted-foreground">指定新写作库的存放位置。</small>
          </span>
          <div className="grid min-w-0 justify-items-end gap-1">
            <Button type="button" variant="outline" className="w-25" disabled={busy} onClick={() => void chooseLocation()}>
              浏览
            </Button>
            <small className="block w-full truncate text-right text-xs text-muted-foreground" title={parentPath}>
              {parentPath || "尚未选择位置"}
            </small>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex justify-center">
        <Button type="button" disabled={busy || !name.trim() || !parentPath} onClick={() => void submit()}>
          {busy ? "正在创建…" : "创建"}
        </Button>
      </div>
    </div>
  );
}
