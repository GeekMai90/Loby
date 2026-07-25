import { describe, expect, it } from "vitest";
import { buildLobyOperatingContext } from "@/features/assistant/model/lobyOperatingContext";
import { buildProjectResourcePaths } from "@/features/library/model/projectModel";
import type { WritingProject, WritingSheet } from "@/shared/types";

const sheet: WritingSheet = {
  id: "sheet-1",
  title: "第一篇",
  groupId: "group-main",
  status: "构思",
  tags: [],
  targetWords: 1200,
  description: "",
  body: "正文",
  createdAt: "2026-07-09",
  updatedAt: "2026-07-09",
  properties: {},
};

const project: WritingProject = {
  id: "project-1",
  title: "写作项目",
  status: "构思",
  projectGoal: { enabled: false, unit: "words", target: 0 },
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

    expect(context).toContain("你正在落笔（Loby）本地优先 Markdown 写作软件中工作");
    expect(context).toContain("/Users/example/LobyLibrary/projects/写作项目/正文/第一篇.md");
    expect(context).toContain("/Users/example/LobyLibrary/assets/images");
    expect(context).toContain("`![Alt text](../../../assets/images/name.png)`");
    expect(context).toContain("不要直接手写修改它们");
    expect(context).toContain("`loby-change.proposedBody` 必须是修改后的完整当前稿件正文");
    expect(context).toContain("不要输出 `id`、`status`、`targetProjectId`、`targetSheetId`、`result`、`error` 或 `effect`");
    expect(context).toContain("`insertImage.path` 只能使用当前文稿指向写作文件夹图片目录的相对路径");
    expect(context).toContain("纯生成、分析、建议和预览不需要动作确认");
    expect(context).toContain("action payload 是待写入成果的唯一数据源");
    expect(context).toContain("只有用户要求把图片插入文稿时才使用 `insertImage` / `loby-insert-image`");
    expect(context).toContain('应使用 `target: "anchor"`');
    expect(context).toContain("必须使用 `paragraphFromStart`");
    expect(context).toContain('"type": "paragraphFromEnd"');
    expect(context).toContain('"type": "paragraphFromStart"');
    expect(context).toContain('"text": "第三段开头文字"');
    expect(context).toContain("`saveExport.filename` 只能是文件名");
    expect(context).toContain("默认当前光标");
    expect(context).toContain("新增少量正文、过渡句、提纲片段、开头、结尾或发布说明：用 `insertText`。");
    expect(context).toContain("改写或替换已有正文、调整大段结构、润色整篇：用 `loby-change`");
    expect(context).toContain("新增封面图、正文配图或任何图片引用：用 `insertImage`");
    expect(context).toContain("```loby-action");
    expect(context).toContain('"action": "insertText"');
    expect(context).toContain("```loby-create-sheet");
    expect(context).toContain("```loby-insert-image");
  });
});
