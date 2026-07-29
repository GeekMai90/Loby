# 安全边界

Loby 是本地优先桌面应用。安全基线是保护写作库、限制文件/进程/网络暴露，并让 AI、发布和破坏性操作始终可见。

## Tauri capability

`src-tauri/capabilities/default.json` 只授予当前可见工作流需要的 core、窗口与 open/save dialog 权限。新增 filesystem、shell、protocol 或 network 能力必须从具体用户动作出发，并同步审查 CSP 与路径范围。

自定义 asset protocol 当前需要读取用户选择的本地资源；应持续收窄到活动写作库、进程级临时附件目录和 Loby 自己生成的明确批准目录，不能依赖宽泛 `$HOME/**` 的 glob 匹配。`macOSPrivateApi` 只服务透明主窗口，若窗口恢复不透明则移除并复测标题栏、拖动、缩放与 AI 面板。

## Agent、网络与本地进程

- Agent Runtime 只通过已配置 Provider 与工具访问网络或进程，不读取其他 AI 应用的 cookie、token、配置或本地登录状态。
- tool approval 必须显示给用户；所有 MCP call 都经过本地审批，不能信任 server 自报的 `readOnlyHint` 绕过授权；取消应终止网络请求、MCP call、审批等待与运行状态。
- AI 默认只接收显式上下文和活动写作库信息，不扫描任意文件系统。
- MCP stdio 只执行设置中明确保存的 executable 和 args，不经过 shell；任意本地命令能力默认不存在。
- 错误可展示必要诊断，但不得暴露 token、cookie、API key、完整环境变量或无关私人路径。
- 粘贴的聊天图片只写入进程级系统临时目录；运行时只接受该目录下路径，持久化前删除路径与附件，退出时清理目录。

## 文件系统

- 所有用户输入路径经过 canonicalize/范围校验，拒绝目录穿越、绝对目标注入和大小写碰撞覆盖。
- 导出 bundle 在创建目标前校验全部相对 destination 与重复项。
- 删除、移动和恢复使用稳定 ID、精确目标与受控废纸篓；不对未解析变量或宽目录执行递归破坏操作。
- 扫描隐藏目录时遵守已定义白名单，不把 `.loby/`、临时文件或未知隐藏内容当作正文。
- 外部文件变化不得静默覆盖编辑器未保存内容。

## 发布秘密

- 发布凭证由 Rust 写入当前用户平台 app-config 下的 `publishing-secrets.json`，位于写作库和浏览器存储之外。
- 用户在设置中主动保存的 API Key 可由专用设置 command 回填到对应密码框，默认遮罩且不得进入日志、预览 HTML、主题文件、聊天记录或评审文本；GitHub OAuth 设置仍只消费去敏连接状态、一次性设备码与仓库列表。
- Unix 限制目录/文件为当前用户；Windows 依赖当前用户 app-config profile 隔离。
- GitHub 默认通过无需 client secret 的 GitHub App Device Flow 授权，access token 失效时由 native refresh token 自动轮换；`LOBY_GITHUB_TOKEN` 只作为开发或受控部署的明确覆盖。OSS Access Key ID 与非秘密 endpoint 设置与 Access Key Secret 分离。
- 系统 Keychain 可以作为未来增强，但不能成为唯一跨平台路径，除非先提供兼容迁移。

## AI 与 MCP 凭证

- AI Provider、订阅 OAuth 与 MCP 凭证由原生 credential store 持有，renderer 只接收 provider id、连接状态和必要的套餐类型。
- 新保存的 AI、ChatGPT OAuth 与 MCP 凭证进入当前用户平台 app-config 下的 `agent-secrets.json`，位于写作库和浏览器存储之外；Unix 目录权限为 `0700`、文件权限为 `0600`，写入使用同目录临时文件原子替换。
- 启动和凭证状态查询不得访问 macOS Keychain。旧 Keychain 内容不会自动读取或迁移，升级后用户需要在落笔中重新保存一次；这是避免系统反复授权的明确产品取舍。
- 应用内文件不声称提供硬件级或 Keychain 级静态加密；它依赖当前系统用户目录与文件权限隔离。不得把相同内容复制到 localStorage、写作库、日志或 crash payload。
- API Key 表单可以在组件内存中承接用户主动保存的回填值；关闭或重新打开表单必须恢复密码遮罩，显隐按钮只改变当前输入框的呈现，不得产生第二份持久化副本。
- access token、refresh token、ChatGPT account ID、OAuth verifier 和账号邮箱不能进入 renderer、prompt、对话、metric、panic 或错误详情；用户在设置中主动保存的 API Key 可由专用设置 command 回填到对应密码框，默认遮罩且不得写入 renderer 持久化、prompt、对话、metric、panic 或错误详情；套餐类型只能作为去敏连接状态返回。
- ChatGPT 订阅登录不读取浏览器 cookie；只允许系统浏览器 PKCE、device flow 或厂商正式支持的授权回调。

## 网络与发布

- 本地文稿只在用户明确触发 AI 或发布时发送到对应服务。
- WordPress 默认创建 draft；墨问和其他公开发布需要明确确认。
- 图片上传不修改源文件，临时优化副本自动清理。
- 应用级 GitHub 发布目标只读取当前文稿所在写作文件夹内已解析图片，只能选择 GitHub App 已安装且具备 Contents 写权限的仓库；目标配置不得包含 token，远端覆盖必须同时通过受管目录和稳定文稿 ID 校验，禁止 force 更新分支。
- 浏览器开发模式可以渲染界面与预览，但不执行真实直接发布。

## 依赖与发布审计

```bash
npm run audit:npm
cargo audit
```

`cargo audit` 需要额外安装，尚未进入默认 `npm run check`；发布候选版本应记录是否执行。任何新增依赖都要检查维护状态、许可证、native 能力与供应链范围。
