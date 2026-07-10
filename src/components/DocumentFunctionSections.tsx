import { formatSnapshotTime } from "../lib/formatters";
import { positionFromLine, type buildDocumentImageItems } from "../lib/documentFunctionRail";
import type { SheetHeading } from "../lib/markdownOutline";
import type { SheetVersion } from "../types";

type DocumentImageItem = ReturnType<typeof buildDocumentImageItems>[number];

interface DocumentOutlineSectionProps {
  body: string;
  headings: SheetHeading[];
  onRevealPosition: (position: number) => void;
}

interface DocumentMediaSectionProps {
  images: DocumentImageItem[];
  onRevealPosition: (position: number) => void;
}

interface DocumentHistorySectionProps {
  versions: SheetVersion[];
  onRestoreVersion: (version: SheetVersion) => void;
}

export function DocumentOutlineSection({ body, headings, onRevealPosition }: DocumentOutlineSectionProps) {
  return (
    <section className="document-function-section">
      <h2>目录</h2>
      <div className="document-outline-list">
        {headings.map((heading) => (
          <button
            key={heading.id}
            type="button"
            className={`heading-level-${heading.level}`}
            onClick={() => onRevealPosition(positionFromLine(body, heading.line))}
          >
            <span>{heading.text}</span>
            <small>L{heading.line}</small>
          </button>
        ))}
        {headings.length === 0 && <p className="document-function-empty">当前文稿还没有 Markdown 标题。</p>}
      </div>
    </section>
  );
}

export function DocumentMediaSection({ images, onRevealPosition }: DocumentMediaSectionProps) {
  return (
    <section className="document-function-section">
      <h2>媒体</h2>
      <div className="document-media-grid">
        {images.map((image) => (
          <button key={`${image.index}-${image.path}`} type="button" onClick={() => onRevealPosition(image.index)}>
            {image.src ? <img src={image.src} alt={image.alt || image.label} /> : <span>{image.label}</span>}
          </button>
        ))}
        {images.length === 0 && <p className="document-function-empty">当前文稿还没有插入图片。</p>}
      </div>
    </section>
  );
}

export function DocumentHistorySection({ versions, onRestoreVersion }: DocumentHistorySectionProps) {
  return (
    <section className="document-function-section">
      <h2>历史版本</h2>
      <div className="document-version-list">
        {versions.map((version) => (
          <article key={version.id} className="document-version-row">
            <div>
              <strong>{version.title}</strong>
              <small>
                {formatSnapshotTime(version.createdAt)} · {version.wordCount} 字
              </small>
              {version.reason && <small>{version.reason}</small>}
            </div>
            <button type="button" onClick={() => onRestoreVersion(version)}>
              恢复
            </button>
          </article>
        ))}
        {versions.length === 0 && <p className="document-function-empty">还没有历史版本。</p>}
      </div>
    </section>
  );
}
