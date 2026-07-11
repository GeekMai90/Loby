use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, Instant};

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
