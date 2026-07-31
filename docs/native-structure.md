# 原生工程结构

最后更新：2026-07-31

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
  search.rs                Tantivy/Jieba 本地 Markdown 全文索引与增量同步
  tests.rs                 跨领域 native 集成测试
  agent.rs                 agent 子模块门面与公开边界
  agent/
    assistant_attachments.rs
                           临时附件与写作库内容寻址持久化
    chatgpt_auth.rs        ChatGPT Device OAuth、token refresh 与去敏账号状态
    chatgpt_models.rs      当前订阅账号可见模型与能力目录
    credentials.rs        Provider、ChatGPT OAuth 与 MCP 原生凭证边界
    discovery.rs          Provider 模型和 Skill 能力发现
    provider_*.rs         模型目录、角色投影、HTTP 政策与三类 SSE 协议解码
    providers.rs          Responses、Messages、Chat Completions 与图片服务组合适配
    runtime*.rs           Agent Loop、事件投影、工具子状态机、预算与定向测试
    proposals.rs          跨 Provider 文稿提案 schema 与深层校验
    run_checkpoint.rs     未完成任务 checkpoint 与安全恢复交接
    tools.rs              内置工具、ToolEffect 与统一注册表
    web_search.rs         Provider-native 搜索与 DuckDuckGo 兜底
    image_generation.rs   Provider-neutral 图片路由与临时成果
    mcp.rs                MCP transport、发现缓存、别名与受控调用
    skill_*.rs            Skill 格式、导入和写作库仓库边界
    conversation_store.rs / quick_prompt_store.rs
                           对话与快捷提示持久化
  library/
    active_library.rs     桌面端与 CLI 共享的活动写作库定位文件
    project_metadata.rs    project.toml 与顺序恢复
    save.rs                整库结构、单文稿 revision、metadata-only index 与稳定 ID 路径索引保存
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
  window_lifecycle.rs      主窗口显示、关闭、Dock 恢复与 macOS 交通灯修复
```

这里按职责组展示模块族，精确文件成员以最近的 [`src-tauri/src/agent/AGENTS.md`](../src-tauri/src/agent/AGENTS.md)、[`library/AGENTS.md`](../src-tauri/src/library/AGENTS.md)、[`publishing/AGENTS.md`](../src-tauri/src/publishing/AGENTS.md) 与 [`resources/AGENTS.md`](../src-tauri/src/resources/AGENTS.md) 为准，避免长期文档复制一份会快速失真的成员清单。

## 边界

- 前端可见的 Tauri command 名称、camelCase payload 与 event 名称保持稳定，除非专门进行协调迁移。
- `app.rs` 只负责 builder、managed state、菜单和 command 注册；新增行为进入所属领域模块。
- `app.rs` 注册官方 updater/process plugins；renderer 只能获得签名包检查、安装和重启权限。更新源固定为公开 `GeekMai90/Loby-Releases` 的静态 `latest.json`，不引入自建服务，也不让 updater 接触写作库。
- `app.rs` 通过系统 About 面板承载“关于落笔”，并显式传入 256px Retina 应用图标、包版本和版权元数据，避免默认 32px 图标过小，也避免为静态应用信息启动额外 WebView。
- `agent/` 拥有 Provider、Agent Loop、Tool、Skill、MCP、运行状态、会话、quick prompts 与临时附件，不拥有文稿持久化。
- `library/` 拥有写作库扫描、保存、偏好、活动记录、监听、回收站与活动库定位；`.loby` 只保存应用元数据。活动库定位只公开协议版本和真实路径，写入失败不能阻断桌面写作。
- `publishing/secret_store.rs` 使用当前用户 app-config 目录；用户主动保存的 API Key 可通过专用设置 command 回填，但 provider secrets 不进入写作库或 renderer 持久化，OAuth secrets 不返回 renderer。
- `fs_paths.rs` 负责平台无关路径校验；项目目录知识位于 `project_paths.rs`；资源清理在写入前重新验证路径和全部保留引用。
- 纯逻辑或临时目录测试放在所属模块；`tests.rs` 只保留真正跨领域的持久化与协议契约。

## 远程服务决策

当前桌面应用不需要自建 `api/` 或 `chat/`。Tauri commands/events 是 renderer 与本机能力之间的内部 API。只有账号/计费、跨设备同步、多人协作、Web/移动端复用、服务端唯一规则或远程 AI gateway 成为真实需求时，才在仓库根 `services/` 下建立独立服务；技术栈、部署边界和数据所有权必须先通过 ADR 明确。

桌面更新同样不构成动态服务需求：当前由 GitHub Releases 托管完整更新包、签名和静态版本清单。只有灰度、账号授权、强制回滚或按设备分流成为真实需求时，才考虑动态 updater endpoint。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
