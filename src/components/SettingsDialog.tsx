import clsx from "clsx";
import {
  Bot,
  FolderOpen,
  Info,
  MonitorCog,
  PenLine,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AgentProvider, EditorFontPreset, EditorTypographySettings, ImageReferenceFormat } from "../types";
import {
  SettingsActionRow,
  SettingsNumberField,
  SettingsRange,
  SettingsSection,
  SettingsSegmentedControl,
  SettingsSelect,
  SettingsTextField,
  SettingsToggle,
  SettingsValueRow,
} from "./settings/SettingsControls";

type SettingsTabId = "general" | "writing" | "ai" | "library" | "about";

interface SettingsDialogProps {
  open: boolean;
  libraryPath: string;
  libraryStatus: string;
  projectCount: number;
  activeProjectTitle: string;
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
  inspectorWidth: number;
  focusMode: boolean;
  typewriterMode: boolean;
  editorTypography: EditorTypographySettings;
  imageReferenceFormat: ImageReferenceFormat;
  sheetPreviewMode: boolean;
  planMode: boolean;
  agentProvider: AgentProvider;
  codexCliPath: string;
  claudeCliPath: string;
  probeSummary: string;
  probeBusy: boolean;
  onClose: () => void;
  onLibraryRailOpenChange: (open: boolean) => void;
  onSheetRailOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorWidthChange: (width: number) => void;
  onFocusModeChange: (enabled: boolean) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onCodexCliPathChange: (path: string) => void;
  onClaudeCliPathChange: (path: string) => void;
  onRunAgentProbe: () => void;
  onSwitchLibrary: () => void;
  onOpenLibrary: () => void;
}

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string; Icon: typeof MonitorCog }> = [
  { id: "general", label: "通用", Icon: MonitorCog },
  { id: "writing", label: "写作", Icon: PenLine },
  { id: "ai", label: "AI", Icon: Bot },
  { id: "library", label: "写作库", Icon: FolderOpen },
  { id: "about", label: "关于", Icon: Info },
];

const EDITOR_FONT_OPTIONS: Array<{ value: EditorFontPreset; label: string }> = [
  { value: "system", label: "系统默认" },
  { value: "pingfang", label: "苹方" },
  { value: "songti", label: "宋体" },
  { value: "kaiti", label: "楷体" },
  { value: "lxgw-wenkai", label: "霞鹜文楷" },
  { value: "huiwen-mincho", label: "汇文明朝" },
  { value: "mono", label: "等宽" },
  { value: "custom", label: "自定义" },
];

