# 发布检查清单

## 发布模型

Loby 的正式桌面版由同一个源码 tag 生成三个 updater 平台：

| updater 平台键   | 构建宿主     | 安装资产                        | 更新资产                                     |
| ---------------- | ------------ | ------------------------------- | -------------------------------------------- |
| `darwin-aarch64` | macOS        | `Loby_<version>_aarch64.dmg`    | `Loby_<version>_aarch64.app.tar.gz` + `.sig` |
| `windows-x86_64` | Windows      | `Loby_<version>_x64-setup.exe`  | 同一个 NSIS `.exe` + `.sig`                  |
| `linux-x86_64`   | Ubuntu 22.04 | `Loby_<version>_amd64.AppImage` | 同一个 AppImage + `.sig`                     |

Linux 首个正式格式固定为 AppImage。Tauri 静态 updater 的 `linux-x86_64` 只有一个平台键，不能同时为 DEB 安装和 AppImage 安装分发两种不同更新包；增加 DEB 前必须先设计独立更新策略并记录 ADR。

源码、三平台正式安装包、公开 `.sig` 和完整 `latest.json` 统一位于公开仓库 `GeekMai90/Loby`；macOS/Windows 的安装与更新资产随后镜像到公开 Gitee 仓库 `geekmai/Loby-Releases`。版本 PR 合并后，在 `main` 的同一提交创建并推送 `v<version>` tag；GitHub 与 Gitee Release 使用相同版本 tag 和 `落笔 <version>` 标题。

## 一、准备版本

```bash
npm run release -- patch # 或 minor / major
npm run release -- --check
npm run check
npm run audit:npm
```

版本准备只同步应用元数据，不提交、不打 tag、不发布。同步版本后补充 `CHANGELOG.md`，提交版本 PR，完成审查并合并到 `main`。先在该提交运行 dry-run，成功后再创建同版本 tag，并用 dry-run Run ID 提升已经验证的同一批资产；正式工作流不重复构建。

仓库 Actions secrets 必须预先配置：

- `TAURI_SIGNING_PRIVATE_KEY`：Tauri updater 私钥内容；
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码；无密码私钥不创建此 secret，工作流会传入空值。
- `GITEE_RELEASE_TOKEN`：仅供正式发布 job 写入公开 Gitee 镜像仓库；不得写入源码、日志或构建 artifact。

正式发布 job 使用 GitHub Actions 自动提供的短期 `GITHUB_TOKEN`，并仅在该 job 授予 `contents: write`；读取同仓库 dry-run artifact 使用 job 级 `actions: read`，Gitee 镜像只使用 `GITEE_RELEASE_TOKEN`，不配置、不保存跨仓库 PAT。来自 fork 的 Pull Request CI 不读取任何发布 secret。

私钥不得进入源码、写作库、日志、Actions artifact 或公开 Release。`.sig` 是公开验签使用的资产，不是秘密。

## 二、运行三平台流水线

在 GitHub Actions 手动运行 `Desktop release`。先以 `dry_run=true` 从当前 `main` 验证完整构建矩阵；预演不依赖旧版本 tag，因此会实际验证刚合并的发布链路：

```bash
gh workflow run desktop-release.yml --repo GeekMai90/Loby -f version=<version> -f dry_run=true
```

记录成功预演的 Actions Run ID。预演成功且三平台真机手测通过后，确认 `v<version>` tag 指向预演记录的同一个 `main` 提交，再以相同版本和 Run ID 正式提升已经验证的资产：

```bash
gh workflow run desktop-release.yml --repo GeekMai90/Loby -f version=<version> -f dry_run=false -f source_run_id=<dry-run-id>
```

正式模式必须提供数字格式的 `source_run_id`，且来源必须是当前仓库中已经成功完成、artifact 未过期的 `Desktop release` 手动运行。三平台 artifact 保留 7 天；超过保留期或 tag 与来源提交不一致时必须重新 dry-run，禁止降级为重新构建后直接发布。

工作流按以下顺序执行：

