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
    <div className="library-manager-create-flow">
      <button type="button" className="library-manager-create-back" disabled={busy} onClick={onBack}>
        <ArrowLeft size={14} /> 返回
      </button>
      <h3>创建本地写作库</h3>

      <div className="library-manager-create-card">
        <label className="library-manager-create-row">
          <span>
            <strong>写作库名称</strong>
            <small>给新的写作库起一个名字。</small>
          </span>
          <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="写作库名称" />
        </label>

        <div className="library-manager-create-row">
          <span>
            <strong>写作库位置</strong>
            <small>指定新写作库的存放位置。</small>
          </span>
          <div className="library-manager-location-control">
            <button type="button" className="secondary-button" disabled={busy} onClick={chooseLocation}>
              浏览
            </button>
            <small title={parentPath}>{parentPath || "尚未选择位置"}</small>
          </div>
        </div>
      </div>

      {error && <p className="library-setup-error">{error}</p>}
      <div className="library-manager-create-actions">
        <button type="button" className="primary-button" disabled={busy || !name.trim() || !parentPath} onClick={submit}>
          {busy ? "正在创建…" : "创建"}
        </button>
      </div>
    </div>
  );
}
