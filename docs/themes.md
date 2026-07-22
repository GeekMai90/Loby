# 主题系统

Loby 有两个相互独立的主题层：

- **应用外观**控制导航、列表、Dialog、菜单、设置与 AI 表面，支持 `system`、`light`、`dark`；
- **编辑器主题**控制 CodeMirror 与 Markdown 预览的排版 palette，其 ID 独立选择，但明暗值跟随解析后的应用外观。

两项偏好都会标准化无效或旧值。活动写作库打开后，可迁移偏好保存在 `.loby/preferences.json`；本机 `loby.agentSettings.v1` 作为启动/兼容设置来源，不能反向成为文稿事实来源。

## 当前编辑器主题

- `loby`：落笔原生，中性系统蓝；
- `graphite`：石墨红，灵感来自 Ursine；
- `vue`：青岚，改造自 typora-vue-theme；
- `lapis`：青金石，改造自 typora-theme-lapis。

主题选项、来源链接和预览色块以 `src/shared/constants/themes.ts` 为准，本文不复制易漂移的色值表。第三方灵感与许可证同步记录在 `THIRD_PARTY_NOTICES.md`。

## 所有权

- `src/shared/constants/themes.ts`：稳定 ID、名称、说明、来源与 swatches；
- `src/shared/lib/themes.ts`：持久化值标准化和 system mode 解析；
- `src/shared/hooks/useAppTheme.ts`：系统外观监听和根节点 theme 应用；
- `src/styles/index.css`：应用全局明暗 Token；
- `src/styles/themes.css`：编辑器 light/dark palette；
- editor model：消费编辑器 Token 的 CodeMirror 规则；
- settings feature：主题设置界面。

## 新增主题

1. 增加稳定 `EditorThemeId` 与 option 元数据。
2. 在 `themes.css` 同时定义 light/dark 映射，复用现有编辑器语义 Token。
3. 不在 CodeMirror extension 或组件中按主题 ID 分支写颜色。
4. 记录灵感来源与许可证。
5. 验证应用亮暗模式下的编辑、预览、选区、代码块、引用和链接，再运行 `npm run check`。
