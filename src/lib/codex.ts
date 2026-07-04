import { invoke } from "@tauri-apps/api/core";
import type { CodexProbeResult, CodexSkill, ProjectResourceFile, ProjectResourceText, WritingProject, WritingSheet } from "../types";
import { buildProjectResourcePaths, buildSheetMarkdownPath } from "./projectModel";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function listCodexSkills(): Promise<CodexSkill[]> {
  if (!isTauriRuntime()) {
    return [
      {
        id: "local-prototype",
        name: "local-prototype",
        description: "Browser fallback skill placeholder",
        path: "browser",
      },
    ];
  }

  return invoke<CodexSkill[]>("list_codex_skills");
}

export async function listProjectResources(libraryPath: string, project: WritingProject): Promise<ProjectResourceFile[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/")) {
    return [];
  }

  return invoke<ProjectResourceFile[]>("list_project_resources", {
    path: libraryPath,
    projectId: project.id,
    projectTitle: project.title,
  });
}

export async function readProjectResourceText(libraryPath: string, resourcePaths: string[]): Promise<ProjectResourceText[]> {
  if (!isTauriRuntime() || !libraryPath.startsWith("/") || resourcePaths.length === 0) {
    return [];
  }

  return invoke<ProjectResourceText[]>("read_project_resource_text", {
    path: libraryPath,
    resourcePaths,
  });
}

export async function writeSkillTask({
  libraryPath,
  skill,
  project,
  sheet,
  selectedText,
  action,
  selectedContextSheetIds,
  resourcePaths,
}: {
  libraryPath: string;
  skill: CodexSkill;
  project: WritingProject;
  sheet: WritingSheet;
  selectedText: string;
  action: string;
  selectedContextSheetIds: string[];
  resourcePaths: string[];
}): Promise<string> {
  if (!isTauriRuntime()) {
    return "Browser fallback: skill task was not written to disk.";
  }

  const projectPath = buildProjectResourcePaths(libraryPath, project)?.project ?? `${libraryPath}/projects/${project.id}`;

  return invoke<string>("write_skill_task", {
    path: libraryPath,
    task: {
      action,
      skillId: skill.id,
      skillName: skill.name,
      projectId: project.id,
      projectTitle: project.title,
      projectPath,
      targetPlatform: project.targetPlatform,
      sheetId: sheet.id,
      sheetTitle: sheet.title,
      sheetPath: buildSheetMarkdownPath(libraryPath, project, sheet),
      selectedContextSheetIds,
      resourcePaths,
      selectedText,
      body: sheet.body,
    },
  });
}

export async function runCodexChat({
  libraryPath,
  prompt,
  context,
  planMode,
  codexCliPath,
}: {
  libraryPath: string;
  prompt: string;
  context: string;
  planMode: boolean;
  codexCliPath?: string;
}): Promise<{ output: string; error: string; command: string }> {
  if (!isTauriRuntime()) {
    return {
      output:
        "浏览器开发模式不能直接调用 Codex CLI。请用 `npm run dev` 启动 Tauri 桌面应用后再发送消息。",
      error: "",
      command: "browser-fallback",
    };
  }

  return invoke<{ output: string; error: string; command: string }>("run_codex_chat", {
    path: libraryPath,
    prompt,
    context,
    planMode,
    codexCliPath: codexCliPath?.trim() || null,
  });
}

export async function probeCodexCli(codexCliPath?: string): Promise<CodexProbeResult> {
  if (!isTauriRuntime()) {
    return {
      resolvedPath: "",
      ok: false,
      steps: [
        {
          name: "browser",
          ok: false,
          command: "probeCodexCli",
          stdout: "",
          stderr: "浏览器开发模式不能探测 Codex CLI。请用 `npm run dev` 启动 Tauri 桌面应用。",
        },
      ],
    };
  }

  return invoke<CodexProbeResult>("probe_codex_cli", {
    codexCliPath: codexCliPath?.trim() || null,
  });
}
