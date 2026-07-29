/**
 * [INPUT]: 依赖 CodeMirror 6
 * [OUTPUT]: 对外提供 MarkdownSyntaxConstruct、collectMarkdownSyntaxConstructs、isMarkdownSyntaxConstructActive、markdownTableTransactionRequiresRebuild、markdownSyntaxDecorations，并渲染等高切换的分隔线、可进入源码态的任务列表、围栏代码、GFM 表格及脚注定义
 * [POS]: 编辑器 feature 的 Markdown 所见即所得边界，统一语法显隐与光标编辑态；分隔线阅读态和源码态保持同一行盒，任务项与表格通过明确入口恢复源码，装饰仅在相关语法或选区命中时重建
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { syntaxTree } from "@codemirror/language";
import { StateField, type EditorState, type Extension, type Range, type Transaction } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";

interface DocumentRange {
  from: number;
  to: number;
}

type MarkerRange = DocumentRange;

export interface MarkdownSyntaxConstruct extends DocumentRange {
  kind: string;
  contentFrom: number;
  contentTo: number;
  markers: MarkerRange[];
  className?: string;
  checked?: boolean;
  checkPosition?: number;
  label?: string;
  table?: MarkdownTableData;
}

interface MarkdownTableData {
  headers: string[];
  rows: string[][];
}

interface MarkdownSyntaxDecorations {
  decorations: DecorationSet;
  atomicRanges: DecorationSet;
}

const STANDARD_CONSTRUCTS = new Set([
  "ATXHeading1",
  "ATXHeading2",
  "ATXHeading3",
  "ATXHeading4",
  "HorizontalRule",
  "StrongEmphasis",
  "Emphasis",
  "Strikethrough",
  "InlineCode",
  "FencedCode",
  "Table",
  "Link",
  "ListMark",
  "QuoteMark",
  "LobyUnderline",
]);

const CUSTOM_SYNTAX_EXCLUDED_NODES = new Set([
  "InlineCode",
  "CodeBlock",
  "FencedCode",
  "CodeText",
  "Table",
  "Link",
  "Image",
  "Autolink",
  "URL",
]);

export function collectMarkdownSyntaxConstructs(
  state: EditorState,
  ranges: readonly DocumentRange[] = [{ from: 0, to: state.doc.length }],
): MarkdownSyntaxConstruct[] {
  const constructs: MarkdownSyntaxConstruct[] = [];
  const seen = new Set<string>();
  const tree = syntaxTree(state);

  for (const range of ranges) {
    tree.iterate({
      from: range.from,
      to: range.to,
      enter(ref) {
        if (!STANDARD_CONSTRUCTS.has(ref.name)) return;
        const node = ref.node;
        const key = `${ref.name}:${node.from}:${node.to}`;
        if (seen.has(key)) return;

        const construct = createStandardConstruct(state, ref.name, node);
        if (!construct) return;
        seen.add(key);
        constructs.push(construct);
        if (ref.name === "Table") return false;
      },
    });
  }

  collectCustomConstructs(state, tree, ranges, constructs, seen);
  return constructs.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function isMarkdownSyntaxConstructActive(state: EditorState, construct: MarkdownSyntaxConstruct, editorHasFocus = true): boolean {
  if (!editorHasFocus) return false;

  return state.selection.ranges.some((range) => {
    if (range.empty) {
      if (
        construct.kind.startsWith("ATXHeading") ||
        construct.kind === "BulletListMarker" ||
        construct.kind === "TaskListItem" ||
        construct.kind === "FencedCode" ||
        construct.kind === "Table" ||
        construct.kind === "FootnoteDefinition"
      ) {
        return range.head >= construct.from && range.head <= construct.contentTo;
      }
      return range.head >= construct.contentFrom && range.head <= construct.contentTo;
    }
    return range.from < construct.to && range.to > construct.from;
  });
}

function createStandardConstruct(
  state: EditorState,
  name: string,
  node: ReturnType<typeof syntaxTree>["topNode"],
): MarkdownSyntaxConstruct | null {
  if (name === "Table") {
    const header = findDirectChild(node, "TableHeader");
    if (!header) return null;
    const headers = collectTableCells(state, header);
    const rows: string[][] = [];
    let child = node.firstChild;

    while (child) {
      if (child.name === "TableRow") rows.push(collectTableCells(state, child));
      child = child.nextSibling;
    }

    return {
      kind: name,
      from: node.from,
      to: node.to,
      contentFrom: node.from,
      contentTo: node.to,
      markers: [],
      table: { headers, rows },
    };
  }

  if (name === "FencedCode") {
    const codeMarks: MarkerRange[] = [];
    let codeText: DocumentRange | null = null;
    let child = node.firstChild;

    while (child) {
      if (child.name === "CodeMark") codeMarks.push({ from: child.from, to: child.to });
      if (child.name === "CodeText") codeText = { from: child.from, to: child.to };
      child = child.nextSibling;
    }

    const openingMark = codeMarks[0];
    if (!openingMark) return null;
    const openingLine = state.doc.lineAt(openingMark.from);
    const closingMark = codeMarks[1];

    return {
      kind: name,
      from: node.from,
      to: node.to,
      contentFrom: codeText?.from ?? Math.min(openingLine.to + 1, node.to),
      contentTo: codeText?.to ?? closingMark?.from ?? node.to,
      markers: [{ from: openingMark.from, to: openingLine.to }, ...(closingMark ? [closingMark] : [])],
    };
  }

  if (name === "HorizontalRule") {
    return {
      kind: name,
      from: node.from,
      to: node.to,
      contentFrom: node.from,
      contentTo: node.to,
      markers: [{ from: node.from, to: node.to }],
    };
  }

  if (name === "QuoteMark") {
    const line = state.doc.lineAt(node.from);
    const whitespace = state.sliceDoc(node.to, line.to).match(/^[\t ]+/)?.[0] ?? "";
    const marker = { from: node.from, to: node.to + whitespace.length };
    return {
      kind: name,
      from: line.from,
      to: line.to,
      contentFrom: marker.to,
      contentTo: line.to,
      markers: [marker],
    };
  }

  if (name === "ListMark") {
    const markerText = state.sliceDoc(node.from, node.to);
    if (!/^[-+*]$/.test(markerText)) return null;
    const line = state.doc.lineAt(node.from);
    const whitespace = state.sliceDoc(node.to, line.to).match(/^[\t ]+/)?.[0] ?? "";
    const task = findDirectChild(node.parent, "Task");
    const taskMarker = task ? findDirectChild(task, "TaskMarker") : null;
    if (taskMarker) {
      const markerSource = state.sliceDoc(taskMarker.from, taskMarker.to);
      return {
        kind: "TaskListItem",
        from: node.from,
        to: line.to,
        contentFrom: taskMarker.to,
        contentTo: line.to,
        markers: [{ from: node.from, to: taskMarker.to }],
        checked: /^\[[xX]\]$/.test(markerSource),
        checkPosition: taskMarker.from + 1,
      };
    }
    return {
      kind: "BulletListMarker",
      from: node.from,
      to: line.to,
      contentFrom: node.to + whitespace.length,
      contentTo: line.to,
      markers: [{ from: node.from, to: node.to }],
    };
  }

  const markers: MarkerRange[] = [];
  let child = node.firstChild;

  while (child) {
    if (isMarkerNode(name, child.name)) {
      markers.push({ from: child.from, to: child.to });
    }
    child = child.nextSibling;
  }

  if (!markers.length) return null;

  if (name.startsWith("ATXHeading")) {
    const marker = markers[0];
    const whitespace = state.sliceDoc(marker.to, node.to).match(/^[\t ]+/)?.[0] ?? "";
    marker.to += whitespace.length;
    return {
      kind: name,
      from: node.from,
      to: node.to,
      contentFrom: marker.to,
      contentTo: node.to,
      markers,
    };
  }

  if (name === "Link") {
    const source = state.sliceDoc(node.from, node.to);
    if (/^\[\^[^\]\n]+\]$/.test(source)) {
      if (state.sliceDoc(node.to, node.to + 1) === ":") return null;
      return {
        kind: "FootnoteReference",
        from: node.from,
        to: node.to,
        contentFrom: node.from + 2,
        contentTo: node.to - 1,
        markers: [
          { from: node.from, to: node.from + 2 },
          { from: node.to - 1, to: node.to },
        ],
        label: source.slice(2, -1),
        className: "cm-footnote-reference-rendered",
      };
    }

    const openingBracket = markers[0];
    const closingBracket = markers.find((marker) => state.sliceDoc(marker.from, marker.to) === "]");
    if (!closingBracket) return null;
    return {
      kind: name,
      from: node.from,
      to: node.to,
      contentFrom: openingBracket.to,
      contentTo: closingBracket.from,
      markers,
    };
  }

  return {
    kind: name,
    from: node.from,
    to: node.to,
    contentFrom: markers[0].to,
    contentTo: markers[markers.length - 1].from,
    markers,
    className:
      name === "StrongEmphasis"
        ? "cm-strong-rendered"
        : name === "Emphasis"
          ? "cm-emphasis-rendered"
          : name === "Strikethrough"
            ? "cm-strikethrough-rendered"
            : name === "LobyUnderline"
              ? "cm-underline-rendered"
              : undefined,
  };
}

function findDirectChild(node: ReturnType<typeof syntaxTree>["topNode"] | null, name: string) {
  let child = node?.firstChild ?? null;
  while (child) {
    if (child.name === name) return child;
    child = child.nextSibling;
  }
  return null;
}

function collectTableCells(state: EditorState, row: ReturnType<typeof syntaxTree>["topNode"]): string[] {
  const cells: string[] = [];
  let child = row.firstChild;
  while (child) {
    if (child.name === "TableCell") cells.push(state.sliceDoc(child.from, child.to).trim());
    child = child.nextSibling;
  }
  return cells;
}

function isMarkerNode(constructName: string, childName: string): boolean {
  if (constructName === "StrongEmphasis" || constructName === "Emphasis") return childName === "EmphasisMark";
  if (constructName === "Strikethrough") return childName === "StrikethroughMark";
  if (constructName === "InlineCode") return childName === "CodeMark";
  if (constructName === "Link") return childName === "LinkMark" || childName === "URL";
  if (constructName === "LobyUnderline") return childName === "LobyUnderlineMark";
  return constructName.startsWith("ATXHeading") && childName === "HeaderMark";
}

function collectCustomConstructs(
  state: EditorState,
  tree: ReturnType<typeof syntaxTree>,
  ranges: readonly DocumentRange[],
  constructs: MarkdownSyntaxConstruct[],
  seen: Set<string>,
) {
  const visitedLines = new Set<number>();
  const patterns = [
    { expression: /==(?!=)([^\n]+?)(?<!\\)==(?![=])/g, markerLength: 2, className: "cm-highlight-rendered", kind: "Highlight" },
  ];

  for (const range of ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;

    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      if (visitedLines.has(lineNumber)) continue;
      visitedLines.add(lineNumber);
      const line = state.doc.line(lineNumber);

      const footnoteDefinition = line.text.match(/^[\t ]{0,3}\[\^([^\]\n]+)\]:[\t ]*/);
      if (footnoteDefinition) {
        const markerTo = line.from + footnoteDefinition[0].length;
        const key = `FootnoteDefinition:${line.from}:${line.to}`;
        if (!seen.has(key)) {
          seen.add(key);
          constructs.push({
            kind: "FootnoteDefinition",
            from: line.from,
            to: line.to,
            contentFrom: markerTo,
            contentTo: line.to,
            markers: [{ from: line.from, to: markerTo }],
            label: footnoteDefinition[1],
            className: "cm-footnote-definition-content",
          });
        }
      }

      for (const pattern of patterns) {
        for (const match of line.text.matchAll(pattern.expression)) {
          const markerLength = pattern.markerLength;
          const from = line.from + match.index;
          const to = from + match[0].length;
          const contentFrom = from + markerLength;
          const contentTo = to - markerLength;
          const key = `${pattern.className}:${from}:${to}`;
          if (seen.has(key) || isEscaped(line.text, match.index) || isInsideExcludedSyntax(tree, contentFrom)) continue;

          seen.add(key);
          constructs.push({
            kind: pattern.kind,
            from,
            to,
            contentFrom,
            contentTo,
            markers: [
              { from, to: contentFrom },
              { from: contentTo, to },
            ],
            className: pattern.className,
          });
        }
      }
    }
  }
}

