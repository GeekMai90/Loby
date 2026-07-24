/**
 * [INPUT]: 依赖 CodeMirror EditorView 与 themes/index.css 提供的 editor/menu 语义 Token
 * [OUTPUT]: 对外提供 editorTheme
 * [POS]: 编辑器 feature 的领域模型边界，集中 编辑器 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--editor-text)",
    backgroundColor: "var(--editor-bg)",
    fontSize: "var(--editor-body-font-size, 18px)",
  },
  ".cm-scroller": {
    height: "100%",
    fontFamily: "var(--editor-font-family, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif)",
    lineHeight: "var(--editor-line-height, 1.76)",
    padding: "80px 0 0",
  },
  ".cm-content": {
    maxWidth: "var(--editor-content-max-width)",
    minHeight: "100%",
    margin: "0 auto",
    padding: "0 var(--editor-content-gutter) 128px",
    caretColor: "var(--editor-accent)",
  },
  ".cm-content ::selection": {
    backgroundColor: "var(--editor-selection)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "var(--editor-selection-soft) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--editor-selection) !important",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--editor-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-dropCursor": {
    borderLeftColor: "var(--editor-accent)",
  },
  ".cm-line": {
    position: "relative",
    padding: "0 2px var(--editor-paragraph-spacing, 0px)",
  },
  ".cm-table-line": {
    fontSize: "var(--editor-table-font-size, 15px)",
  },
  ".cm-heading-level-1": {
    padding: "8px 2px 8px",
    color: "var(--editor-heading)",
    fontFamily: "var(--editor-heading-font-family, var(--editor-font-family))",
    lineHeight: "1.34",
  },
  ".cm-heading-level-2": {
    padding: "16px 2px 6px",
    color: "var(--editor-heading)",
    fontFamily: "var(--editor-heading-font-family, var(--editor-font-family))",
    lineHeight: "1.38",
  },
  ".cm-heading-level-3": {
    padding: "12px 2px 5px",
    color: "var(--editor-heading)",
    fontFamily: "var(--editor-heading-font-family, var(--editor-font-family))",
    lineHeight: "1.42",
  },
  ".cm-heading-level-4": {
    padding: "10px 2px 4px",
    color: "var(--editor-heading)",
    fontFamily: "var(--editor-heading-font-family, var(--editor-font-family))",
    lineHeight: "1.45",
  },
  ".cm-horizontal-rule-line": {
    position: "relative",
    minHeight: "4px",
    padding: "0 2px",
    fontSize: "0",
    lineHeight: "4px",
  },
  ".cm-horizontal-rule-line::before": {
    content: "''",
    position: "absolute",
    left: "2px",
    right: "2px",
    top: "50%",
    height: "1px",
    backgroundColor: "var(--editor-divider)",
    transform: "translateY(-50%)",
    pointerEvents: "none",
  },
  ".cm-unordered-list-marker-rendered": {
    display: "inline-block",
    position: "relative",
    color: "transparent",
  },
  ".cm-unordered-list-marker-rendered::before": {
    content: '"•"',
    position: "absolute",
    inset: "0",
    color: "var(--editor-accent)",
    textAlign: "center",
    pointerEvents: "none",
    transform: "scale(1.32)",
    transformOrigin: "center",
  },
  ".cm-unordered-list-line:hover .cm-unordered-list-marker-rendered": {
    color: "inherit",
  },
  ".cm-unordered-list-line:hover .cm-unordered-list-marker-rendered::before": {
    opacity: "0",
  },
  ".cm-emphasis-rendered": {
    display: "inline-block",
    color: "var(--editor-emphasis)",
    fontStyle: "normal",
    fontWeight: "520",
    transform: "skewX(-10deg)",
    transformOrigin: "left center",
  },
  ".cm-strong-rendered": {
    color: "var(--editor-strong)",
    fontWeight: "800",
    WebkitTextStroke: "0.12px currentColor",
  },
  ".cm-highlight-rendered": {
    borderRadius: "var(--radius-sm)",
    padding: "0 3px",
    color: "var(--editor-highlight-text)",
    backgroundColor: "var(--editor-highlight-bg)",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  },
  ".cm-footnote-reference-rendered": {
    color: "var(--editor-accent)",
    fontSize: "0.68em",
    fontWeight: "800",
    lineHeight: "0",
    verticalAlign: "super",
  },
  ".cm-underline-rendered": {
    "--cm-underline-thickness": "1.2px",
    borderBottom: "var(--cm-underline-thickness) solid var(--editor-accent)",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  },
  ".cm-strong-rendered .cm-underline-rendered, .cm-underline-rendered:has(.cm-strong-rendered)": {
    "--cm-underline-thickness": "2px",
  },
  ".cm-strikethrough-rendered": {
    color: "var(--editor-muted)",
    textDecoration: "line-through",
    textDecorationThickness: "1.2px",
  },
  ".cm-strikethrough-rendered .cm-emphasis-rendered": {
    textDecoration: "line-through",
    textDecorationThickness: "1.2px",
  },
  ".cm-quote-line": {
    borderLeft: "3px solid var(--editor-quote-border)",
    borderRadius: "0",
    paddingLeft: "12px",
    color: "var(--editor-quote-text)",
    backgroundColor: "var(--editor-quote-bg)",
  },
  ".cm-image-preview": {
    display: "inline-block",
    position: "relative",
    maxWidth: "100%",
    margin: "0",
    borderRadius: "var(--radius-md)",
  },
  ".cm-image-preview.selected img": {
    outline: "2px solid var(--editor-accent)",
    outlineOffset: "3px",
    boxShadow: "var(--editor-image-selected-shadow)",
  },
  ".cm-image-preview.size-thumbnail img": {
    maxWidth: "160px",
    maxHeight: "120px",
  },
  ".cm-image-preview.size-small img": {
    maxWidth: "320px",
    maxHeight: "240px",
  },
  ".cm-image-preview.size-medium img": {
    maxWidth: "520px",
    maxHeight: "360px",
  },
  ".cm-image-preview.size-large img": {
    maxWidth: "100%",
    maxHeight: "520px",
  },
  ".cm-image-reference-line": {
    paddingBottom: "0",
  },
  ".cm-image-reference-line-hidden": {
    lineHeight: "0",
  },
  ".cm-image-reference-hidden": {
    fontSize: "0",
    lineHeight: "0",
    color: "transparent",
  },
  ".cm-image-reference-hidden *": {
    color: "transparent",
  },
  ".cm-image-preview img": {
    display: "block",
    maxWidth: "100%",
    maxHeight: "420px",
    borderRadius: "var(--radius-md)",
    objectFit: "contain",
    boxShadow: "var(--editor-image-shadow)",
  },
  ".cm-image-preview-action": {
    position: "absolute",
    top: "8px",
    right: "8px",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    border: "1px solid var(--editor-floating-border)",
    borderRadius: "var(--radius-full)",
    padding: "0",
    color: "var(--editor-text)",
    backgroundColor: "var(--editor-floating-surface)",
    boxShadow: "var(--editor-image-action-shadow)",
    cursor: "pointer",
    backdropFilter: "blur(14px) saturate(140%)",
  },
  ".cm-image-preview-action svg": {
    width: "16px",
    height: "16px",
    stroke: "currentColor",
  },
  ".cm-image-preview-action:hover": {
    backgroundColor: "var(--editor-floating-surface-hover)",
  },
  ".cm-image-preview:hover .cm-image-preview-action, .cm-image-preview.selected .cm-image-preview-action, .cm-image-preview.source-visible .cm-image-preview-action":
    {
      display: "flex",
    },
  ".cm-image-preview-error": {
    display: "inline-flex",
    maxWidth: "100%",
    margin: "8px 0 14px",
    borderRadius: "var(--radius-md)",
    padding: "8px 10px",
    color: "var(--editor-muted)",
    backgroundColor: "var(--editor-block-bg)",
    fontSize: "13px",
    lineHeight: "1.35",
  },
  ".cm-image-context-menu": {
    position: "fixed",
    zIndex: "10000",
    minWidth: "148px",
    border: "1px solid var(--menu-border)",
    borderRadius: "var(--menu-radius)",
    padding: "var(--menu-padding)",
    color: "var(--menu-foreground)",
    backgroundColor: "var(--menu-surface)",
    boxShadow: "var(--menu-shadow)",
    font: "13px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif",
    backdropFilter: "var(--menu-backdrop-filter)",
  },
  ".cm-image-context-menu button": {
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    alignItems: "center",
    columnGap: "4px",
    width: "100%",
    minHeight: "26px",
    border: "0",
    borderRadius: "var(--menu-item-radius)",
    padding: "0 9px 0 3px",
    color: "inherit",
    backgroundColor: "transparent",
    font: "inherit",
    textAlign: "left",
    cursor: "default",
  },
  ".cm-image-context-menu button:hover": {
    backgroundColor: "var(--menu-hover)",
    color: "var(--menu-foreground)",
  },
  ".cm-image-context-menu button.danger-menu-item": {
    color: "var(--destructive)",
  },
  ".cm-image-context-menu button.danger-menu-item:hover": {
    backgroundColor: "var(--menu-danger-hover)",
    color: "var(--destructive)",
  },
  ".cm-image-context-check": {
    display: "inline-block",
    width: "14px",
    color: "var(--foreground-tertiary)",
    textAlign: "center",
  },
  ".cm-image-context-label": {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-image-context-menu-separator": {
    height: "1px",
    margin: "5px 10px",
    backgroundColor: "var(--menu-separator)",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-panels": {
    color: "var(--editor-text)",
    backgroundColor: "var(--editor-panel-bg)",
    borderColor: "var(--editor-divider)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: "13px",
  },
  ".cm-panel.cm-search": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
  },
  ".cm-panel.cm-search input": {
    height: "28px",
    border: "1px solid var(--editor-divider)",
    borderRadius: "var(--radius-md)",
    padding: "0 8px",
    color: "var(--editor-text)",
    backgroundColor: "var(--editor-bg)",
    outline: "none",
  },
  ".cm-panel.cm-search button": {
    minHeight: "28px",
    border: "1px solid var(--editor-divider)",
    borderRadius: "var(--radius-md)",
    padding: "0 8px",
    color: "var(--editor-text)",
    backgroundColor: "var(--editor-bg)",
    font: "inherit",
  },
  ".cm-panel.cm-search button:hover": {
    backgroundColor: "var(--editor-block-bg)",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--editor-search-bg)",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "var(--editor-search-current)",
  },
});
