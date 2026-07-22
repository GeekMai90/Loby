# 发布架构

编辑器工具栏的发布入口面向当前文稿；多文稿编译和保存产物仍由导出面板负责。发布 feature 负责内容转换与界面，Rust publishing 模块负责秘密、网络、上传和渠道错误。

## 渠道

### 微信公众号

打开独立主题工作室，用注册主题渲染当前 Markdown，提供移动/桌面预览并复制适合微信编辑器的 inline-style HTML。配置阿里云 OSS 后，可上传本地图片并只在本次预览/复制结果中替换公共 URL，不修改源 Markdown。

### WordPress

通过 REST API 上传本地图片并创建文章，默认状态为 draft。公开发布必须由显式选项确认；站点 URL 和用户名可保存为非秘密设置，application password 只留在 Rust secret store。

### 墨问

Rust 后端从 secret store 读取并校验 API Key，把 Markdown 转为 NoteAtom、上传图片并创建公开或私密笔记。确认、进度、成功与失败共用稳定 Dialog 区域；失败不得显示原始凭证或把“部分上传”报告为成功。

大图只通过自清理临时副本做尺寸/格式优化，源项目图片永不修改。每个准备上传的图片都必须对应一个有效 attachment marker。

## 主题 Registry

`src/features/publishing/model/wechatThemes.ts` 是内置公众号主题的唯一 registry。当前内置 ID 为 `loby-basic`、`classic`、`grace`、`simple`；旧主题只用于兼容迁移，不作为新增设计入口。

renderer 只消费 `WechatThemeManifest`，不得按 theme ID 分支。新布局使用 manifest 的 base style、CSS 与 HTML transforms 表达；新增结构能力先扩展可验证协议，不能增加平行 preset component enum。

个人主题本体保存在当前写作库 `themes/*.lobywechat`；收藏、默认项、revision 与主题对话保存在 `.loby/publishing/wechat-theme-state.json`，两者都随写作库迁移。导入时验证文件格式与 schema，导出时不包含文章内容、凭证或本机路径。

主题工作室契约见 `wechat-theme-studio.md`。

## 图片托管

- 首个图床 provider 是阿里云 OSS，设置包含 Region、Bucket、Access Key ID、可选自定义域名和 object prefix；
- Access Key Secret 只在 Rust；浏览器不直接请求上传接口；
- object key 使用前缀、年月、可读 stem 与内容 hash，重复内容得到稳定位置；
- 只上传受支持的本地 PNG/JPEG/GIF/WebP/SVG，HTTP(S)、data 与已可预览 URL 保持不变；
- 自定义域名只影响生成的公共 URL，上传仍指向 OSS endpoint。

## 秘密与安全

- 发布秘密保存在当前用户平台 app-config 下的 Rust `publishing-secrets.json`，不进入写作库、项目、主题、浏览器存储、日志或截图。
- 设置只返回“已保存”状态，不把 secret 回填到 renderer；空密码字段与已保存标记表示继续使用原值。
- 环境变量可作为渠道级覆盖；非秘密 endpoint 设置与 secret 分离。
- 浏览器开发模式可渲染 Dialog 和预览，但不执行真实直接发布。
- 渠道适配器必须限制目标 URL/路径、处理取消与超时，并向用户返回去敏的可行动错误。