function isEscaped(line: string, markerIndex: number): boolean {
  let slashCount = 0;
  for (let index = markerIndex - 1; index >= 0 && line[index] === "\\"; index -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function isInsideExcludedSyntax(tree: ReturnType<typeof syntaxTree>, position: number): boolean {
  let node: ReturnType<(typeof tree)["resolveInner"]> | null = tree.resolveInner(position, 1);
  while (node) {
    if (CUSTOM_SYNTAX_EXCLUDED_NODES.has(node.name)) return true;
    node = node.parent;
  }
  return false;
}

function getHeadingLevel(kind: string): number | null {
  const match = kind.match(/^ATXHeading([1-6])$/);
  return match ? Number(match[1]) : null;
}

function addFencedCodeLineDecorations(
  state: EditorState,
  construct: MarkdownSyntaxConstruct,
  active: boolean,
  decorations: Range<Decoration>[],
) {
  const startLineNumber = state.doc.lineAt(construct.from).number;
  const endLineNumber = state.doc.lineAt(construct.to).number;
  const closingMarker = construct.markers[1];
  const closingLineNumber = closingMarker ? state.doc.lineAt(closingMarker.from).number : null;

  for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber += 1) {
    const classes = ["cm-code-block-line"];
    if (lineNumber === startLineNumber) classes.push("cm-code-block-start", "cm-code-block-boundary");
    if (lineNumber === endLineNumber) classes.push("cm-code-block-end");
    if (lineNumber === closingLineNumber) classes.push("cm-code-block-boundary");
    if (active) classes.push("cm-code-block-source-active");
    decorations.push(Decoration.line({ class: classes.join(" ") }).range(state.doc.line(lineNumber).from));
  }
}

function addTableSourceLineDecorations(state: EditorState, construct: MarkdownSyntaxConstruct, decorations: Range<Decoration>[]) {
  const startLineNumber = state.doc.lineAt(construct.from).number;
  const endLineNumber = state.doc.lineAt(construct.to).number;

  for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber += 1) {
    const classes = ["cm-table-line"];
    if (lineNumber === startLineNumber) classes.push("cm-table-source-start", "cm-table-source-header");
    if (lineNumber === startLineNumber + 1) classes.push("cm-table-source-delimiter");
    if (lineNumber === endLineNumber) classes.push("cm-table-source-end");
    decorations.push(Decoration.line({ class: classes.join(" ") }).range(state.doc.line(lineNumber).from));
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    private readonly checkPosition: number,
    private readonly checked: boolean,
  ) {
    super();
  }

  eq(other: TaskCheckboxWidget) {
    return other.checkPosition === this.checkPosition && other.checked === this.checked;
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = "cm-task-checkbox";
    checkbox.dataset.checked = String(this.checked);
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", String(this.checked));
    checkbox.setAttribute("aria-label", this.checked ? "标记为未完成" : "标记为已完成");
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        changes: {
          from: this.checkPosition,
          to: this.checkPosition + 1,
          insert: this.checked ? " " : "x",
        },
      });
      view.focus();
    });
    return checkbox;
  }

  ignoreEvent() {
    return true;
  }
}

class FootnoteDefinitionLabelWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }

  eq(other: FootnoteDefinitionLabelWidget) {
    return other.label === this.label;
  }

  toDOM() {
    const label = document.createElement("button");
    label.type = "button";
    label.className = "cm-footnote-definition-label";
    label.dataset.footnoteLabel = this.label;
    label.setAttribute("aria-label", `返回脚注 ${this.label} 的正文引用`);
    label.title = "返回正文引用";
    label.textContent = this.label;
    return label;
  }

  ignoreEvent() {
    return false;
  }
}

class MarkdownTableWidget extends WidgetType {
  private readonly signature: string;

  constructor(private readonly table: MarkdownTableData) {
    super();
    this.signature = JSON.stringify(table);
  }

  eq(other: MarkdownTableWidget) {
    return other.signature === this.signature;
  }

  toDOM(view: EditorView) {
    const table = document.createElement("div");
    table.className = "cm-table-widget";
    table.tabIndex = 0;
    table.setAttribute("role", "table");
    table.setAttribute("aria-label", "Markdown 表格，点击编辑源码");
    const columnCount = Math.max(this.table.headers.length, ...this.table.rows.map((row) => row.length), 1);
    table.style.setProperty("--cm-table-column-count", String(columnCount));

    table.append(createTableWidgetRow(this.table.headers, columnCount, true));
    for (const row of this.table.rows) table.append(createTableWidgetRow(row, columnCount, false));

    const revealSource = () => {
      const tablePosition = view.posAtDOM(table);
      revealMarkdownSource(view, tablePosition);
    };
    table.addEventListener("click", revealSource);
    table.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      revealSource();
    });
    return table;
  }

  ignoreEvent() {
    return true;
  }
}

