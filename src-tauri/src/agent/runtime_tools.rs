//! [INPUT]: 依赖 AgentStreamRun、Tool/MCP/Proposal 注册表、审批通道、持久化运行 checkpoint 与 Agent Event Protocol
//! [OUTPUT]: 向 runtime 提供结构化 proposal、顺序工具执行、可恢复审批生命周期、写工具风险阶段和结果截断
//! [POS]: Loby Agent Runtime 的工具执行子状态机；拥有 tool item 终态并在副作用边界落盘，但不拥有模型循环或正文写入
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::events::{
    emit_agent_activity, emit_agent_approval, emit_agent_proposal, emit_agent_run_state,
    AgentActivity,
};
use super::proposals;
use super::providers::{self, ProviderToolResult};
use super::runtime::AgentStreamRun;
use super::runtime_events::tool_activity_kind;
use super::tools::{self, ToolDefinition};
use crate::models::{
    AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentRunPhase,
};
use tauri::Manager;

pub(super) const CANCELLED_TOOL_CALL: &str = "__loby_cancelled_tool_call__";

pub(super) fn emit_document_proposals(
    run: &AgentStreamRun,
    calls: &[providers::ProviderToolCall],
) -> Result<(), Vec<ProviderToolResult>> {
    let mut normalized = Vec::with_capacity(calls.len());
    let mut errors = Vec::new();
    for call in calls {
        match proposals::normalize(&call.name, &call.arguments) {
            Ok(proposal) => normalized.push((call, proposal)),
            Err(error) => {
                let message = format!("文稿提案无效：{error} 请修正参数后重新调用提案工具。");
                emit_agent_activity(
                    &run.window,
                    &run.request_id,
                    AgentActivity::new(
                        format!("tool-{}", call.id),
                        AgentActivityKind::Proposal,
                        AgentActivityState::Failed,
                        AgentActivityVisibility::Milestone,
                    )
                    .title("文稿提案无效")
                    .tool_name(&call.name)
                    .text(&message),
                );
                errors.push(ProviderToolResult {
                    call_id: call.id.clone(),
                    output: message,
                });
            }
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }
    for (call, proposal) in normalized {
        let item_id = format!("tool-{}", call.id);
        emit_agent_proposal(
            &run.window,
            &run.request_id,
            &item_id,
            &call.name,
            proposal.kind.as_str(),
            &proposal.title,
            &proposal.payload,
        );
    }
    Ok(())
}

pub(super) async fn execute_tool_calls(
    run: &mut AgentStreamRun,
    definitions: &[ToolDefinition],
    calls: Vec<providers::ProviderToolCall>,
) -> Result<Vec<ProviderToolResult>, String> {
    let mut results = Vec::with_capacity(calls.len());
    for call in calls {
        let Some(definition) = definitions
            .iter()
            .find(|definition| definition.name == call.name)
        else {
            let error = format!("模型请求了未注册工具：{}", call.name);
            emit_agent_activity(
                &run.window,
                &run.request_id,
                AgentActivity::new(
                    format!("tool-{}", call.id),
                    tool_activity_kind(&call.name),
                    AgentActivityState::Failed,
                    AgentActivityVisibility::Milestone,
                )
                .title("工具不可用")
                .tool_name(&call.name)
                .text(&error),
            );
            return Err(error);
        };
        if definition.effect == "proposal" {
            emit_agent_activity(
                &run.window,
                &run.request_id,
                AgentActivity::new(
                    format!("tool-{}", call.id),
                    AgentActivityKind::Proposal,
                    AgentActivityState::Failed,
                    AgentActivityVisibility::Milestone,
                )
                .title("文稿提案调用顺序无效")
                .tool_name(&call.name),
            );
            results.push(ProviderToolResult {
                call_id: call.id,
                output: "文稿提案必须在其他工具调用完成后的独立一步中提出。".to_string(),
            });
            continue;
        }
        let item_id = format!("tool-{}", call.id);
        if definition.effect == "write" {
            let approved = match request_tool_approval(run, &item_id, definition).await {
                Ok(approved) => approved,
                Err(error) => {
                    let state = if error == CANCELLED_TOOL_CALL {
                        AgentActivityState::Cancelled
                    } else {
                        AgentActivityState::Failed
                    };
                    emit_tool_activity(run, &item_id, definition, state, None);
                    return Err(error);
                }
            };
            if !approved {
                emit_tool_activity(
                    run,
                    &item_id,
                    definition,
                    AgentActivityState::Cancelled,
                    None,
                );
                emit_agent_run_state(
                    &run.window,
                    &run.request_id,
                    AgentRunPhase::WaitingForModel,
                    None,
                );
                results.push(ProviderToolResult {
                    call_id: call.id,
                    output: "用户拒绝了这次工具调用。".to_string(),
                });
                continue;
            }
        }
        emit_tool_activity(run, &item_id, definition, AgentActivityState::Running, None);
        emit_agent_run_state(
            &run.window,
            &run.request_id,
            AgentRunPhase::ExecutingTool,
            Some(&item_id),
        );
        let execution = async {
            if definition.name.starts_with("mcp__") {
                super::mcp::execute_namespaced_mcp_tool(&definition.name, &call.arguments).await
            } else {
                tools::execute_builtin_tool(
                    run.window.app_handle(),
                    &run.library_path,
                    &run.provider,
                    &run.runtime,
                    &definition.name,
                    &call.arguments,
                )
                .await
            }
        };
        tokio::pin!(execution);
        let execution = tokio::select! {
            result = &mut execution => result,
            changed = run.cancel_receiver.changed() => {
                if changed.is_ok() && *run.cancel_receiver.borrow() {
                    emit_tool_activity(run, &item_id, definition, AgentActivityState::Cancelled, None);
                    return Err(CANCELLED_TOOL_CALL.to_string());
                }
                continue;
            }
        };
        match execution {
            Ok(execution) => {
                emit_tool_activity(
                    run,
                    &item_id,
                    definition,
                    AgentActivityState::Completed,
                    execution.artifact_path.as_deref(),
                );
                emit_agent_run_state(
                    &run.window,
                    &run.request_id,
                    AgentRunPhase::WaitingForModel,
                    None,
                );
                results.push(ProviderToolResult {
                    call_id: call.id,
                    output: truncate_tool_output(execution.output),
                });
            }
            Err(error) => {
                emit_agent_activity(
                    &run.window,
                    &run.request_id,
                    AgentActivity::new(
                        &item_id,
                        tool_activity_kind(&definition.name),
                        AgentActivityState::Failed,
                        AgentActivityVisibility::Milestone,
                    )
                    .title(format!("{} 调用失败", definition.name))
                    .tool_name(&definition.name)
                    .text(&error),
                );
                emit_agent_run_state(
                    &run.window,
                    &run.request_id,
                    AgentRunPhase::WaitingForModel,
                    None,
                );
                results.push(ProviderToolResult {
                    call_id: call.id,
                    output: format!("工具调用失败：{error}"),
                });
            }
        }
    }
    Ok(results)
}

fn emit_tool_activity(
    run: &AgentStreamRun,
    item_id: &str,
    definition: &ToolDefinition,
    state: AgentActivityState,
    artifact_path: Option<&str>,
) {
    let title = match state {
        AgentActivityState::Running => format!("调用 {}", definition.name),
        AgentActivityState::Completed => format!("完成 {}", definition.name),
        AgentActivityState::Failed => format!("{} 调用失败", definition.name),
        AgentActivityState::Cancelled => format!("已取消调用 {}", definition.name),
        _ => definition.name.clone(),
    };
    emit_agent_activity(
        &run.window,
        &run.request_id,
        AgentActivity::new(
            item_id,
            tool_activity_kind(&definition.name),
            state,
            AgentActivityVisibility::Milestone,
        )
        .title(title)
        .tool_name(&definition.name)
        .artifact_path(artifact_path),
    );
}

async fn request_tool_approval(
    run: &mut AgentStreamRun,
    approval_id: &str,
    definition: &ToolDefinition,
) -> Result<bool, String> {
    if run.runtime.execution_mode == "autonomous-read" {
        return Ok(false);
    }
    let approval_id = format!("{}:{}", run.request_id, approval_id);
    super::run_checkpoint::write_run_checkpoint(super::run_checkpoint::AgentRunCheckpointUpdate {
        library_path: &run.library_path,
        request_id: &run.request_id,
        conversation_id: &run.conversation_id,
        provider: &run.provider,
        prompt: &run.prompt,
        status: "waitingForApproval",
        tool_name: &definition.name,
        reason: "上次任务停在写工具审批之前，工具尚未执行；确认后可以安全重试。",
    })?;
    let (sender, receiver) = tokio::sync::oneshot::channel();
    run.approval_state
        .pending
        .lock()
        .map_err(|error| error.to_string())?
        .insert(approval_id.clone(), sender);
    emit_agent_run_state(
        &run.window,
        &run.request_id,
        AgentRunPhase::WaitingForApproval,
        Some(&approval_id),
    );
    emit_agent_approval(
        &run.window,
        &run.request_id,
        &approval_id,
        "需要工具审批",
        &format!("{} 可能修改外部状态，是否允许本次调用？", definition.name),
    );
    let decision = tokio::select! {
        decision = receiver => Ok(matches!(decision.as_deref(), Ok("accept" | "acceptForSession"))),
        changed = run.cancel_receiver.changed() => {
            if changed.is_ok() && *run.cancel_receiver.borrow() {
                Err(CANCELLED_TOOL_CALL.to_string())
            } else {
                Ok(false)
            }
        }
    };
    let state = match decision {
        Ok(true) => AgentActivityState::Completed,
        Ok(false) | Err(_) => AgentActivityState::Cancelled,
    };
    if matches!(decision, Ok(true)) {
        super::run_checkpoint::write_run_checkpoint(
            super::run_checkpoint::AgentRunCheckpointUpdate {
                library_path: &run.library_path,
                request_id: &run.request_id,
                conversation_id: &run.conversation_id,
                provider: &run.provider,
                prompt: &run.prompt,
                status: "executingTool",
                tool_name: &definition.name,
                reason: "上次任务在写工具开始后中断；重试前请先检查外部状态，避免重复写入。",
            },
        )?;
    }
    emit_agent_activity(
        &run.window,
        &run.request_id,
        AgentActivity::new(
            &approval_id,
            AgentActivityKind::Approval,
            state,
            AgentActivityVisibility::Milestone,
        )
        .title(if state == AgentActivityState::Completed {
            "工具审批已确认"
        } else {
            "工具审批已取消"
        })
        .tool_name(&definition.name),
    );
    decision
}

fn truncate_tool_output(output: String) -> String {
    const LIMIT: usize = 64 * 1024;
    if output.len() <= LIMIT {
        return output;
    }
    let mut end = LIMIT;
    while !output.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}\n\n[工具结果已截断]", &output[..end])
}
