import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { tags } from "@lezer/highlight";

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
      fontSize: "var(--editor-h1-font-size, 28px)",
      fontWeight: "750",
    },
    {
      tag: tags.heading2,
      color: "#1d1d1f",
      fontSize: "var(--editor-h2-font-size, 24px)",
      fontWeight: "720",
    },
    {
      tag: tags.heading3,
      color: "#1d1d1f",
      fontSize: "var(--editor-h3-font-size, 21px)",
      fontWeight: "700",
    },
    {
      tag: tags.heading4,
      color: "#1d1d1f",
      fontWeight: "680",
    },
    {
      tag: tags.strong,
      fontWeight: "800",
    },
    {
      tag: tags.emphasis,
      color: "#4f4f57",
      fontStyle: "oblique 11deg",
      fontWeight: "520",
    },
    {
      tag: tags.strikethrough,
      textDecoration: "none",
    },
    {
      tag: tags.quote,
      color: "#5f6068",
      fontStyle: "normal",
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
