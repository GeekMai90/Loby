# src-tauri/ - Tauri 原生工程

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
src/ - Rust composition root、领域模块与跨领域测试
capabilities/ - Tauri capability 权限声明
icons/ - 桌面 bundle 图标资产
gen/ - Tauri 生成配置，不手工承载业务规则
</directory>

<member>
Cargo.toml - crate 元数据与原生依赖，包括 updater 签名包安装与 process restart plugins
Cargo.lock - Rust 依赖解析锁定文件，保证本地门禁与桌面构建可复现
tauri.conf.json - 窗口、bundle、runtime、GitHub/Shields 公开仓库统计 API CSP 与 Gitee 优先、GitHub 回退的静态更新源配置
tauri.windows.conf.json - Windows 专属无装饰主窗口配置；首次创建限制在工作区且不继承固定 720px 最小高度，与默认配置合并
build.rs - Tauri build entry
</member>

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
