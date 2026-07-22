/**
 * [INPUT]: 依赖 设置模块
 * [OUTPUT]: 对外提供 SettingsAboutPanel
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { SettingsSection, SettingsValueRow } from "@/features/settings/components/SettingsControls";

export function SettingsAboutPanel() {
  return (
    <SettingsSection title="落笔">
      <SettingsValueRow label="版本" value="0.1.0" />
      <SettingsValueRow label="定位" value="Local-first Markdown writing app" />
      <SettingsValueRow label="桌面框架" value="Tauri 2" />
    </SettingsSection>
  );
}
