/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 ExportReadinessItem
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export interface ExportReadinessItem {
  label: string;
  ok: boolean;
}
