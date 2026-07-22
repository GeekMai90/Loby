import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSISTANT_PRESENTATION_PREFERENCE,
  normalizeAssistantPresentationPreference,
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
  it("docks automatically when the editor keeps enough writing space", () => {
    expect(resolveAssistantPresentation({ preference: "auto", ...spaciousWindow })).toBe("docked");
  });

  it("floats automatically in a narrower window instead of squeezing the editor", () => {
    expect(resolveAssistantPresentation({ preference: "auto", ...spaciousWindow, viewportWidth: 1280 })).toBe("floating");
  });

  it("accounts for collapsed navigation when resolving the automatic mode", () => {
    expect(
      resolveAssistantPresentation({
        preference: "auto",
        ...spaciousWindow,
        viewportWidth: 1200,
        libraryRailOpen: false,
        sheetRailOpen: false,
      }),
    ).toBe("docked");
  });

  it("lets a manual switch override every default preference", () => {
    expect(resolveAssistantPresentation({ preference: "docked", manualOverride: "floating", ...spaciousWindow })).toBe("floating");
    expect(resolveAssistantPresentation({ preference: "floating", manualOverride: "docked", ...spaciousWindow })).toBe("docked");
  });

  it("normalizes unknown persisted preferences to automatic", () => {
    expect(DEFAULT_ASSISTANT_PRESENTATION_PREFERENCE).toBe("auto");
    expect(normalizeAssistantPresentationPreference("floating")).toBe("floating");
    expect(normalizeAssistantPresentationPreference("docked")).toBe("docked");
    expect(normalizeAssistantPresentationPreference("unknown")).toBe("auto");
  });
});
