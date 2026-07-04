import type { ProjectResourceText } from "../types";
import { readProjectResourceText } from "./codex";

export async function loadSelectedResourceTexts(libraryPath: string, selectedResourcePaths: string[]): Promise<ProjectResourceText[]> {
  if (selectedResourcePaths.length === 0) return [];
  try {
    return await readProjectResourceText(libraryPath, selectedResourcePaths);
  } catch (error) {
    return [
      {
        path: "resource-read",
        name: "resource-read",
        status: `read-failed: ${error instanceof Error ? error.message : String(error)}`,
        content: "",
        sizeBytes: 0,
        truncated: false,
      },
    ];
  }
}
