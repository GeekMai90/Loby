/**
 * [INPUT]: 依赖 React、shadcn/ui、共享内缩设置列表行、应用级 Tooltip、Lobe 品牌 SVG 适配器、已支持连接预设目录、Agent credential、ChatGPT OAuth、真实连接验证 IPC、默认 Provider 与兼容服务地址回调
 * [OUTPUT]: 对外提供含彩色服务商标识和能力目录的连接选项，以及具备独立状态读取、无生成验证反馈的 AiConnectionSettingsSection 连接管理表面
 * [POS]: settings feature 的 AI 连接管理边界，只展示已添加连接及其真实接入能力，列表视觉与发布目标目录同构，并隔离不同 Provider 的读取失败
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  CircleCheck,
  Eye,
  EyeOff,
  ImageIcon,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/animate-ui/components/animate/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  deleteAgentCredential,
  disconnectChatGpt,
  getAgentCredentialStatus,
  getChatGptConnection,
  saveAgentCredential,
  validateAgentConnection,
} from "@/features/assistant/model/agentRuntime";
import { AGENT_CREDENTIALS_CHANGED_EVENT, notifyAgentCredentialsChanged } from "@/features/assistant/model/agentCredentialEvents";
import { agentConnectionCapabilities, type AgentConnectionCapability } from "@/features/assistant/model/agentConnectionCapabilities";
import { AgentBrandLabel, AgentProviderIcon } from "@/features/assistant/components/AgentBrandIcon";
import { ChatGptConnectionSettings } from "@/features/settings/components/ChatGptConnectionSettings";
import { SettingsListRow, SettingsSectionHeader } from "@/features/settings/components/SettingsControls";
import {
  API_CONNECTION_PRESETS,
  API_CONNECTION_PROVIDERS,
  apiConnectionPresetForProvider,
} from "@/features/settings/constants/aiConnectionProviders";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { showAppToast } from "@/shared/lib/appToast";
import type { AgentProvider, ChatGptConnection } from "@/shared/types";

export interface AiConnectionOption {
  value: AgentProvider;
  label: string;
  capabilities: AgentConnectionCapability[];
}

interface AiConnection {
  provider: AgentProvider;
  name: string;
  detail: string;
  capabilities: AgentConnectionCapability[];
}

interface AiConnectionSettingsSectionProps {
  agentProvider: AgentProvider;
  providerBaseUrl: string;
  onAgentProviderChange: (provider: AgentProvider) => void;
  onProviderBaseUrlChange: (url: string) => void;
  onAvailableConnectionsChange: (connections: AiConnectionOption[]) => void;
}

export function AiConnectionSettingsSection({
  agentProvider,
  providerBaseUrl,
  onAgentProviderChange,
  onProviderBaseUrlChange,
  onAvailableConnectionsChange,
}: AiConnectionSettingsSectionProps) {
  const [connections, setConnections] = useState<AiConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatGptDialogOpen, setChatGptDialogOpen] = useState(false);
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AgentProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiConnection | null>(null);
  const [validatingProvider, setValidatingProvider] = useState<AgentProvider | null>(null);
  const chatGptAdded = connections.some((connection) => connection.provider === "chatgpt-subscription");

  const refreshConnections = useCallback(async () => {
    setLoading(true);
    try {
      const [chatGptResult, statusResults] = await Promise.all([
        settle(getChatGptConnection()),
        Promise.all(
          API_CONNECTION_PROVIDERS.map(async (provider) => ({ provider, result: await settle(getAgentCredentialStatus(provider)) })),
        ),
      ]);
      const statuses = statusResults.flatMap(({ result }) => (result.ok ? [result.value] : []));
      const initial = buildConnections(chatGptResult.ok ? chatGptResult.value : null, statuses, providerBaseUrl);
      setConnections(initial);
      onAvailableConnectionsChange(optionsWithCurrentFallback(initial, agentProvider));
      const failure = [chatGptResult, ...statusResults.map(({ result }) => result)].find((result) => !result.ok);
      if (failure && !failure.ok) showError("部分连接状态读取失败", failure.error);
    } catch (error) {
      showError("连接读取失败", error);
      onAvailableConnectionsChange([{ value: agentProvider, label: `${agentProviderLabel(agentProvider)}（状态未知）`, capabilities: [] }]);
    } finally {
      setLoading(false);
    }
  }, [agentProvider, onAvailableConnectionsChange, providerBaseUrl]);

  useEffect(() => {
    void refreshConnections();
    const handleCredentialChange = () => void refreshConnections();
    window.addEventListener(AGENT_CREDENTIALS_CHANGED_EVENT, handleCredentialChange);
    return () => window.removeEventListener(AGENT_CREDENTIALS_CHANGED_EVENT, handleCredentialChange);
  }, [refreshConnections]);

  function openApiDialog(provider: AgentProvider | null = null) {
    setEditingProvider(provider);
    setApiDialogOpen(true);
  }

  async function removeConnection(connection: AiConnection) {
    setDeleteTarget(null);
    try {
      if (connection.provider === "chatgpt-subscription") await disconnectChatGpt();
      else await deleteAgentCredential(connection.provider);
      const fallback = connections.find((item) => item.provider !== connection.provider);
      if (agentProvider === connection.provider && fallback) onAgentProviderChange(fallback.provider);
      notifyAgentCredentialsChanged();
      showAppToast({ variant: "success", title: "连接已删除", description: `${connection.name} 已从落笔中移除。` });
    } catch (error) {
      showError("连接删除失败", error);
    }
  }

  async function validateConnection(connection: AiConnection) {
    setValidatingProvider(connection.provider);
    try {
      const message = await validateAgentConnection(
        connection.provider,
        connection.provider === "openai-compatible" ? providerBaseUrl : undefined,
      );
      showAppToast({ variant: "success", title: "连接验证成功", description: message });
    } catch (error) {
      showError("连接验证失败", error);
    } finally {
      setValidatingProvider(null);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <SettingsSectionHeader title="连接" />

        <div className="overflow-hidden rounded-lg border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-section-background)]">
          {connections.length > 0 ? (
            [...connections]
              .sort((left, right) => Number(right.provider === agentProvider) - Number(left.provider === agentProvider))
              .map((connection) => (
                <ConnectionRow
                  key={connection.provider}
                  connection={connection}
                  isDefault={connection.provider === agentProvider}
                  capabilities={connection.capabilities}
                  onSetDefault={() => onAgentProviderChange(connection.provider)}
                  onReconnect={() => {
                    if (connection.provider === "chatgpt-subscription") setChatGptDialogOpen(true);
                    else openApiDialog(connection.provider);
                  }}
                  validating={validatingProvider === connection.provider}
                  validationDisabled={validatingProvider !== null}
                  onValidate={() => void validateConnection(connection)}
                  onDelete={() => setDeleteTarget(connection)}
                />
              ))
          ) : (
            <div className="px-3 py-7 text-center text-xs leading-5 text-muted-foreground">
              {loading ? "正在读取连接…" : "尚未添加连接。添加后可在上方选择默认使用的服务。"}
            </div>
          )}
        </div>

        <div className="flex justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus />
                添加连接
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-58">
              <DropdownMenuItem disabled={chatGptAdded} onSelect={() => setChatGptDialogOpen(true)}>
                <AgentProviderIcon provider="chatgpt-subscription" />
                <span>ChatGPT 订阅</span>
                {chatGptAdded ? <CircleCheck className="ml-auto" aria-label="已添加" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openApiDialog()}>
                <AgentProviderIcon provider="openai-compatible" />
                <span>其他提供商</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </section>

      <Dialog open={chatGptDialogOpen} onOpenChange={setChatGptDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>连接 ChatGPT 订阅</DialogTitle>
            <DialogDescription>使用包含 Codex 用量的 ChatGPT 账号登录，访问凭证不会显示在设置界面中。</DialogDescription>
          </DialogHeader>
          <ChatGptConnectionSettings
            onConnectionChange={(connection) => {
              if (connection.connected && connections.length === 0) onAgentProviderChange("chatgpt-subscription");
              notifyAgentCredentialsChanged();
            }}
          />
        </DialogContent>
      </Dialog>

      <ApiConnectionDialog
        open={apiDialogOpen}
        editingProvider={editingProvider}
        providerBaseUrl={providerBaseUrl}
        hasConnections={connections.length > 0}
        onOpenChange={setApiDialogOpen}
        onSaved={async (provider, endpoint) => {
          if (provider === "openai-compatible") onProviderBaseUrlChange(endpoint);
          if (connections.length === 0) onAgentProviderChange(provider);
          notifyAgentCredentialsChanged();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除连接？"
        message={deleteTarget ? deleteConnectionMessage(deleteTarget) : ""}
        confirmLabel="删除"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && void removeConnection(deleteTarget)}
      />
    </>
  );
}

function ConnectionRow({
  connection,
  isDefault,
  capabilities,
  onSetDefault,
  onReconnect,
  validating,
  validationDisabled,
  onValidate,
  onDelete,
}: {
  connection: AiConnection;
  isDefault: boolean;
  capabilities: AgentConnectionCapability[];
  onSetDefault: () => void;
  onReconnect: () => void;
  validating: boolean;
  validationDisabled: boolean;
  onValidate: () => void;
  onDelete: () => void;
}) {
  return (
    <SettingsListRow className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.25">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <AgentProviderIcon provider={connection.provider} />
          <span className="text-[13px] font-medium text-foreground">{connection.name}</span>
          {isDefault ? (
            <span className="rounded border border-border px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">默认</span>
          ) : null}
        </div>
        {connection.detail ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{connection.detail}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ConnectionCapabilityIcons capabilities={capabilities} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`${connection.name}连接操作`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={isDefault} onSelect={onSetDefault}>
              <Star />
              <span>{isDefault ? "当前默认连接" : "设为默认"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onReconnect}>
              <RefreshCw />
              <span>{connection.provider.endsWith("-subscription") ? "重新认证" : "替换凭证"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={validationDisabled} onSelect={onValidate}>
              <ShieldCheck className={validating ? "animate-pulse" : undefined} />
              <span>{validating ? "正在验证…" : "验证连接"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              <span>删除</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </SettingsListRow>
  );
}

const CAPABILITY_ICONS = {
  text: { label: "文本对话", Icon: MessageSquareText },
  reasoning: { label: "思考强度", Icon: Brain },
  imageGeneration: { label: "图片生成", Icon: ImageIcon },
} satisfies Record<AgentConnectionCapability, { label: string; Icon: typeof MessageSquareText }>;

function ConnectionCapabilityIcons({ capabilities }: { capabilities: AgentConnectionCapability[] }) {
  return (
    <TooltipProvider openDelay={500} closeDelay={100}>
      <div className="flex items-center gap-1" aria-label="连接能力">
        {capabilities.map((capability) => {
          const { label, Icon } = CAPABILITY_ICONS[capability];
          return (
            <Tooltip key={capability} side="top" sideOffset={6}>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  tabIndex={0}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={label}
                >
                  <Icon size={14} strokeWidth={1.8} />
                </span>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function ApiConnectionDialog({
  open,
  editingProvider,
  providerBaseUrl,
  hasConnections,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editingProvider: AgentProvider | null;
  providerBaseUrl: string;
  hasConnections: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (provider: AgentProvider, endpoint: string) => Promise<void>;
}) {
  const initialPreset = presetForProvider(editingProvider);
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [endpoint, setEndpoint] = useState(editingProvider === "openai-compatible" ? providerBaseUrl : initialPreset.endpoint);
  const [secret, setSecret] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const preset = useMemo(() => API_CONNECTION_PRESETS.find((item) => item.id === presetId) ?? API_CONNECTION_PRESETS[0], [presetId]);

  useEffect(() => {
    if (!open) return;
    const nextPreset = presetForProvider(editingProvider);
    setPresetId(nextPreset.id);
    setEndpoint(editingProvider === "openai-compatible" ? providerBaseUrl : nextPreset.endpoint);
    setSecret("");
    setSecretVisible(false);
    setMessage("");
  }, [editingProvider, open, providerBaseUrl]);

  function selectPreset(nextPresetId: string) {
    const nextPreset = API_CONNECTION_PRESETS.find((item) => item.id === nextPresetId);
    if (!nextPreset) return;
    setPresetId(nextPresetId);
    setEndpoint(nextPreset.endpoint);
    setMessage("");
  }

  async function save() {
    if (!secret.trim()) return;
    if (preset.provider === "openai-compatible" && !validHttpsEndpoint(endpoint)) {
      setMessage("请输入有效的 HTTPS Endpoint，例如 https://api.example.com/v1。");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await saveAgentCredential(preset.provider, secret.trim());
      await onSaved(preset.provider, endpoint.trim());
      onOpenChange(false);
      showAppToast({
        variant: "success",
        title: editingProvider ? "连接已更新" : "连接已添加",
        description: `${agentProviderLabel(preset.provider)} 凭证已安全保存。${!hasConnections ? " 已设为默认连接。" : ""}`,
      });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingProvider ? "更新 API 连接" : "API 配置"}</DialogTitle>
          <DialogDescription className="sr-only">添加或更新大模型服务连接。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
            服务商
            <Select value={presetId} onValueChange={selectPreset}>
              <SelectTrigger width="full" aria-label="服务商">
                <SelectValue>
                  <AgentBrandLabel icon={<AgentProviderIcon provider={preset.provider} />}>{preset.label}</AgentBrandLabel>
                </SelectValue>
              </SelectTrigger>
              <SelectContent width="trigger" className="max-h-72">
                {API_CONNECTION_PRESETS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <AgentBrandLabel icon={<AgentProviderIcon provider={option.provider} />}>{option.label}</AgentBrandLabel>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
            API Key
            <div className="relative">
              <Input
                type={secretVisible ? "text" : "password"}
                value={secret}
                autoComplete="off"
                className="pr-10"
                placeholder={editingProvider ? "输入新凭证以重新认证" : "输入 API Key"}
                onChange={(event) => setSecret(event.target.value)}
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={secretVisible ? "隐藏 API Key" : "显示 API Key"}
                title={secretVisible ? "隐藏 API Key" : "显示 API Key"}
                onClick={() => setSecretVisible((visible) => !visible)}
              >
                {secretVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-foreground">
            Endpoint
            <Input
              value={endpoint}
              disabled={preset.provider !== "openai-compatible"}
              aria-label="Endpoint"
              placeholder="https://api.example.com/v1"
              onChange={(event) => setEndpoint(event.target.value)}
            />
          </label>

          {message ? <p className="m-0 text-[11px] leading-4 text-destructive">{message}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={busy || !secret.trim()} onClick={() => void save()}>
            {busy ? "保存中…" : editingProvider ? "更新连接" : "添加连接"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function agentProviderLabel(provider: AgentProvider): string {
  switch (provider) {
    case "chatgpt-subscription":
      return "ChatGPT 订阅";
    case "anthropic-api":
      return "Anthropic API";
    case "qwen-api":
      return "千问";
    case "minimax-api":
      return "MiniMax";
    case "deepseek-api":
      return "DeepSeek";
    case "kimi-api":
      return "Kimi";
    case "openai-compatible":
      return "自定义服务商";
    default:
      return "OpenAI API";
  }
}

function buildConnections(
  chatGpt: ChatGptConnection | null,
  statuses: Array<{ provider: string; configured: boolean }>,
  providerBaseUrl: string,
): AiConnection[] {
  const connections: AiConnection[] = [];
  if (chatGpt?.connected) {
    const plan = chatGpt.planType ? ` ${capitalize(chatGpt.planType)}` : "";
    connections.push({
      provider: "chatgpt-subscription",
      name: `ChatGPT${plan}`,
      detail: "",
      capabilities: agentConnectionCapabilities("chatgpt-subscription").filter(
        (capability) => capability !== "imageGeneration" || chatGpt.planType.toLowerCase() !== "free",
      ),
    });
  }
  for (const status of statuses) {
    if (!status.configured || !isAgentProvider(status.provider)) continue;
    connections.push(apiConnection(status.provider, providerBaseUrl));
  }
  return connections;
}

type LoadResult<T> = { ok: true; value: T } | FailedLoad;
type FailedLoad = { ok: false; error: unknown };

async function settle<T>(promise: Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, error };
  }
}

function apiConnection(provider: AgentProvider, providerBaseUrl: string): AiConnection {
  const capabilities = agentConnectionCapabilities(provider);
  if (provider === "anthropic-api") return { provider, name: "Anthropic API", detail: "Anthropic · api.anthropic.com", capabilities };
  if (provider === "qwen-api") return { provider, name: "千问", detail: "阿里云百炼 · dashscope.aliyuncs.com", capabilities };
  if (provider === "minimax-api") return { provider, name: "MiniMax", detail: "MiniMax · api.minimaxi.com", capabilities };
  if (provider === "deepseek-api") return { provider, name: "DeepSeek", detail: "DeepSeek · api.deepseek.com", capabilities };
  if (provider === "kimi-api") return { provider, name: "Kimi", detail: "月之暗面 · api.moonshot.cn", capabilities };
  if (provider === "openai-compatible") {
    const host = endpointHost(providerBaseUrl);
    return { provider, name: compatibleServiceName(host), detail: `OpenAI Responses · ${host || "自定义 Endpoint"}`, capabilities };
  }
  return { provider: "openai-api", name: "OpenAI API", detail: "OpenAI · api.openai.com", capabilities };
}

function optionsWithCurrentFallback(connections: AiConnection[], current: AgentProvider): AiConnectionOption[] {
  const options = connections.map((connection) => ({
    value: connection.provider,
    label: connection.name,
    capabilities: connection.capabilities,
  }));
  if (!options.some((option) => option.value === current)) {
    options.push({ value: current, label: `${agentProviderLabel(current)}（未连接）`, capabilities: [] });
  }
  return options;
}

function presetForProvider(provider: AgentProvider | null) {
  return apiConnectionPresetForProvider(provider);
}

function isAgentProvider(value: string): value is AgentProvider {
  return value === "chatgpt-subscription" || API_CONNECTION_PROVIDERS.includes(value as AgentProvider);
}

function deleteConnectionMessage(connection: AiConnection): string {
  return `这会移除 ${connection.name} 的本地授权信息。之后如需使用，必须重新连接。`;
}

function endpointHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function compatibleServiceName(host: string): string {
  if (host.includes("deepseek")) return "DeepSeek";
  if (host.includes("openrouter")) return "OpenRouter";
  if (host.includes("groq")) return "Groq";
  if (host.includes("mistral")) return "Mistral";
  if (host.includes("moonshot") || host.includes("kimi")) return "Kimi";
  return "自定义服务商";
}

function validHttpsEndpoint(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function showError(title: string, error: unknown) {
  showAppToast({ variant: "error", title, description: errorMessage(error) });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
