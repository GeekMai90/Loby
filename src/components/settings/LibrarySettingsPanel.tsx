import { Button } from "@/components/ui/button";
import { SettingsActionRow, SettingsSection, SettingsValueRow } from "./SettingsControls";

interface LibrarySettingsPanelProps {
  libraryPath: string;
  libraryStatus: string;
  activeLibraryName: string;
  libraryCount: number;
  projectCount: number;
  activeProjectTitle: string;
  onOpenLibrary: () => void;
  onManageLibraries: () => void;
}

export function LibrarySettingsPanel({
  libraryPath,
  libraryStatus,
  activeLibraryName,
  libraryCount,
  projectCount,
  activeProjectTitle,
  onOpenLibrary,
  onManageLibraries,
}: LibrarySettingsPanelProps) {
  return (
    <SettingsSection title="当前写作库">
      <SettingsValueRow label="名称" value={activeLibraryName || "未命名"} />
      <SettingsValueRow label="路径" value={libraryPath} />
      <SettingsValueRow label="写作库数量" value={`${libraryCount}`} />
      <SettingsValueRow label="项目数" value={`${projectCount}`} />
      <SettingsValueRow label="当前项目" value={activeProjectTitle || "未选择"} />
      {libraryStatus && <SettingsValueRow label="状态" value={libraryStatus} />}
      <SettingsActionRow label="写作库操作">
        <Button type="button" variant="outline" onClick={onOpenLibrary} disabled={!libraryPath.startsWith("/")}>
          打开
        </Button>
        <Button type="button" onClick={onManageLibraries}>
          管理
        </Button>
      </SettingsActionRow>
    </SettingsSection>
  );
}
