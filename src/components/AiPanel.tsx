import clsx from "clsx";
import { Copy, ListCollapse, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { AiResourceContext } from "./ai/AiResourceContext";
import { AiReviewTools } from "./ai/AiReviewTools";
import { slashCommands } from "../lib/agentCommands";
import type { ProjectResourcePaths } from "../lib/projectModel";
import type {
  AiSuggestion,
  ChatConversation,
  ChatMessage,
  CodexProbeResult,
  CodexSkill,
  DiffLine,
  MentionMode,
  ProjectResourceFile,
  ProjectResourceText,
  WritingSheet,
} from "../types";

interface AiPanelProps {
  suggestion: AiSuggestion | null;
  diffLines: DiffLine[];
  messages: ChatMessage[];
  conversations: ChatConversation[];
  activeConversationId: string;
  input: string;
  busy: boolean;
  planMode: boolean;
  mentionModes: MentionMode[];
  projectSheets: WritingSheet[];
  selectedContextSheetIds: string[];
  resourcePaths: ProjectResourcePaths | null;
  projectResources: ProjectResourceFile[];
  selectedResourcePaths: string[];
  resourceImportStatus: string;
  resourcePreview: ProjectResourceText | null;
  resourcePreviewBusy: boolean;
  skills: CodexSkill[];
  selectedSkillIds: string[];
  skillTaskStatus: string;
  codexCliPath: string;
  providerMode: "exec" | "app-server";
  probe: CodexProbeResult | null;
  probeBusy: boolean;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation: () => void;
  onForkConversation: () => void;
  onCompactConversation: () => void;
  onDeleteConversation: () => void;
  onInputChange: (value: string) => void;
  onPlanModeChange: (enabled: boolean) => void;
  onMentionModesChange: (modes: MentionMode[]) => void;
  onSelectedContextSheetIdsChange: (sheetIds: string[]) => void;
  onSelectedResourcePathsChange: (paths: string[]) => void;
  onImportAssets: () => void;
  onImportReferences: () => void;
  onOpenResourcePath: (path: string, label: string) => void;
  onPreviewResource: (resource: ProjectResourceFile) => void;
  onClearResourcePreview: () => void;
  onSelectedSkillIdsChange: (skillIds: string[]) => void;
  onCreateSkillTasks: () => void;
  onCodexCliPathChange: (path: string) => void;
  onProviderModeChange: (mode: "exec" | "app-server") => void;
  onProbeCodex: () => void;
  onSend: () => void;
  onQuickStructure: () => void;
  onQuickPolish: () => void;
  onCodexInlineEdit: () => void;
  onPolish: () => void;
  onTitle: () => void;
  onSummary: () => void;
  onImageIdeas: () => void;
  onSaveNote: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export function AiPanel({
  suggestion,
  diffLines,
  messages,
  conversations,
  activeConversationId,
  input,
  busy,
  planMode,
  mentionModes,
  projectSheets,
  selectedContextSheetIds,
  resourcePaths,
  projectResources,
  selectedResourcePaths,
  resourceImportStatus,
  resourcePreview,
  resourcePreviewBusy,
  skills,
  selectedSkillIds,
  skillTaskStatus,
  codexCliPath,
  providerMode,
  probe,
  probeBusy,
  onSelectConversation,
  onCreateConversation,
  onForkConversation,
  onCompactConversation,
  onDeleteConversation,
  onInputChange,
  onPlanModeChange,
  onMentionModesChange,
  onSelectedContextSheetIdsChange,
  onSelectedResourcePathsChange,
  onImportAssets,
  onImportReferences,
  onOpenResourcePath,
  onPreviewResource,
  onClearResourcePreview,
  onSelectedSkillIdsChange,
  onCreateSkillTasks,
  onCodexCliPathChange,
  onProviderModeChange,
  onProbeCodex,
  onSend,
  onQuickStructure,
  onQuickPolish,
  onCodexInlineEdit,
  onPolish,
  onTitle,
  onSummary,
  onImageIdeas,
  onSaveNote,
  onAccept,
  onReject,
}: AiPanelProps) {
  const contextSheets = projectSheets.filter((sheet) => sheet.type !== "发布版本");

  return (
    <div className="panel-stack">
      <section className="panel-section chat-panel">
        <div className="chat-header">
          <h2>Codex Chat</h2>
          <div className="chat-header-actions">
            <button className="icon-button" onClick={onCreateConversation} title="新建对话">
              <Plus size={14} />
            </button>
            <button className="icon-button" onClick={onForkConversation} title="分叉当前对话">
              <Copy size={14} />
            </button>
            <button className="icon-button" onClick={onCompactConversation} title="压缩当前对话">
              <ListCollapse size={14} />
            </button>
            <button className="icon-button danger-button" onClick={onDeleteConversation} title="删除当前对话">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="conversation-tabs">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={clsx(conversation.id === activeConversationId && "active")}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {conversation.title}
            </button>
          ))}
        </div>
        <div className="agent-toolbar">
          <label className="toggle-row">
            <input type="checkbox" checked={planMode} onChange={(event) => onPlanModeChange(event.target.checked)} />
            Plan Mode
          </label>
          <details>
            <summary>
              <Settings2 size={14} /> 设置
            </summary>
            <label>
              Codex CLI 路径
              <input
                value={codexCliPath}
                placeholder="留空自动查找；可填 /opt/homebrew/bin/codex"
                onChange={(event) => onCodexCliPathChange(event.target.value)}
              />
            </label>
            <label>
              Provider 模式
              <select value={providerMode} onChange={(event) => onProviderModeChange(event.target.value as "exec" | "app-server")}>
                <option value="exec">exec（当前可用）</option>
                <option value="app-server">app-server（下一阶段）</option>
              </select>
            </label>
            <button className="secondary-button full-width" onClick={onProbeCodex} disabled={probeBusy}>
              {probeBusy ? "测试中..." : "测试 Codex CLI"}
            </button>
            {probe && (
              <div className={clsx("probe-card", probe.ok ? "probe-ok" : "probe-failed")}>
                <strong>{probe.ok ? "Codex CLI 可用" : "Codex CLI 需要处理"}</strong>
                <small>{probe.resolvedPath || "未解析到路径"}</small>
                {probe.steps.map((step) => (
                  <div key={step.name} className="probe-step">
                    <span>{step.ok ? "OK" : "FAIL"} · {step.name}</span>
                    <code>{step.stderr || step.stdout || step.command}</code>
                  </div>
                ))}
              </div>
            )}
          </details>
        </div>
        <div className="mention-row">
          {[
            ["current-sheet", "@sheet"],
            ["selection", "@selection"],
            ["project-outline", "@project"],
            ["materials", "@materials"],
            ["all-sheets", "@all"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              className={clsx(mentionModes.includes(mode as MentionMode) && "active")}
              onClick={() => toggleMentionMode(mode as MentionMode, mentionModes, onMentionModesChange)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="context-sheet-picker">
          <div className="context-sheet-picker-header">
            <span>@cards</span>
            <button className="text-button" onClick={() => onSelectedContextSheetIdsChange([])} disabled={selectedContextSheetIds.length === 0}>
              清空
            </button>
          </div>
          <div className="context-sheet-list">
            {contextSheets.map((sheet) => (
              <label key={sheet.id} className={clsx("context-sheet-row", selectedContextSheetIds.includes(sheet.id) && "selected")}>
                <input
                  type="checkbox"
                  checked={selectedContextSheetIds.includes(sheet.id)}
                  onChange={() =>
                    onSelectedContextSheetIdsChange(
                      selectedContextSheetIds.includes(sheet.id)
                        ? selectedContextSheetIds.filter((id) => id !== sheet.id)
                        : [...selectedContextSheetIds, sheet.id],
                    )
                  }
                />
                <span>
                  <strong>{sheet.title}</strong>
                  <small>{sheet.type} · {sheet.status}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="slash-help">
          {slashCommands.map((command) => (
            <button key={command.name} onClick={() => onInputChange(command.name)}>
              {command.name}
            </button>
          ))}
        </div>
        <div className="skill-strip">
          {skills.slice(0, 12).map((skill) => (
            <button
              key={`${skill.id}-${skill.path}`}
              className={clsx(selectedSkillIds.includes(skill.id) && "active")}
              title={skill.description || skill.path}
              onClick={() => toggleSkill(skill.id, selectedSkillIds, onSelectedSkillIdsChange)}
            >
              ${skill.name}
            </button>
          ))}
          {skills.length === 0 && <span>未发现本机 Codex skills</span>}
        </div>
        <div className="skill-task-actions">
          <button className="secondary-button full-width" onClick={onCreateSkillTasks} disabled={selectedSkillIds.length === 0 && !input.includes("$")}>
            <Save size={16} /> 写入本地 skill 任务
          </button>
          <small>{skillTaskStatus || "任务会保存到当前写作库的 ai-tasks/，供 Codex CLI 或 skill runner 读取。"}</small>
        </div>
        <AiResourceContext
          resourcePaths={resourcePaths}
          projectResources={projectResources}
          selectedResourcePaths={selectedResourcePaths}
          resourceImportStatus={resourceImportStatus}
          resourcePreview={resourcePreview}
          resourcePreviewBusy={resourcePreviewBusy}
          onSelectedResourcePathsChange={onSelectedResourcePathsChange}
          onImportAssets={onImportAssets}
          onImportReferences={onImportReferences}
          onOpenResourcePath={onOpenResourcePath}
          onPreviewResource={onPreviewResource}
          onClearResourcePreview={onClearResourcePreview}
        />
        <div className="chat-messages">
          {messages.map((message) => (
            <article key={message.id} className={clsx("chat-message", `chat-${message.role}`)}>
              <div className="chat-role">{message.role === "user" ? "你" : message.role === "assistant" ? "Codex" : "系统"}</div>
              <p>{message.content}</p>
              {message.command && <small>{message.command}</small>}
            </article>
          ))}
          {busy && (
            <article className="chat-message chat-system">
              <div className="chat-role">系统</div>
              <p>Codex CLI 正在处理...</p>
            </article>
          )}
        </div>
        <textarea
          className="chat-input"
          value={input}
          placeholder="问 Codex：帮我看看这段结构、润色当前选区、生成标题方向..."
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <div className="button-row">
          <button className="secondary-button" onClick={onQuickStructure} disabled={busy}>
            结构建议
          </button>
          <button className="secondary-button" onClick={onQuickPolish} disabled={busy}>
            润色选区
          </button>
          <button className="primary-button" onClick={onSend} disabled={busy || !input.trim()}>
            发送
          </button>
        </div>
      </section>

      <AiReviewTools
        suggestion={suggestion}
        diffLines={diffLines}
        busy={busy}
        onCodexInlineEdit={onCodexInlineEdit}
        onPolish={onPolish}
        onTitle={onTitle}
        onSummary={onSummary}
        onImageIdeas={onImageIdeas}
        onSaveNote={onSaveNote}
        onAccept={onAccept}
        onReject={onReject}
      />
    </div>
  );
}

function toggleSkill(skillId: string, selectedSkillIds: string[], onChange: (skillIds: string[]) => void) {
  onChange(selectedSkillIds.includes(skillId) ? selectedSkillIds.filter((id) => id !== skillId) : [...selectedSkillIds, skillId]);
}

function toggleMentionMode(
  mode: MentionMode,
  mentionModes: MentionMode[],
  onChange: (modes: MentionMode[]) => void,
) {
  if (mentionModes.includes(mode)) {
    const next = mentionModes.filter((item) => item !== mode);
    onChange(next.length > 0 ? next : ["current-sheet"]);
    return;
  }
  onChange([...mentionModes, mode]);
}
