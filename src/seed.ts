import type { WritingProject } from "./types";

export const seedProjects: WritingProject[] = [
  {
    id: "project-ai-writing-app",
    title: "AI 友好的专业写作软件",
    description: "落笔的产品构想、技术栈和界面规划。",
    status: "初稿",
    targetPlatform: "公众号 / 产品文档",
    targetWords: 4200,
    tags: ["产品", "写作软件", "AI Native"],
    updatedAt: "2026-07-03",
    sheets: [
      {
        id: "sheet-opening",
        title: "开篇：为什么不是 Obsidian 插件",
        type: "正文",
        status: "初稿",
        targetWords: 900,
        summary: "说明落笔的起点：不是给笔记软件补功能，而是重新围绕写作项目设计。",
        updatedAt: "2026-07-03",
        body: `# 为什么不是 Obsidian 插件

Obsidian 是很好的本地知识管理软件，但它的产品心智仍然是笔记。对专业写作来说，真正重要的不是多一个插件，而是整个工作流都围绕一篇作品的完成度展开。

落笔的目标是把写作项目、稿件卡片、AI 辅助、配图、排版和发布放在同一个本地优先的系统里。文件仍然保持 Markdown 开放格式，但界面不再是通用文件浏览器。`,
      },
      {
        id: "sheet-model",
        title: "稿件卡片模型",
        type: "章节",
        status: "构思",
        targetWords: 1100,
        summary: "定义 Library / Project / Sheet 三层模型。",
        updatedAt: "2026-07-03",
        body: `# 稿件卡片模型

落笔的核心对象不是 note，而是 sheet。它比段落更完整，比文章更灵活，可以独立写作、排序、组合、导出，也可以被 AI 作为清晰的上下文读取。

- Library 是本地写作库。
- Project 是一个作品项目。
- Sheet 是可组合的稿件卡片。`,
      },
      {
        id: "sheet-export",
        title: "组合发布流程",
        type: "发布版本",
        status: "待发布",
        targetWords: 800,
        summary: "把多张稿件卡片合并成一个可发布版本。",
        updatedAt: "2026-07-03",
        body: `# 组合发布

写作不止于写完。落笔应该允许用户选择几张稿件卡片，按顺序合并，预览最终稿，并导出为 Markdown、HTML 或平台特定格式。

第一版先支持 Markdown 和干净 HTML，后续再支持公众号 HTML、小红书拆条、长图和 PDF。`,
      },
      {
        id: "sheet-materials",
        title: "素材：竞品和灵感",
        type: "素材",
        status: "构思",
        targetWords: 500,
        summary: "记录 Ulysses、iA Writer、Bear、Obsidian/Claudian 等参考方向。",
        updatedAt: "2026-07-03",
        body: `# 素材：竞品和灵感

- Ulysses 的稿件卡片和项目组合思路值得参考。
- iA Writer 的 Markdown 可见但样式友好的编辑体验值得参考。
- Bear 的轻量样式和本地写作手感值得参考。
- Obsidian/Claudian 的右侧 AI 对话和本地 agent 能力值得迁移到落笔。`,
      },
    ],
  },
  {
    id: "project-sample-series",
    title: "示例：教程系列项目",
    description: "用于验证多篇文章组合、状态流转和导出顺序。",
    status: "构思",
    targetPlatform: "教程 / 网站",
    targetWords: 6000,
    tags: ["教程", "系列"],
    updatedAt: "2026-07-03",
    sheets: [
      {
        id: "sheet-series-1",
        title: "第一篇：安装与准备",
        type: "正文",
        status: "构思",
        targetWords: 1600,
        summary: "教程系列第一篇。",
        updatedAt: "2026-07-03",
        body: "# 第一篇：安装与准备\n\n这里写教程系列的第一篇。",
      },
    ],
  },
];
