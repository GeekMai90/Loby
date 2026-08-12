# ADR 0021：开源源码并将桌面发布收敛到同一仓库

## 背景

Loby 过去将私有源码放在 `GeekMai90/Loby`，把安装包和 updater metadata 放在公开 `GeekMai90/Loby-Releases`。这种分仓方式避免了公开源码，却带来跨仓库 PAT、重复 README、两处 Release 状态和私有仓库 hosted runner 成本。项目现已具备 ISC License、贡献指南、稳定本地门禁与三平台发布矩阵，完整 Git 历史和依赖许可证审计未发现阻止公开的问题。

已有 `0.3.x` 客户端仍固定读取旧仓库的 `releases/latest/download/latest.json`，因此迁移不能直接删除旧入口。

## 决策

将 `GeekMai90/Loby` 设为公开源码与唯一正式 Release 仓库。README 在同一仓库提供下载、开发、贡献、安全和许可证入口；源代码继续使用 ISC License，Loby / 落笔名称与图标的品牌权利由独立商标政策说明。

公开 Pull Request 和 `main` push 使用 GitHub-hosted Ubuntu runner 执行只读 CI。所有第三方 Actions 固定到完整 commit SHA，工作流默认 `contents: read`，fork PR 不获得仓库 secret。桌面发布仍只允许维护者手动触发；仅 publish job 获得 `contents: write`，通过 GitHub 自动生成的短期 `GITHUB_TOKEN` 向同仓库 Release 写入资产，不再维护跨仓库 PAT。

Tauri updater 固定读取：

```text
https://github.com/GeekMai90/Loby/releases/latest/download/latest.json
```

三平台原生构建、收据、SHA-256、`.sig` 和匿名验收契约保持不变。首次迁移版本 `0.4.0` 发布成功后，在旧 `GeekMai90/Loby-Releases` 创建一次仅含 `latest.json` 的迁移 Release；该 manifest 的全部下载 URL 指向新仓库 `v0.4.0` 资产。旧仓库不再上传安装包，也不参与后续发布。确认旧客户端能够升级到 `0.4.0` 后，删除源码仓库中不再使用的跨仓库 token secret。

## 结果

代码、Issue、CI、版本 tag、安装包和在线更新回到同一事实来源，发布权限缩短为单次 workflow 的仓库内 token，公开项目可使用标准 GitHub-hosted runner。旧仓库仅承担一次向前迁移兼容，不成为永久双写目标。

公开源码意味着 Actions 配置、历史提交和工程文档都可被审阅；敏感报告必须进入 Private Vulnerability Reporting，发布私钥继续只保存在 Actions secrets。静态 updater 仍不提供灰度、账号分流或自动降级，平台代码签名与 Tauri updater 签名仍是两套独立边界。
