//! [INPUT]: 依赖 tauri-build 读取 tauri.conf.json 与 Cargo build context
//! [OUTPUT]: 向 Cargo 提供 Tauri 桌面应用的构建期代码生成入口
//! [POS]: src-tauri 的 build script，只委托 Tauri 生成构建元数据，不承载运行时逻辑
//! [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
fn main() {
    tauri_build::build()
}
