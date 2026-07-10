import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { nibvaMarkdownExtensions } from "./editorMarkdownLanguage";
import {
  collectMarkdownSyntaxConstructs,
  isMarkdownSyntaxConstructActive,
  type MarkdownSyntaxConstruct,
} from "./editorMarkdownDecorations";

function createState(doc: string, anchor = doc.length, head = anchor) {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [markdown({ extensions: nibvaMarkdownExtensions })],
  });
}

function constructText(doc: string, construct: MarkdownSyntaxConstruct) {
  return doc.slice(construct.from, construct.to);
}

describe("editorMarkdownDecorations", () => {
  it("collects supported Markdown constructs and their marker ranges", () => {
    const doc = "# 标题\n\n**粗体** *斜体* ~~删除~~ `代码` [链接](https://example.com)\n> 引用";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));

    expect(constructs.map((construct) => construct.kind)).toEqual([
      "ATXHeading1",
      "StrongEmphasis",
      "Emphasis",
      "Strikethrough",
      "InlineCode",
      "Link",
      "QuoteMark",
    ]);
    expect(constructs.map((construct) => constructText(doc, construct))).toEqual([
      "# 标题",
      "**粗体**",
      "*斜体*",
      "~~删除~~",
      "`代码`",
      "[链接](https://example.com)",
      "> 引用",
    ]);
    expect(constructs[0].markers.map((marker) => doc.slice(marker.from, marker.to))).toEqual(["# "]);
    expect(constructs[3].className).toBe("cm-strikethrough-rendered");
    expect(constructs[5].markers.map((marker) => doc.slice(marker.from, marker.to))).toEqual(["[", "]", "(", "https://example.com", ")"]);
  });

  it("reveals only constructs touched by the cursor or selection", () => {
    const doc = "**粗体** 和 *斜体*";
    const cursorState = createState(doc, doc.indexOf("粗") + 1);
    const cursorConstructs = collectMarkdownSyntaxConstructs(cursorState);

    expect(isMarkdownSyntaxConstructActive(cursorState, cursorConstructs[0])).toBe(true);
    expect(isMarkdownSyntaxConstructActive(cursorState, cursorConstructs[1])).toBe(false);

    const selectionState = createState(doc, doc.indexOf("体"), doc.indexOf("斜") + 1);
    const selectionConstructs = collectMarkdownSyntaxConstructs(selectionState);
    expect(selectionConstructs.every((construct) => isMarkdownSyntaxConstructActive(selectionState, construct))).toBe(true);
  });

  it("treats heading markers as cursor-addressable source text", () => {
    const doc = "# 一级标题";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));
    const heading = constructs[0];

    expect(heading.kind).toBe("ATXHeading1");
    expect(doc.slice(heading.markers[0].from, heading.markers[0].to)).toBe("# ");
    expect(isMarkdownSyntaxConstructActive(createState(doc, 0), heading)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, 1), heading)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("一")), heading)).toBe(true);
  });

  it("collects horizontal rules and keeps them editable when selected", () => {
    for (const marker of ["---", "***", "___"]) {
      const constructs = collectMarkdownSyntaxConstructs(createState(marker));
      const horizontalRule = constructs[0];

      expect(horizontalRule.kind).toBe("HorizontalRule");
      expect(constructText(marker, horizontalRule)).toBe(marker);
      expect(horizontalRule.markers.map((range) => marker.slice(range.from, range.to))).toEqual([marker]);
      expect(isMarkdownSyntaxConstructActive(createState(marker, 0), horizontalRule)).toBe(true);
      expect(isMarkdownSyntaxConstructActive(createState(marker, marker.length), horizontalRule)).toBe(true);
    }
  });

  it("keeps adjacent bold and Bear underline markers paired with their own text", () => {
    const doc = "**~文本~**上添加**粗体**和~下划线~";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));

    expect(constructs.filter((construct) => construct.kind === "StrongEmphasis").map((construct) => constructText(doc, construct))).toEqual(
      ["**~文本~**", "**粗体**"],
    );
    expect(
      constructs
        .filter((construct) => construct.kind === "StrongEmphasis")
        .every((construct) => construct.className === "cm-strong-rendered"),
    ).toBe(true);
    expect(constructs.filter((construct) => construct.kind === "NibvaUnderline").map((construct) => constructText(doc, construct))).toEqual(
      ["~文本~", "~下划线~"],
    );
    expect(constructs.some((construct) => constructText(doc, construct) === "**上添加**")).toBe(false);
  });

  it("renders footnote references without their Markdown markers", () => {
    const doc = "Markdown[^1]";
    const footnote = collectMarkdownSyntaxConstructs(createState(doc)).find((construct) => construct.kind === "FootnoteReference");

    expect(footnote).toBeDefined();
    expect(doc.slice(footnote?.contentFrom, footnote?.contentTo)).toBe("1");
    expect(footnote?.markers.map((marker) => doc.slice(marker.from, marker.to))).toEqual(["[^", "]"]);
    expect(footnote?.className).toBe("cm-footnote-reference-rendered");
  });

  it("recognizes == highlights and ignores custom markers in code, links, and escapes", () => {
    const doc = "==高=亮== ~下划线~ ~~删除线~~ `~代码~` [链接](https://example.com/~路径~) \\~转义~";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));

    expect(constructs.filter((construct) => construct.kind === "Highlight").map((construct) => constructText(doc, construct))).toEqual([
      "==高=亮==",
    ]);
    expect(constructs.filter((construct) => construct.kind === "NibvaUnderline").map((construct) => constructText(doc, construct))).toEqual(
      ["~下划线~"],
    );
    expect(constructs.filter((construct) => construct.kind === "Strikethrough")).toHaveLength(1);
  });

  it("keeps underline, highlight, and emphasis as nested constructs in the real document context", () => {
    const doc = "📝 添加文字~==*样式*==~";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));

    expect(constructs.map((construct) => construct.kind)).toEqual(["NibvaUnderline", "Highlight", "Emphasis"]);
    expect(constructs.map((construct) => doc.slice(construct.contentFrom, construct.contentTo))).toEqual(["==*样式*==", "*样式*", "样式"]);
  });

  it("keeps legacy plus markers as ordinary content", () => {
    const doc = "普通内容 ++不是下划线++";
    expect(collectMarkdownSyntaxConstructs(createState(doc)).some((construct) => construct.kind === "NibvaUnderline")).toBe(false);
  });

  it("keeps legacy double-colon text as ordinary content", () => {
    const doc = "普通内容 ::不是高亮::";
    expect(collectMarkdownSyntaxConstructs(createState(doc)).some((construct) => construct.kind === "Highlight")).toBe(false);
  });
});
