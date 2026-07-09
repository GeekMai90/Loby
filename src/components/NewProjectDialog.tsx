import clsx from "clsx";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { getProjectIconOption, PROJECT_COLOR_OPTIONS, PROJECT_ICON_OPTIONS, type NewProjectDraft } from "../constants/projectAppearance";

interface NewProjectDialogProps {
  open: boolean;
  draft: NewProjectDraft;
  inputRef: RefObject<HTMLInputElement | null>;
  title?: string;
  submitLabel?: string;
  showAppearanceControls?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onDraftChange: Dispatch<SetStateAction<NewProjectDraft>>;
}

export function NewProjectDialog({
  open,
  draft,
  inputRef,
  title = "新建项目",
  submitLabel = "创建",
  showAppearanceControls = true,
  onClose,
  onSubmit,
  onDraftChange,
}: NewProjectDialogProps) {
  if (!open) return null;

  const selectedIcon = getProjectIconOption(draft.icon);
  const SelectedProjectIcon = selectedIcon.Icon;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="project-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <header className="project-dialog-header">
          <div className="project-dialog-icon-preview" style={{ color: draft.iconColor, backgroundColor: `${draft.iconColor}18` }}>
            <SelectedProjectIcon size={22} />
          </div>
          <div>
            <h2 id="new-project-dialog-title">{title}</h2>
          </div>
        </header>

        <label className="project-dialog-field">
          <span>名称</span>
          <input
            ref={inputRef}
            autoFocus
            value={draft.title}
            onChange={(event) => onDraftChange((current) => ({ ...current, title: event.target.value }))}
          />
        </label>

        {showAppearanceControls && (
          <>
            <section className="project-dialog-section">
              <span>图标</span>
              <div className="project-icon-picker">
                {PROJECT_ICON_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={clsx("project-icon-choice", draft.icon === option.id && "selected")}
                    onClick={() => onDraftChange((current) => ({ ...current, icon: option.id }))}
                    title={option.label}
                  >
                    <option.Icon size={18} />
                  </button>
                ))}
              </div>
            </section>

            <section className="project-dialog-section">
              <span>图标颜色</span>
              <div className="project-color-picker">
                {PROJECT_COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={clsx("project-color-choice", draft.iconColor === option.value && "selected")}
                    onClick={() => onDraftChange((current) => ({ ...current, iconColor: option.value }))}
                    title={option.label}
                    style={{ backgroundColor: option.value }}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="project-dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary-button">
            {submitLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}
