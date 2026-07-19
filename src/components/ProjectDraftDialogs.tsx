import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { NewProjectDraft } from "../constants/projectAppearance";
import { NewProjectDialog } from "./NewProjectDialog";

interface ProjectDraftDialogsProps {
  projectDialogOpen: boolean;
  groupDialogOpen: boolean;
  editingProjectId: string;
  projectDraft: NewProjectDraft;
  groupDraft: NewProjectDraft;
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
  projectDraft,
  groupDraft,
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
          title="新建组"
          showGoalControls={false}
          onClose={onCloseGroup}
          onSubmit={onSubmitGroup}
          onDraftChange={onGroupDraftChange}
        />
      )}
    </>
  );
}
