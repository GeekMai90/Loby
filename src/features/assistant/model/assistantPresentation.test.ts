/**
 * [INPUT]: 依赖 Vitest 与 assistantPresentation 展示策略
 * [OUTPUT]: 验证默认固定侧边、空间不足降级、未固定小窗、单次覆盖与旧设置迁移
 * [POS]: AI 助手展示形态的纯模型回归测试，保护持久默认和临时切换的职责分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSISTANT_DOCKED_BY_DEFAULT,
  normalizeAssistantDockedByDefault,
  resolveAssistantPresentation,
} from "@/features/assistant/model/assistantPresentation";

const spaciousWindow = {
  viewportWidth: 1512,
  libraryRailOpen: true,
  sheetRailOpen: true,
  sheetRailWidth: 240,
  inspectorWidth: 400,
} as const;

describe("assistant presentation", () => {
  it("docks by default when the editor keeps enough writing space", () => {
    expect(DEFAULT_ASSISTANT_DOCKED_BY_DEFAULT).toBe(true);
    expect(resolveAssistantPresentation({ dockedByDefault: true, ...spaciousWindow })).toBe("docked");
  });

  it("falls back to floating when a pinned sidebar would squeeze the editor", () => {
    expect(resolveAssistantPresentation({ dockedByDefault: true, ...spaciousWindow, viewportWidth: 1280 })).toBe("floating");
  });

  it("always opens floating when the sidebar preference is unchecked", () => {
    expect(resolveAssistantPresentation({ dockedByDefault: false, ...spaciousWindow })).toBe("floating");
    expect(
      resolveAssistantPresentation({
        dockedByDefault: false,
        ...spaciousWindow,
        libraryRailOpen: false,
        sheetRailOpen: false,
      }),
    ).toBe("floating");
  });

  it("lets the current-open manual switch override either persisted default", () => {
    expect(resolveAssistantPresentation({ dockedByDefault: true, manualOverride: "floating", ...spaciousWindow })).toBe("floating");
    expect(resolveAssistantPresentation({ dockedByDefault: false, manualOverride: "docked", ...spaciousWindow })).toBe("docked");
  });

  it("migrates only the former explicit floating preference to unchecked", () => {
    expect(normalizeAssistantDockedByDefault(true, "floating")).toBe(true);
    expect(normalizeAssistantDockedByDefault(false, "docked")).toBe(false);
    expect(normalizeAssistantDockedByDefault(undefined, "floating")).toBe(false);
    expect(normalizeAssistantDockedByDefault(undefined, "auto")).toBe(true);
    expect(normalizeAssistantDockedByDefault(undefined, "docked")).toBe(true);
    expect(normalizeAssistantDockedByDefault(undefined, "unknown")).toBe(true);
  });
});
