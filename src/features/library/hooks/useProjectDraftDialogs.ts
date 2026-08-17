/**
 * [INPUT]: 依赖 React 运行时、写作库模块、shared 公共契约与写作活动模块
 * [OUTPUT]: 对外提供 useProjectDraftDialogs，统一管理项目与项目/笔记分组的新建、编辑草稿及提交边界
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

interface UseProjectDraftDialogsOptions {
  activeProjectId: string;
  onCreateProject: (draft: NewProjectDraft) => void;
  onUpdateProject: (projectId: string, draft: NewProjectDraft) => void;
  onCreateGroup: (projectId: string, draft: NewProjectDraft) => void;
  onUpdateGroup: (projectId: string, groupId: string, draft: NewProjectDraft) => void | Promise<void>;
}

const EMPTY_PROJECT_DRAFT: NewProjectDraft = {
  title: DEFAULT_NEW_PROJECT_TITLE,
  icon: DEFAULT_PROJECT_ICON,
  iconColor: DEFAULT_PROJECT_ICON_COLOR,
  goalEnabled: false,
  goalUnit: "words",
  goalTarget: 0,
  publishingTargetId: "",
  publishingGroupMappings: [],
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
  onUpdateGroup,
}: UseProjectDraftDialogsOptions) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState("");
  const [projectDraft, setProjectDraft] = useState<NewProjectDraft>(EMPTY_PROJECT_DRAFT);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupDraft, setGroupDraft] = useState<NewProjectDraft>(EMPTY_GROUP_DRAFT);
  const [groupTargetProjectId, setGroupTargetProjectId] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");

  function openNewProjectDialog() {
    setEditingProjectId("");
    setProjectDraft({ ...EMPTY_PROJECT_DRAFT });
    setProjectDialogOpen(true);
  }

  function openEditProjectDialog(project: WritingProject) {
    const goal = normalizeProjectGoal(project);
    setEditingProjectId(project.id);
    setProjectDraft({
      title: project.title || DEFAULT_NEW_PROJECT_TITLE,
      icon: project.icon || DEFAULT_PROJECT_ICON,
      iconColor: project.iconColor || DEFAULT_PROJECT_ICON_COLOR,
      goalEnabled: goal.enabled,
      goalUnit: goal.unit,
      goalTarget: goal.target,
      publishingTargetId: project.publishingBinding?.targetId ?? "",
      publishingGroupMappings: project.publishingBinding?.groupMappings ?? [],
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
        publishingTargetId: projectDraft.publishingTargetId ?? "",
        publishingGroupMappings: projectDraft.publishingGroupMappings ?? [],
      });
    } else {
      onCreateProject(projectDraft);
    }
    closeProjectDialog();
  }

  function openGroupDialog(targetProjectId = activeProjectId) {
    setGroupTargetProjectId(targetProjectId);
    setEditingGroupId("");
    setGroupDraft({ ...EMPTY_GROUP_DRAFT });
    setGroupDialogOpen(true);
  }

  function openEditGroupDialog(project: WritingProject, groupId: string) {
    const group = project.groups?.find((item) => item.id === groupId);
    if (!group) return;
    setGroupTargetProjectId(project.id);
    setEditingGroupId(group.id);
    setGroupDraft({
      title: group.title || EMPTY_GROUP_DRAFT.title,
      icon: group.icon || DEFAULT_PROJECT_ICON,
      iconColor: group.iconColor || DEFAULT_PROJECT_ICON_COLOR,
    });
    setGroupDialogOpen(true);
  }

  function closeGroupDialog() {
    setGroupDialogOpen(false);
    setGroupTargetProjectId("");
    setEditingGroupId("");
  }

  async function submitGroupDialog() {
    try {
      const projectId = groupTargetProjectId || activeProjectId;
      if (editingGroupId) {
        await onUpdateGroup(projectId, editingGroupId, {
          title: groupDraft.title.trim() || EMPTY_GROUP_DRAFT.title,
          icon: groupDraft.icon || DEFAULT_PROJECT_ICON,
          iconColor: groupDraft.iconColor || DEFAULT_PROJECT_ICON_COLOR,
        });
      } else {
        onCreateGroup(projectId, groupDraft);
      }
      closeGroupDialog();
    } catch {
      // 提交失败时保留弹窗和草稿，让调用方的状态栏错误可见并允许修正后重试。
    }
  }

  return {
    projectDialogOpen,
    groupDialogOpen,
    editingGroupId,
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
    openEditGroupDialog,
    closeGroupDialog,
    submitGroupDialog,
  };
}
