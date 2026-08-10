/**
 * [INPUT]: 依赖 Vitest、Agent 对话消息契约与本地目录路径提取器
 * [OUTPUT]: 验证 macOS/Linux、Windows 盘符、UNC 与用户目录写法都能被提取为本地目录候选
 * [POS]: assistant/model 的本地参考路径回归边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { describe, expect, it } from "vitest";
import { extractExplicitLocalDirectoryPaths } from "@/features/assistant/model/localReferencePaths";

describe("localReferencePaths", () => {
  it("extracts Windows user-directory paths with both separators", () => {
    expect(extractExplicitLocalDirectoryPaths("请读取 C:\\Users\\Mai\\Loby 和 ~\\Documents\\参考资料")).toEqual([
      "C:\\Users\\Mai\\Loby",
      "~\\Documents\\参考资料",
    ]);
  });

  it("keeps UNC paths as explicit local directory candidates", () => {
    expect(extractExplicitLocalDirectoryPaths("请读取 \\\\server\\share\\Loby")).toEqual(["\\\\server\\share\\Loby"]);
  });
});
