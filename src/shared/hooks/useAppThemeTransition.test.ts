// @vitest-environment happy-dom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { AppThemePreference } from "@/shared/types";
import { resolveCurrentAppTheme } from "@/shared/lib/themes";
import { useAppTheme } from "@/shared/hooks/useAppTheme";
import { APP_THEME_TRANSITION_DURATION_MS, useAppThemeTransition } from "@/shared/hooks/useAppThemeTransition";

interface ThemeHarnessProps {
  initialTheme: AppThemePreference;
  nextTheme: AppThemePreference;
  prefersReducedMotion?: boolean;
}

function ThemeHarness({ initialTheme, nextTheme, prefersReducedMotion = false }: ThemeHarnessProps) {
  const [theme, setTheme] = useState(initialTheme);
  const resolvedTheme = useAppTheme(theme);
  const runThemeTransition = useAppThemeTransition({
    resolvedTheme,
    prefersReducedMotion,
  });

  return createElement(
    "button",
    {
      type: "button",
      "data-preference": theme,
      "data-resolved": resolvedTheme,
      onClick: () => runThemeTransition(resolveCurrentAppTheme(nextTheme), () => setTheme(nextTheme)),
    },
    "切换主题",
  );
}

describe("useAppThemeTransition", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalStartViewTransition: PropertyDescriptor | undefined;
  let originalRootAnimate: PropertyDescriptor | undefined;
  let originalMatchMedia: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    originalStartViewTransition = Object.getOwnPropertyDescriptor(document, "startViewTransition");
    originalRootAnimate = Object.getOwnPropertyDescriptor(document.documentElement, "animate");
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    restoreProperty(document, "startViewTransition", originalStartViewTransition);
    restoreProperty(document.documentElement, "animate", originalRootAnimate);
    restoreProperty(window, "matchMedia", originalMatchMedia);
    delete document.documentElement.dataset.appTheme;
    document.documentElement.style.removeProperty("color-scheme");
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reveals the new theme from left to right with the root view transition", async () => {
    installMatchMedia(false);
    const { animate, startViewTransition } = installViewTransition();
    await renderHarness({ initialTheme: "light", nextTheme: "dark" });

    expect(document.documentElement.dataset.appTheme).toBe("light");
    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());
    await act(async () => Promise.resolve());

    expect(startViewTransition).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.appTheme).toBe("dark");
    expect(animate).toHaveBeenCalledWith(
      { clipPath: ["inset(0 100% 0 0)", "inset(0 0 0 0)"] },
      {
        duration: APP_THEME_TRANSITION_DURATION_MS,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });

  it("switches immediately when reduced motion is enabled", async () => {
    installMatchMedia(false);
    const { animate, startViewTransition } = installViewTransition();
    await renderHarness({ initialTheme: "light", nextTheme: "dark", prefersReducedMotion: true });

    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.appTheme).toBe("dark");
  });

  it("does not animate when the preference changes but the resolved theme stays the same", async () => {
    installMatchMedia(true);
    const { startViewTransition } = installViewTransition();
    await renderHarness({ initialTheme: "dark", nextTheme: "system" });

    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());

    const button = container.querySelector<HTMLButtonElement>("button")!;
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(button.dataset.preference).toBe("system");
    expect(button.dataset.resolved).toBe("dark");
  });

  it("falls back to an immediate switch when view transitions are unavailable", async () => {
    installMatchMedia(false);
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
    await renderHarness({ initialTheme: "light", nextTheme: "dark" });

    await act(async () => container.querySelector<HTMLButtonElement>("button")!.click());

    expect(document.documentElement.dataset.appTheme).toBe("dark");
  });

  async function renderHarness(props: ThemeHarnessProps) {
    await act(async () => root.render(createElement(ThemeHarness, props)));
  }
});

function installMatchMedia(matches: boolean) {
  const matchMedia = vi.fn().mockImplementation(
    (query: string): MediaQueryList =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
}

function installViewTransition(): { animate: Mock; startViewTransition: Mock } {
  const animate = vi.fn().mockReturnValue({ finished: Promise.resolve() });
  const startViewTransition = vi.fn().mockImplementation((update: () => void) => {
    update();
    return {
      ready: Promise.resolve(),
      finished: new Promise<void>(() => undefined),
      updateCallbackDone: Promise.resolve(),
      skipTransition: vi.fn(),
    } as unknown as ViewTransition;
  });
  Object.defineProperty(document.documentElement, "animate", { configurable: true, value: animate });
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: startViewTransition });
  return { animate, startViewTransition };
}

function restoreProperty(target: object, property: PropertyKey, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(target, property, descriptor);
  else Reflect.deleteProperty(target, property);
}
