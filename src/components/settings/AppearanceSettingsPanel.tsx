import { Check } from "lucide-react";
import { APP_THEME_OPTIONS, EDITOR_THEME_OPTIONS } from "../../constants/themes";
import type { AppThemePreference, EditorThemeId, ResolvedAppTheme } from "../../types";
import { SettingsSection, SettingsSegmentedControl } from "./SettingsControls";
import { Button } from "@/components/ui/button";

interface AppearanceSettingsPanelProps {
  appTheme: AppThemePreference;
  appThemeOverride: ResolvedAppTheme | null;
  resolvedAppTheme: ResolvedAppTheme;
  editorTheme: EditorThemeId;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
}

export function AppearanceSettingsPanel({
  appTheme,
  appThemeOverride,
  resolvedAppTheme,
  editorTheme,
  onAppThemeChange,
  onEditorThemeChange,
}: AppearanceSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="应用主题">
        <SettingsSegmentedControl label="外观" value={appTheme} options={APP_THEME_OPTIONS} onChange={onAppThemeChange} />
        <p className="-mt-px mx-0.5 text-[11px] leading-6 text-muted-foreground">
          {appThemeOverride
            ? appTheme === "system"
              ? `当前由主界面临时切换为${appThemeOverride === "dark" ? "深色" : "浅色"}外观；系统外观下次变化或重新启动后会恢复跟随系统。`
              : `当前由主界面临时切换为${appThemeOverride === "dark" ? "深色" : "浅色"}外观；重新启动或在此更改主题后会恢复设置中的${appTheme === "dark" ? "深色" : "浅色"}外观。`
            : appTheme === "system"
              ? `当前跟随系统使用${resolvedAppTheme === "dark" ? "深色" : "浅色"}外观。`
              : "应用界面会保持所选外观。"}
        </p>
      </SettingsSection>

      <SettingsSection title="编辑器主题">
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="编辑器主题">
          {EDITOR_THEME_OPTIONS.map((theme) => (
            <Button
              key={theme.id}
              type="button"
              variant={editorTheme === theme.id ? "secondary" : "outline"}
              className="relative grid h-auto min-w-0 w-full grid-cols-[84px_minmax(0,1fr)] grid-rows-[1fr_auto] gap-x-3 gap-y-2 p-2.5 text-left whitespace-normal"
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
              <span className="flex min-w-0 flex-col gap-0.75">
                <strong className="text-[13px] font-bold">{theme.name}</strong>
                <small className="line-clamp-2 overflow-hidden text-[11px] leading-[1.4] font-normal text-muted-foreground">
                  {theme.description}
                </small>
                <em className="text-[10px] font-normal not-italic text-muted-foreground">{theme.sourceLabel}</em>
              </span>
              <span
                className="flex items-center gap-1 [&_i]:size-3.5 [&_i]:rounded-full [&_i]:border [&_i]:border-foreground/10"
                aria-hidden="true"
              >
                {theme.swatches.map((color) => (
                  <i key={color} style={{ backgroundColor: color }} />
                ))}
              </span>
              {editorTheme === theme.id && (
                <span
                  className="absolute top-1.75 right-1.75 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
                  aria-hidden="true"
                >
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </Button>
          ))}
        </div>
        <p className="-mt-px mx-0.5 text-[11px] leading-6 text-muted-foreground">
          编辑器主题独立于应用外观，并会自动使用匹配的浅色或深色版本。
        </p>
      </SettingsSection>
    </>
  );
}
