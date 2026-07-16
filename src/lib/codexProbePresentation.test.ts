import { describe, expect, it } from "vitest";
import { formatCodexProbePresentation } from "./codexProbePresentation";

describe("Codex CLI probe presentation", () => {
  it("explains ChatGPT bundled CLI paths", () => {
    expect(formatCodexProbePresentation({ ok: true, resolvedPath: "/Applications/ChatGPT.app/Contents/Resources/codex" })).toEqual({
      status: "已连接",
      detail: "ChatGPT 应用内置 CLI · /Applications/ChatGPT.app/Contents/Resources/codex",
    });
  });

  it("shows ordinary PATH-resolved CLIs without an app label", () => {
    expect(formatCodexProbePresentation({ ok: true, resolvedPath: "/opt/homebrew/bin/codex" })).toEqual({
      status: "已连接",
      detail: "Codex CLI · /opt/homebrew/bin/codex",
    });
  });

  it("distinguishes an unresolved failure from an untested state", () => {
    expect(formatCodexProbePresentation(null).status).toBe("尚未检测");
    expect(formatCodexProbePresentation({ ok: false, resolvedPath: "" }).status).toBe("检测失败");
  });
});
