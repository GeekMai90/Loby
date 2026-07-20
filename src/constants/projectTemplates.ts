import type { ProjectPropertyDefinition, ProjectStatus } from "../types";

export interface ProjectTemplateSheet {
  title: string;
  groupId?: string;
  status: ProjectStatus;
  targetWords: number;
  summary: string;
  body: string;
}

export interface ProjectTemplate {
  id: string;
  title: string;
  description: string;
  projectDescription: string;
  targetPlatform: string;
  targetWords: number;
  tags: string[];
  propertyDefinitions: ProjectPropertyDefinition[];
  sheets: ProjectTemplateSheet[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    title: "空白写作项目",
    description: "从一张正文卡片开始。",
    projectDescription: "从一个清晰的写作目标开始。",
    targetPlatform: "未指定",
    targetWords: 3000,
    tags: ["草稿"],
    propertyDefinitions: [],
    sheets: [
      {
        title: "第一张稿件卡片",
        status: "构思",
        targetWords: 1200,
        summary: "记录这张卡片要完成的内容。",
        body: "# 第一张稿件卡片\n\n从这里开始写。",
      },
    ],
  },
  {
    id: "wechat-longform",
    title: "公众号长文",
    description: "观点、案例、收束和发布版本。",
    projectDescription: "围绕一个明确观点写成可发布的公众号长文。",
    targetPlatform: "公众号",
    targetWords: 3600,
    tags: ["公众号", "长文"],
    propertyDefinitions: [],
    sheets: [
      {
        title: "开篇：问题和钩子",
        status: "构思",
        targetWords: 700,
        summary: "用具体场景引出文章问题。",
        body: "# 开篇：问题和钩子\n\n先写一个真实场景，再提出这篇文章要解决的问题。",
      },
      {
        title: "核心论点",
        status: "构思",
        targetWords: 1400,
        summary: "展开最重要的判断和理由。",
        body: "# 核心论点\n\n## 不是表层原因\n\n\n## 真正关键的是\n\n",
      },
      {
        title: "素材：案例与金句",
        status: "构思",
        targetWords: 600,
        summary: "记录案例、引用、数据和配图方向。",
        body: "# 素材：案例与金句\n\n- 案例：\n- 引用：\n- 数据：\n- 配图方向：\n",
      },
      {
        title: "结尾与发布版",
        status: "构思",
        targetWords: 900,
        summary: "收束观点，并准备最终发布稿。",
        body: "# 结尾与发布版\n\n用一句更清楚的话收束全文，并给读者留下可执行的判断。",
      },
    ],
  },
  {
    id: "series",
    title: "系列文章",
    description: "总纲、多篇正文和素材库。",
    projectDescription: "为一个主题规划多篇文章，分阶段写作和发布。",
    targetPlatform: "公众号 / 网站",
    targetWords: 8000,
    tags: ["系列", "选题"],
    propertyDefinitions: [],
    sheets: [
      {
        title: "系列总纲",
        status: "构思",
        targetWords: 800,
        summary: "定义系列目标、读者和每篇文章边界。",
        body: "# 系列总纲\n\n- 系列目标：\n- 目标读者：\n- 文章清单：\n  - 第一篇：\n  - 第二篇：\n  - 第三篇：\n",
      },
      {
        title: "第一篇：建立问题",
        status: "构思",
        targetWords: 1800,
        summary: "系列第一篇，用来建立问题和背景。",
        body: "# 第一篇：建立问题\n\n",
      },
      {
        title: "第二篇：方法和路径",
        status: "构思",
        targetWords: 1800,
        summary: "系列第二篇，展开方法或解决路径。",
        body: "# 第二篇：方法和路径\n\n",
      },
      {
        title: "素材库",
        status: "构思",
        targetWords: 1000,
        summary: "集中记录系列素材、参考链接和待验证事实。",
        body: "# 素材库\n\n- 参考链接：\n- 可用案例：\n- 待验证事实：\n",
      },
    ],
  },
  {
    id: "tutorial",
    title: "教程 / 指南",
    description: "目标读者、步骤、FAQ 和发布稿。",
    projectDescription: "把一个操作流程写成清晰、可执行的教程或指南。",
    targetPlatform: "教程 / 网站",
    targetWords: 5000,
    tags: ["教程", "指南"],
    propertyDefinitions: [],
    sheets: [
      {
        title: "读者与准备",
        status: "构思",
        targetWords: 600,
        summary: "说明适合谁、需要准备什么、完成后得到什么。",
        body: "# 读者与准备\n\n- 适合谁：\n- 前置条件：\n- 完成结果：\n",
      },
      {
        title: "步骤一：搭建基础环境",
        status: "构思",
        targetWords: 1300,
        summary: "教程第一步。",
        body: "# 步骤一：搭建基础环境\n\n",
      },
      {
        title: "步骤二：完成核心操作",
        status: "构思",
        targetWords: 1600,
        summary: "教程核心步骤。",
        body: "# 步骤二：完成核心操作\n\n",
      },
      {
        title: "常见问题",
        status: "构思",
        targetWords: 900,
        summary: "补充常见错误和处理办法。",
        body: "# 常见问题\n\n## 问题一\n\n\n## 问题二\n\n",
      },
    ],
  },
  {
    id: "visual-article",
    title: "图文稿",
    description: "正文、封面、正文配图和发布检查。",
    projectDescription: "为需要配图、封面和平台排版的图文内容建立项目。",
    targetPlatform: "公众号 / 小红书",
    targetWords: 3000,
    tags: ["图文", "配图"],
    propertyDefinitions: [],
    sheets: [
      {
        title: "正文主稿",
        status: "构思",
        targetWords: 1800,
        summary: "文章主体内容。",
        body: "# 正文主稿\n\n",
      },
      {
        title: "封面方向",
        status: "构思",
        targetWords: 400,
        summary: "封面图视觉方向和生图提示词。",
        body: "# 封面方向\n\n- 主题：\n- 风格：白色、干净、Apple 风格、专业写作感\n- 画面元素：\n- 避免：深色仪表盘、杂乱科技感、过度装饰\n",
      },
      {
        title: "正文配图清单",
        status: "构思",
        targetWords: 500,
        summary: "记录正文中需要插图的位置。",
        body: "# 正文配图清单\n\n- 开头后：\n- 结构转折处：\n- 结尾前：\n",
      },
      {
        title: "发布检查",
        status: "构思",
        targetWords: 300,
        summary: "发布前检查标题、封面、摘要和平台格式。",
        body: "# 发布检查\n\n- [ ] 标题\n- [ ] 封面\n- [ ] 摘要\n- [ ] 正文配图\n- [ ] 平台格式\n",
      },
    ],
  },
];
