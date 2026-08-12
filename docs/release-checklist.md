# 发布检查清单

## 发布模型

Loby 的正式桌面版由同一个源码 tag 生成三个 updater 平台：

| updater 平台键   | 构建宿主     | 安装资产                        | 更新资产                                     |
| ---------------- | ------------ | ------------------------------- | -------------------------------------------- |
| `darwin-aarch64` | macOS        | `Loby_<version>_aarch64.dmg`    | `Loby_<version>_aarch64.app.tar.gz` + `.sig` |
| `windows-x86_64` | Windows      | `Loby_<version>_x64-setup.exe`  | 同一个 NSIS `.exe` + `.sig`                  |
| `linux-x86_64`   | Ubuntu 22.04 | `Loby_<version>_amd64.AppImage` | 同一个 AppImage + `.sig`                     |

Linux 首个正式格式固定为 AppImage。Tauri 静态 updater 的 `linux-x86_64` 只有一个平台键，不能同时为 DEB 安装和 AppImage 安装分发两种不同更新包；增加 DEB 前必须先设计独立更新策略并记录 ADR。

源码、安装包、公开 `.sig` 和 `latest.json` 统一位于公开仓库 `GeekMai90/Loby`。版本 PR 合并后，在 `main` 的同一提交创建并推送 `v<version>` tag；同仓库 Release 使用相同 tag 和 `落笔 <version>` 标题。

## 一、准备版本

```bash
npm run release -- patch # 或 minor / major
npm run release -- --check
npm run check
npm run audit:npm
```

版本准备只同步应用元数据，不提交、不打 tag、不发布。同步版本后补充 `CHANGELOG.md`，提交版本 PR，完成审查并合并到 `main`，再创建同版本 tag。正式工作流会再次验证版本、tag、完整质量门禁和 npm 审计。

仓库 Actions secrets 必须预先配置：

- `TAURI_SIGNING_PRIVATE_KEY`：Tauri updater 私钥内容；
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码；无密码私钥不创建此 secret，工作流会传入空值。

正式发布 job 使用 GitHub Actions 自动提供的短期 `GITHUB_TOKEN`，并仅在该 job 授予 `contents: write`；不配置、不保存跨仓库 PAT。来自 fork 的 Pull Request CI 不读取任何发布 secret。

私钥不得进入源码、写作库、日志、Actions artifact 或公开 Release。`.sig` 是公开验签使用的资产，不是秘密。

## 二、运行三平台流水线

在 GitHub Actions 手动运行 `Desktop release`。先以 `dry_run=true` 从当前 `main` 验证完整构建矩阵；预演不依赖旧版本 tag，因此会实际验证刚合并的发布链路：

```bash
gh workflow run desktop-release.yml --repo GeekMai90/Loby -f version=<version> -f dry_run=true
```

预演成功且三平台真机手测通过后，确认 `v<version>` tag 指向当前 `main`，再以相同版本正式发布：

```bash
gh workflow run desktop-release.yml --repo GeekMai90/Loby -f version=<version> -f dry_run=false
```

工作流按以下顺序执行：

1. dry-run 检出当前 `main`，正式发布检出同版本 tag；Ubuntu runner 执行版本检查、`npm run check` 和 `npm run audit:npm`；
2. macOS、Windows、Ubuntu runner 并行原生构建，每个平台只输出标准化资产和带 SHA-256 的收据；
3. 汇总器要求三份收据全部存在，逐项核对版本、目标、资产名、大小、哈希和 updater 签名；
4. 汇总器生成同时包含三个平台键的 `latest.json`；
5. 新 Release 先以 draft 建立，先上传安装/更新资产，最后上传 `latest.json`，再公开 Release；
6. 从未登录下载链路逐项下载八个公开资产并校验 SHA-256，同时再次校验 `latest.json` 的版本、URL 和签名。
7. 全部公开资产验收成功后才结束工作流；验收失败时不提前宣称多平台版本可用。

本地脚本的职责边界：

