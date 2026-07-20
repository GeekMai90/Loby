import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Clock3, ImageIcon, Info, List, Search } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { FunctionSegmentedTabs, type FunctionSegmentedTab } from "./FunctionSegmentedTabs";

type Tab = "outline" | "information" | "media" | "search" | "history";

const tabs: Array<FunctionSegmentedTab<Tab>> = [
  { value: "outline", label: "目录", icon: List },
  { value: "information", label: "信息", icon: Info },
  { value: "media", label: "媒体", icon: ImageIcon },
  { value: "search", label: "查找替换", icon: Search },
  { value: "history", label: "历史版本", icon: Clock3 },
];

describe("FunctionSegmentedTabs", () => {
  it("positions the active indicator independently from the icon grid", () => {
    const html = renderToStaticMarkup(
      createElement(FunctionSegmentedTabs<Tab>, {
        value: "information",
        tabs,
        ariaLabel: "文稿功能",
        onValueChange: vi.fn(),
      }),
    );

    expect(html).toContain("--function-segment-left:calc(20% + 2.2px)");
    expect(html).toContain("--function-segment-width:calc(20% - 2.8px)");
    expect(html).not.toContain("--function-segment-offset");
  });
});
