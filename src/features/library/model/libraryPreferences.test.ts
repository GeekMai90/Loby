/**
 * [INPUT]: 依赖 Vitest、设备级 agent 设置与写作库便携偏好模型
 * [OUTPUT]: 验证写作库偏好快照排除设备字段与已退役图片格式字段，并规范化异常数据
 * [POS]: library/model 的便携偏好回归测试，保护写作库与设备设置之间的持久化边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { defaultAgentSettings } from "@/features/assistant/model/agentSettings";
import { libraryPreferencesFromAgentSettings, normalizeLibraryPreferences } from "@/features/library/model/libraryPreferences";

describe("library preferences", () => {
  it("creates a portable snapshot without device-specific settings", () => {
    const settings = {
      ...defaultAgentSettings(),
      libraryPath: "/tmp/library",
      sheetPreviewMode: true,
    };
    const preferences = libraryPreferencesFromAgentSettings(settings, { lastProjectId: "project-1", lastSheetId: "sheet-1" });

    expect(preferences.lastProjectId).toBe("project-1");
    expect(preferences.lastSheetId).toBe("sheet-1");
    expect(preferences.sheetPreviewMode).toBe(true);
    expect(preferences).not.toHaveProperty("libraryPath");
    expect(preferences).not.toHaveProperty("inspectorWidth");
    expect(preferences).not.toHaveProperty("imageReferenceFormat");
  });

  it("normalizes malformed portable state against the local fallback", () => {
    const fallback = libraryPreferencesFromAgentSettings(defaultAgentSettings());
    const normalized = normalizeLibraryPreferences(
      {
        version: 1,
        lastProjectId: "project-2",
        goalCelebrationEnabled: false,
        appTheme: "invalid",
        editorTypography: { bodyFontSize: 200 },
        activeGroupIdsByProject: { "project-2": "group-2", unsafe: 10 },
        sheetSortPreferences: { "project-2": { mode: "title", direction: "asc" } },
        sheetManualOrders: { "project-2": ["sheet-2", "sheet-2", 10] },
      },
      fallback,
    );

    expect(normalized.lastProjectId).toBe("project-2");
    expect(normalized.goalCelebrationEnabled).toBe(false);
    expect(normalized.appTheme).toBe("system");
    expect(normalized.editorTypography.bodyFontSize).toBe(28);
    expect(normalized.activeGroupIdsByProject).toEqual({ "project-2": "group-2" });
    expect(normalized.sheetSortPreferences).toEqual({ "project-2": { mode: "title", direction: "asc" } });
    expect(normalized.sheetManualOrders).toEqual({ "project-2": ["sheet-2"] });
  });
});
