interface ExportPreviewSectionProps {
  title: string;
  body: string;
}

export function ExportPreviewSection({ title, body }: ExportPreviewSectionProps) {
  return (
    <section className="panel-section export-preview">
      <h2>{title}</h2>
      <pre>{body}</pre>
    </section>
  );
}
