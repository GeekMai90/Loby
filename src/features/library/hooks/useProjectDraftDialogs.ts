/**
 * [INPUT]: 依赖 React 运行时、写作库模块、shared 公共契约、写作活动模块、编辑器模块
 * [OUTPUT]: 对外提供 useProjectDraftDialogs
 * [POS]: 写作库 feature 的React 协调边界，封装 写作库 状态、副作用与用户动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useState } from "react";
import {
  DEFAULT_NEW_PROJECT_TITLE,
  DEFAULT_PROJECT_ICON,
  DEFAULT_PROJECT_ICON_COLOR,
  type NewProjectDraft,
} from "@/features/library/constants/projectAppearance";
import type { WritingProject } from "@/shared/types";
import { normalizeProjectGoal } from "@/features/writing-activity/model/writingGoals";
import { projectArticleGoalTarget } from "@/features/editor/model/documentProperties";

interface UseProjectDraftDialogsOptions {
  activeProjectId: string;
  onCreateProject: (draft: NewProjectDraft) => void;
  onUpdateProject: (projectId: string, draft: NewProjectDraft) => void;
  onCreateGroup: (projectId: string, draft: NewProjectDraft) => void;
}

const EMPTY_PROJECT_DRAFT: NewProjectDraft = {
  title: DEFAULT_NEW_PROJECT_TITLE,
  icon: DEFAULT_PROJECT_ICON,
  iconColor: DEFAULT_PROJECT_ICON_COLOR,
  goalEnabled: false,
  goalUnit: "words",
  goalTarget: 0,
  articleGoalEnabled: true,
  articleGoalTarget: 1000,
  blogEnabled: false,
  blogName: "GitHub 发布",
  blogRepository: "",
  blogBranch: "main",
  blogContentRoot: "content/posts",
  blogSiteUrl: "",
};

const EMPTY_GROUP_DRAFT: NewProjectDraft = {
  title: "无标题",
  icon: DEFAULT_PROJECT_ICON,
  iconColor: DEFAULT_PROJECT_ICON_COLOR,
};

export function useProjectDraftDialogs({
  activeProjectId,
  onCreateProject,
  onUpdateProject,
  onCreateGroup,
}: UseProjectDraftDialogsOptions) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [projectDraft, setProjectDraft] = useState<NewProjectDraft>(EMPTY_PROJECT_DRAFT);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState<NewProjectDraft>(EMPTY_GROUP_DRAFT);
  const [groupTargetProjectId, setGroupTargetProjectId] = useState("");

  function openNewProjectDialog() {
    setEditingProjectId("");
    setProjectDraft({ ...EMPTY_PROJECT_DRAFT });
    setProjectDialogOpen(true);
  }

  function openEditProjectDialog(project: WritingProject) {
    const goal = normalizeProjectGoal(project);
    const articleGoalTarget = projectArticleGoalTarget(project);
    setEditingProjectId(project.id);
    setProjectDraft({
      title: project.title || DEFAULT_NEW_PROJECT_TITLE,
      icon: project.icon || DEFAULT_PROJECT_ICON,
      iconColor: project.iconColor || DEFAULT_PROJECT_ICON_COLOR,
      goalEnabled: goal.enabled,
      goalUnit: goal.unit,
      goalTarget: goal.target,
      articleGoalEnabled: articleGoalTarget > 0,
      articleGoalTarget,
      blogEnabled: Boolean(project.blogPublishing?.enabled),
      blogName: project.blogPublishing?.name?.trim() || "GitHub 发布",
      blogRepository: project.blogPublishing?.repository ?? "",
      blogBranch: project.blogPublishing?.branch || "main",
      blogContentRoot: project.blogPublishing?.contentRoot || "content/posts",
      blogSiteUrl: project.blogPublishing?.siteUrl ?? "",
    });
    setProjectDialogOpen(true);
  }

  function closeProjectDialog() {
    setProjectDialogOpen(false);
    setEditingProjectId("");
  }

  function submitProjectDialog() {
    if (editingProjectId) {
      onUpdateProject(editingProjectId, {
        title: projectDraft.title.trim() || DEFAULT_NEW_PROJECT_TITLE,
        icon: projectDraft.icon || DEFAULT_PROJECT_ICON,
        iconColor: projectDraft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
        goalEnabled: Boolean(projectDraft.goalEnabled),
        goalUnit: projectDraft.goalUnit ?? "words",
        goalTarget: Math.max(0, Math.round(projectDraft.goalTarget ?? 0)),
        articleGoalEnabled: Boolean(projectDraft.articleGoalEnabled),
        articleGoalTarget: Math.max(0, Math.round(projectDraft.articleGoalTarget ?? 0)),
        blogEnabled: Boolean(projectDraft.blogEnabled),
        blogName: projectDraft.blogName?.trim() || "GitHub 发布",
        blogRepository: projectDraft.blogRepository?.trim() ?? "",
        blogBranch: projectDraft.blogBranch?.trim() || "main",
        blogContentRoot: projectDraft.blogContentRoot?.trim() || "content/posts",
        blogSiteUrl: projectDraft.blogSiteUrl?.trim() ?? "",
      });
    } else {
      onCreateProject(projectDraft);
    }
    closeProjectDialog();
  }

  function openGroupDialog(targetProjectId = activeProjectId) {
    setGroupTargetProjectId(targetProjectId);
    setGroupDraft({ ...EMPTY_GROUP_DRAFT });
    setGroupDialogOpen(true);
  }

  function closeGroupDialog() {
    setGroupDialogOpen(false);
    setGroupTargetProjectId("");
  }

  function submitGroupDialog() {
    onCreateGroup(groupTargetProjectId || activeProjectId, groupDraft);
    closeGroupDialog();
  }

  return {
    projectDialogOpen,
    groupDialogOpen,
    editingProjectId,
    projectDraft,
    groupDraft,
    setProjectDraft,
    setGroupDraft,
    openNewProjectDialog,
    openEditProjectDialog,
    closeProjectDialog,
    submitProjectDialog,
    openGroupDialog,
    closeGroupDialog,
    submitGroupDialog,
  };
}
