# 发布检查清单

## 自动检查

```bash
npm run release -- --check
npm run release:publish -- --version <version> --dry-run
npm run release:publish -- --version <version>
```

版本类型使用自然语言映射：修订版更新执行 `npm run release -- patch`，功能版更新执行 `npm run release -- minor`，重大版更新执行 `npm run release -- major`。版本准备命令只同步应用元数据，不自动提交、打 tag 或上传 Release；版本同步后先更新 `CHANGELOG.md`，再提交版本 PR、合并到 `main` 并创建同版本 tag。正式发布命令必须显式传入 `--version`，且只允许从干净的 `main` 和对应 tag 执行。

`release:publish` 是唯一正式桌面发布入口。它会固定执行 `npm ci --legacy-peer-deps`、版本来源检查、`npm run check`、`npm run audit:npm`、生产构建、源 bundle 与 DMG 内 `.app` 的严格签名校验、Tauri 中文产物到公开 ASCII 资产名的标准化、`latest.json` 生成、GitHub 上传和匿名下载验收。它不会执行 `npm audit fix`，也不会提交代码、创建源码 tag 或修改写作库；审计修复必须单独作为依赖维护变更完成并重新通过门禁。

## 标准 GitHub Release 格式

桌面应用的源码与发布资产分仓管理：源码位于私有仓库 `GeekMai90/Loby`，正式桌面发布位于公开仓库 `GeekMai90/Loby-Releases`。版本 PR 合并到源码仓库 `main` 后，再在发布仓库创建同版本 Release。

- Tag 使用 `v<version>`，例如 `v0.2.0`；Release 标题使用 `落笔 <version>`。
- macOS Apple Silicon 的 Tauri 本地产物名为 `落笔_<version>_aarch64.dmg`、`落笔.app.tar.gz`、`落笔.app.tar.gz.sig`；发布脚本会在临时目录中将它们标准化为 `Loby_<version>_aarch64.dmg`、`Loby_<version>_aarch64.app.tar.gz`、`Loby_<version>_aarch64.app.tar.gz.sig`，不会把重命名后的临时文件写回仓库。
- 同一 Release 必须上传 `latest.json`。其 `version` 与 Release 版本一致，`platforms.darwin-aarch64.signature` 逐字复制对应 `.sig` 文件内容，`url` 指向同一 Release 的 updater 包。
- `latest.json` 的下载地址必须保持为 `https://github.com/GeekMai90/Loby-Releases/releases/latest/download/latest.json`，不能改为源码仓库或某个固定版本 URL。
- Release 不得上传 Tauri 私钥、密码、源码仓库秘密或写作库文件；`.sig` 是公开发布资产，私钥只来自仓库外受控环境。

示例 `latest.json` 结构：

```json
{
  "version": "<version>",
  "notes": "落笔 <version>：版本说明。",
  "pub_date": "<ISO 8601 UTC time>",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<对应 .sig 文件的完整内容>",
      "url": "https://github.com/GeekMai90/Loby-Releases/releases/download/v<version>/Loby_<version>_aarch64.app.tar.gz"
    }
  }
}
```

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
- 从未登录环境读取 `https://github.com/GeekMai90/Loby-Releases/releases/latest/download/latest.json`，确认返回版本、签名和下载 URL 均指向当前 Release；再使用 `gh release view v<version> --repo GeekMai90/Loby-Releases` 核对四类资产均已上传。
- 未通过的手测项必须明确阻塞或写入已知问题，不能默认为通过。
