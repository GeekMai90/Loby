/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 ExportPreviewSection
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
interface ExportPreviewSectionProps {
  title: string;
  body: string;
}

export function ExportPreviewSection({ title, body }: ExportPreviewSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      <pre className="m-0 max-h-55 overflow-auto rounded-lg bg-muted/40 p-2.5 font-mono text-xs leading-[1.55] whitespace-pre-wrap text-foreground">
        {body}
      </pre>
    </section>
  );
}
