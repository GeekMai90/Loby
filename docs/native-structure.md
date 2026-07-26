# 原生工程结构

最后更新：2026-07-26

## 目标

Tauri 层向前端暴露稳定 command/event 边界。`app.rs` 负责组合和注册，持久文件系统、AI、发布与资源行为进入明确的 Rust 领域模块。

```text
src-tauri/src/
  lib.rs                   crate 模块根
  main.rs                  desktop binary 入口
  app.rs                   Tauri builder、state、菜单与 command 注册
  models.rs                序列化 command/persistence 模型
  fs_paths.rs              通用安全路径与文件名能力
  markdown.rs              Markdown/frontmatter 解析与渲染
  project_paths.rs         项目目录与资源路径解析
  system_paths.rs          系统打开、显示与复制
  tests.rs                 跨领域 native 集成测试
  agent.rs                 agent 子模块门面与公开边界
  agent/
    assistant_attachments.rs
                           会话临时图片与受控路径
    conversation_store.rs  AI 会话持久化
    credentials.rs         Provider/MCP 原生凭证边界
    discovery.rs           Loby skill 与 provider model 发现
    events.rs              稳定前端 event 翻译
    mcp.rs                 MCP client 与 transport 管理
    providers.rs           模型服务适配器
    tools.rs               内置工具与统一注册表
    quick_prompt_store.rs  quick prompts 持久化
    runtime.rs             Agent Loop、commands 与 stream 生命周期
  library/
    project_metadata.rs    project.toml 与顺序恢复
    save.rs                Markdown、metadata 与 index 保存
    scan.rs                folder-first 扫描
    trash.rs               回收、恢复与永久删除
    library_preferences_store.rs
                           写作库非敏感偏好
    writing_activity_store.rs
                           写作活动与目标事件
    watcher.rs             写作库监听与过滤
  library.rs               library 子模块门面与稳定常量
  publishing/              渠道、主题、秘密与上传
  resources/               图片与导出资源的受控读写
  resources.rs             resources 子模块门面
```

## 边界

- 前端可见的 Tauri command 名称、camelCase payload 与 event 名称保持稳定，除非专门进行协调迁移。
- `app.rs` 只负责 builder、managed state、菜单和 command 注册；新增行为进入所属领域模块。
- `agent/` 拥有 Provider、Agent Loop、Tool、Skill、MCP、运行状态、会话、quick prompts 与临时附件，不拥有文稿持久化。
- `library/` 拥有写作库扫描、保存、偏好、活动记录、监听与回收站；`.loby` 只保存应用元数据。
- `publishing/secret_store.rs` 使用当前用户 app-config 目录；provider secrets 不进入写作库或 renderer 持久化。
- `fs_paths.rs` 负责平台无关路径校验；项目目录知识位于 `project_paths.rs`；资源清理在写入前重新验证路径和全部保留引用。
- 纯逻辑或临时目录测试放在所属模块；`tests.rs` 只保留真正跨领域的持久化与协议契约。

## 远程服务决策

当前桌面应用不需要自建 `api/` 或 `chat/`。Tauri commands/events 是 renderer 与本机能力之间的内部 API。只有账号/计费、跨设备同步、多人协作、Web/移动端复用、服务端唯一规则或远程 AI gateway 成为真实需求时，才在仓库根 `services/` 下建立独立服务；技术栈、部署边界和数据所有权必须先通过 ADR 明确。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
