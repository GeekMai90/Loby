import { Folder, HardDrive, MapPin } from "lucide-react";
import { useMemo, useState } from "react";

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
    <div className="library-setup-form">
      <label className="library-setup-field">
        <span>写作库名称</span>
        <input value={name} maxLength={80} autoFocus onChange={(event) => setName(event.target.value)} placeholder="例如：个人写作" />
      </label>

      <fieldset className="library-location-options">
        <legend>存储位置</legend>
        <button
          type="button"
          className={locationMode === "default" ? "selected" : ""}
          onClick={() => {
            setLocationMode("default");
            setError("");
          }}
        >
          <HardDrive size={18} />
          <span>
            <strong>使用 Nibva 默认目录</strong>
            <small>{defaultParentPath || "正在读取默认目录…"}</small>
          </span>
        </button>
        <button type="button" className={locationMode === "custom" ? "selected" : ""} onClick={chooseCustomParent}>
          <Folder size={18} />
          <span>
            <strong>选择其他位置</strong>
            <small>{customParentPath || "本地磁盘、iCloud Drive 或其他文件夹"}</small>
          </span>
        </button>
      </fieldset>

      <div className="library-target-path">
        <MapPin size={14} />
        <span>{targetPath || "选择位置后会在这里显示完整路径"}</span>
      </div>
      {error && <p className="library-setup-error">{error}</p>}
      <button
        type="button"
        className="primary-button library-setup-submit"
        disabled={busy || (locationMode === "default" ? !defaultParentPath : !customParentPath)}
        onClick={submit}
      >
        {busy ? "正在准备写作库…" : submitLabel}
      </button>
    </div>
  );
}

function joinDisplayPath(parent: string, name: string): string {
  if (!parent) return "";
  if (parent.startsWith("Browser")) return `${parent} / ${name.trim() || "写作库名称"}`;
  return `${parent.replace(/[\\/]+$/, "")}/${name.trim() || "写作库名称"}`;
}
