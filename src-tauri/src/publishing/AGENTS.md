# publishing/ - 原生发布领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
mod.rs - 发布 command 与共享进度契约
blog.rs - 当前文稿到 Hugo page bundle 的转换、图片收束与项目 GitHub 发布编排
github.rs - GitHub 远端文章归属校验与 Git object 原子提交
github_auth.rs - GitHub App Device Flow、令牌轮换、连接状态、安装权限与多仓库查询
mowen.rs - 墨问 MCP payload、图片上传与发布流程
wordpress.rs - WordPress payload 与发布适配
wechat_image_host.rs - 微信图片托管设置与上传
wechat_theme_store.rs - 公众号主题文件、会话与 library-scoped 状态
wechat_theme_studio.rs - 使用系统标题栏和窗口控制的主题工作室独立窗口命令
secret_store.rs - app-config 目录中的跨平台发布秘密存储，统一承载 GitHub 与内容平台凭证
</member>

秘密不得进入写作库、浏览器存储、日志或前端响应。provider 输入在本模块边界校验，前端只消费稳定 command 与进度 event。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
