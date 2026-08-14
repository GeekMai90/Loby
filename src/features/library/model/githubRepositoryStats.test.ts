// @vitest-environment happy-dom

/**
 * [INPUT]: 依赖 Vitest 对全局 fetch 的模拟与 GitHub 仓库统计模型
 * [OUTPUT]: 验证公开仓库 Star 数解析、成功缓存与异常降级契约
 * [POS]: library 远端只读统计模型的边界回归测试
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("githubRepositoryStats", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads and caches the public repository Star count", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1234 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getGitHubStarCount } = await import("@/features/library/model/githubRepositoryStats");

    await expect(getGitHubStarCount()).resolves.toBe(1234);
    await expect(getGitHubStarCount()).resolves.toBe(1234);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/GeekMai90/Loby", {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
  });

  it("falls back to the public badge cache when the GitHub API is rate limited", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    fetchMock.mockResolvedValueOnce({ ok: false });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: "2" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getGitHubStarCount } = await import("@/features/library/model/githubRepositoryStats");

    await expect(getGitHubStarCount()).resolves.toBe(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://img.shields.io/github/stars/GeekMai90/Loby.json");
  });

  it("returns an empty value when both remote sources fail", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const { getGitHubStarCount } = await import("@/features/library/model/githubRepositoryStats");

    await expect(getGitHubStarCount()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
