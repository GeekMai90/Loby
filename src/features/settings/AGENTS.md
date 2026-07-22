# settings/ - 应用设置能力

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
components/ - 设置对话框、侧栏、表单基础与 AI/外观/存储/发布/写作面板
constants/ - 设置 tab 标识与稳定元数据
</directory>

设置界面只编辑各领域公开配置，不复制领域校验和持久化实现。持久化单选设置统一使用共享 Select；Tabs 只切换当前内容视图，Toggle Group 只保留给高频即时操作，不再维护设置专用分段选择器。设置 Dialog 的主体、侧栏、区块与分区边界统一消费 `index.css` 中的专属语义 Token：主体跟随应用 `background`，侧栏复用 Tabs 容器的 `muted` 灰色；设置区块在亮色模式融入 `background`，在暗色模式使用 `muted` 建立层级。敏感值必须交给 native secret store，不能在表单组件中建立第二套存储。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
