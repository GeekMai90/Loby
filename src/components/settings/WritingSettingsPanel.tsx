import { EDITOR_FONT_OPTIONS, IMAGE_REFERENCE_FORMAT_OPTIONS } from "../../constants/settingsDialog";
import type { EditorTypographySettings, ImageReferenceFormat } from "../../types";
import {
  SettingsNumberField,
  SettingsSection,
  SettingsSegmentedControl,
  SettingsSelect,
  SettingsTextField,
  SettingsToggle,
} from "./SettingsControls";

interface WritingSettingsPanelProps {
  focusMode: boolean;
  typewriterMode: boolean;
  sheetPreviewMode: boolean;
  imageReferenceFormat: ImageReferenceFormat;
  editorTypography: EditorTypographySettings;
  onFocusModeChange: (enabled: boolean) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
}

export function WritingSettingsPanel({
  focusMode,
  typewriterMode,
  sheetPreviewMode,
  imageReferenceFormat,
  editorTypography,
  onFocusModeChange,
  onTypewriterModeChange,
  onSheetPreviewModeChange,
  onImageReferenceFormatChange,
  onEditorTypographyChange,
}: WritingSettingsPanelProps) {
  function updateEditorTypography(nextTypography: Partial<EditorTypographySettings>) {
    onEditorTypographyChange({ ...editorTypography, ...nextTypography });
  }

  return (
    <>
      <SettingsSection title="编辑器">
        <SettingsToggle label="专注模式" checked={focusMode} onChange={onFocusModeChange} />
        <SettingsToggle label="打字机模式" checked={typewriterMode} onChange={onTypewriterModeChange} />
        <SettingsToggle label="Markdown 预览" checked={sheetPreviewMode} onChange={onSheetPreviewModeChange} />
        <SettingsSegmentedControl
          label="图片引用"
          value={imageReferenceFormat}
          options={IMAGE_REFERENCE_FORMAT_OPTIONS}
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
  );
}
