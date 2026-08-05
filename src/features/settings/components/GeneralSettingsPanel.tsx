/**
 * [INPUT]: 依赖 lucide-react、shared 主题选项、设置表单基础控件与 shadcn/ui Button
 * [OUTPUT]: 对外提供 GeneralSettingsPanel，并提供系统/浅色/深色三态主题预览与侧边栏折叠模式选择
 * [POS]: settings feature 的通用面板，承载应用外观、界面布局与暂时隐藏的编辑器主题预览，不改变主题持久化与切换契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsSection, SettingsSelect } from "@/features/settings/components/SettingsControls";
import { SIDEBAR_COLLAPSE_MODE_OPTIONS } from "@/features/settings/constants/settingsDialog";
import { APP_THEME_OPTIONS, EDITOR_THEME_OPTIONS } from "@/shared/constants/themes";
import type { AppThemePreference, EditorThemeId, SidebarCollapseMode } from "@/shared/types";

interface GeneralSettingsPanelProps {
  appTheme: AppThemePreference;
  editorTheme: EditorThemeId;
  sidebarCollapseMode: SidebarCollapseMode;
  onAppThemeChange: (theme: AppThemePreference) => void;
  onEditorThemeChange: (theme: EditorThemeId) => void;
  onSidebarCollapseModeChange: (mode: SidebarCollapseMode) => void;
}

const SHOW_EDITOR_THEME_SETTINGS = false;

export function GeneralSettingsPanel({
  appTheme,
  editorTheme,
  sidebarCollapseMode,
  onAppThemeChange,
  onEditorThemeChange,
  onSidebarCollapseModeChange,
}: GeneralSettingsPanelProps) {
  return (
    <>
      <SettingsSection title="主题" surface={false}>
        <div className="grid grid-cols-3 gap-4" role="radiogroup" aria-label="主题">
          {APP_THEME_OPTIONS.map((theme) => {
            const selected = appTheme === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={selected}
                data-selected={selected}
                className="app-theme-option flex min-w-0 flex-col gap-2 rounded-lg px-0 py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => onAppThemeChange(theme.value)}
              >
                <span className="app-theme-preview" data-preview-theme={theme.value} aria-hidden="true">
                  <span className="app-theme-preview-half app-theme-preview-half--light" />
                  {theme.value === "system" && <span className="app-theme-preview-half app-theme-preview-half--dark" />}
                  <span className="app-theme-preview-toolbar">
                    <span className="app-theme-preview-toolbar-line app-theme-preview-toolbar-line--wide" />
                    <span className="app-theme-preview-toolbar-line" />
                  </span>
                  <span className="app-theme-preview-window">
                    {theme.value === "system" ? (
                      <>
                        <span className="app-theme-preview-window-pane app-theme-preview-window-pane--outer app-theme-preview-window-pane--light" />
                        <span className="app-theme-preview-window-pane app-theme-preview-window-pane--outer app-theme-preview-window-pane--dark" />
                        <span className="app-theme-preview-window-inset">
                          <span className="app-theme-preview-window-pane app-theme-preview-window-pane--light">
                            <ThemePreviewRows compact />
                          </span>
                          <span className="app-theme-preview-window-pane app-theme-preview-window-pane--dark">
                            <ThemePreviewRows compact />
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="app-theme-preview-window-pane">
                        <ThemePreviewRows />
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-app-base font-medium text-foreground">{theme.label}</span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="界面布局">
        <SettingsSelect
          label="侧边栏折叠模式"
          description="控制左侧折叠按钮是否同时收起文稿列表。"
          value={sidebarCollapseMode}
          options={SIDEBAR_COLLAPSE_MODE_OPTIONS}
          width="fit"
          contentAlign="end"
          onChange={onSidebarCollapseModeChange}
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

function ThemePreviewRows({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {Array.from({ length: compact ? 2 : 3 }, (_, index) => (
        <span key={index} className="app-theme-preview-window-row">
          <span className="app-theme-preview-window-row-title" />
          <span className="app-theme-preview-window-row-body" />
        </span>
      ))}
    </>
  );
}
