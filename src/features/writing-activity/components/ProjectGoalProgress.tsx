/**
 * [INPUT]: 依赖 React 运行时、写作活动模块、shared 公共契约
 * [OUTPUT]: 对外提供 ProjectGoalProgress
 * [POS]: 写作活动 feature 的界面组合单元，连接写作活动状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type { CSSProperties } from "react";
import { normalizeProjectGoal, projectGoalProgress, projectGoalValue } from "@/features/writing-activity/model/writingGoals";
import type { WritingProject } from "@/shared/types";

export function ProjectGoalProgress({ project }: { project: WritingProject }) {
  const goal = normalizeProjectGoal(project);
  if (!goal.enabled) return null;

  const currentValue = projectGoalValue(project);
  const progress = projectGoalProgress(project);
  const unit = goal.unit === "articles" ? "篇" : "字";
  const label = goal.unit === "articles" ? "文章进度" : "字数进度";
  const progressDescription = `${currentValue.toLocaleString()} / ${goal.target.toLocaleString()} ${unit}`;
  const progressStyle = { "--project-goal-progress": `${progress}%` } as CSSProperties;

  return (
    <div
      className="project-goal-progress mb-2"
      role="progressbar"
      tabIndex={0}
      aria-label={`项目${label}：${progressDescription}，已完成 ${progress}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      style={progressStyle}
    >
      <div className="project-goal-progress-header">
        <span className="project-goal-progress-title">项目目标</span>
        <span className="project-goal-progress-value">{progress}%</span>
      </div>
      <div className="project-goal-progress-metrics">
        <span>当前</span>
        <strong>
          {currentValue.toLocaleString()} {unit}
        </strong>
        <span>目标</span>
        <strong>
          {goal.target.toLocaleString()} {unit}
        </strong>
      </div>
      <div className="project-goal-progress-track">
        <div className="project-goal-progress-fill" />
      </div>
    </div>
  );
}
