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