export function SettingsDialog({
  open,
  libraryPath,
  libraryStatus,
  projectCount,
  activeProjectTitle,
  libraryRailOpen,
  sheetRailOpen,
  inspectorOpen,
  inspectorWidth,
  focusMode,
  typewriterMode,
  editorTypography,
  imageReferenceFormat,
  sheetPreviewMode,
  planMode,
  agentProvider,
  codexCliPath,
  claudeCliPath,
  probeSummary,
  probeBusy,
  onClose,
  onLibraryRailOpenChange,
  onSheetRailOpenChange,
  onInspectorOpenChange,
  onInspectorWidthChange,
  onFocusModeChange,
  onTypewriterModeChange,
  onEditorTypographyChange,
  onImageReferenceFormatChange,
  onSheetPreviewModeChange,
  onPlanModeChange,
  onAgentProviderChange,
  onCodexCliPathChange,
  onClaudeCliPathChange,
  onRunAgentProbe,
  onSwitchLibrary,
  onOpenLibrary,
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const activeTabTitle = useMemo(
    () => SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "设置",
    [activeTab],
  );

  function updateEditorTypography(nextTypography: Partial<EditorTypographySettings>) {
    onEditorTypographyChange({ ...editorTypography, ...nextTypography });
  }

  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop settings-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="settings-sidebar">
          <header className="settings-sidebar-header">
            <h2 id="settings-dialog-title">设置</h2>
          </header>
          <nav className="settings-nav" aria-label="设置分类">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={clsx("settings-nav-item", activeTab === tab.id && "active")}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.Icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="settings-content">
          <header className="settings-content-header">
            <h3>{activeTabTitle}</h3>
            <button type="button" className="icon-button settings-close-button" onClick={onClose} title="关闭设置">
              <X size={17} />
            </button>
          </header>

          <div className="settings-panel">
            {activeTab === "general" && (
              <>
                <SettingsSection title="窗口">
                  <SettingsToggle label="项目导航栏" checked={libraryRailOpen} onChange={onLibraryRailOpenChange} />
                  <SettingsToggle label="文稿列表" checked={sheetRailOpen} onChange={onSheetRailOpenChange} />
                  <SettingsToggle label="右侧检查器" checked={inspectorOpen} onChange={onInspectorOpenChange} />
                  <SettingsRange
                    label="检查器宽度"
                    value={inspectorWidth}
                    min={360}
                    max={520}
                    step={10}
                    unit="px"
                    onChange={onInspectorWidthChange}
                  />
                </SettingsSection>
              </>
            )}

            {activeTab === "writing" && (
              <>
                <SettingsSection title="编辑器">
                  <SettingsToggle label="专注模式" checked={focusMode} onChange={onFocusModeChange} />
                  <SettingsToggle label="打字机模式" checked={typewriterMode} onChange={onTypewriterModeChange} />
                  <SettingsToggle label="Markdown 预览" checked={sheetPreviewMode} onChange={onSheetPreviewModeChange} />
                  <SettingsSegmentedControl
                    label="图片引用"
                    value={imageReferenceFormat}
                    options={[
                      { value: "markdown", label: "Markdown" },
                      { value: "obsidian", label: "Obsidian" },
                    ]}
                    onChange={onImageReferenceFormatChange}
                  />
                </SettingsSection>

                <SettingsSection title="排版">
                  <SettingsSelect
                    label="字体"
                    value={editorTypography.fontPreset}
                    options={EDITOR_FONT_OPTIONS}
                    onChange={(fontPreset) => updateEditorTypography({ fontPreset })}
                  />
                  {editorTypography.fontPreset === "custom" && (
                    <SettingsTextField
                      label="自定义字体"
                      value={editorTypography.customFontFamily}
                      placeholder="例如 LXGW WenKai"
                      onChange={(customFontFamily) => updateEditorTypography({ customFontFamily })}
                    />
                  )}
                  <SettingsNumberField
                    label="行高"
                    value={editorTypography.lineHeight}
                    min={1.1}
                    max={2.4}
                    step={0.05}
                    onChange={(lineHeight) => updateEditorTypography({ lineHeight })}
                  />
                  <SettingsNumberField
                    label="段间距"
                    value={editorTypography.paragraphSpacing}
                    min={0}
                    max={32}
                    step={1}
                    unit="px"
                    onChange={(paragraphSpacing) => updateEditorTypography({ paragraphSpacing })}
                  />
                  <SettingsNumberField
                    label="# 一级标题"
                    value={editorTypography.h1FontSize}
                    min={16}
                    max={44}
                    step={1}
                    unit="px"
                    onChange={(h1FontSize) => updateEditorTypography({ h1FontSize })}
                  />
                  <SettingsNumberField
                    label="## 二级标题"
                    value={editorTypography.h2FontSize}
                    min={15}
                    max={40}
                    step={1}
                    unit="px"
                    onChange={(h2FontSize) => updateEditorTypography({ h2FontSize })}
                  />
                  <SettingsNumberField
                    label="### 三级标题"
                    value={editorTypography.h3FontSize}
                    min={14}
                    max={36}
                    step={1}
                    unit="px"
                    onChange={(h3FontSize) => updateEditorTypography({ h3FontSize })}
                  />
                  <SettingsNumberField
                    label="正文"
                    value={editorTypography.bodyFontSize}
                    min={12}
                    max={28}
                    step={1}
                    unit="px"
                    onChange={(bodyFontSize) => updateEditorTypography({ bodyFontSize })}
                  />
                  <SettingsNumberField
                    label="表格"
                    value={editorTypography.tableFontSize}
                    min={12}
                    max={28}
                    step={1}
                    unit="px"
                    onChange={(tableFontSize) => updateEditorTypography({ tableFontSize })}
                  />
                </SettingsSection>
              </>
            )}

            {activeTab === "ai" && (
              <>
                <SettingsSection title="助手">
                  <SettingsSegmentedControl
                    label="运行器"
                    value={agentProvider}
                    options={[
                      { value: "codex", label: "Codex" },
                      { value: "claude", label: "Claude" },
                    ]}
                    onChange={onAgentProviderChange}
                  />
                  <SettingsToggle label="Plan Mode" checked={planMode} onChange={onPlanModeChange} />
                </SettingsSection>

                <SettingsSection title="CLI">
                  <SettingsTextField label="Codex 路径" value={codexCliPath} placeholder="codex" onChange={onCodexCliPathChange} />
                  <SettingsTextField label="Claude 路径" value={claudeCliPath} placeholder="claude" onChange={onClaudeCliPathChange} />
                  <SettingsActionRow label="CLI 检测" value={probeSummary}>
                    <button type="button" className="secondary-button" onClick={onRunAgentProbe} disabled={probeBusy}>
                      {probeBusy ? "检测中" : "检测"}
                    </button>
                  </SettingsActionRow>
                </SettingsSection>
              </>
            )}

            {activeTab === "library" && (
              <SettingsSection title="当前写作库">
                <SettingsValueRow label="路径" value={libraryPath} />
                <SettingsValueRow label="项目数" value={`${projectCount}`} />
                <SettingsValueRow label="当前项目" value={activeProjectTitle || "未选择"} />
                {libraryStatus && <SettingsValueRow label="状态" value={libraryStatus} />}
                <SettingsActionRow label="写作库操作">
                  <button type="button" className="secondary-button" onClick={onOpenLibrary} disabled={!libraryPath.startsWith("/")}>
                    打开
                  </button>
                  <button type="button" className="primary-button" onClick={onSwitchLibrary}>
                    切换
                  </button>
                </SettingsActionRow>
              </SettingsSection>
            )}

            {activeTab === "about" && (
              <SettingsSection title="Nibva">
                <SettingsValueRow label="版本" value="0.1.0" />
                <SettingsValueRow label="定位" value="Local-first Markdown writing app" />
                <SettingsValueRow label="桌面框架" value="Tauri 2" />
              </SettingsSection>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
