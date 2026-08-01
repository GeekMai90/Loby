//! [INPUT]: 依赖 AgentStreamRun（含用户明确的本地参考目录范围）、Tool/MCP/Proposal 注册表及运行内插入意图策略、审批通道、持久化运行 checkpoint 与 Agent Event Protocol
//! [OUTPUT]: 向 runtime 提供 Provider 别名路由、阻止精确定位静默降级且禁止协议回显的 proposal 回执、带取消/六分钟上限的顺序执行、可恢复审批生命周期、写工具不确定状态和结果脱敏截断
//! [POS]: Loby Agent Runtime 的工具执行子状态机；拥有 tool item 终态并在副作用边界落盘，向上层报告取消与总时限但不拥有模型循环或正文写入
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::events::{
    emit_agent_activity, emit_agent_approval, emit_agent_proposal, emit_agent_run_state,
    AgentActivity,
};
use super::proposals;
use super::providers::{self, ProviderToolResult};
use super::runtime::AgentStreamRun;
use super::runtime_events::tool_activity_kind;
use super::tools::{self, ToolDefinition, ToolEffect};
use crate::models::{
    AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentRunPhase,
};
use serde_json::Value;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::Manager;

pub(super) const CANCELLED_TOOL_CALL: &str = "__loby_cancelled_tool_call__";
pub(super) const TIMED_OUT_TOOL_CALL: &str = "__loby_timed_out_tool_call__";
pub(super) const UNCERTAIN_WRITE_TOOL_CALL: &str = "__loby_uncertain_write_tool_call__";
const MAX_TOOL_EXECUTION_DURATION: Duration = Duration::from_secs(6 * 60);

pub(super) fn emit_document_proposals(
    run: &AgentStreamRun,
    calls: &[providers::ProviderToolCall],
    policy: &mut proposals::ProposalRunPolicy,
) -> Vec<ProviderToolResult> {
    let mut normalized = Vec::with_capacity(calls.len());
    let mut errors = Vec::new();
    for call in calls {
        match policy.normalize(&call.name, &call.arguments) {
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
        return errors;
    }
    let mut results = Vec::with_capacity(normalized.len());
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
        results.push(ProviderToolResult {
            call_id: call.id.clone(),
            output: proposal_receipt(&call.name),
        });
    }
    results
}

fn proposal_receipt(tool_name: &str) -> String {
    format!(
        "{tool_name} 的一张作者确认卡片已记录，但尚未执行。若本轮还有其他待确认操作，请继续逐项调用对应提案工具；全部记录后只用自然语言简短说明已创建确认卡片及建议位置。不要输出“文稿动作”列表，不要重复提案参数、路径或 pending/target 等内部状态。"
    )
}

