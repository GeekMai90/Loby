//! [INPUT]: 依赖 loby_lib::run 公开启动边界
//! [OUTPUT]: 向操作系统提供 Loby desktop binary 的 main 入口
//! [POS]: Tauri desktop binary 入口，只委托 library crate 启动应用
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
fn main() {
    loby_lib::run()
}
