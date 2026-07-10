import { useEffect, useState } from "react";
import type { InsertImageActionPreview } from "../lib/assistantActionImagePreview";

export function AssistantActionImagePreview({ preview }: { preview: InsertImageActionPreview }) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setFailed(false);
    setOpen(false);
  }, [preview.src]);

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (failed) return null;

  return (
    <>
      <figure className="assistant-action-image-preview">
        <img
          src={preview.src}
          alt={preview.alt || "图片预览"}
          title="双击放大查看"
          onDoubleClick={() => setOpen(true)}
          onError={() => setFailed(true)}
        />
        <figcaption>{preview.label}</figcaption>
      </figure>
      {open && (
        <div className="assistant-action-image-lightbox" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <img src={preview.src} alt={preview.alt || "图片预览"} onClick={(event) => event.stopPropagation()} />
          <span>{preview.label}</span>
        </div>
      )}
    </>
  );
}
