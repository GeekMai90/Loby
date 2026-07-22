//! [INPUT]: 依赖 agent、app、library、publishing、resources 等 native 子模块及跨领域集成测试
//! [OUTPUT]: 对外仅重导出 app::run 作为 desktop library 启动边界
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
