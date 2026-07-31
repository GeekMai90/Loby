/**
 * [INPUT]: 依赖 Vitest 与 EditorDocumentAuthority
 * [OUTPUT]: 验证同一编辑 session 的完整本地延迟回声识别、外部正文放行与跨 session 隔离
 * [POS]: 编辑器文档权威回归边界，覆盖任意数量较早模型提交晚于较新输入到达时不得回灌 CodeMirror
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { EditorDocumentAuthority } from "@/features/editor/model/editorDocumentAuthority";

describe("EditorDocumentAuthority", () => {
  it("keeps the CodeMirror seed stable while consuming delayed local model echoes", () => {
    const authority = new EditorDocumentAuthority();
    authority.beginSession("live:sheet-1");

    authority.recordLocalCommit("live:sheet-1", "较早输入");
    authority.recordLocalCommit("live:sheet-1", "较新输入");

    expect(authority.consumeLocalEcho("live:sheet-1", "较早输入")).toBe(true);
    expect(authority.consumeLocalEcho("live:sheet-1", "较新输入")).toBe(true);
    expect(authority.consumeLocalEcho("live:sheet-1", "外部替换")).toBe(false);
  });

  it("accepts a new seed only when the document session changes", () => {
    const authority = new EditorDocumentAuthority();
    authority.beginSession("live:sheet-1");
    authority.recordLocalCommit("live:sheet-1", "本地输入");

    authority.beginSession("version:sheet-1:v2");
    expect(authority.consumeLocalEcho("version:sheet-1:v2", "本地输入")).toBe(false);
  });

  it("does not misclassify an older echo after more than four local commits", () => {
    const authority = new EditorDocumentAuthority();
    authority.beginSession("live:sheet-1");

    for (let revision = 1; revision <= 8; revision += 1) {
      authority.recordLocalCommit("live:sheet-1", `本地输入 ${revision}`);
    }

    expect(authority.consumeLocalEcho("live:sheet-1", "本地输入 1")).toBe(true);
    expect(authority.consumeLocalEcho("live:sheet-1", "本地输入 8")).toBe(true);
  });
});
