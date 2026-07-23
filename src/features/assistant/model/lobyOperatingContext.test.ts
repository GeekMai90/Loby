import { describe, expect, it } from "vitest";
import { buildLobyOperatingContext } from "@/features/assistant/model/lobyOperatingContext";
import { buildProjectResourcePaths } from "@/features/library/model/projectModel";
import type { WritingProject, WritingSheet } from "@/shared/types";

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "第一篇",
  groupId: "group-main",
  status: "构思",
  targetWords: 1200,
  summary: "",
  body: "正文",
  updatedAt: "2026-07-09",
};

const project: WritingProject = {
  id: "project-1",
  title: "写作项目",
  description: "",
  status: "构思",
  targetPlatform: "公众号",
  targetWords: 1200,
  tags: [],
  groups: [{ id: "group-main", title: "正文" }],
  sheets: [sheet],
  updatedAt: "2026-07-09",
};

describe("lobyOperatingContext", () => {
  it("describes the active library, sheet, resources, and safe edit protocol", () => {
    const libraryPath = "/Users/example/LobyLibrary";
    const context = buildLobyOperatingContext({
      libraryPath,
      project,
      sheet,
      resourcePaths: buildProjectResourcePaths(libraryPath, project),
    });

    expect(context).toContain("你是本地优先写作软件落笔的 AI 助手");
    expect(context).toContain("/Users/example/LobyLibrary/projects/写作项目/正文/第一篇.md");
    expect(context).toContain("/Users/example/LobyLibrary/assets/images");
    expect(context).toContain("`![Alt text](../../../assets/images/name.png)`");
    expect(context).toContain("不要直接手写修改它们");
    expect(context).toContain("`proposedBody` 必须是完整当前稿件");
    expect(context).toContain("不要输出应用维护的 `id`、`status`、`targetProjectId`、`targetSheetId`、`result`、`error`、`effect`");
    expect(context).toContain("`insertImage.path` 只能使用相对路径或 http/https");
    expect(context).toContain("只回答、分析、建议、候选标题、图片提示词或预览：仅自然语言，不输出动作");
    expect(context).toContain("action payload 是成果唯一数据源");
    expect(context).toContain("只在用户要求插入图片时创建 `insertImage`");
    expect(context).toContain("用户指定段落或标题位置时必须使用 `anchor`");
    expect(context).toContain("“第 N 段”使用 `paragraphFromStart`");
    expect(context).toContain("“倒数第 N 段”使用 `paragraphFromEnd`");
    expect(context).toContain('"type": "paragraphFromStart"');
    expect(context).toContain('"text": "第三段开头文字"');
    expect(context).toContain("`saveExport.filename` 只能是文件名");
    expect(context).toContain("默认当前光标");
    expect(context).toContain("新增少量正文用 `insertText`");
    expect(context).toContain("改写已有正文用 `loby-change`");
    expect(context).toContain("新增图片引用用 `insertImage`");
    expect(context.length).toBeLessThan(2_600);
  });
});
