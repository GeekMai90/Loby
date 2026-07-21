import { Button } from "@/components/ui/button";
import { useState } from "react";
import { isDesktopLibraryPath } from "../../lib/libraryRegistry";
import { SettingsActionRow, SettingsSection, SettingsValueRow } from "./SettingsControls";

interface FileStorageSettingsPanelProps {
  libraryPath: string;
  libraryStatus: string;
  projectCount: number;
  onOpenLibrary: () => void;
  onMoveLibrary: () => Promise<void>;
}

export function FileStorageSettingsPanel({
  libraryPath,
  libraryStatus,
  projectCount,
  onOpenLibrary,
  onMoveLibrary,
}: FileStorageSettingsPanelProps) {
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");
  const localFolder = isDesktopLibraryPath(libraryPath);

  async function moveLibrary() {
    setMoving(true);
    setMoveError("");
    try {
      await onMoveLibrary();
    } catch (cause) {
      setMoveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setMoving(false);
    }
  }

  return (
    <SettingsSection title="本地文件">
      <SettingsActionRow
        label="写作文件夹"
        description="所有项目、文稿、图片和便携设置都保存在这个文件夹中。"
        value={folderName(libraryPath)}
        detail={libraryPath}
      >
        <Button type="button" variant="outline" onClick={onOpenLibrary} disabled={!localFolder || moving}>
          打开
        </Button>
        <Button type="button" onClick={() => void moveLibrary()} disabled={!localFolder || moving}>
          {moving ? "正在移动…" : "移动…"}
        </Button>
      </SettingsActionRow>
      <SettingsValueRow label="项目" value={`${projectCount} 个`} />
      {libraryStatus && <SettingsValueRow label="状态" value={libraryStatus} />}
      {moveError && <SettingsValueRow label="移动失败" value={moveError} />}
    </SettingsSection>
  );
}

function folderName(path: string): string {
  if (!path) return "未设置";
  return path.split(/[\\/]/).filter(Boolean).at(-1) || path;
}
