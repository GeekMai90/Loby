//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 仅向所属 Rust 模块提供内部实现，不扩大 crate 接口
//! [POS]: native crate 组合根，声明模块边界并只暴露桌面启动能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 仅向所属 Rust 模块提供内部实现，不扩大 crate 接口
//! [POS]: native crate 组合根，声明模块边界并只暴露桌面启动能力
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
mod agent;
mod app;
mod fs_paths;
mod library;
mod markdown;
mod models;
mod project_paths;
mod publishing;
mod resources;
mod system_paths;
mod zen_mode;

#[cfg(test)]
mod tests;

pub use app::run;
