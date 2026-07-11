import clsx from "clsx";
import { Check } from "lucide-react";
import { APP_THEME_OPTIONS, EDITOR_THEME_OPTIONS } from "../../constants/themes";
import type { AppThemePreference, EditorThemeId, ResolvedAppTheme } from "../../types";
import { SettingsSection, SettingsSegmentedControl } from "./SettingsControls";

interface AppearanceSettingsPanelProps {
  appTheme: AppThemePreference;
  resolvedAppTheme: ResolvedAppTheme;
  editorTheme: EditorThemeId;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
}

export function AppearanceSettingsPanel({
  appTheme,
  resolvedAppTheme,
  editorTheme,
  onAppThemeChange,
  onEditorThemeChange,
}: AppearanceSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="应用主题">
        <SettingsSegmentedControl label="外观" value={appTheme} options={APP_THEME_OPTIONS} onChange={onAppThemeChange} />
        <p className="settings-section-note">
          {appTheme === "system" ? `当前跟随系统使用${resolvedAppTheme === "dark" ? "深色" : "浅色"}外观。` : "应用界面会保持所选外观。"}
        </p>
      </SettingsSection>

      <SettingsSection title="编辑器主题">
        <div className="editor-theme-grid" role="radiogroup" aria-label="编辑器主题">
          {EDITOR_THEME_OPTIONS.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={clsx("editor-theme-card", editorTheme === theme.id && "selected")}
              role="radio"
              aria-checked={editorTheme === theme.id}
              onClick={() => onEditorThemeChange(theme.id)}
            >
              <span className="editor-theme-preview" data-preview-theme={theme.id} aria-hidden="true">
                <span className="editor-theme-preview-title">Aa</span>
                <span className="editor-theme-preview-line wide" />
                <span className="editor-theme-preview-line" />
                <span className="editor-theme-preview-quote" />
              </span>
              <span className="editor-theme-card-copy">
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
                <em>{theme.sourceLabel}</em>
              </span>
              <span className="editor-theme-swatches" aria-hidden="true">
                {theme.swatches.map((color) => (
                  <i key={color} style={{ backgroundColor: color }} />
                ))}
              </span>
              {editorTheme === theme.id && (
                <span className="editor-theme-check" aria-hidden="true">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="settings-section-note">编辑器主题独立于应用外观，并会自动使用匹配的浅色或深色版本。</p>
      </SettingsSection>
    </>
  );
}
