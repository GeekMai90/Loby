# publishing/ - 原生发布领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
mod.rs - 发布 command、发布凭证保存/查询/删除入口与共享进度契约
blog.rs - 当前文稿到 Hugo page bundle 的转换、可选 description、图片收束与应用级目标 GitHub 发布编排
github.rs - GitHub 目标仓库写权限、远端文章归属校验与 Git object 原子提交
github_auth.rs - GitHub App Device Flow、令牌轮换、连接状态及带短期缓存和并发去重的安装仓库查询
target_store.rs - app-config 中的非敏感发布目标 registry、项目级旧博客配置一次性迁移与目标参数校验
mowen.rs - 墨问 MCP payload、图片上传与发布流程
wordpress.rs - WordPress payload 与发布适配
wechat_image_host.rs - 微信图片托管设置与上传
wechat_theme_store.rs - 公众号主题文件、会话与 library-scoped 状态
wechat_theme_studio.rs - 使用系统标题栏和窗口控制的主题工作室独立窗口命令
secret_store.rs - app-config 目录中的跨平台发布秘密存储，统一承载 GitHub 与内容平台凭证
</member>

秘密不得进入写作库、浏览器存储、日志或前端响应。provider 输入在本模块边界校验，前端只消费稳定 command 与进度 event。设置查询可以使用短期仓库快照，真实发布必须在打包内容前针对目标仓库重新验证写权限。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
