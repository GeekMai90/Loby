/**
 * [INPUT]: 依赖 React 服务端渲染与 UnsplashPreparationView 的推荐/手动搜索阶段契约
 * [OUTPUT]: 验证准备态只呈现单一进度语义、手动搜索阶段文案与完整复用主界面 40px AI 入口后的等比放大
 * [POS]: media components 的静态结构回归测试，防止重复说明、步骤清单和 Orb 几何再次漂移
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnsplashPreparationView } from "@/features/media/components/UnsplashPreparationView";

describe("UnsplashPreparationView", () => {
  it("reuses and scales the complete assistant launcher while keeping one progress message", () => {
    const html = renderToStaticMarkup(<UnsplashPreparationView stage="analyzing" aiEnabled />);

    expect(html).toContain('class="assistant-launcher grid size-10 scale-125 place-items-center"');
    expect(html).toContain('class="assistant-launcher-glass"');
    expect(html).toContain('class="assistant-launcher-fluid"');
    expect(html).toContain("AI 正在为文章寻找合适的封面方向");
    expect(html).toContain("正在分析文章内容…");
    expect(html).not.toContain("AI 正在理解文章主题与适合的画面方向");
    expect(html).not.toContain("生成英文关键词");
    expect(html).not.toContain("搜索 Unsplash 图片");
  });

  it("uses dedicated translation and search stages for manual searches", () => {
    const translatingHtml = renderToStaticMarkup(<UnsplashPreparationView stage="translating" aiEnabled={false} variant="manual-search" />);
    const searchingHtml = renderToStaticMarkup(<UnsplashPreparationView stage="searching" aiEnabled={false} variant="manual-search" />);

    expect(translatingHtml).toContain("正在准备搜索结果");
    expect(translatingHtml).toContain("正在翻译搜索词…");
    expect(searchingHtml).toContain("正在为你寻找合适的图片");
    expect(searchingHtml).toContain("正在搜索 Unsplash…");
  });
});
