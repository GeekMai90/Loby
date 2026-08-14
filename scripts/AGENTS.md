# scripts/ - 仓库自动化与本地门禁

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
build-tauri.mjs - 校验固定 toolchain 后通过当前 Node 直接执行 Tauri CLI，规避 Windows `.cmd` 子进程差异，并处理 macOS DMG 卷图标
check-architecture.mjs - 验证 renderer 依赖方向、GEB 契约、历史路径、旧 Token、禁用 surface 背景命名与普通 UI 全 Tailwind palette/裸色边界
check-bundle-size.mjs - 检查生产 renderer 首屏初始 JavaScript 总量与最大动态 chunk 双预算
release-version.mjs - 按 patch/minor/major 或中文版本语义同步应用版本元数据；只准备发布版本，不提交、打 tag 或上传 Release
release-version.test.mjs - 验证中文版本语义映射、SemVer 增量和版本来源一致性
release-config.mjs - 维护 macOS/Windows/Linux 原生构建矩阵、公开资产名、GitHub/Gitee 下载 URL 与 updater manifest 单一契约
release-config.test.mjs - 验证三平台资产命名、完整 GitHub manifest、Gitee macOS/Windows manifest 与 updater URL 契约
desktop-security-config.test.mjs - 验证 Tauri 主窗口 CSP 为公众号预览保留远程图片来源、且 updater 先走 Gitee 再回退 GitHub
build-release-platform.mjs - 在目标原生 runner 通过当前 Node 直接调用 Tauri 构建入口，校验 bundle 并生成绑定源码提交、Actions Run ID 与 SHA-256 的公开资产收据，避免 Windows `.cmd` 子进程兼容差异
publish-release.mjs - 汇总与当前 checkout 提交及指定来源 Run 一致的三平台收据，生成完整 latest.json，执行 GitHub Release 的幂等上传与逐资产匿名验收，并按显式参数推进 Gitee 镜像
publish-gitee-mirror.mjs - 使用 GITEE_RELEASE_TOKEN 幂等同步 macOS/Windows Release 附件、平台 raw 清单并执行公开 URL 哈希验收
release-pipeline.test.mjs - 验证矩阵参数、源码提交/来源 Run 绑定、收据完整性与资产篡改阻断
setup-git-hooks.mjs - 将仓库跟踪的 hooks 配置为当前 Git worktree 的 hooksPath
</member>

脚本只编排环境检查、构建和质量门禁，不承载产品业务规则。新增脚本必须由 `package.json` 或明确的工程流程消费，不保留无调用者的备用命令。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