function revealMarkdownSource(view: EditorView, anchor: number) {
  view.focus();
  view.dispatch({ selection: { anchor } });
}

function createTableWidgetRow(cells: string[], columnCount: number, header: boolean) {
  const row = document.createElement("div");
  row.className = header ? "cm-table-widget-row cm-table-widget-header" : "cm-table-widget-row";
  row.setAttribute("role", "row");
  for (let index = 0; index < columnCount; index += 1) {
    const cell = document.createElement("div");
    cell.className = "cm-table-widget-cell";
    cell.setAttribute("role", header ? "columnheader" : "cell");
    cell.textContent = cells[index] || "\u00a0";
    row.append(cell);
  }
  return row;
}

function buildMarkdownSyntaxDecorations(view: EditorView): MarkdownSyntaxDecorations {
  const decorations: Range<Decoration>[] = [];
  const atomicRanges: Range<Decoration>[] = [];
  let hasFootnoteDefinition = false;

  for (const construct of collectMarkdownSyntaxConstructs(view.state, view.visibleRanges)) {
    const active = isMarkdownSyntaxConstructActive(view.state, construct, view.hasFocus);
    const headingLevel = getHeadingLevel(construct.kind);
    if (headingLevel) {
      decorations.push(
        Decoration.line({ class: `cm-heading-line cm-heading-level-${headingLevel}` }).range(view.state.doc.lineAt(construct.from).from),
      );
    }
    if (construct.className && construct.contentFrom < construct.contentTo) {
      const attributes = construct.kind === "FootnoteReference" && construct.label ? { "data-footnote-label": construct.label } : undefined;
      decorations.push(Decoration.mark({ class: construct.className, attributes }).range(construct.contentFrom, construct.contentTo));
    }
    if (construct.kind === "BulletListMarker") {
      decorations.push(Decoration.line({ class: "cm-unordered-list-line" }).range(view.state.doc.lineAt(construct.from).from));
    }
    if (construct.kind === "TaskListItem") {
      decorations.push(Decoration.line({ class: "cm-task-list-line" }).range(view.state.doc.lineAt(construct.from).from));
      if (active) continue;
      const marker = construct.markers[0];
      const checkbox = Decoration.replace({
        widget: new TaskCheckboxWidget(construct.checkPosition ?? marker.from, construct.checked === true),
      }).range(marker.from, marker.to);
      decorations.push(checkbox);
      atomicRanges.push(checkbox);
      if (construct.checked && construct.contentFrom < construct.contentTo) {
        decorations.push(Decoration.mark({ class: "cm-task-list-content-completed" }).range(construct.contentFrom, construct.contentTo));
      }
      continue;
    }
    if (construct.kind === "FencedCode") {
      addFencedCodeLineDecorations(view.state, construct, active, decorations);
    }
    if (construct.kind === "Table") {
      if (active) {
        addTableSourceLineDecorations(view.state, construct, decorations);
      }
      continue;
    }
    if (construct.kind === "FootnoteDefinition") {
      const lineClasses = ["cm-footnote-definition-line"];
      if (!hasFootnoteDefinition) lineClasses.push("cm-footnote-definition-first");
      hasFootnoteDefinition = true;
      decorations.push(Decoration.line({ class: lineClasses.join(" ") }).range(view.state.doc.lineAt(construct.from).from));
      if (active) continue;
      const marker = construct.markers[0];
      const replacement = Decoration.replace({
        widget: new FootnoteDefinitionLabelWidget(construct.label ?? ""),
      }).range(marker.from, marker.to);
      decorations.push(replacement);
      atomicRanges.push(replacement);
      continue;
    }
    if (construct.kind === "HorizontalRule") {
      decorations.push(
        Decoration.line({
          class: active ? "cm-horizontal-rule-source-line" : "cm-horizontal-rule-line",
          attributes: active ? undefined : { "data-horizontal-rule-position": String(construct.from) },
        }).range(view.state.doc.lineAt(construct.from).from),
      );
      if (active) continue;
    }
    if (active) continue;
    if (construct.kind === "BulletListMarker") {
      const marker = construct.markers[0];
      decorations.push(Decoration.mark({ class: "cm-unordered-list-marker-rendered" }).range(marker.from, marker.to));
      continue;
    }
    for (const marker of construct.markers) {
      if (marker.from >= marker.to) continue;
      const replacement = Decoration.replace({}).range(marker.from, marker.to);
      decorations.push(replacement);
      atomicRanges.push(replacement);
    }
  }

  return {
    decorations: Decoration.set(decorations, true),
    atomicRanges: Decoration.set(atomicRanges, true),
  };
}

const markdownSyntaxViewDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomicRanges: DecorationSet;

    constructor(view: EditorView) {
      const result = buildMarkdownSyntaxDecorations(view);
      this.decorations = result.decorations;
      this.atomicRanges = result.atomicRanges;
    }

    update(update: ViewUpdate) {
      if (!update.docChanged && !update.viewportChanged && !update.selectionSet && !update.focusChanged) return;
      const result = buildMarkdownSyntaxDecorations(update.view);
      this.decorations = result.decorations;
      this.atomicRanges = result.atomicRanges;
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.atomicRanges ?? Decoration.none),
  },
);

const horizontalRuleSourceInteraction = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0 || !(event.target instanceof Element)) return false;

    const line = event.target.closest<HTMLElement>(".cm-horizontal-rule-line");
    const position = Number(line?.dataset.horizontalRulePosition);
    if (!Number.isSafeInteger(position) || position < 0 || position > view.state.doc.length) return false;

    event.preventDefault();
    event.stopPropagation();
    revealMarkdownSource(view, position);
    return true;
  },
});

function buildMarkdownTableDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  for (const construct of collectMarkdownSyntaxConstructs(state)) {
    if (construct.kind !== "Table" || !construct.table || isMarkdownSyntaxConstructActive(state, construct)) continue;
    decorations.push(
      Decoration.replace({ block: true, widget: new MarkdownTableWidget(construct.table) }).range(construct.from, construct.to),
    );
  }

  return Decoration.set(decorations, true);
}

