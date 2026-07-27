//! [INPUT]: 依赖 Provider 归一化增量、Agent Event Protocol 构造器、proposal 类型识别与运行阶段计时
//! [OUTPUT]: 向 runtime 提供 Provider stream sink、面向用户的中文 reasoning 摘要、reasoning 显式封口与确定性工具活动分类
//! [POS]: Loby Agent Runtime 的可观测性适配层，把不可信模型增量本地化、清理后转成权威 phase/item 事件，不拥有 Agent Loop
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use super::events::{
    emit_agent_activity, emit_agent_delta, emit_agent_metric, emit_agent_reasoning,
    emit_agent_run_state, AgentActivity,
};
use super::proposals;
use super::provider_stream::{ProviderStreamEvent, ProviderStreamSink};
use crate::models::{
    AgentActivityKind, AgentActivityState, AgentActivityVisibility, AgentRunPhase,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

pub(super) fn provider_stream_sink(
    window: tauri::Window,
    request_id: String,
    step: usize,
    request_started: Instant,
    first_text_delta: Arc<AtomicBool>,
    reasoning_active: Arc<AtomicBool>,
) -> ProviderStreamSink {
    Arc::new(move |event| match event {
        ProviderStreamEvent::ResponseStarted => {
            emit_agent_run_state(&window, &request_id, AgentRunPhase::WaitingForModel, None);
        }
        ProviderStreamEvent::TextDelta(delta) => {
            complete_active_reasoning(
                &window,
                &request_id,
                reasoning_active.as_ref(),
                AgentActivityState::Completed,
            );
            if !first_text_delta.swap(true, Ordering::Relaxed) {
                emit_agent_metric(
                    &window,
                    &request_id,
                    "first_text_delta",
                    "ready",
                    request_started.elapsed().as_millis() as u64,
                );
            }
            emit_agent_run_state(
                &window,
                &request_id,
                AgentRunPhase::StreamingAnswer,
                Some("assistant-message"),
            );
            emit_agent_delta(&window, &request_id, &delta);
        }
        ProviderStreamEvent::ReasoningSummary(summary) => {
            reasoning_active.store(true, Ordering::Relaxed);
            emit_agent_run_state(
                &window,
                &request_id,
                AgentRunPhase::Reasoning,
                Some("assistant-reasoning"),
            );
            emit_agent_reasoning(
                &window,
                &request_id,
                "assistant-reasoning",
                AgentActivityState::Running,
                &present_reasoning_summary(&summary),
            );
        }
        ProviderStreamEvent::ToolInputStarted { call_id, name } => {
            complete_active_reasoning(
                &window,
                &request_id,
                reasoning_active.as_ref(),
                AgentActivityState::Completed,
            );
            let item_id = format!("tool-{call_id}");
            emit_agent_activity(
                &window,
                &request_id,
                AgentActivity::new(
                    &item_id,
                    tool_activity_kind(&name),
                    AgentActivityState::Queued,
                    AgentActivityVisibility::Milestone,
                )
                .title(format!("准备调用 {name}"))
                .tool_name(&name)
                .parent_id(format!("provider-step-{step}")),
            );
            emit_agent_run_state(
                &window,
                &request_id,
                AgentRunPhase::ExecutingTool,
                Some(&item_id),
            );
        }
    })
}

fn present_reasoning_summary(summary: &str) -> String {
    const FALLBACK: &str = "模型正在分析任务并规划下一步操作。";
    const DISPLAY_LIMIT: usize = 2_000;

    let separated = summary
        .replace("****", "\n")
        .replace("**", "")
        .replace("__", "")
        .replace('`', "");
    let cleaned = separated
        .lines()
        .filter_map(clean_reasoning_line)
        .filter(|line| line.chars().any(is_han_character))
        .collect::<Vec<_>>();
    if cleaned.is_empty() {
        return FALLBACK.to_string();
    }
    truncate_display_text(cleaned.join("\n"), DISPLAY_LIMIT)
}

fn clean_reasoning_line(line: &str) -> Option<String> {
    let mut line = line.trim().trim_matches('*').trim();
    while let Some(rest) = line.strip_prefix('#').or_else(|| line.strip_prefix('>')) {
        line = rest.trim_start();
    }
    if let Some(rest) = line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")) {
        line = rest.trim_start();
    }
    (!line.is_empty()).then(|| line.to_string())
}

fn is_han_character(character: char) -> bool {
    matches!(
        character,
        '\u{3400}'..='\u{4DBF}' | '\u{4E00}'..='\u{9FFF}' | '\u{F900}'..='\u{FAFF}'
    )
}

fn truncate_display_text(text: String, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text;
    }
    let truncated = text.chars().take(limit).collect::<String>();
    format!("{truncated}……")
}

pub(super) fn complete_active_reasoning(
    window: &tauri::Window,
    request_id: &str,
    reasoning_active: &AtomicBool,
    state: AgentActivityState,
) {
    if reasoning_active.swap(false, Ordering::Relaxed) {
        emit_agent_reasoning(window, request_id, "assistant-reasoning", state, "");
    }
}

pub(super) fn tool_activity_kind(name: &str) -> AgentActivityKind {
    if proposals::is_proposal_tool(name) {
        return AgentActivityKind::Proposal;
    }
    match name {
        "activate_skill"
        | "read_skill_resource"
        | "inspect_skill_package"
        | "inspect_external_skill"
        | "install_external_skill"
        | "create_skill"
        | "update_skill" => AgentActivityKind::Skill,
        "generate_image" => AgentActivityKind::ImageGeneration,
        "web_search" => AgentActivityKind::WebSearch,
        _ => AgentActivityKind::Tool,
    }
}

#[cfg(test)]
mod tests {
    use super::{present_reasoning_summary, tool_activity_kind};
    use crate::models::AgentActivityKind;

    #[test]
    fn tool_kind_is_owned_by_runtime_instead_of_localized_titles() {
        assert_eq!(
            tool_activity_kind("activate_skill"),
            AgentActivityKind::Skill
        );
        assert_eq!(
            tool_activity_kind("generate_image"),
            AgentActivityKind::ImageGeneration
        );
        assert_eq!(
            tool_activity_kind("web_search"),
            AgentActivityKind::WebSearch
        );
        assert_eq!(
            tool_activity_kind("propose_insert_image"),
            AgentActivityKind::Proposal
        );
        assert_eq!(tool_activity_kind("read_markdown"), AgentActivityKind::Tool);
    }

    #[test]
    fn english_markdown_reasoning_is_replaced_by_a_localized_summary() {
        assert_eq!(
            present_reasoning_summary(
                "**Generating abstract markdown image****Verifying generated image path compatibility**"
            ),
            "模型正在分析任务并规划下一步操作。"
        );
    }

    #[test]
    fn chinese_reasoning_is_split_and_stripped_of_markdown() {
        assert_eq!(
            present_reasoning_summary("**生成抽象封面****检查图片路径兼容性**"),
            "生成抽象封面\n检查图片路径兼容性"
        );
        assert_eq!(
            present_reasoning_summary("## 规划配图\n- 检查文章主题"),
            "规划配图\n检查文章主题"
        );
        assert_eq!(
            present_reasoning_summary("**Planning image**\n**检查 generate_image 参数**"),
            "检查 generate_image 参数"
        );
    }
}
