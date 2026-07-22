# public/ - renderer 原样静态资产

> L2 | 父级：[../AGENTS.md](../AGENTS.md)

<directory>
assets/ - 不经 Vite module graph 处理、按固定 URL 访问的静态资产
</directory>

`assets/zen-mountains.png` 是内置禅模式背景。只有需要稳定公开 URL 的文件才放在此处；普通 renderer 资产应由 `src/assets/` 纳入构建图。

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
