// @vitest-environment happy-dom

import { act, createElement, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppThemePreference, ResolvedAppTheme } from "@/shared/types";
import { useAppTheme } from "@/shared/hooks/useAppTheme";

interface ThemeHarnessProps {
  preference: AppThemePreference;
  initialOverride: ResolvedAppTheme | null;
}

function ThemeHarness({ preference, initialOverride }: ThemeHarnessProps) {
  const [override, setOverride] = useState(initialOverride);
  const handleSystemThemeChange = useCallback(() => {
    if (preference === "system") setOverride(null);
  }, [preference]);
  const resolvedTheme = useAppTheme(preference, {
    override,
    onSystemThemeChange: handleSystemThemeChange,
  });

  return createElement("output", {
    "data-override": override ?? "",
    "data-resolved": resolvedTheme,
  });
}

describe("useAppTheme", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMatchMedia: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    if (originalMatchMedia) Object.defineProperty(window, "matchMedia", originalMatchMedia);
    else Reflect.deleteProperty(window, "matchMedia");
    delete document.documentElement.dataset.appTheme;
    document.documentElement.style.removeProperty("color-scheme");
    container.remove();
    vi.unstubAllGlobals();
  });

  it("clears a temporary override on the next system change when following the system", async () => {
    const media = installMutableMatchMedia(true);
    await act(async () => root.render(createElement(ThemeHarness, { preference: "system", initialOverride: "light" })));

    expect(readThemeState()).toEqual({ override: "light", resolved: "light" });
    await media.emitChange(false);
    expect(readThemeState()).toEqual({ override: "", resolved: "light" });
    await media.emitChange(true);
    expect(readThemeState()).toEqual({ override: "", resolved: "dark" });
  });

  it("keeps a temporary override across system changes for a fixed preference", async () => {
    const media = installMutableMatchMedia(false);
    await act(async () => root.render(createElement(ThemeHarness, { preference: "dark", initialOverride: "light" })));

    await media.emitChange(true);
    expect(readThemeState()).toEqual({ override: "light", resolved: "light" });
  });

  function readThemeState() {
    const output = container.querySelector<HTMLOutputElement>("output")!;
    return { override: output.dataset.override, resolved: output.dataset.resolved };
  }
});

function installMutableMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => media) });

  return {
    emitChange: async (nextMatches: boolean) => {
      matches = nextMatches;
      await act(async () => {
        const event = { matches: nextMatches, media: media.media } as MediaQueryListEvent;
        listeners.forEach((listener) => listener(event));
      });
    },
  };
}
