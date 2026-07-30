# ADR 0019：项目绑定的 GitHub 发布适配器

## 状态

Accepted — 2026-07-30

## 背景

落笔已经能把 Markdown 发布到 Hugo 博客，也能把项目投影为 Astro Starlight 文档站。两条链路都依赖相同的 GitHub 身份、仓库权限、图片安全读取、Git Database API 原子提交和按目标隔离的发布记录，差异只在目标格式、受管目录及单篇或批量能力。旧设计却允许 Hugo 目标跨全部项目出现，同时把 Starlight 的仓库参数直接保存在项目中，导致同一种 GitHub 发布能力拥有两套作用域和配置模型。

## 决策

- 设置中的 GitHub registry 保存用户创建的目标实例；产品只内置 `Hugo 博客` 与 `Starlight 文档站` 两种通用适配器，不内置任何私人站点。
- 目标实例拥有稳定 ID、适配器 kind、启用状态、显示名称、仓库、分支、内容根目录、站点地址和适配器专属参数；GitHub token 仍只归 native secret store。
- 普通项目通过 `project.toml` 的 `[publishing] targetId` 一对一引用一个目标，不复制目标参数。一个目标同时只能绑定一个项目；收件箱和笔记不参与绑定。
- 当前项目只显示自身绑定且配置完整的 GitHub 发布入口。Hugo 提供单篇博客发布；Starlight 提供单篇与整项目同步，并在项目绑定中额外保存 `[[publishingGroups]]` 分组目录投影。
- `github.rs` 继续作为不理解内容格式的共享传输边界；Hugo 和 Starlight 编排器只负责各自的 Markdown、图片路径、所有权与 URL 规则。新增 GitHub 站点类型必须扩展适配器，不得复制身份、权限、提交或项目绑定链路。
- 旧 `[blogPublishing]` 和 `[helpCenter]` 配置在加载时迁为普通目标实例与项目引用；旧 `[[helpCenterGroups]]` 和 `loby.publications.help-center` 迁为新分组表和按 target ID 隔离的发布记录。迁移必须幂等。

## 结果

“麦先生说博客”和“落笔帮助中心”成为用户自己的普通目标实例，其他用户可以用同一套 Hugo 或 Starlight 适配器连接自己的仓库与 Cloudflare 部署。目标参数只有一个事实来源，项目归属明确，后续增加 VitePress、Docusaurus 或其他 GitHub 驱动站点时只需增加内容适配器。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
