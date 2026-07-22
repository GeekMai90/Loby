//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 仅向所属 Rust 模块提供内部实现，不扩大 crate 接口
//! [POS]: Tauri desktop binary 入口，只委托 library crate 启动应用
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
//! [INPUT]: 依赖所属领域模型、受控文件系统或 Tauri 平台能力
//! [OUTPUT]: 仅向所属 Rust 模块提供内部实现，不扩大 crate 接口
//! [POS]: Tauri desktop binary 入口，只委托 library crate 启动应用
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
fn main() {
    loby_lib::run()
}
