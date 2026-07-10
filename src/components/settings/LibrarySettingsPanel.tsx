import { SettingsActionRow, SettingsSection, SettingsValueRow } from "./SettingsControls";

interface LibrarySettingsPanelProps {
  libraryPath: string;
  libraryStatus: string;
  projectCount: number;
  activeProjectTitle: string;
  onOpenLibrary: () => void;
  onSwitchLibrary: () => void;
}

export function LibrarySettingsPanel({
  libraryPath,
  libraryStatus,
  projectCount,
  activeProjectTitle,
  onOpenLibrary,
  onSwitchLibrary,
}: LibrarySettingsPanelProps) {
  return (
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
  );
}
