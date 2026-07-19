import type { WritingProject } from "../types";
import type { SheetMoveTarget } from "./projectCreation";
import {
  getVisibleProjectGroups,
  INBOX_GROUP_ID,
  INBOX_PROJECT_ID,
  isInboxProject,
  isNotesProject,
  isStarterProject,
} from "./projectModel";

export interface SheetMoveSourceLocation {
  projectId: string;
  groupId?: string;
}

export interface SheetMoveGroupDestination extends SheetMoveTarget {
  id: string;
  title: string;
}

export interface SheetMoveProjectDestination {
  projectId: string;
  title: string;
  icon?: string;
  iconColor?: string;
  kind: "notes" | "project";
  groups: SheetMoveGroupDestination[];
}

export interface SheetMoveMenuModel {
  inbox: SheetMoveGroupDestination;
  notes?: SheetMoveProjectDestination;
  projects: SheetMoveProjectDestination[];
}

export function createSheetMoveMenuModel(projects: WritingProject[]): SheetMoveMenuModel {
  const notes = projects.find(isNotesProject);
  return {
    inbox: {
      id: `${INBOX_PROJECT_ID}:${INBOX_GROUP_ID}`,
      projectId: INBOX_PROJECT_ID,
      groupId: INBOX_GROUP_ID,
      title: "收件箱",
    },
    notes: notes ? createProjectDestination(notes, "notes") : undefined,
    projects: projects
      .filter((project) => !isInboxProject(project) && !isNotesProject(project) && !isStarterProject(project))
      .map((project) => createProjectDestination(project, "project")),
  };
}

export function isCurrentSheetMoveTarget(sources: SheetMoveSourceLocation[], target: SheetMoveTarget): boolean {
  return (
    sources.length > 0 &&
    sources.every((source) => source.projectId === target.projectId && (source.groupId ?? "") === (target.groupId ?? ""))
  );
}

function createProjectDestination(project: WritingProject, kind: SheetMoveProjectDestination["kind"]): SheetMoveProjectDestination {
  return {
    projectId: project.id,
    title: kind === "notes" ? "笔记" : project.title,
    icon: project.icon,
    iconColor: project.iconColor,
    kind,
    groups: getVisibleProjectGroups(project).map((group) => ({
      id: `${project.id}:${group.id}`,
      projectId: project.id,
      groupId: group.id,
      title: group.title,
    })),
  };
}
