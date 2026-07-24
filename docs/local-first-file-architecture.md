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
- 项目位于 `projects/项目名/`。`project.toml` 保存项目字段、分组、目标、发布清单和导出记录，`README.md` 提供离开应用后的可读说明。
- 项目名、分组名和文稿标题参与路径生成；稳定 ID 用于识别重命名前后的同一实体。

## Markdown 契约

文稿正文是普通 Markdown。Loby 管理的字段写入 YAML frontmatter，读取时从编辑器正文中剥离，保存时再结构化渲染。

应用拥有的字段包括稳定 ID、标题、状态、目标字数、摘要、创建/更新时间、归档/完成时间与自定义属性。未知的合法自定义属性必须尽可能保留；格式损坏的 frontmatter 不得被静默丢弃为“空元数据”。

标题优先使用 frontmatter；缺失时可以从第一个 H1 或文件名恢复。正文不得因为元数据解析失败而消失。

## 图片与项目资源

- 写作图片统一进入写作库级 `assets/images/`，避免文稿跨项目移动后引用失效。
- 项目 `assets/`、`references/`、`exports/` 分别承载项目素材、参考资料与导出结果。
- Markdown 和 Obsidian 图片引用都可进入编辑流程；导出时根据目标格式重写为可移植引用。
- 清理未使用图片必须先扫描引用并移动到 `.loby/trash/images/`，不得直接永久删除。

详见 `image-assets-design.md`。

## 偏好与运行数据

- `.loby/preferences.json` 保存可随写作库迁移的非敏感偏好，例如应用/编辑器主题、排版、当前选择与排序。
- `.loby/ai/conversations.json` 保存该写作库的 AI 对话历史和动作卡片。
- `themes/*.lobywechat` 保存个人公众号主题 manifest；`.loby/publishing/wechat-theme-state.json` 保存默认项、收藏、revision 与主题对话。
- `.loby/activity/` 保存写作活动；`.loby/trash/` 保存可恢复的项目、文稿与图片。
- 设备相关探测、窗口表现和其他不适合跨设备迁移的设置可以留在本机存储，但不得覆盖写作库中的内容事实。
- 发布密钥与访问令牌不得进入写作库，必须使用 Rust 秘密存储或显式环境变量覆盖。

## 保存与外部变化

- 保存操作必须串行化，并以 debounce 合并高频编辑；后到的旧状态不得覆盖先前已确认的新状态。
- 文件写入使用受控路径与“内容未变化则不写”的策略，降低监听回环和无意义时间戳变化。
- 文件监听只触发受控刷新；若本地存在未保存编辑，必须先解决冲突，不能静默覆盖编辑器内容。
- 改名、移动、归档、恢复和废纸篓操作必须以稳定 ID 确认目标，不能只依赖显示名称。

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
- 不在未确认目标的情况下执行递归删除或覆盖。
