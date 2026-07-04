import { Bot, Download, FolderOpen, History, Info } from "lucide-react";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import type { InspectorTab } from "../types";
import { ExportPanel } from "./ExportPanel";
import { HistoryPanel } from "./HistoryPanel";
import { InfoPanel } from "./InfoPanel";
import { ResourcePanel } from "./ResourcePanel";

interface InspectorPanelProps {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  info: ComponentProps<typeof InfoPanel>;
  ai: ReactNode;
  resources: ComponentProps<typeof ResourcePanel>;
  history: ComponentProps<typeof HistoryPanel>;
  exportPanel: ComponentProps<typeof ExportPanel>;
}

const INSPECTOR_TABS: InspectorTab[] = ["信息", "AI", "资源", "历史", "导出"];

export function InspectorPanel({
  activeTab,
  onTabChange,
  info,
  ai,
  resources,
  history,
  exportPanel,
}: InspectorPanelProps) {
  return (
    <aside className="inspector">
      <div className="inspector-tabs">
        {INSPECTOR_TABS.map((tab) => (
          <button key={tab} className={clsx(tab === activeTab && "active")} onClick={() => onTabChange(tab)}>
            <InspectorTabIcon tab={tab} />
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "信息" && <InfoPanel {...info} />}
      {activeTab === "AI" && ai}
      {activeTab === "资源" && <ResourcePanel {...resources} />}
      {activeTab === "历史" && <HistoryPanel {...history} />}
      {activeTab === "导出" && <ExportPanel {...exportPanel} />}
    </aside>
  );
}

function InspectorTabIcon({ tab }: { tab: InspectorTab }) {
  if (tab === "信息") return <Info size={14} />;
  if (tab === "AI") return <Bot size={14} />;
  if (tab === "资源") return <FolderOpen size={14} />;
  if (tab === "历史") return <History size={14} />;
  return <Download size={14} />;
}