```bash
npm run release:build -- --version <version> --platform <platform-id> --output-dir <empty-directory>
npm run release:publish -- --version <version> --artifacts-dir <three-platform-artifacts> --dry-run
npm run release:publish -- --version <version> --artifacts-dir <three-platform-artifacts>
```

`release:build` 只能在目标原生系统运行；`release:publish` 不构建应用，只汇总三个 runner 的可信收据。不要手工拼接 manifest，也不要绕过收据直接使用 `gh release upload`。

## 三、静态 updater 契约

`latest.json` 的固定入口为：

```text
https://github.com/GeekMai90/Loby/releases/latest/download/latest.json
```

清单必须一次性包含全部受支持平台；任何一个平台缺失、URL 错误或签名不匹配都会阻塞整次发布。结构如下：

```json
{
  "version": "<version>",
  "notes": "落笔 <version>：版本说明。",
  "pub_date": "<ISO 8601 UTC time>",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<macOS .sig 完整内容>",
      "url": "https://github.com/GeekMai90/Loby/releases/download/v<version>/Loby_<version>_aarch64.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "<Windows .sig 完整内容>",
      "url": "https://github.com/GeekMai90/Loby/releases/download/v<version>/Loby_<version>_x64-setup.exe"
    },
    "linux-x86_64": {
      "signature": "<Linux .sig 完整内容>",
      "url": "https://github.com/GeekMai90/Loby/releases/download/v<version>/Loby_<version>_amd64.AppImage"
    }
  }
}
```

Tauri updater 签名验证资产完整性，但不替代平台发行者签名。当前 macOS 使用 ad-hoc 签名，Windows NSIS 尚未配置 Authenticode，Windows 首次安装可能显示 SmartScreen 提示；这不影响 updater 验签，但正式对外扩大分发前应分别配置 Apple Developer ID/公证与 Windows 代码签名证书。

## 四、三平台真机手测

每个平台至少覆盖：

- 安装、首次启动、退出、重启和卸载；
- 打开已有写作库，创建项目、分组和文稿，连续输入后直接退出并确认正文已落盘；
- 中文 IME、长文滚动、选区、撤销、快捷键、拖拽、右键菜单和亮暗主题；
- 图片粘贴、已有图片预览、默认应用打开、在系统文件管理器中定位；
- 设置、微信公众号排版预览等大尺寸模态窗，以及窗口缩放、最大化和系统任务栏/Dock 边界；
- 自动发现更新、手动检查、下载进度、安装前 flush 和升级后的版本号；
- AI 发送、取消、审批、图片附件和凭证读取；
- Markdown、HTML、纯文本、微信、小红书、墨问、WordPress 与 GitHub 发布路径；
- 重启后确认项目、正文、偏好、对话、主题和动作卡片持久化。

平台特有行为：

- macOS：检查 DMG 挂载、应用签名、Gatekeeper 行为、原生菜单和红绿灯；
- Windows：检查 NSIS 安装、SmartScreen、150% 缩放、任务栏可用工作区、自定义标题栏和卸载；调用 `downloadAndInstall` 后，Tauri 会退出当前进程并由安装器接管，不会进入应用内“等待重启”状态；
- Linux：至少在 Ubuntu 22.04 和一个较新的发行版测试 AppImage 启动、执行权限、系统 WebView 依赖和覆盖更新。

## 五、安全、验收与回滚

- 复查 `security.md` 和 Tauri capabilities；
- 确认提交、Actions artifact 和 Release 中没有私钥、token、私人路径、写作库文件或临时截图；
- 确认 updater 公钥与发布私钥配对，私钥有仓库外备份；
- 使用 `gh release view v<version> --repo GeekMai90/Loby` 核对八个公开资产；
- 从未登录环境访问固定 latest URL，确认三平台条目都指向当前 Release；
- 记录三平台手测系统版本、已知但接受的问题和构建工作流链接；
- 未通过的手测项必须阻塞发布或写入明确的已知问题，不能默认为通过。

静态 updater 不支持向较低 SemVer 自动降级。发布错误时先撤下有问题的 Release/`latest.json` 阻止继续更新，再以更高 patch 版本发布修复；不能仅把旧 Release 重新标记为 latest 来假设已安装用户会自动回退。
