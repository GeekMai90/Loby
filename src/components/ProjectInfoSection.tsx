import { Archive, Check, ChevronDown, Download, PenLine } from "lucide-react";
import { PROJECT_STATUS_FLOW } from "../lib/projectModel";
import type { ProjectStatus, WritingProject } from "../types";

interface ProjectInfoSectionProps {
  activeProject: WritingProject;
  tagText: string;
  nextProjectStatus: ProjectStatus | null;
  updateProject: (updater: (project: WritingProject) => WritingProject) => void;
  getCurrentDate: () => string;
  onSetProjectWorkflowStatus: (status: ProjectStatus) => void;
}

export function ProjectInfoSection({
  activeProject,
  tagText,
  nextProjectStatus,
  updateProject,
  getCurrentDate,
  onSetProjectWorkflowStatus,
}: ProjectInfoSectionProps) {
  return (
    <section className="panel-section">
      <h2>项目信息</h2>
      <label>
        状态
        <select
          value={activeProject.status}
          onChange={(event) =>
            updateProject((project) => ({ ...project, status: event.target.value as ProjectStatus, updatedAt: getCurrentDate() }))
          }
        >
          {PROJECT_STATUS_FLOW.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </label>
      <label>
        目标平台
        <input
          value={activeProject.targetPlatform}
          placeholder="公众号 / 小红书 / 网站 / 书稿"
          onChange={(event) =>
            updateProject((project) => ({ ...project, targetPlatform: event.target.value, updatedAt: getCurrentDate() }))
          }
        />
      </label>
      <label>
        目标字数
        <input
          type="number"
          value={activeProject.targetWords}
          onChange={(event) =>
            updateProject((project) => ({ ...project, targetWords: Number(event.target.value), updatedAt: getCurrentDate() }))
          }
        />
      </label>
      <label>
        标签
        <input
          value={tagText}
          placeholder="产品, 写作软件, AI Native"
          onChange={(event) =>
            updateProject((project) => ({
              ...project,
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              updatedAt: getCurrentDate(),
            }))
          }
        />
      </label>
      <label>
        描述
        <textarea
          value={activeProject.description}
          onChange={(event) => updateProject((project) => ({ ...project, description: event.target.value, updatedAt: getCurrentDate() }))}
        />
      </label>
      <div className="workflow-actions">
        {nextProjectStatus && (
          <button className="secondary-button" onClick={() => onSetProjectWorkflowStatus(nextProjectStatus)}>
            <ChevronDown size={16} /> 推进到{nextProjectStatus}
          </button>
        )}
        <button className="secondary-button" onClick={() => onSetProjectWorkflowStatus("待发布")}>
          <Download size={16} /> 待发布
        </button>
        <button className="primary-button" onClick={() => onSetProjectWorkflowStatus("已发布")}>
          <Check size={16} /> 已发布
        </button>
        {(activeProject.status === "已发布" || activeProject.status === "已归档") && (
          <button
            className="secondary-button"
            onClick={() => onSetProjectWorkflowStatus("已归档")}
            disabled={activeProject.status === "已归档"}
          >
            <Archive size={16} /> 归档
          </button>
        )}
        {(activeProject.status === "已发布" || activeProject.status === "已归档") && (
          <button className="secondary-button" onClick={() => onSetProjectWorkflowStatus("修改中")}>
            <PenLine size={16} /> 恢复修改
          </button>
        )}
      </div>
    </section>
  );
}
