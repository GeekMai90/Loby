# 发布检查清单

## 自动检查

```bash
npm ci
npm run release -- --check
npm run check
npm run audit:npm
npm run build
```

版本类型使用自然语言映射：修订版更新执行 `npm run release -- patch`，功能版更新执行 `npm run release -- minor`，重大版更新执行 `npm run release -- major`。版本准备命令只同步应用元数据，不自动提交、打 tag 或上传 Release；版本同步后先更新 `CHANGELOG.md`，再执行本清单。

生产构建必须提供 `TAURI_SIGNING_PRIVATE_KEY`，其值可以是私钥内容或仓库外的私钥文件路径；无密码私钥同时设置空的 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，避免非交互构建等待输入。更新私钥不得位于仓库或写作库。构建后确认目标平台同时生成 updater bundle 与 `.sig`。

## 桌面手测

- 打开现有写作库，创建项目、分组、笔记和文稿；
- 编辑长 Markdown，验证滚动、光标、浏览器原生选区、撤销与历史；
- 在编辑器和 AI composer 中验证中文 IME；
- 验证导航选择/焦点、键盘快捷键、拖拽与亮暗主题；
- 验证底部帮助菜单四个入口、自动发现更新后的版本提醒卡片与主题色下载按钮、下载进度、安装前保存与重启；
- 附加文稿、选区和图片，发送、steer、cancel、retry 并处理审批；
- 应用、拒绝和撤销 AI change/action，重启后确认历史仍可审计；
- 插入、预览、移动、导出和清理图片引用；
- 验证 Markdown、HTML、纯文本、微信、小红书、墨问和 WordPress 相关路径；
- 打开公众号主题工作室，验证手动调整、AI change、undo/redo、导入/导出和预览复制；
- 重启后确认项目、偏好、对话、主题和动作卡片持久化。

至少在目标 macOS 版本执行；发布 Windows 构建前复测路径、CLI 发现、文件监听、秘密存储和 WebView 行为。

## 安全与数据

- 复查 `security.md` 和 Tauri capabilities；
- 确认提交中没有密钥、token、私人路径、写作库文件或临时截图；
- 确认 Tauri updater 公钥与预期私钥配对，私钥已有仓库外备份且没有出现在 git、日志或 Release；
- 对删除、覆盖、移动、导出和发布检查目标限制与失败恢复；
- 需要 Rust 依赖审计时安装并运行 `cargo audit`，记录工具版本和结果。

## 发布记录

- 更新 `CHANGELOG.md`；
- 记录已知但接受的问题、手测平台与构建方式；
- 确认版本号、安装包签名/公证和回滚方案；
- 将安装包、`.sig` 与完整 `latest.json` 发布到公开 `GeekMai90/Loby-Releases`，并从未登录环境验证 latest URL 和目标平台下载 URL；
- 未通过的手测项必须明确阻塞或写入已知问题，不能默认为通过。
