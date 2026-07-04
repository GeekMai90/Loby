import type { ImportedMarkdownFile, WritingSheet } from "../types";
import { DEFAULT_USER_GROUP_ID } from "./projectModel";
import { countWords } from "./text";
import { today } from "./dates";

export function deriveImportedSheetTitle(filename: string, body: string): string {
  const withoutFrontmatter = body.replace(/^---\n[\s\S]*?\n---\n+/, "");
  const heading = withoutFrontmatter.match(/^#\s+(.+)$/m)?.[1]?.replace(/\s+#+$/, "").trim();
  if (heading) return heading;
  const basename = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return basename || "导入稿件";
}

export function buildImportedMarkdownSheets(files: ImportedMarkdownFile[], groupId = DEFAULT_USER_GROUP_ID): WritingSheet[] {
  const timestamp = Date.now();
  return files.map((file, index) => {
    const body = file.content.trimStart();
    const title = deriveImportedSheetTitle(file.name, body);
    return {
      id: `sheet-import-${timestamp}-${index}`,
      title,
      groupId,
      type: "正文",
      status: "构思",
      targetWords: Math.max(800, countWords(body)),
      summary: `从 ${file.name} 导入。`,
      body: body || `# ${title}\n\n`,
      updatedAt: today(),
    };
  });
}
