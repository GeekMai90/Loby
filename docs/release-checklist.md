# 发布检查清单

## 自动检查

```bash
npm ci
npm run check
npm run audit:npm
npm run build
```

## 桌面手测

- 打开现有写作库，创建项目、分组、笔记和文稿；
- 编辑长 Markdown，验证滚动、光标、浏览器原生选区、撤销与历史；
- 在编辑器和 AI composer 中验证中文 IME；
- 验证导航选择/焦点、键盘快捷键、拖拽与亮暗主题；
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
- 对删除、覆盖、移动、导出和发布检查目标限制与失败恢复；
- 需要 Rust 依赖审计时安装并运行 `cargo audit`，记录工具版本和结果。

## 发布记录

- 更新 `CHANGELOG.md`；
- 记录已知但接受的问题、手测平台与构建方式；
- 确认版本号、安装包签名/公证和回滚方案；
- 未通过的手测项必须明确阻塞或写入已知问题，不能默认为通过。