function selectionTouchesTableSyntax(state: EditorState): boolean {
  const tree = syntaxTree(state);
  for (const range of state.selection.ranges) {
    for (const position of range.empty ? [range.head] : [range.from, range.to]) {
      let node: ReturnType<(typeof tree)["resolveInner"]> | null = tree.resolveInner(position, position === state.doc.length ? -1 : 1);
      while (node) {
        if (node.name === "Table") return true;
        node = node.parent;
      }
    }
  }
  return false;
}

function decorationTouchesChangedRange(decorations: DecorationSet, transaction: Transaction): boolean {
  let touches = false;
  transaction.changes.iterChangedRanges((fromA, toA) => {
    if (touches) return;
    decorations.between(Math.max(0, fromA - 1), Math.min(transaction.startState.doc.length, Math.max(fromA + 1, toA + 1)), () => {
      touches = true;
    });
  });
  return touches;
}

function changedLinesContainTableSignal(transaction: Transaction): boolean {
  let containsSignal = false;
  transaction.changes.iterChanges((fromA, toA, fromB, toB) => {
    if (containsSignal) return;
    if (transaction.startState.sliceDoc(fromA, toA).includes("|")) {
      containsSignal = true;
      return;
    }

    const startLine = Math.max(1, transaction.newDoc.lineAt(fromB).number - 1);
    const endLine = Math.min(transaction.newDoc.lines, transaction.newDoc.lineAt(toB).number + 1);
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      if (transaction.newDoc.line(lineNumber).text.includes("|")) {
        containsSignal = true;
        return;
      }
    }
  });
  return containsSignal;
}

export function markdownTableTransactionRequiresRebuild(decorations: DecorationSet, transaction: Transaction): boolean {
  if (transaction.docChanged) {
    if (decorationTouchesChangedRange(decorations, transaction) || changedLinesContainTableSignal(transaction)) return true;
  }
  return (
    Boolean(transaction.selection) &&
    (selectionTouchesTableSyntax(transaction.startState) || selectionTouchesTableSyntax(transaction.state))
  );
}

const markdownTableDecorations = StateField.define<DecorationSet>({
  create: buildMarkdownTableDecorations,
  update(decorations, transaction) {
    if (!transaction.docChanged && !transaction.selection) return decorations;
    if (markdownTableTransactionRequiresRebuild(decorations, transaction)) return buildMarkdownTableDecorations(transaction.state);
    return transaction.docChanged ? decorations.map(transaction.changes) : decorations;
  },
  provide: (field) => [EditorView.decorations.from(field), EditorView.atomicRanges.of((view) => view.state.field(field))],
});

export const markdownSyntaxDecorations: Extension = [
  markdownSyntaxViewDecorations,
  markdownTableDecorations,
  horizontalRuleSourceInteraction,
];
