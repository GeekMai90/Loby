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
