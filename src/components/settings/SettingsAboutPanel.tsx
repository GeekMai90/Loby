import { SettingsSection, SettingsValueRow } from "./SettingsControls";

export function SettingsAboutPanel() {
  return (
    <SettingsSection title="落笔">
      <SettingsValueRow label="版本" value="0.1.0" />
      <SettingsValueRow label="定位" value="Local-first Markdown writing app" />
      <SettingsValueRow label="桌面框架" value="Tauri 2" />
    </SettingsSection>
  );
}
