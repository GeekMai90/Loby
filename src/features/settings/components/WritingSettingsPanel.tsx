/**
 * [INPUT]: 依赖 设置模块、shared 公共契约
 * [OUTPUT]: 对外提供 WritingSettingsPanel
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EDITOR_FONT_OPTIONS, IMAGE_REFERENCE_FORMAT_OPTIONS } from "@/features/settings/constants/settingsDialog";
import type { EditorTypographySettings, ImageReferenceFormat, MarkdownFormattingSettings } from "@/shared/types";
import {
  SettingsNumberField,
  SettingsSection,
  SettingsSegmentedControl,
  SettingsSelect,
  SettingsTextField,
  SettingsToggle,
} from "@/features/settings/components/SettingsControls";

interface WritingSettingsPanelProps {
  focusMode: boolean;
  typewriterMode: boolean;
  goalCelebrationEnabled: boolean;
  sheetPreviewMode: boolean;
  imageReferenceFormat: ImageReferenceFormat;
  editorTypography: EditorTypographySettings;
  markdownFormatting: MarkdownFormattingSettings;
  onFocusModeChange: (enabled: boolean) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onGoalCelebrationEnabledChange: (enabled: boolean) => void;
  onSheetPreviewModeChange: (enabled: boolean) => void;
  onImageReferenceFormatChange: (format: ImageReferenceFormat) => void;
  onEditorTypographyChange: (settings: EditorTypographySettings) => void;
  onMarkdownFormattingChange: (settings: MarkdownFormattingSettings) => void;
}

export function WritingSettingsPanel({
  focusMode,
  typewriterMode,
  goalCelebrationEnabled,
  sheetPreviewMode,
  imageReferenceFormat,
  editorTypography,
  markdownFormatting,
  onFocusModeChange,
  onTypewriterModeChange,
  onGoalCelebrationEnabledChange,
  onSheetPreviewModeChange,
  onImageReferenceFormatChange,
  onEditorTypographyChange,
  onMarkdownFormattingChange,
}: WritingSettingsPanelProps) {
  function updateEditorTypography(nextTypography: Partial<EditorTypographySettings>) {
    onEditorTypographyChange({ ...editorTypography, ...nextTypography });
  }

  function updateMarkdownFormatting(nextSettings: Partial<MarkdownFormattingSettings>) {
    onMarkdownFormattingChange({ ...markdownFormatting, ...nextSettings });
  }

  return (
    <>
      <SettingsSection title="编辑器">
        <SettingsToggle label="专注模式" checked={focusMode} onChange={onFocusModeChange} />
        <SettingsToggle label="打字机模式" checked={typewriterMode} onChange={onTypewriterModeChange} />
        <SettingsToggle label="Markdown 预览" checked={sheetPreviewMode} onChange={onSheetPreviewModeChange} />
        <SettingsToggle
          label="目标达成礼花"
          description="单篇文章首次达到目标时，从窗口两侧显示一次克制的纸片礼花。"
          checked={goalCelebrationEnabled}
          onChange={onGoalCelebrationEnabledChange}
        />
        <SettingsSegmentedControl
          label="图片引用"
          value={imageReferenceFormat}
          options={IMAGE_REFERENCE_FORMAT_OPTIONS}
          onChange={onImageReferenceFormatChange}
        />
      </SettingsSection>

      <SettingsSection title="Markdown 排版">
        <SettingsToggle
          label="清理多余空格"
          description="删除重复空格和无意义的行尾空格，同时保留 Markdown 强制换行。"
          checked={markdownFormatting.cleanupWhitespace}
          onChange={(cleanupWhitespace) => updateMarkdownFormatting({ cleanupWhitespace })}
        />
        <SettingsToggle
          label="统一段落空行"
          description="段落、标题、列表、引用和代码块之间统一保留一个空行。"
          checked={markdownFormatting.normalizeBlockSpacing}
          onChange={(normalizeBlockSpacing) => updateMarkdownFormatting({ normalizeBlockSpacing })}
        />
        <SettingsToggle
          label="规范 Markdown 标记"
          description="整理标题、列表和引用标记的空格及写法。"
          checked={markdownFormatting.normalizeMarkdownMarkers}
          onChange={(normalizeMarkdownMarkers) => updateMarkdownFormatting({ normalizeMarkdownMarkers })}
        />
        <SettingsToggle
          label="中英文之间添加空格"
          description="同时处理中文与英文、中文与数字之间的间距。"
          checked={markdownFormatting.spaceCjkAndLatin}
          onChange={(spaceCjkAndLatin) => updateMarkdownFormatting({ spaceCjkAndLatin })}
        />
        <SettingsToggle
          label="中文标点转为全角"
          description="只处理中文正文，不修改代码、链接、图片地址、版本号和文件路径。"
          checked={markdownFormatting.fullWidthPunctuation}
          onChange={(fullWidthPunctuation) => updateMarkdownFormatting({ fullWidthPunctuation })}
        />
      </SettingsSection>

      <SettingsSection title="字体与版式">
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
