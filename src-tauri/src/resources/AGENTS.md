# resources/ - 写作资源领域

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<member>
images.rs - 共享图片保存、导入、去重、迁移、未使用扫描与受控清理
exports.rs - 项目导出文件与校验后的 bundle 写入
</member>

资源读写必须先验证路径边界。图片清理需重新校验候选项，并保留 live Markdown、历史版本与回收站 Markdown 的全部引用。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
