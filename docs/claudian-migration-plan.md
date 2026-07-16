# Claudian-style AI Migration Plan

Reference: <https://github.com/YishenTu/claudian>

Nibva should adopt the same broad product pattern as Claudian: a writing workspace with an embedded local agent sidebar. The difference is that Nibva is not an Obsidian plugin. It is a Tauri desktop writing app, so the provider runtime must be rebuilt around Nibva's own library/project/sheet model.

Current decision (2026-07-16): the shipped settings and assistant runtime are Codex-only. The minimal Claude process bridge remains internal, but Claude and hosted API providers will not be exposed until their session model and feature-parity requirements are planned. The provider-related sections below describe future architecture, not current user-facing support.

## Target Capabilities

Claudian capabilities to bring into Nibva:

- Chat sidebar
- Local agent provider runtime
- Codex support
- Inline edit with diff preview
- Slash commands
- Skills
- `@mention` for files, sheets, projects, assets, and external context
- Plan Mode
- Instruction Mode
- MCP server configuration
- Multi-tab conversations
- Conversation history
- Fork/resume/compact as later enhancements
- Provider settings and CLI path configuration

## Architecture Translation

Claudian concept mapping:

```text
Obsidian vault         -> Nibva library
Obsidian note          -> Nibva sheet
Plugin sidebar chat    -> Nibva right AI sidebar
Vault adapter          -> Tauri Rust file service
Provider runtime       -> Nibva agent runtime
Claude/Codex providers -> Nibva provider adapters
Inline edit modal      -> Editor selection diff review
```

## Provider Runtime Direction

Short-term implementation:

- Use local CLI calls from Tauri commands.
- Codex provider uses `codex exec`.
- Claude provider uses `claude --print`.
- Send current project, sheet, selected text, and recent chat as prompt context.
- Display stdout/stderr in the chat window.
- Keep the visible AI surface limited to chat until the provider runtime is stable.

Long-term implementation:

- Use `codex app-server --listen stdio://`.
- Keep a long-lived Codex process.
- Communicate through JSON-RPC.
- Start/resume Codex threads for each Nibva conversation.
- Stream turn notifications into the chat UI.
- Persist conversation metadata in the Nibva library.

Claudian's Codex provider uses this app-server style runtime. It starts the process, initializes with `experimentalApi`, then manages `thread/start`, `turn/start`, `turn/steer`, and session history.

## Nibva-specific Changes

Nibva should not expose raw coding-agent language everywhere. The UI should adapt agent power to writing workflows:

- "Apply edit" should mean proposed prose changes, not direct file mutation by default.
- AI edits should be reviewable before changing a sheet.
- Mentions should prioritize sheets, project assets, references, exports, and writing context.
- Slash commands should include writing actions like `/polish`, `/outline`, `/cover`, `/wechat`, `/xhs`, `/compile`.
- Plan Mode should be framed as "先分析/计划，再修改".
- MCP and CLI tools should be advanced settings, not first-run requirements.

## Implementation Phases

### Phase A: Chat Runtime

- Right-side chat panel
- Codex CLI command bridge
- Prompt context from active project/sheet/selection
- Error display for CLI resolution/auth/runtime failures

Status: partially implemented with local CLI calls. Nibva now has right-side chat, multiple chat tabs, library-scoped conversation persistence, Plan Mode, slash prompt expansion, typed mention context, CLI path override, Codex diagnostics, and Claude diagnostics. It is not yet streaming and does not yet use Codex app-server.

Current scope decision: the visible right sidebar should behave like a simple Claudian-style chat surface. Inline edit controls, resource pickers, generated note controls, and inspector tabs are intentionally hidden until the chat/runtime foundation is solid.

### Phase B: Inline Edit

- Selection-based edit request
- Word or line diff preview
- Accept/reject/apply to editor
- Preserve undo history

Status: deferred from the visible UI. Previous prototype code exists, but the right sidebar should not expose inline edit controls until the chat runtime is stable.

### Phase C: Slash and Skills

- Slash command menu
- Skill discovery from local Codex skills
- Writing-focused command templates
- `$skill` references in chat input

Status: slash command shortcuts are implemented as prompt expansion. `$skill` context references are implemented through local skill discovery and typed `$skill-name` references in the chat input. Runtime skill execution through Codex app-server is not implemented yet.

### Phase D: Mentions

- `@sheet`
- `@project`
- `@asset`
- `@reference`
- External local file mentions

Status: typed mentions for `@sheet`, `@selection`, `@project`, `@materials`, and `@all` are implemented. `@materials` maps to project sheets with type `素材`. Inline mention autocomplete and external asset/reference mentions are not implemented yet.

### Phase E: App-server Runtime

- Replace one-shot `codex exec` with long-lived `codex app-server`
- JSON-RPC transport
- Thread and turn lifecycle
- Streaming responses
- Conversation resume/fork/compact as later enhancements after the basic chat path is stable

Status: deferred. The current Nibva assistant intentionally keeps only basic chat, provider selection, conversation switching, new conversation, and delete conversation controls.

### Phase F: MCP and Advanced Provider Settings

- Codex CLI path setting
- Extra environment variables
- MCP server visibility
- Permission mode / Plan Mode controls
- Cross-platform path resolution

Status: Codex and Claude CLI path override plus basic CLI diagnostics are implemented. Extra environment variables, MCP server visibility, and app-server permission controls are still pending.
