import { SettingsRange, SettingsSection, SettingsToggle } from "./SettingsControls";

interface GeneralSettingsPanelProps {
  libraryRailOpen: boolean;
  sheetRailOpen: boolean;
  inspectorOpen: boolean;
  inspectorWidth: number;
  onLibraryRailOpenChange: (open: boolean) => void;
  onSheetRailOpenChange: (open: boolean) => void;
  onInspectorOpenChange: (open: boolean) => void;
  onInspectorWidthChange: (width: number) => void;
}

export function GeneralSettingsPanel({
  libraryRailOpen,
  sheetRailOpen,
  inspectorOpen,
  inspectorWidth,
  onLibraryRailOpenChange,
  onSheetRailOpenChange,
  onInspectorOpenChange,
  onInspectorWidthChange,
}: GeneralSettingsPanelProps) {
  return (
    <SettingsSection title="窗口">
      <SettingsToggle label="项目导航栏" checked={libraryRailOpen} onChange={onLibraryRailOpenChange} />
      <SettingsToggle label="文稿列表" checked={sheetRailOpen} onChange={onSheetRailOpenChange} />
      <SettingsToggle label="右侧检查器" checked={inspectorOpen} onChange={onInspectorOpenChange} />
      <SettingsRange label="检查器宽度" value={inspectorWidth} min={360} max={520} step={10} unit="px" onChange={onInspectorWidthChange} />
    </SettingsSection>
  );
}