1. dry-run 固定检出触发时的 `main` 提交；快速版本预检完成后，完整质量门禁与 macOS、Windows、Ubuntu 三平台原生构建并行执行；
2. 每个平台只输出标准化资产和 schema v2 收据；收据同时记录版本、源码提交、Actions Run ID、目标、资产名、大小与 SHA-256；
3. dry-run 汇总器要求质量门禁和三平台构建全部成功，再逐项核对源码提交、资产契约和 updater 签名；
4. 正式模式检出同版本 tag，验证来源 Run 已成功、工作流身份正确、artifact 完整，且来源 `head_sha` 与 tag 提交严格一致；
5. 正式模式直接下载来源 Run 的三平台资产，不再执行质量门禁、原生构建或 updater 签名；
6. 汇总器重新验证三份源码绑定收据，生成同时包含三个平台键的 `latest.json`；
7. 新 Release 先以 draft 建立，先上传安装/更新资产，最后上传 `latest.json`，再公开 Release；
8. 从未登录下载链路逐项下载 GitHub 八个公开资产并校验 SHA-256，同时再次校验完整 `latest.json` 的版本、URL 和签名；
9. 正式发布在 GitHub 验收成功后，使用 `GITEE_RELEASE_TOKEN` 以 `--mirror-gitee` 同步 macOS/Windows 的五个安装/更新资产和 `latest.json`，更新两个平台 raw 清单，再从未登录下载链路校验 Gitee 资产哈希、清单版本、URL 和签名；Gitee 验收失败时工作流失败，必须修复或重试后才能视为发布完成。

本地脚本的职责边界：

```bash
npm run release:build -- --version <version> --platform <platform-id> --output-dir <empty-directory>
npm run release:publish -- --version <version> --artifacts-dir <three-platform-artifacts> --dry-run
npm run release:publish -- --version <version> --artifacts-dir <three-platform-artifacts>
npm run release:publish -- --version <version> --artifacts-dir <three-platform-artifacts> --mirror-gitee
```

`release:build` 只能在目标原生系统运行，并把当前 Git 提交与 Actions Run ID 写入收据；`release:publish` 不构建应用，只接受与当前 checkout 提交和显式 `--source-run-id` 一致的三个 runner 可信收据。脱离 Actions 的本地构建允许 Run ID 为空，但不能作为工作流正式提升的来源。`--mirror-gitee` 只在正式发布且已提供 `GITEE_RELEASE_TOKEN` 时使用；不要手工拼接 manifest，也不要绕过收据直接使用 `gh release upload`。

## 三、静态 updater 契约

`latest.json` 的固定入口为：

```text
https://github.com/GeekMai90/Loby/releases/latest/download/latest.json
```

macOS/Windows 国内备用入口由 Tauri 按当前平台替换 `{{target}}` 与 `{{arch}}`：

```text
https://gitee.com/geekmai/Loby-Releases/raw/master/updates/{{target}}-{{arch}}/latest.json
```

Gitee 只维护 `darwin-aarch64` 与 `windows-x86_64` 两个 raw 清单，清单中的更新包 URL 指向同版本 Gitee Release 附件；Linux 对应路径不创建，首个 Gitee 请求返回 404 后继续使用 GitHub 完整清单。GitHub 仍是三平台版本、签名和资产的事实来源，Gitee 不重新构建安装包。

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
- 使用 `gh release view v<version> --repo GeekMai90/Loby` 核对 GitHub 八个公开资产，并核对 Gitee `geekmai/Loby-Releases` 的五个 macOS/Windows 资产与 `latest.json`；
- 从未登录环境访问 GitHub 完整 latest URL，以及 Gitee 两个平台 raw URL，确认版本、签名和下载 URL 都指向当前 Release；
- 记录三平台手测系统版本、已知但接受的问题和构建工作流链接；
- 未通过的手测项必须阻塞发布或写入明确的已知问题，不能默认为通过。

静态 updater 不支持向较低 SemVer 自动降级。发布错误时先撤下有问题的 Release/`latest.json` 阻止继续更新，再以更高 patch 版本发布修复；不能仅把旧 Release 重新标记为 latest 来假设已安装用户会自动回退。
