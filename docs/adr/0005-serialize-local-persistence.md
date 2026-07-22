# ADR 0005：Debounce 并串行化本地持久化

日期：2026-07-11

## 状态

已接受

## 背景

Loby 在前端状态中维护完整写作库模型。编辑器按键和 AI stream 每秒可产生多次更新；立即保存每个中间状态会造成 Tauri 调用重叠、无意义磁盘写入，并可能出现旧请求晚于新请求完成的竞态。

本地 Markdown 仍是持久事实来源，因此性能优化不能丢失最新状态，也不能让文件变得不透明。

## 决策

写作库与 AI 对话持久化使用 latest-wins 任务队列：

- 对可替换更新 debounce 500 ms；
- 同一时刻只允许一个 save；
- 保存期间收到的更新折叠为最新 pending state；
- 切换写作库、重建索引或执行自定义关闭前 flush 写作库变更；
- 渲染内容未变化时跳过写入；
- macOS/Linux 对已变化的受管文件使用目标目录内已 sync 临时文件，再 rename 替换。

当前继续使用完整写作库 command 契约。未来引入增量 dirty-project/dirty-sheet command 时，必须另做兼容与集成测试。

## 影响

- 普通输入与 AI stream 不再为每次状态变化启动持久化；
- 单个 Loby 进程不会让自己的写作库保存互相竞态；
- Markdown、项目元数据和对话格式保持不变；
- Rust 保存仍遍历完整项目模型，但不会重写未变化文件；
- Windows 暂时使用直接替换，直到有经过测试的平台原子替换实现；
- rapid-edit collapse、切库顺序/路径捕获和关闭 flush 由 production coordinator 与 adapter 覆盖；
- 外部编辑和大型写作库仍需持续扩展 integration coverage。
