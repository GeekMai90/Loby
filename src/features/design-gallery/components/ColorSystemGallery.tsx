/**
 * [INPUT]: 依赖 lucide-react、ColorAuditGallery 与 DeveloperGalleryShell
 * [OUTPUT]: 对外提供 ColorSystemGallery 开发态颜色治理页面
 * [POS]: design-gallery 的颜色系统入口，独立承载亮暗色板、语义映射和源码审计，不混入组件陈列
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { SwatchBook } from "lucide-react";
import { ColorAuditGallery } from "@/features/design-gallery/components/ColorAuditGallery";
import { DeveloperGalleryShell } from "@/features/design-gallery/components/DeveloperGalleryShell";

export function ColorSystemGallery({ onClose }: { onClose: () => void }) {
  return (
    <DeveloperGalleryShell
      icon={SwatchBook}
      title="颜色系统"
      summary="Light / Dark 色板、语义与源码审计"
      closeLabel="关闭颜色系统"
      contentLabel="颜色系统审计矩阵"
      onClose={onClose}
    >
      <ColorAuditGallery />
    </DeveloperGalleryShell>
  );
}
