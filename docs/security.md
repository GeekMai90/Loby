# 安全边界

Loby 是本地优先桌面应用。安全基线是保护写作库、限制文件/进程/网络暴露，并让 AI、发布和破坏性操作始终可见。

## Tauri capability

`src-tauri/capabilities/default.json` 只授予当前可见工作流需要的 core、窗口与 open/save dialog 权限。新增 filesystem、shell、protocol 或 network 能力必须从具体用户动作出发，并同步审查 CSP 与路径范围。

自定义 asset protocol 当前需要读取用户选择的本地资源；应持续收窄到活动写作库和明确批准目录。`macOSPrivateApi` 只服务透明主窗口，若窗口恢复不透明则移除并复测标题栏、拖动、缩放与 AI 面板。

## Agent 与本地进程

- Rust 层只启动设置中可见、可探测的本地 Agent CLI，并通过受控 app-server 协议交互。
- tool approval 必须显示给用户；取消应终止等待与运行状态。
- AI 默认只接收显式上下文和活动写作库信息，不扫描任意文件系统。
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
- secret 值不返回密码输入框，不进入日志、截图、预览 HTML、主题文件、聊天记录或评审文本；设置只查询“是否已保存”。
- Unix 限制目录/文件为当前用户；Windows 依赖当前用户 app-config profile 隔离。
- 环境变量可以作为明确覆盖；OSS Access Key ID 与非秘密 endpoint 设置与 Access Key Secret 分离。
- 系统 Keychain 可以作为未来增强，但不能成为唯一跨平台路径，除非先提供兼容迁移。

## 网络与发布

- 本地文稿只在用户明确触发 AI 或发布时发送到对应服务。
- WordPress 默认创建 draft；墨问和其他公开发布需要明确确认。
- 图片上传不修改源文件，临时优化副本自动清理。
- 浏览器开发模式可以渲染界面与预览，但不执行真实直接发布。

## 依赖与发布审计

```bash
npm run audit:npm
cargo audit
```

`cargo audit` 需要额外安装，尚未进入默认 `npm run check`；发布候选版本应记录是否执行。任何新增依赖都要检查维护状态、许可证、native 能力与供应链范围。
