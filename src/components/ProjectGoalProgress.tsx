import type { CSSProperties } from "react";
import { normalizeProjectGoal, projectGoalProgress, projectGoalValue } from "../lib/writingGoals";
import type { WritingProject } from "../types";

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
      <div className="project-goal-progress-details">
        <span className="project-goal-progress-title">项目目标</span>
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
      </div>
      <div className="project-goal-progress-track">
        <div className="project-goal-progress-fill" />
        <span className="project-goal-progress-particles" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <span className="project-goal-progress-value">{progress}%</span>
    </div>
  );
}
