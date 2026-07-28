//! [INPUT]: 依赖父级 runtime 的请求校验、上下文分隔、步数预算与运行控制注册内部契约
//! [OUTPUT]: 为 Agent Loop 提供 requestId 隔离、steer 预算与重复启动的原生回归测试
//! [POS]: runtime.rs 的测试陪伴文件，只进入 test build，避免生产编排文件被测试实现推过 800 行边界
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

use super::{
    build_agent_prompt, register_run_control, validate_request_id, AgentLoopBudget,
    AgentRunControl, AgentRunState, MAX_AGENT_STEPS,
};
use std::path::Path;

#[test]
fn request_id_is_safe_for_request_scoped_events() {
    assert!(validate_request_id("agent-123_abc").is_ok());
    assert!(validate_request_id("agent/123").is_err());
}

#[test]
fn prompt_keeps_context_and_user_message_separate() {
    let prompt = build_agent_prompt("请分析结构", "当前稿件：测试", Path::new("/tmp/library"));
    assert!(prompt.contains("当前写作上下文：\n当前稿件：测试"));
    assert!(prompt.contains("用户消息：\n请分析结构"));
}

#[test]
fn steering_attempts_do_not_consume_completed_loop_steps() {
    let mut budget = AgentLoopBudget::default();
    assert_eq!(budget.begin_attempt(), 0);
    assert_eq!(budget.begin_attempt(), 1);
    assert!(budget.has_capacity());

    for _ in 0..MAX_AGENT_STEPS {
        budget.complete_step();
    }
    assert!(!budget.has_capacity());
}

#[test]
fn duplicate_request_ids_cannot_replace_a_live_run_control() {
    let state = AgentRunState::default();
    let control = || {
        let (cancel_sender, _) = tokio::sync::watch::channel(false);
        let (steer_sender, _) = tokio::sync::mpsc::unbounded_channel();
        AgentRunControl {
            cancel_sender,
            steer_sender,
        }
    };
    assert!(register_run_control(&state, "agent-1", control()).is_ok());
    assert!(register_run_control(&state, "agent-1", control()).is_err());
    assert_eq!(state.pending.lock().unwrap().len(), 1);
}
