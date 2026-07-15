import { SETTINGS_TABS, type SettingsTabId } from "../../constants/settingsDialog";
import { NavigationItem } from "../NavigationItem";

interface SettingsDialogSidebarProps {
  activeTab: SettingsTabId;
  onActiveTabChange: (tab: SettingsTabId) => void;
}

export function SettingsDialogSidebar({ activeTab, onActiveTabChange }: SettingsDialogSidebarProps) {
  return (
    <aside className="flex min-w-0 flex-col gap-2.5 border-r border-border bg-muted/50 px-3 py-4">
      <header>
        <h2 className="m-0 px-1.5 text-[17px] font-bold">设置</h2>
      </header>
      <nav className="flex flex-col gap-1" aria-label="设置分类">
        {SETTINGS_TABS.map((tab) => (
          <NavigationItem key={tab.id} selected={activeTab === tab.id} active onClick={() => onActiveTabChange(tab.id)}>
            <tab.Icon size={16} />
            <span className="min-w-0 truncate">{tab.label}</span>
          </NavigationItem>
        ))}
      </nav>
    </aside>
  );
}
