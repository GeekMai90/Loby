/**
 * [INPUT]: 依赖 lucide 项目外观配置、React DOM Portal 与写作项目模型
 * [OUTPUT]: 对外提供跟随指针且脱离导航栏裁切的 ProjectDragPreview
 * [POS]: library components 的项目排序反馈层，只呈现拖拽快照，不拥有排序状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { createPortal } from "react-dom";
import { getProjectIconColor, getProjectIconOption } from "@/features/library/constants/projectAppearance";
import type { WritingProject } from "@/shared/types";

interface ProjectDragPreviewProps {
  project: WritingProject;
  x: number;
  y: number;
}

export function ProjectDragPreview({ project, x, y }: ProjectDragPreviewProps) {
  const previewWidth = 184;
  const iconCenterX = 22;
  const iconCenterY = 20;
  const left = Math.min(Math.max(12, x - iconCenterX), Math.max(12, window.innerWidth - previewWidth - 12));
  const top = Math.min(Math.max(12, y - iconCenterY), Math.max(12, window.innerHeight - 52));
  const ProjectIcon = getProjectIconOption(project.icon).Icon;
  const iconColor = getProjectIconColor(project.iconColor);

  return createPortal(
    <div className="project-drag-preview" style={{ left, top }} aria-hidden="true">
      <span className="project-drag-preview-icon" style={{ color: iconColor }}>
        <ProjectIcon />
      </span>
      <strong>{project.title}</strong>
    </div>,
    document.body,
  );
}
