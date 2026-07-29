/**
 * [INPUT]: 依赖 lucide-react、shared 主题选项、设置表单基础控件与 shadcn/ui Button
 * [OUTPUT]: 对外提供 GeneralSettingsPanel
 * [POS]: settings feature 的通用面板，当前开放应用明暗主题 Select，并保留但暂时隐藏编辑器主题预览选择
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsSection, SettingsSelect } from "@/features/settings/components/SettingsControls";
import { APP_THEME_OPTIONS, EDITOR_THEME_OPTIONS } from "@/shared/constants/themes";
import type { AppThemePreference, EditorThemeId } from "@/shared/types";

interface GeneralSettingsPanelProps {
  appTheme: AppThemePreference;
  editorTheme: EditorThemeId;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
}

const SHOW_EDITOR_THEME_SETTINGS = false;

export function GeneralSettingsPanel({ appTheme, editorTheme, onAppThemeChange, onEditorThemeChange }: GeneralSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="应用主题">
        <SettingsSelect
          label="外观"
          value={appTheme}
          options={APP_THEME_OPTIONS}
          width="fit"
          contentAlign="end"
          onChange={onAppThemeChange}
        />
      </SettingsSection>

      {SHOW_EDITOR_THEME_SETTINGS && (
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
      )}
    </>
  );
}
