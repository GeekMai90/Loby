import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    fontSize: "17px",
  },
  ".cm-scroller": {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    lineHeight: "1.76",
    padding: "34px 0",
  },
  ".cm-content": {
    maxWidth: "760px",
    margin: "0 auto",
    padding: "0 44px 128px",
    caretColor: "#0071e3",
  },
  ".cm-line": {
    padding: "0 2px",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-focused": {
    outline: "none",
  },
  ".cm-panels": {
    color: "#1d1d1f",
    backgroundColor: "#fbfbfc",
    borderColor: "#ececf0",
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
    border: "1px solid #d7d7dd",
    borderRadius: "7px",
    padding: "0 8px",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    outline: "none",
  },
  ".cm-panel.cm-search button": {
    minHeight: "28px",
    border: "1px solid #d7d7dd",
    borderRadius: "7px",
    padding: "0 8px",
    color: "#1d1d1f",
    backgroundColor: "#ffffff",
    font: "inherit",
  },
  ".cm-panel.cm-search button:hover": {
    backgroundColor: "#f2f2f4",
  },
  ".cm-searchMatch": {
    backgroundColor: "#fff3b0",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "#ffd85a",
  },
});

export const chineseEditorPhrases = EditorState.phrases.of({
  Find: "查找",
  Replace: "替换",
  next: "下一个",
  previous: "上一个",
  all: "全选",
  "match case": "区分大小写",
  regexp: "正则",
  "by word": "整词",
  replace: "替换",
  "replace all": "全部替换",
  close: "关闭",
  "current match": "当前匹配",
  "on line": "位于行",
  "replaced match on line $": "已替换第 $ 行的匹配",
  "replaced $ matches": "已替换 $ 个匹配",
});

export const markdownHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: tags.heading1,
      color: "#1d1d1f",
      fontSize: "1.46em",
      fontWeight: "750",
    },
    {
      tag: tags.heading2,
      color: "#1d1d1f",
      fontSize: "1.28em",
      fontWeight: "720",
    },
    {
      tag: tags.heading3,
      color: "#1d1d1f",
      fontSize: "1.14em",
      fontWeight: "700",
    },
    {
      tag: [tags.heading4, tags.heading5, tags.heading6],
      color: "#1d1d1f",
      fontWeight: "680",
    },
    {
      tag: tags.strong,
      fontWeight: "720",
    },
    {
      tag: tags.emphasis,
      fontStyle: "italic",
    },
    {
      tag: tags.quote,
      color: "#515154",
      fontStyle: "italic",
    },
    {
      tag: [tags.link, tags.url],
      color: "#0057d9",
      textDecoration: "none",
    },
    {
      tag: tags.monospace,
      color: "#3a3a3c",
      backgroundColor: "#f2f2f7",
      fontFamily: "'SF Mono', 'SFMono-Regular', Consolas, monospace",
    },
  ]),
);

export const typewriterScrollExtension = EditorView.updateListener.of((update) => {
  if ((!update.docChanged && !update.selectionSet) || !update.view.hasFocus) return;
  const head = update.state.selection.main.head;
  window.requestAnimationFrame(() => {
    update.view.dispatch({
      effects: EditorView.scrollIntoView(head, { y: "center" }),
    });
  });
});