pub(super) async fn execute_tool_calls(
    run: &mut AgentStreamRun,
    definitions: &[ToolDefinition],
    calls: Vec<providers::ProviderToolCall>,
    run_deadline: tokio::time::Instant,
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
        if definition.effect == ToolEffect::Proposal {
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
        if definition.effect == ToolEffect::Write {
            let approved =
                match request_tool_approval(run, &item_id, definition, run_deadline).await {
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
        if definition.effect == ToolEffect::Write {
            run.uncertain_write.store(true, Ordering::Release);
        }
        let execution_name = definition
            .execution_name
            .as_deref()
            .unwrap_or(&definition.name);
        let execution = async {
            if definition.name.starts_with("mcp__") {
                super::mcp::execute_namespaced_mcp_tool(execution_name, &call.arguments).await
            } else {
                tools::execute_builtin_tool(
                    run.window.app_handle(),
                    &run.library_path,
                    &run.local_directory_paths,
                    &run.provider,
                    &run.runtime,
                    &definition.name,
                    &call.arguments,
                )
                .await
            }
        };
        tokio::pin!(execution);
        let tool_deadline = std::cmp::min(
            run_deadline,
            tokio::time::Instant::now() + MAX_TOOL_EXECUTION_DURATION,
        );
        let execution = tokio::select! {
            result = tokio::time::timeout_at(tool_deadline, &mut execution) => {
                match result {
                    Ok(result) => result,
                    Err(_) if definition.effect == ToolEffect::Write => {
                        emit_tool_activity(run, &item_id, definition, AgentActivityState::Failed, None);
                        return Err(UNCERTAIN_WRITE_TOOL_CALL.to_string());
                    }
                    Err(_) if tool_deadline == run_deadline => {
                        emit_tool_activity(run, &item_id, definition, AgentActivityState::Failed, None);
                        return Err(TIMED_OUT_TOOL_CALL.to_string());
                    }
                    Err(_) => Err(format!(
                        "{} 执行超过 {} 分钟，已安全停止。",
                        definition.name,
                        MAX_TOOL_EXECUTION_DURATION.as_secs() / 60
                    )),
                }
            },
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
                run.uncertain_write.store(false, Ordering::Release);
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
                    output: prepare_tool_output(execution.output),
                });
            }
            Err(error) => {
                run.uncertain_write.store(false, Ordering::Release);
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
        AgentActivityState::Running => format!("调用 {}", definition.display_name),
        AgentActivityState::Completed => format!("完成 {}", definition.display_name),
        AgentActivityState::Failed => format!("{} 调用失败", definition.display_name),
        AgentActivityState::Cancelled => format!("已取消调用 {}", definition.display_name),
        _ => definition.display_name.clone(),
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
    run_deadline: tokio::time::Instant,
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
        &format!(
            "{} 可能修改外部状态，是否允许本次调用？",
            definition.display_name
        ),
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
        _ = tokio::time::sleep_until(run_deadline) => Err(TIMED_OUT_TOOL_CALL.to_string())
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

fn prepare_tool_output(output: String) -> String {
    let redacted = match serde_json::from_str::<Value>(&output) {
        Ok(mut value) => {
            redact_sensitive_json(&mut value);
            serde_json::to_string(&value).unwrap_or_else(|_| redact_sensitive_text(&output))
        }
        Err(_) => redact_sensitive_text(&output),
    };
    truncate_tool_output(redacted)
}

fn redact_sensitive_json(value: &mut Value) {
    match value {
        Value::Object(object) => {
            for (key, value) in object {
                if is_sensitive_key(key) {
                    *value = Value::String("[REDACTED]".to_string());
                } else {
                    redact_sensitive_json(value);
                }
            }
        }
        Value::Array(values) => values.iter_mut().for_each(redact_sensitive_json),
        _ => {}
    }
}

fn redact_sensitive_text(value: &str) -> String {
    value
        .lines()
        .map(|line| {
            for separator in ['=', ':'] {
                if let Some((key, _)) = line.split_once(separator) {
                    if is_sensitive_key(key.trim()) {
                        return format!("{}{} [REDACTED]", key.trim_end(), separator);
                    }
                }
            }
            line.to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn is_sensitive_key(key: &str) -> bool {
    matches!(
        key.trim()
            .to_ascii_lowercase()
            .replace(['-', '.'], "_")
            .as_str(),
        "api_key"
            | "apikey"
            | "token"
            | "auth_token"
            | "access_token"
            | "refresh_token"
            | "id_token"
            | "authorization"
            | "password"
            | "secret"
            | "client_secret"
            | "cookie"
            | "set_cookie"
            | "credential"
            | "credentials"
    )
}

#[cfg(test)]
mod tests {
    use super::{prepare_tool_output, proposal_receipt};

    #[test]
    fn proposal_receipt_keeps_the_model_loop_open_for_remaining_actions() {
        let output = proposal_receipt("propose_insert_image");
        assert!(output.contains("一张作者确认卡片已记录"));
        assert!(output.contains("继续逐项调用"));
        assert!(output.contains("不要输出“文稿动作”列表"));
        assert!(output.contains("不要重复提案参数"));
    }

    #[test]
    fn tool_results_redact_nested_json_secrets_before_model_ingestion() {
        let output = prepare_tool_output(
            r#"{"result":{"access_token":"token-value","title":"保留"},"cookie":"session"}"#
                .to_string(),
        );
        assert!(!output.contains("token-value"));
        assert!(!output.contains("session"));
        assert!(output.contains("[REDACTED]"));
        assert!(output.contains("保留"));
    }

    #[test]
    fn tool_results_redact_common_plain_text_secret_assignments() {
        let output =
            prepare_tool_output("API_KEY=abc\nAuthorization: Bearer token\n正文=保留".to_string());
        assert_eq!(
            output,
            "API_KEY= [REDACTED]\nAuthorization: [REDACTED]\n正文=保留"
        );
    }
}
