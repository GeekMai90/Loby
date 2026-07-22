//! [INPUT]: 依赖 std path/process/thread/time/sync 与当前环境中的 agent provider 可执行文件
//! [OUTPUT]: 向 crate 提供 AgentCommandState、超时进程工具、provider 归一化与带更新感知的可执行路径解析
//! [POS]: 本地 AI agent 进程边界，集中 CLI 路径探测、进程级缓存、失效重探测与命令超时
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct AgentCommandCacheKey {
    provider: String,
    configured_path: String,
}

impl AgentCommandCacheKey {
    fn new(provider: &str, configured_path: Option<&str>) -> Self {
        Self {
            provider: provider.to_string(),
            configured_path: configured_path.unwrap_or_default().trim().to_string(),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct AgentCommandFingerprint {
    length: u64,
    modified: Option<SystemTime>,
}

#[derive(Clone, Debug)]
struct CachedAgentCommand {
    path: String,
    fingerprint: Option<AgentCommandFingerprint>,
}

#[derive(Clone, Default)]
pub(crate) struct AgentCommandState {
    cached: Arc<Mutex<HashMap<AgentCommandCacheKey, CachedAgentCommand>>>,
}

impl AgentCommandState {
    pub(crate) fn resolve(
        &self,
        provider: &str,
        configured_path: Option<String>,
    ) -> Option<String> {
        let key = AgentCommandCacheKey::new(provider, configured_path.as_deref());
        self.resolve_cached(key, || resolve_agent_command(provider, configured_path))
    }

    pub(crate) fn invalidate_path(&self, path: &str) {
        if let Ok(mut cached) = self.cached.lock() {
            cached.retain(|_, command| command.path != path);
        }
    }

    fn resolve_cached(
        &self,
        key: AgentCommandCacheKey,
        resolver: impl FnOnce() -> Option<String>,
    ) -> Option<String> {
        let Ok(mut cached) = self.cached.lock() else {
            return resolver();
        };
        if let Some(command) = cached.get(&key) {
            if command.fingerprint.is_some()
                && command.fingerprint == agent_command_fingerprint(&command.path)
            {
                return Some(command.path.clone());
            }
        }

        cached.retain(|candidate, _| candidate.provider != key.provider);
        let path = resolver()?;
        cached.insert(
            key,
            CachedAgentCommand {
                fingerprint: agent_command_fingerprint(&path),
                path: path.clone(),
            },
        );
        Some(path)
    }
}

fn agent_command_fingerprint(path: &str) -> Option<AgentCommandFingerprint> {
    let metadata = fs::metadata(path).ok()?;
    Some(AgentCommandFingerprint {
        length: metadata.len(),
        modified: metadata.modified().ok(),
    })
}

pub(crate) fn run_command_with_timeout(
    mut command: Command,
    timeout: Duration,
) -> Result<Output, String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|error| error.to_string())?;
    let started_at = Instant::now();

    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(_) => return child.wait_with_output().map_err(|error| error.to_string()),
            None if started_at.elapsed() >= timeout => {
                let _ = child.kill();
                let output = child
                    .wait_with_output()
                    .map_err(|error| error.to_string())?;
                let mut stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                if !stderr.is_empty() {
                    stderr.push('\n');
                }
                stderr.push_str("AI CLI timed out after 90 seconds.");
                return Ok(Output {
                    status: output.status,
                    stdout: output.stdout,
                    stderr: stderr.into_bytes(),
                });
            }
            None => thread::sleep(Duration::from_millis(100)),
        }
    }
}

pub(crate) fn normalize_agent_provider(provider: &str) -> String {
    if provider.eq_ignore_ascii_case("claude") {
        "claude".to_string()
    } else {
        "codex".to_string()
    }
}

pub(crate) fn agent_binary_name(provider: &str) -> &'static str {
    if provider == "claude" {
        "claude"
    } else {
        "codex"
    }
}

fn agent_env_var(provider: &str) -> &'static str {
    if provider == "claude" {
        "CLAUDE_CLI"
    } else {
        "CODEX_CLI"
    }
}

