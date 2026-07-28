/**
 * [INPUT]: 依赖 React、已配置连接目录加载器与凭证变化事件
 * [OUTPUT]: 对外提供 useAgentConnectionDirectory，在助手打开期间刷新可选连接及各自模型目录
 * [POS]: AI 助手 hooks 层的连接目录生命周期边界，为当前对话模型菜单提供只读数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useState } from "react";
import { loadAgentConnectionDirectory, type AgentConnectionDirectoryItem } from "@/features/assistant/model/agentConnectionDirectory";
import { AGENT_CREDENTIALS_CHANGED_EVENT } from "@/features/assistant/model/agentCredentialEvents";

export function useAgentConnectionDirectory() {
  const [connections, setConnections] = useState<AgentConnectionDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    void loadAgentConnectionDirectory()
      .then((items) => {
        if (active) setConnections(items);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let cancelLoad = refresh();
    const handleCredentialChange = () => {
      cancelLoad();
      cancelLoad = refresh();
    };
    window.addEventListener(AGENT_CREDENTIALS_CHANGED_EVENT, handleCredentialChange);
    return () => {
      cancelLoad();
      window.removeEventListener(AGENT_CREDENTIALS_CHANGED_EVENT, handleCredentialChange);
    };
  }, [refresh]);

  return { connections, loading, refresh };
}
