# 本地优先文件架构

## 决策

用户选择的写作库目录是内容事实来源。Loby 直接读写可见 Markdown、项目目录和资源文件；数据库、索引、缓存与运行状态不得取代这些文件。

## 目录结构

```text
写作库/
├── inbox/
│   └── 文稿.md
├── notes/
│   └── 分组/
│       └── 笔记.md
├── projects/
│   └── 项目名/
│       ├── project.toml
│       ├── README.md
│       ├── 分组/
│       │   └── 文稿.md
│       ├── assets/
│       ├── references/
│       └── exports/
├── assets/
│   └── images/
├── themes/
│   └── 个人主题.lobywechat
└── .loby/
    ├── library.json
    ├── preferences.json
    ├── activity/
    ├── ai/
    ├── publishing/
    └── trash/
```

`inbox/`、`notes/`、`projects/`、`assets/images/` 与 `themes/` 是用户可见内容。`.loby/` 是应用管理目录，不要求用户手工编辑；其中数据必须有清晰所有权，可重建数据不能反向成为内容事实来源。

## 收件箱、笔记与项目

- 收件箱文稿直接位于 `inbox/`，用于低摩擦接收和后续整理。
- 笔记按可见分组目录保存在 `notes/`；移动分组或笔记时，应用同步更新真实路径。
- 项目位于 `projects/项目名/`。`project.toml` 保存项目身份与状态、分组、纯项目目标、按项目隔离的文稿自定义属性定义、发布清单、导出记录，以及可选的 GitHub 发布目标 ID 和 Starlight 分组映射；文章标签、`description` 和目标字数归每篇 Markdown 文稿，仓库、分支、站点地址和适配器参数归平台 app-config。`README.md` 提供离开应用后的可读说明。
- 项目名、分组名和文稿标题参与路径生成；稳定 ID 用于识别重命名前后的同一实体。

## Markdown 契约

文稿正文是普通 Markdown。Loby 管理的字段写入 YAML frontmatter，读取时从编辑器正文中剥离，保存时再结构化渲染。

应用拥有的文稿字段包括稳定 ID、标题、标签、目标字数、`description`、`createdAt`/`updatedAt`、可选 `archivedAt` 与自定义属性。文稿不拥有“构思/完成”等系统状态；公开通用字段尽量使用行业常见顶层键，Loby 私有字段进入 `loby` 命名空间，不依赖 `lobySheet` 之类冗余标记。系统不写入含义模糊的 `date`，用户自定义“发布日期”保持原样。旧 `status: 已归档` 只在读取时迁为 `archivedAt`，后续保存不再输出文稿 `status`。未知的合法自定义属性必须尽可能保留；格式损坏的 frontmatter 不得被静默丢弃为“空元数据”。

标题优先使用 frontmatter；缺失时可以从第一个 H1 或文件名恢复。正文不得因为元数据解析失败而消失。

## 图片与项目资源

- 写作图片统一进入写作库级 `assets/images/`，避免文稿跨项目移动后引用失效。
- 项目 `assets/`、`references/`、`exports/` 分别承载项目素材、参考资料与导出结果。
- Markdown 和 Obsidian 图片引用都可进入编辑流程；新插入、外部导入改写与 Markdown bundle 导出只生成标准 Markdown。Obsidian embed 是读取兼容输入，不是新的写入目标，普通编辑不得静默改写历史引用。
- 清理未使用图片必须先扫描引用并移动到 `.loby/trash/images/`，不得直接永久删除。

详见 `image-assets-design.md`。

## 偏好与运行数据

