/**
 * [INPUT]: 依赖 React 运行时、写作库模块
 * [OUTPUT]: 对外提供 ProjectDraftDialogsProps、ProjectDraftDialogs，区分新建分组与分组设置的标题、草稿和提交文案
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { NewProjectDraft } from "@/features/library/constants/projectAppearance";
import { NewProjectDialog } from "@/features/library/components/NewProjectDialog";

export interface ProjectDraftDialogsProps {
  projectDialogOpen: boolean;
  groupDialogOpen: boolean;
  editingProjectId: string;
  editingGroupId: string;
  projectDraft: NewProjectDraft;
  groupDraft: NewProjectDraft;
  projectAdditionalSettings?: ReactNode;
  onCloseProject: () => void;
  onSubmitProject: () => void;
  onProjectDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
  onCloseGroup: () => void;
  onSubmitGroup: () => void;
  onGroupDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
}

export function ProjectDraftDialogs({
  projectDialogOpen,
  groupDialogOpen,
  editingProjectId,
  editingGroupId,
  projectDraft,
  groupDraft,
  projectAdditionalSettings,
  onCloseProject,
  onSubmitProject,
  onProjectDraftChange,
  onCloseGroup,
  onSubmitGroup,
  onGroupDraftChange,
}: ProjectDraftDialogsProps) {
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);
  const groupNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!projectDialogOpen) return;
    window.setTimeout(() => {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }, 0);
  }, [projectDialogOpen]);

  useEffect(() => {
    if (!groupDialogOpen) return;
    window.setTimeout(() => {
      groupNameInputRef.current?.focus();
      groupNameInputRef.current?.select();
    }, 0);
  }, [groupDialogOpen]);

  return (
    <>
      {projectDialogOpen && (
        <NewProjectDialog
          open
          draft={projectDraft}
          inputRef={projectNameInputRef}
          title={editingProjectId ? "编辑项目" : "新建项目"}
          submitLabel={editingProjectId ? "保存" : "创建"}
          additionalSettings={editingProjectId ? projectAdditionalSettings : undefined}
          onClose={onCloseProject}
          onSubmit={onSubmitProject}
          onDraftChange={onProjectDraftChange}
        />
      )}
      {groupDialogOpen && (
        <NewProjectDialog
          open
          draft={groupDraft}
          inputRef={groupNameInputRef}
          title={editingGroupId ? "分组设置" : "新建分组"}
          submitLabel={editingGroupId ? "保存" : "创建"}
          showGoalControls={false}
          onClose={onCloseGroup}
          onSubmit={onSubmitGroup}
          onDraftChange={onGroupDraftChange}
        />
      )}
    </>
  );
}
