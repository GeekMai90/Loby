/**
 * [INPUT]: 依赖 React 运行时、AI 助手图片预览模型、写作库原生图片预览能力与全局反馈
 * [OUTPUT]: 对外提供 AssistantActionImagePreview，完整显示 action 生成图片并用 macOS Quick Look 查看本地原图
 * [POS]: AI 助手消息成果层的图片查看器；复用编辑器预览链路，不维护独立网页 lightbox
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import type { InsertImageActionPreview } from "@/features/assistant/model/assistantActionImagePreview";
import { previewImage } from "@/features/library/model/persistence";
import { showAppToast } from "@/shared/lib/appToast";

export function AssistantActionImagePreview({ preview }: { preview: InsertImageActionPreview }) {
  const [failed, setFailed] = useState(false);
  const supportsNativePreview = preview.sourcePath.startsWith("/") || /^https?:\/\//i.test(preview.sourcePath);

  useEffect(() => {
    setFailed(false);
  }, [preview.src]);

  if (failed) return null;

  return (
    <figure
      className="assistant-action-image-preview"
      data-native-preview={supportsNativePreview ? "true" : "false"}
      data-slot="assistant-action-image-artifact"
    >
      <img
        src={preview.src}
        alt={preview.alt || "图片预览"}
        title={supportsNativePreview ? "双击快速查看" : undefined}
        onDoubleClick={supportsNativePreview ? () => openNativePreview(preview.sourcePath) : undefined}
        onError={() => setFailed(true)}
      />
    </figure>
  );
}

function openNativePreview(sourcePath: string) {
  previewImage(sourcePath).catch(() => {
    showAppToast({ variant: "error", title: "预览失败", description: "暂时无法打开这张图片" });
  });
}
