/**
 * [INPUT]: 依赖 React、设置控件、Loby Agent MCP IPC 与系统钥匙串凭证接口
 * [OUTPUT]: 对外提供 MCP server 新增、启停、工具发现测试和删除的 McpSettingsSection
 * [POS]: settings feature 的 MCP 配置边界，只暂存表单明文，已保存凭证不返回 renderer
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteAgentCredential,
  deleteMcpServer,
  listMcpServers,
  listMcpTools,
  saveAgentCredential,
  saveMcpServer,
} from "@/features/assistant/model/agentRuntime";
import { SettingsActionRow, SettingsSection, SettingsSelect, SettingsTextField } from "@/features/settings/components/SettingsControls";
import type { McpServerConfig } from "@/shared/types";

type McpTransport = McpServerConfig["transport"];

export function McpSettingsSection() {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [transport, setTransport] = useState<McpTransport>("streamable-http");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [argsText, setArgsText] = useState("[]");
  const [secretEnv, setSecretEnv] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    listMcpServers()
      .then(setServers)
      .catch((error) => setMessage(errorMessage(error)));
  }, []);

  async function addServer() {
    setBusy(true);
    setMessage("");
    const id = `mcp-${Date.now()}`;
    try {
      const config: McpServerConfig = {
        id,
        name: name.trim(),
        enabled: true,
        transport,
        command: transport === "stdio" ? endpoint.trim() : "",
        args: transport === "stdio" ? parseArgs(argsText) : [],
        url: transport === "streamable-http" ? endpoint.trim() : "",
        secretEnv: secret.trim() ? (transport === "stdio" ? secretEnv.trim() : "AUTHORIZATION") : "",
      };
      if (secret.trim()) await saveAgentCredential(`mcp:${id}`, secret.trim());
      setServers(await saveMcpServer(config));
      setName("");
      setEndpoint("");
      setArgsText("[]");
      setSecretEnv("");
      setSecret("");
      setMessage("MCP server 已保存。启用后，它的工具会在下一轮 AI 请求中自动发现。");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleServer(server: McpServerConfig, enabled: boolean) {
    setBusy(true);
    setMessage("");
    try {
      setServers(await saveMcpServer({ ...server, enabled }));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function testServer(server: McpServerConfig) {
    setBusy(true);
    setMessage("");
    try {
      const tools = await listMcpTools(server.id);
      setMessage(`${server.name} 已连接，发现 ${tools.length} 个工具。`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeServer(server: McpServerConfig) {
    setBusy(true);
    setMessage("");
    try {
      const next = await deleteMcpServer(server.id);
      await deleteAgentCredential(`mcp:${server.id}`).catch(() => undefined);
      setServers(next);
      setMessage(`${server.name} 已删除。`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection title="MCP">
      {servers.map((server) => (
        <SettingsActionRow
          key={server.id}
          label={server.name}
          description={server.transport === "stdio" ? server.command : server.url}
          value={server.enabled ? "已启用" : "已停用"}
        >
          <Button type="button" variant="outline" disabled={busy} onClick={() => void toggleServer(server, !server.enabled)}>
            {server.enabled ? "停用" : "启用"}
          </Button>
          <Button type="button" variant="outline" disabled={busy || !server.enabled} onClick={() => void testServer(server)}>
            测试
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void removeServer(server)}>
            删除
          </Button>
        </SettingsActionRow>
      ))}
      <SettingsSelect
        label="连接方式"
        value={transport}
        options={[
          { value: "streamable-http", label: "Streamable HTTP" },
          { value: "stdio", label: "本地 stdio" },
        ]}
        onChange={setTransport}
      />
      <SettingsTextField label="名称" value={name} placeholder="例如：文献检索" onChange={setName} />
      <SettingsTextField
        label={transport === "stdio" ? "可执行文件" : "Server URL"}
        description={transport === "stdio" ? "必须填写绝对路径；不会经过 shell。" : "发布环境只允许 HTTPS。"}
        value={endpoint}
        placeholder={transport === "stdio" ? "/absolute/path/to/mcp-server" : "https://example.com/mcp"}
        onChange={setEndpoint}
      />
      {transport === "stdio" ? (
        <SettingsTextField
          label="参数"
          description="使用 JSON 字符串数组。"
          value={argsText}
          placeholder='["--mode","read"]'
          onChange={setArgsText}
        />
      ) : null}
      {transport === "stdio" ? (
        <SettingsTextField label="Secret 环境变量" value={secretEnv} placeholder="例如：SERVICE_API_KEY" onChange={setSecretEnv} />
      ) : null}
      <SettingsTextField
        label={transport === "stdio" ? "Secret" : "Bearer token"}
        value={secret}
        type="password"
        placeholder="可选；保存到系统钥匙串"
        onChange={setSecret}
      />
      <SettingsActionRow label="新增 Server" detail={message || undefined}>
        <Button type="button" variant="outline" disabled={busy || !name.trim() || !endpoint.trim()} onClick={() => void addServer()}>
          {busy ? "处理中" : "保存"}
        </Button>
      </SettingsActionRow>
    </SettingsSection>
  );
}

function parseArgs(value: string): string[] {
  const parsed: unknown = JSON.parse(value || "[]");
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("MCP 参数必须是 JSON 字符串数组。");
  }
  return parsed;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
