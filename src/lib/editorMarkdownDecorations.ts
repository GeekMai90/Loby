import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";

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
  headingMarker?: string;
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
  "StrongEmphasis",
  "Emphasis",
  "Strikethrough",
  "InlineCode",
  "Link",
  "QuoteMark",
  "NibvaUnderline",
]);

const CUSTOM_SYNTAX_EXCLUDED_NODES = new Set(["InlineCode", "CodeBlock", "FencedCode", "CodeText", "Link", "Image", "Autolink", "URL"]);

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
      },
    });
  }

  collectCustomConstructs(state, tree, ranges, constructs, seen);
  return constructs.sort((left, right) => left.from - right.from || left.to - right.to);
}

export function isMarkdownSyntaxConstructActive(state: EditorState, construct: MarkdownSyntaxConstruct): boolean {
  return state.selection.ranges.some((range) => {
    if (range.empty) {
      if (construct.kind.startsWith("ATXHeading")) {
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
    const headingMarker = state.sliceDoc(marker.from, marker.to);
    const whitespace = state.sliceDoc(marker.to, node.to).match(/^[\t ]+/)?.[0] ?? "";
    marker.to += whitespace.length;
    return {
      kind: name,
      from: node.from,
      to: node.to,
      contentFrom: marker.to,
      contentTo: node.to,
      markers,
      headingMarker,
    };
  }

  if (name === "Link") {
    const source = state.sliceDoc(node.from, node.to);
    if (/^\[\^[^\]\n]+\]$/.test(source)) {
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
            : name === "NibvaUnderline"
              ? "cm-underline-rendered"
              : undefined,
  };
}

function isMarkerNode(constructName: string, childName: string): boolean {
  if (constructName === "StrongEmphasis" || constructName === "Emphasis") return childName === "EmphasisMark";
  if (constructName === "Strikethrough") return childName === "StrikethroughMark";
  if (constructName === "InlineCode") return childName === "CodeMark";
  if (constructName === "Link") return childName === "LinkMark" || childName === "URL";
  if (constructName === "NibvaUnderline") return childName === "NibvaUnderlineMark";
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

function buildMarkdownSyntaxDecorations(view: EditorView): MarkdownSyntaxDecorations {
  const decorations = [];
  const atomicRanges = [];

  for (const construct of collectMarkdownSyntaxConstructs(view.state, view.visibleRanges)) {
    if (construct.className && construct.contentFrom < construct.contentTo) {
      decorations.push(Decoration.mark({ class: construct.className }).range(construct.contentFrom, construct.contentTo));
    }
    if (isMarkdownSyntaxConstructActive(view.state, construct)) continue;
    if (construct.headingMarker) {
      decorations.push(
        Decoration.line({
          class: "cm-heading-marker-line",
          attributes: { "data-heading-marker": construct.headingMarker },
        }).range(view.state.doc.lineAt(construct.from).from),
      );
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

export const markdownSyntaxDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    atomicRanges: DecorationSet;

    constructor(view: EditorView) {
      const result = buildMarkdownSyntaxDecorations(view);
      this.decorations = result.decorations;
      this.atomicRanges = result.atomicRanges;
    }

    update(update: ViewUpdate) {
      if (!update.docChanged && !update.viewportChanged && !update.selectionSet) return;
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
