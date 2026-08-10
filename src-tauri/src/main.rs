//! [INPUT]: 依赖 loby_lib::run 公开启动边界
//! [OUTPUT]: 向操作系统提供 Loby desktop binary 的 main 入口；Windows Release 使用 GUI subsystem，不创建附加控制台窗口
//! [POS]: Tauri desktop binary 入口，只委托 library crate 启动应用，并承载平台启动子系统声明
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    loby_lib::run()
}