- `.loby/preferences.json` 保存可随写作库迁移的非敏感偏好，例如应用/编辑器主题、排版、当前选择与排序。
- `.loby/ai/conversations.json` 保存该写作库的 AI 对话历史和动作卡片。
- `themes/*.lobywechat` 保存个人公众号主题 manifest；`.loby/publishing/wechat-theme-state.json` 保存默认项、收藏、revision 与主题对话。
- `.loby/activity/` 保存写作活动；`.loby/trash/` 保存可恢复的项目、文稿与图片。
- 设备相关探测、窗口表现和其他不适合跨设备迁移的设置可以留在本机存储，但不得覆盖写作库中的内容事实。
- 桌面端最后成功打开的写作库路径可以写入系统配置目录中的版本化 `active-library.json`，供 `loby` CLI 发现当前目标；该定位文件不得包含正文、registry、凭证或界面设置，写入失败不得阻断桌面写作。
- 发布密钥与访问令牌不得进入写作库，必须使用 Rust 秘密存储或显式环境变量覆盖。
- GitHub 仓库、分支、站点地址与适配器路径只保存在应用级目标 registry；项目 `project.toml` 只保存目标 ID 和自身的 Starlight 分组映射。它们都是发布投影配置，不得反向取代本地 Markdown 事实源。

## 保存与外部变化

- 保存操作必须串行化，并以 debounce 合并高频编辑；后到的旧状态不得覆盖先前已确认的新状态。
- 每篇文稿独立维护单调 revision、已保存 revision 与最大 dirty age；普通正文输入只向原生层发送目标文稿和最小路径上下文，不序列化或扫描整棵写作库。
- CodeMirror 逐键变化只捕获持久 `Text` 引用和单文稿 revision，不逐键生成完整 JavaScript 字符串；正文只在 idle/max-delay 模型提交或真实写盘边界物化一次。React 写作库模型更新在短边界内合并；完整结构保存必须叠加尚未提交到 React 的最新正文，不能用目录快照反向覆盖编辑器权威内容。
- 连续输入不能无限延后耐久化；idle debounce 与最大 dirty age 任一先到即保存。切换写作库、关闭窗口、重建索引和显式持久化边界统一 flush 文稿、索引与结构队列。
- `.loby/library.json` 的 metadata-only 更新可以低频合并，但必须剥离当前正文；创建、删除、移动、项目/分组结构变化仍走完整结构保存。
- 文件写入使用受控路径与“内容未变化则不写”的策略，降低监听回环和无意义时间戳变化。
- 原子写入前按精确目标路径登记短期内部写入回执，watcher 忽略该目标和内部临时文件，不使用普通正文保存的全局时间窗吞掉无关外部变化。若本地存在未保存编辑，必须先解决冲突，不能静默覆盖编辑器内容。
- 改名、移动、归档、恢复和废纸篓操作必须以稳定 ID 确认目标，不能只依赖显示名称。
- 标题、分组或项目变化时，保存流程只按该文稿稳定 ID 精确移动原文件；不能扫描并硬删除所有未出现在当前内存模型中的 Markdown。
- 用户主动删除或“清理空白文稿”统一移动到 `.loby/trash/` 并保留恢复 manifest，只有显式清空废纸篓才允许永久删除。

## 重建与兼容

应用应能从 `inbox/`、`notes/`、`projects/`、`themes/`、Markdown frontmatter 与 `project.toml` 重建主要内容模型。`.loby/library.json` 是加速与兼容索引，不是唯一副本。文稿 ID 的当前格式为 `sheet-` 加 26 位小写 Crockford Base32；新建、导入和 AI 创建必须直接生成该格式。普通加载与文件监听只读取，不静默迁移；用户主动执行“重建索引”时才补齐缺失 ID、修复旧格式或重复 ID，并同步 `.loby` 内已知引用。

Loby 与 Obsidian、Git、iCloud Drive、Dropbox 等外部工具共享目录时，应遵守：

- 不写入绝对路径作为可移植内容的一部分；
- 不假设文件始终由 Loby 独占；
- 不删除无法识别的用户文件；
- 冲突和缺失必须可见，优先保留用户数据。

## 架构红线

- 移除或改名写作库注册项不得移动、重命名或删除其本地目录。
- 不把正文、项目或资源只保存在浏览器存储或私有数据库。
- 不允许 AI、发布器或清理任务直接手写 `.loby/` 内部文件；必须经过对应 Rust/领域 API。
- CLI 只能新增可见 Markdown，并通过桌面活动库定位或用户显式参数确定目标；不得读取 WebKit 私有数据库或把定位文件升级为第二套写作库 registry。
- 不在未确认目标的情况下执行递归删除或覆盖。