pub(crate) fn resolve_agent_command(
    provider: &str,
    configured_path: Option<String>,
) -> Option<String> {
    let binary = agent_binary_name(provider);
    if let Some(path) = configured_path {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }

    if let Ok(path) = std::env::var(agent_env_var(provider)) {
        if !path.trim().is_empty() {
            return Some(path);
        }
    }

    let shell_lookup = Command::new("/bin/zsh")
        .arg("-lc")
        .arg(format!("command -v {}", binary))
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if value.is_empty() {
                    None
                } else {
                    Some(value)
                }
            } else {
                None
            }
        });

    if let Some(path) = shell_lookup {
        if is_agent_command_usable(&path) {
            return Some(path);
        }
    }

    let home = dirs::home_dir()?;
    let candidates = if provider == "claude" {
        vec![
            home.join(".claude").join("local").join("claude"),
            home.join(".local").join("bin").join("claude"),
            PathBuf::from("/opt/homebrew/bin/claude"),
            PathBuf::from("/usr/local/bin/claude"),
        ]
    } else {
        vec![
            home.join(".codex")
                .join("plugins")
                .join(".plugin-appserver")
                .join("codex"),
            home.join(".codex").join("bin").join("codex"),
            home.join(".local").join("bin").join("codex"),
            PathBuf::from("/opt/homebrew/bin/codex"),
            PathBuf::from("/usr/local/bin/codex"),
        ]
    };

    candidates
        .iter()
        .find(|candidate| candidate.exists() && is_agent_command_usable_path(candidate))
        .map(|candidate| candidate.display().to_string())
}

fn is_agent_command_usable_path(path: &Path) -> bool {
    is_agent_command_usable(&path.display().to_string())
}

fn is_agent_command_usable(path: &str) -> bool {
    let mut command = Command::new(path);
    command.arg("--version");
    run_command_with_timeout(command, Duration::from_secs(8))
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{AgentCommandCacheKey, AgentCommandState};
    use std::cell::Cell;
    use std::fs;

    #[test]
    fn caches_resolved_command_until_binary_changes() -> Result<(), String> {
        let directory = tempfile::tempdir().map_err(|error| error.to_string())?;
        let binary = directory.path().join("codex");
        fs::write(&binary, "v1").map_err(|error| error.to_string())?;
        let path = binary.display().to_string();
        let state = AgentCommandState::default();
        let key = AgentCommandCacheKey::new("codex", None);
        let calls = Cell::new(0);

        for _ in 0..2 {
            let resolved = state.resolve_cached(key.clone(), || {
                calls.set(calls.get() + 1);
                Some(path.clone())
            });
            assert_eq!(resolved.as_deref(), Some(path.as_str()));
        }
        assert_eq!(calls.get(), 1);

        fs::write(&binary, "version-two").map_err(|error| error.to_string())?;
        let resolved = state.resolve_cached(key, || {
            calls.set(calls.get() + 1);
            Some(path.clone())
        });
        assert_eq!(resolved.as_deref(), Some(path.as_str()));
        assert_eq!(calls.get(), 2);

        state.invalidate_path(&path);
        state.resolve_cached(AgentCommandCacheKey::new("codex", None), || {
            calls.set(calls.get() + 1);
            Some(path.clone())
        });
        assert_eq!(calls.get(), 3);
        Ok(())
    }

    #[test]
    fn settings_change_replaces_the_provider_cache_entry() {
        let state = AgentCommandState::default();
        let first_key = AgentCommandCacheKey::new("codex", Some("/first/codex"));
        let second_key = AgentCommandCacheKey::new("codex", Some("/second/codex"));

        state.resolve_cached(first_key, || Some("codex-one".to_string()));
        state.resolve_cached(second_key, || Some("codex-two".to_string()));

        let cached = state
            .cached
            .lock()
            .expect("command cache should be available");
        assert_eq!(cached.len(), 1);
        assert_eq!(
            cached.values().next().map(|value| value.path.as_str()),
            Some("codex-two")
        );
    }
}
