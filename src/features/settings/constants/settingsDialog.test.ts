/**
 * [INPUT]: 依赖 Vitest 与设置分类常量
 * [OUTPUT]: 验证设置首项命名为“通用”且不再暴露“关于”分类
 * [POS]: settings constants 的导航信息架构回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { Settings2 } from "lucide-react";
import { SETTINGS_TABS } from "@/features/settings/constants/settingsDialog";

describe("SETTINGS_TABS", () => {
  it("starts with general settings and excludes the redundant about category", () => {
    expect(SETTINGS_TABS[0]).toMatchObject({ id: "appearance", label: "通用", Icon: Settings2 });
    expect(SETTINGS_TABS.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "appearance", label: "通用" },
      { id: "writing", label: "写作" },
      { id: "ai", label: "AI 助手" },
      { id: "publishing", label: "发布" },
      { id: "storage", label: "文件与存储" },
    ]);
  });
});
