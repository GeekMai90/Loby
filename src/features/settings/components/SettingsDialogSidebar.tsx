/**
 * [INPUT]: 依赖 设置模块、shared 公共契约
 * [OUTPUT]: 对外提供 SettingsDialogSidebar
 * [POS]: 设置 feature 的界面组合单元，连接 设置 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { SETTINGS_TABS, type SettingsTabId } from "@/features/settings/constants/settingsDialog";
import { NavigationItem } from "@/shared/components/NavigationItem";

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
            <tab.Icon />
            <span className="min-w-0 truncate">{tab.label}</span>
          </NavigationItem>
        ))}
      </nav>
    </aside>
  );
}
