import { Folder, HardDrive, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LibrarySetupFormProps {
  defaultParentPath: string;
  submitLabel: string;
  busy?: boolean;
  onChooseParent: () => Promise<string | null>;
  onSubmit: (name: string, parentPath?: string) => Promise<void> | void;
}

export function LibrarySetupForm({ defaultParentPath, submitLabel, busy = false, onChooseParent, onSubmit }: LibrarySetupFormProps) {
  const [name, setName] = useState("我的写作库");
  const [locationMode, setLocationMode] = useState<"default" | "custom">("default");
  const [customParentPath, setCustomParentPath] = useState("");
  const [error, setError] = useState("");
  const targetPath = useMemo(
    () => joinDisplayPath(locationMode === "default" ? defaultParentPath : customParentPath, name),
    [customParentPath, defaultParentPath, locationMode, name],
  );

  async function chooseCustomParent() {
    const selected = await onChooseParent();
    if (!selected) return;
    setCustomParentPath(selected);
    setLocationMode("custom");
    setError("");
  }

  async function submit() {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError("请输入写作库名称。");
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
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted-foreground">写作库名称</span>
        <Input value={name} maxLength={80} autoFocus onChange={(event) => setName(event.target.value)} placeholder="例如：个人写作" />
      </label>

      <fieldset className="m-0 grid grid-cols-2 gap-2.5 border-0 p-0">
        <legend className="mb-2 text-xs font-semibold text-muted-foreground">存储位置</legend>
        <Button
          type="button"
          variant={locationMode === "default" ? "secondary" : "outline"}
          className="h-auto w-full justify-start gap-3 p-3 text-left whitespace-normal"
          onClick={() => {
            setLocationMode("default");
            setError("");
          }}
        >
          <HardDrive />
          <span className="min-w-0">
            <strong className="block">使用 Nibva 默认目录</strong>
            <small className="mt-1 block truncate text-xs font-normal text-muted-foreground">
              {defaultParentPath || "正在读取默认目录…"}
            </small>
          </span>
        </Button>
        <Button
          type="button"
          variant={locationMode === "custom" ? "secondary" : "outline"}
          className="h-auto w-full justify-start gap-3 p-3 text-left whitespace-normal"
          onClick={chooseCustomParent}
        >
          <Folder />
          <span className="min-w-0">
            <strong className="block">选择其他位置</strong>
            <small className="mt-1 block truncate text-xs font-normal text-muted-foreground">
              {customParentPath || "本地磁盘、iCloud Drive 或其他文件夹"}
            </small>
          </span>
        </Button>
      </fieldset>

      <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
        <MapPin size={14} />
        <span className="truncate">{targetPath || "选择位置后会在这里显示完整路径"}</span>
      </div>
      {error && <p className="m-0 text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        className="w-full"
        disabled={busy || (locationMode === "default" ? !defaultParentPath : !customParentPath)}
        onClick={submit}
      >
        {busy ? "正在准备写作库…" : submitLabel}
      </Button>
    </div>
  );
}

function joinDisplayPath(parent: string, name: string): string {
  if (!parent) return "";
  if (parent.startsWith("Browser")) return `${parent} / ${name.trim() || "写作库名称"}`;
  return `${parent.replace(/[\\/]+$/, "")}/${name.trim() || "写作库名称"}`;
}
