import clsx from "clsx";
import { SETTINGS_TABS, type SettingsTabId } from "../../constants/settingsDialog";

interface SettingsDialogSidebarProps {
  activeTab: SettingsTabId;
  onActiveTabChange: (tab: SettingsTabId) => void;
}

export function SettingsDialogSidebar({ activeTab, onActiveTabChange }: SettingsDialogSidebarProps) {
  return (
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
            onClick={() => onActiveTabChange(tab.id)}
          >
            <tab.Icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
