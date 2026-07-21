import { Folder } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLibraryParentPath } from "@/lib/libraryDisplayPath";

interface LibrarySetupFormProps {
  defaultParentPath: string;
  submitLabel: string;
  busy?: boolean;
  onChooseParent: () => Promise<string | null>;
  onSubmit: (name: string, parentPath?: string) => Promise<void> | void;
}

export function LibrarySetupForm({ defaultParentPath, submitLabel, busy = false, onChooseParent, onSubmit }: LibrarySetupFormProps) {
  const [name, setName] = useState("LobyLibrary");
  const [locationMode, setLocationMode] = useState<"default" | "custom">("default");
  const [customParentPath, setCustomParentPath] = useState("");
  const [error, setError] = useState("");
  const activeParentPath = locationMode === "default" ? defaultParentPath : customParentPath;

  async function chooseCustomParent() {
    const selected = await onChooseParent();
    if (!selected) return;
    setCustomParentPath(selected);
    setLocationMode("custom");
    setError("");
  }

  async function submit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("请输入写作文件夹名称。");
      return;
    }
    if (locationMode === "custom" && !customParentPath) {
      setError("请先选择自定义存储位置。");
      return;
    }
    setError("");
    try {
      await onSubmit(normalizedName, locationMode === "custom" ? customParentPath : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <form className="mt-14 flex w-full flex-col" onSubmit={submit}>
      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-foreground/80">写作文件夹名称</span>
        <Input
          className="h-14 rounded-xl px-4 text-base shadow-[0_1px_2px_rgb(0_0_0_/_3%)] focus-visible:ring-2 focus-visible:ring-primary/30 md:text-base"
          value={name}
          maxLength={80}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            void submit();
          }}
          placeholder="例如：LobyLibrary"
        />
      </label>

      <div className="mt-5 mb-2 text-[15px] font-medium text-foreground/80">保存到</div>
      <div className="flex h-14 min-w-0 items-center gap-3 rounded-xl border border-border bg-background px-4 shadow-[0_1px_2px_rgb(0_0_0_/_3%)]">
        <Folder className="size-5 shrink-0 text-foreground/80" />
        <span className="min-w-0 flex-1 truncate text-[15px]" title={activeParentPath || undefined}>
          {formatLibraryParentPath(activeParentPath)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {locationMode === "custom" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setLocationMode("default");
                setError("");
              }}
            >
              恢复默认
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={chooseCustomParent}>
            更改
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 mb-0 text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        className="mt-7 h-12 w-full rounded-xl text-base"
        disabled={busy || (locationMode === "default" ? !defaultParentPath : !customParentPath)}
      >
        {busy ? "正在准备写作文件夹…" : submitLabel}
      </Button>
    </form>
  );
}
