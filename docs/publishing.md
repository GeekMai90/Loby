# 发布架构

编辑器工具栏的发布入口面向当前文稿；多文稿编译和保存产物仍由导出面板负责。发布 feature 负责内容转换与界面，Rust publishing 模块负责秘密、网络、上传和渠道错误。

## 渠道

### 微信公众号

打开独立主题工作室，用注册主题渲染当前 Markdown，提供移动/桌面预览并复制适合微信编辑器的 inline-style HTML。配置阿里云 OSS 后，可上传本地图片并只在本次预览/复制结果中替换公共 URL，不修改源 Markdown。

### WordPress

通过 REST API 上传本地图片并创建文章，默认状态为 draft。WordPress `excerpt` 只使用文稿显式摘要，摘要为空时发送空值，不以项目描述补位。公开发布必须由显式选项确认；站点 URL 和用户名可保存为非秘密设置，application password 只留在 Rust secret store。

### 墨问

Rust 后端从 secret store 读取并校验 API Key，把 Markdown 转为 NoteAtom、上传图片并创建公开或私密笔记。确认、进度、成功与失败共用稳定 Dialog 区域；失败不得显示原始凭证或把“部分上传”报告为成功。

大图只通过自清理临时副本做尺寸/格式优化，源项目图片永不修改。每个准备上传的图片都必须对应一个有效 attachment marker。

### 项目 GitHub 发布

GitHub 身份属于跨项目连接，在设置中心的“发布”中通过 GitHub App Device Flow 完成一次浏览器授权；用户不创建、不复制也看不到访问令牌。GitHub App 只申请 `Contents: write` 与隐含的 `Metadata: read`，安装时可选择 All repositories，让未来新增仓库自动进入落笔的可选范围。发布目标名称、具体仓库、分支、文章目录和站点地址属于项目配置，持久化在 `project.toml`；名称直接作为当前文稿分享菜单里的发布入口。只有配置完整的项目才显示该入口。

GitHub Device Flow 只把一次性用户码与本地流程 ID 展示给 renderer，GitHub `device_code`、access token 与 refresh token 始终停留在 Rust；后两者保存在 app-config secret store。用户 access token 失效时原生层使用 refresh token 自动轮换；项目设置通过 GitHub App installation API 查询当前账号获准且可写的所有仓库，并在 Rust 进程内共享 60 秒快照、合并同时发生的刷新，不允许 renderer 自建第二套 OAuth、缓存或 token 存储。

项目 GitHub 发布由 Rust 把当前文稿转换为 `content/posts/<slug>/` Hugo page bundle：新文稿默认直接使用 26 位 Base32 文稿 ID 主体作为公开地址 ID，正文写入 `index.md`，本地引用图片按内容 hash 命名并与文章同目录提交，`.publish.json` 记录稳定文稿 source identity 与来源 hash。Hugo `description` 只在当前文稿显式填写摘要时生成，摘要为空就省略，不得用项目描述或模板文案代替。首次成功后把 source identity、slug、公开 URL、commit SHA 与发布时间写入文稿 `loby.blog` 元数据；后续更新固定使用同一 slug。重建索引迁移旧文稿 ID 时必须保留已发布文章原来的 source identity，禁止因此改变永久链接或失去远端更新权限。

GitHub 适配器通过 Git Database API 基于当前 branch HEAD 创建 blob、tree 和 commit，并以非 force 方式更新 ref。远端文章目录只有在 `.publish.json.sourceId` 与当前文稿一致时才允许覆盖；分支并发变化、缺少管理标识或 slug 被占用时必须停止。GitHub 提交成功与 Cloudflare 部署完成是两个状态，当前版本只确认提交并提示 Cloudflare 正在部署，不把未确认的部署报告为已上线。

项目 GitHub 发布与墨问共享打字机、进度条和成功态视觉；GitHub 确认态不等待网络，用户点击主操作后先由 native 定向验证当前目标仓库，再进入 preparing、packaging、committing、finished 等阶段。授权问题应引导用户前往设置，网络或临时错误应保留原地重试；设置仓库快照不能替代发布时的权威检查。成功回写 `loby.blog` 元数据时必须保持当前 Dialog 的 success 状态，直到用户点击“完成”，不得因父级 sheet 更新重新显示发布确认表单。

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

- 发布秘密保存在当前用户平台 app-config 下的 Rust `publishing-secrets.json`；GitHub Device Flow 的 access token 与 refresh token 使用独立账户槽并成组轮换，秘密不进入写作库、项目、主题、浏览器存储、日志或截图。
- 设置只返回“已保存”状态，不把 secret 回填到 renderer；空密码字段与已保存标记表示继续使用原值。
- 环境变量可作为渠道级覆盖；非秘密 endpoint 设置与 secret 分离。
- 浏览器开发模式可渲染 Dialog 和预览，但不执行真实直接发布。
- 渠道适配器必须限制目标 URL/路径、处理取消与超时，并向用户返回去敏的可行动错误。
