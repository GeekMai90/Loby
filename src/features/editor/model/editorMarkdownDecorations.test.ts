// @vitest-environment happy-dom
/**
 * [INPUT]: 依赖 CodeMirror 6、Vitest、Loby Markdown 扩展与 Markdown 所见即所得装饰器
 * [OUTPUT]: 验证语法标记显隐、链接完整源码编辑、可点击编辑的分隔线、围栏代码、任务复选框、GFM 表格无滚动切换与增量失效、自定义 Markdown 样式及中文标点相邻粗体
 * [POS]: 编辑器 Markdown 装饰层的交互回归测试，覆盖阅读态结构的真实指针命中与光标源码编辑态切换，并锁定表格激活不重复滚动、普通输入不触发全文重建
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";
import { lobyMarkdownExtensions } from "@/features/editor/model/editorMarkdownLanguage";
import {
  collectMarkdownSyntaxConstructs,
  isMarkdownSyntaxConstructActive,
  markdownTableTransactionRequiresRebuild,
  markdownSyntaxDecorations,
  type MarkdownSyntaxConstruct,
} from "@/features/editor/model/editorMarkdownDecorations";

function createState(doc: string, anchor = doc.length, head = anchor) {
  return EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [markdown({ extensions: lobyMarkdownExtensions })],
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

  it("keeps the complete link source active while editing its label or URL", () => {
    const doc = "[链接文本](https://example.com/path)";
    const link = collectMarkdownSyntaxConstructs(createState(doc)).find((construct) => construct.kind === "Link");

    expect(link).toBeDefined();
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("链接")), link!)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("https")), link!)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.length - 1), link!)).toBe(true);
  });

  it("does not collapse a link back to rendered text when the cursor moves into its URL", () => {
    const doc = "[链接文本](https://example.com/path)";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    expect(parent.querySelector(".cm-line")?.textContent).toBe("链接文本");

    view.contentDOM.focus();
    view.dispatch({ selection: { anchor: doc.indexOf("https") } });

    expect(parent.querySelector(".cm-line")?.textContent).toBe(doc);
    expect(view.state.selection.main.head).toBe(doc.indexOf("https"));

    view.dispatch({ changes: { from: doc.indexOf("example"), to: doc.indexOf("example") + "example".length, insert: "loby" } });

    expect(view.state.doc.toString()).toBe("[链接文本](https://loby.com/path)");
    expect(parent.querySelector(".cm-line")?.textContent).toBe("[链接文本](https://loby.com/path)");

    const labelFrom = view.state.doc.toString().indexOf("链接文本");
    view.dispatch({ changes: { from: labelFrom, to: labelFrom + "链接文本".length, insert: "新的显示文本" } });

    expect(view.state.doc.toString()).toBe("[新的显示文本](https://loby.com/path)");
    expect(parent.querySelector(".cm-line")?.textContent).toBe("[新的显示文本](https://loby.com/path)");

    view.destroy();
    parent.remove();
  });

  it("keeps decorations correct across cursor moves that change no construct's active state", () => {
    const doc = "这是纯文本前缀，后面才有**粗体**结尾。";
    const rendered = "这是纯文本前缀，后面才有粗体结尾。";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });
    view.contentDOM.focus();

    // 连续在纯文本前缀里移动：没有构造的激活态翻转，装饰必须保持正确而不是变陈旧
    for (const anchor of [1, 3, 5, 2]) {
      view.dispatch({ selection: { anchor } });
      expect(parent.querySelector(".cm-line")?.textContent).toBe(rendered);
    }

    // 进入粗体内容：激活态翻转，必须重建并展开源码
    view.dispatch({ selection: { anchor: doc.indexOf("粗体") } });
    expect(parent.querySelector(".cm-line")?.textContent).toBe(doc);

    // 回到纯文本：再次翻转，必须收回源码
    view.dispatch({ selection: { anchor: 1 } });
    expect(parent.querySelector(".cm-line")?.textContent).toBe(rendered);

    view.destroy();
    parent.remove();
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

  it("keeps heading markers hidden while the editor is not focused", () => {
    const doc = "# 一级标题";
    const state = createState(doc, 0);
    const heading = collectMarkdownSyntaxConstructs(state)[0];

    expect(isMarkdownSyntaxConstructActive(state, heading, false)).toBe(false);
    expect(isMarkdownSyntaxConstructActive(state, heading, true)).toBe(true);
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

  it("reveals horizontal rule source when the rendered divider is clicked", () => {
    const doc = "正文\n\n---\n\n结尾";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    const divider = parent.querySelector<HTMLElement>(".cm-horizontal-rule-line");
    expect(divider).not.toBeNull();
    expect(divider?.textContent).toBe("");

    divider?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, cancelable: true }));

    expect(view.hasFocus).toBe(true);
    expect(view.state.selection.main.head).toBe(doc.indexOf("---"));
    expect(parent.querySelector(".cm-horizontal-rule-line")).toBeNull();
    expect(parent.querySelector(".cm-horizontal-rule-source-line")).not.toBeNull();
    expect([...parent.querySelectorAll(".cm-line")].some((line) => line.textContent === "---")).toBe(true);

    view.destroy();
    parent.remove();
  });

  it("collects fenced code as one block with complete opening and closing markers", () => {
    const doc = "```js\nfunction sayHello() {\n  return '你好';\n}\n```";
    const fencedCode = collectMarkdownSyntaxConstructs(createState(doc)).find((construct) => construct.kind === "FencedCode");

    expect(fencedCode).toBeDefined();
    expect(doc.slice(fencedCode?.contentFrom, fencedCode?.contentTo)).toBe("function sayHello() {\n  return '你好';\n}");
    expect(fencedCode?.markers.map((marker) => doc.slice(marker.from, marker.to))).toEqual(["```js", "```"]);
    expect(isMarkdownSyntaxConstructActive(createState(doc, 0), fencedCode!)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("return")), fencedCode!)).toBe(true);
  });

  it("renders fenced code as a continuous block and reveals source only while editing it", () => {
    const doc = "正文\n\n```js\nconst answer = 42;\nconsole.log(answer);\n```\n\n结尾";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    expect(parent.querySelectorAll(".cm-code-block-line")).toHaveLength(4);
    expect(parent.querySelector(".cm-code-block-start")?.textContent).toBe("");
    expect(parent.querySelector(".cm-code-block-end")?.textContent).toBe("");
    expect(parent.querySelectorAll(".cm-code-block-source-active")).toHaveLength(0);

    view.contentDOM.focus();
    view.dispatch({ selection: { anchor: doc.indexOf("answer") } });

    expect(parent.querySelectorAll(".cm-code-block-source-active")).toHaveLength(4);
    expect(parent.querySelector(".cm-code-block-start")?.textContent).toBe("```js");
    expect(parent.querySelector(".cm-code-block-end")?.textContent).toBe("```");

    view.destroy();
    parent.remove();
  });

  it("recognizes task items without also treating their list marks as bullets", () => {
    const doc = "- [x] 已完成\n- [ ] 待处理";
    const tasks = collectMarkdownSyntaxConstructs(createState(doc));

    expect(tasks.map((construct) => construct.kind)).toEqual(["TaskListItem", "TaskListItem"]);
    expect(tasks.map((construct) => construct.checked)).toEqual([true, false]);
    expect(tasks.map((construct) => doc.slice(construct.markers[0].from, construct.markers[0].to))).toEqual(["- [x]", "- [ ]"]);
  });

  it("treats the complete task item as cursor-addressable source text", () => {
    const doc = "- [x] 已完成\n- [ ] 待处理";
    const tasks = collectMarkdownSyntaxConstructs(createState(doc));

    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("已")), tasks[0])).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, 0), tasks[0])).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("待")), tasks[0])).toBe(false);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("待")), tasks[1])).toBe(true);
  });

  it("renders interactive task checkboxes that update the Markdown marker", () => {
    const doc = "- [x] 已完成\n- [ ] 待处理";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    const checkboxes = parent.querySelectorAll<HTMLButtonElement>(".cm-task-checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0].getAttribute("aria-checked")).toBe("true");
    expect(checkboxes[1].getAttribute("aria-checked")).toBe("false");
    expect(checkboxes[0].textContent).toBe("");
    expect(checkboxes[1].textContent).toBe("");
    expect(parent.querySelectorAll(".cm-unordered-list-marker-rendered")).toHaveLength(0);
    expect(parent.querySelector(".cm-task-list-content-completed")?.textContent).toContain("已完成");

    checkboxes[1].click();

    expect(view.state.doc.toString()).toBe("- [x] 已完成\n- [x] 待处理");
    expect(parent.querySelectorAll(".cm-task-checkbox[data-checked='true']")).toHaveLength(2);

    view.destroy();
    parent.remove();
  });

  it("restores the full task marker when the cursor enters the item", () => {
    const doc = "- [x] 已完成\n- [ ] 待处理";
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    view.contentDOM.focus();
    view.dispatch({ selection: { anchor: doc.indexOf("已") } });

    expect(parent.querySelectorAll(".cm-task-checkbox")).toHaveLength(1);
    expect(parent.querySelector(".cm-line")?.textContent).toBe("- [x] 已完成");
    expect(parent.querySelector(".cm-task-list-content-completed")).toBeNull();

    view.destroy();
    parent.remove();
  });

  it("renders a GFM table widget and reveals its source after activation", () => {
    const tableSource = "| 模块 | 用途 | 状态 |\n| --- | --- | --- |\n| 编辑器 | 编写正文 | 已支持 |\n| 预览 | 查看效果 | 已支持 |";
    const doc = `正文\n\n${tableSource}\n\n结尾`;
    const state = createState(doc);
    const table = collectMarkdownSyntaxConstructs(state).find((construct) => construct.kind === "Table");

    expect(table?.table).toEqual({
      headers: ["模块", "用途", "状态"],
      rows: [
        ["编辑器", "编写正文", "已支持"],
        ["预览", "查看效果", "已支持"],
      ],
    });

    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    const widget = parent.querySelector<HTMLElement>(".cm-table-widget");
    expect(widget).not.toBeNull();
    expect(widget?.querySelectorAll('[role="columnheader"]')).toHaveLength(3);
    expect(widget?.querySelectorAll('[role="cell"]')).toHaveLength(6);
    expect(parent.querySelectorAll(".cm-table-line")).toHaveLength(0);

    const dispatch = vi.spyOn(view, "dispatch");
    widget?.click();
    const revealTransaction = dispatch.mock.calls.map(([transaction]) => transaction).find((transaction) => "selection" in transaction);
    expect(revealTransaction).not.toHaveProperty("scrollIntoView");
    view.contentDOM.focus();
    view.dispatch({ selection: { anchor: doc.indexOf("| 模块") } });

    expect(parent.querySelector(".cm-table-widget")).toBeNull();
    expect(parent.querySelectorAll(".cm-table-line")).toHaveLength(4);
    expect(parent.querySelector(".cm-table-source-delimiter")?.textContent).toContain("---");

    view.destroy();
    parent.remove();
  });

  it("maps table decorations for ordinary prose edits and rebuilds only on table-related changes", () => {
    const tableSource = "| 模块 | 状态 |\n| --- | --- |\n| 编辑器 | 已支持 |";
    const doc = `开头\n\n${tableSource}\n\n结尾`;
    const state = createState(doc, doc.length);
    const tableFrom = doc.indexOf("| 模块");
    const tableTo = tableFrom + tableSource.length;
    const decorations = Decoration.set([Decoration.replace({}).range(tableFrom, tableTo)]);

    const proseEdit = state.update({ changes: { from: doc.length, insert: "。" } });
    expect(markdownTableTransactionRequiresRebuild(decorations, proseEdit)).toBe(false);

    const tableEdit = state.update({ changes: { from: tableFrom + 2, insert: "新" } });
    expect(markdownTableTransactionRequiresRebuild(decorations, tableEdit)).toBe(true);

    const tableCreationSignal = state.update({ changes: { from: 2, insert: "| 新列 |" } });
    expect(markdownTableTransactionRequiresRebuild(decorations, tableCreationSignal)).toBe(true);

    const enterTable = state.update({ selection: { anchor: tableFrom + 2 } });
    expect(markdownTableTransactionRequiresRebuild(Decoration.none, enterTable)).toBe(true);
  });

  it("keeps a mapped table widget clickable after text is inserted before it", () => {
    const tableSource = "| 模块 | 状态 |\n| --- | --- |\n| 编辑器 | 已支持 |";
    const doc = `开头\n\n${tableSource}\n\n结尾`;
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    view.dispatch({ changes: { from: 0, insert: "新" } });
    parent.querySelector<HTMLElement>(".cm-table-widget")?.click();

    expect(view.state.selection.main.head).toBe(view.state.doc.toString().indexOf("| 模块"));

    view.destroy();
    parent.remove();
  });

  it("renders unordered list markers while leaving ordered list markers as source text", () => {
    const doc = "- 第一项\n  * 子项\n+ 第三项\n1. 有序项";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));
    const bulletMarkers = constructs.filter((construct) => construct.kind === "BulletListMarker");

    expect(bulletMarkers.map((construct) => doc.slice(construct.markers[0].from, construct.markers[0].to))).toEqual(["-", "*", "+"]);
    expect(bulletMarkers.map((construct) => doc.slice(construct.contentFrom, construct.contentTo))).toEqual(["第一项", "子项", "第三项"]);
    expect(constructs.some((construct) => constructText(doc, construct) === "1. 有序项")).toBe(false);
  });

  it("reveals an unordered list source marker when the cursor enters its line", () => {
    const doc = "- 第一项\n- 第二项";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));
    const firstItem = constructs[0];
    const secondItem = constructs[1];

    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("一")), firstItem)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("一")), secondItem)).toBe(false);
    expect(isMarkdownSyntaxConstructActive(createState(doc, 0), firstItem)).toBe(true);
    expect(isMarkdownSyntaxConstructActive(createState(doc, doc.indexOf("二")), secondItem)).toBe(true);
  });

  it("decorates an inactive unordered list marker and restores its source after entering the item", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: "- 第一项",
        extensions: [markdown({ extensions: lobyMarkdownExtensions }), markdownSyntaxDecorations],
      }),
    });

    expect(parent.querySelector(".cm-unordered-list-line")).not.toBeNull();
    expect(parent.querySelector(".cm-unordered-list-marker-rendered")?.textContent).toBe("-");
    expect(document.head.textContent).not.toContain(".cm-unordered-list-line:hover");

    view.contentDOM.focus();
    view.dispatch({ selection: { anchor: 3 } });

    expect(parent.querySelector(".cm-unordered-list-marker-rendered")).toBeNull();
    expect(parent.querySelector(".cm-line")?.textContent).toBe("- 第一项");

    view.destroy();
    parent.remove();
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
    expect(constructs.filter((construct) => construct.kind === "LobyUnderline").map((construct) => constructText(doc, construct))).toEqual([
      "~文本~",
      "~下划线~",
    ]);
    expect(constructs.some((construct) => constructText(doc, construct) === "**上添加**")).toBe(false);
  });

  it("recognizes bold text that ends with Chinese punctuation before following Chinese text", () => {
    const doc = "这就要说到我的变化。**“注意力 > 时间 > 金钱”**这个价值观仍然重要。";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));
    const bold = constructs.find((construct) => construct.kind === "StrongEmphasis");

    expect(bold).toBeDefined();
    expect(constructText(doc, bold!)).toBe("**“注意力 > 时间 > 金钱”**");
    expect(bold?.className).toBe("cm-strong-rendered");
  });

  it("recognizes bold text enclosed by Chinese quotation marks", () => {
    const doc = "自己的**“前识”**过早地给现实下了结论";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));
    const bold = constructs.find((construct) => construct.kind === "StrongEmphasis");

    expect(bold).toBeDefined();
    expect(constructText(doc, bold!)).toBe("**“前识”**");
    expect(bold?.className).toBe("cm-strong-rendered");
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
    expect(constructs.filter((construct) => construct.kind === "LobyUnderline").map((construct) => constructText(doc, construct))).toEqual([
      "~下划线~",
    ]);
    expect(constructs.filter((construct) => construct.kind === "Strikethrough")).toHaveLength(1);
  });

  it("keeps underline, highlight, and emphasis as nested constructs in the real document context", () => {
    const doc = "📝 添加文字~==*样式*==~";
    const constructs = collectMarkdownSyntaxConstructs(createState(doc));

    expect(constructs.map((construct) => construct.kind)).toEqual(["LobyUnderline", "Highlight", "Emphasis"]);
    expect(constructs.map((construct) => doc.slice(construct.contentFrom, construct.contentTo))).toEqual(["==*样式*==", "*样式*", "样式"]);
  });

  it("keeps legacy plus markers as ordinary content", () => {
    const doc = "普通内容 ++不是下划线++";
    expect(collectMarkdownSyntaxConstructs(createState(doc)).some((construct) => construct.kind === "LobyUnderline")).toBe(false);
  });

  it("keeps legacy double-colon text as ordinary content", () => {
    const doc = "普通内容 ::不是高亮::";
    expect(collectMarkdownSyntaxConstructs(createState(doc)).some((construct) => construct.kind === "Highlight")).toBe(false);
  });
});
