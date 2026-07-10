import { ProjectInfoSection, SheetInfoSection, WritingBriefSection } from "./InfoPanelFormSections";
import {
  ProjectProgressSection,
  SheetOutlineSection,
  SheetProgressSection,
  SheetStatsSection,
  WritingSessionSection,
} from "./InfoPanelStatsSections";
import { getSheetHeadings } from "../lib/markdownOutline";
import { getNextProjectStatus, getWritingBrief } from "../lib/projectModel";
import { countWords, sheetStats } from "../lib/text";
import type { ProjectStatus, ProjectWritingBrief, WritingProject, WritingSheet } from "../types";

interface InfoPanelProps {
  activeProject: WritingProject;
  activeSheet: WritingSheet;
  sessionStartWords: number;
  updateProject: (updater: (project: WritingProject) => WritingProject) => void;
  updateSheet: (updater: (sheet: WritingSheet) => WritingSheet) => void;
  onResetWritingSession: () => void;
  onJumpToHeading: (line: number) => void;
  getCurrentDate: () => string;
}

export function InfoPanel({
  activeProject,
  activeSheet,
  sessionStartWords,
  updateProject,
  updateSheet,
  onResetWritingSession,
  onJumpToHeading,
  getCurrentDate,
}: InfoPanelProps) {
  const tagText = activeProject.tags.join(", ");
  const writingBrief = getWritingBrief(activeProject);
  const headings = getSheetHeadings(activeSheet.body);
  const stats = sheetStats(activeSheet);
  const nextProjectStatus = getNextProjectStatus(activeProject.status);
  const nextSheetStatus = getNextProjectStatus(activeSheet.status);
  const currentWords = countWords(activeSheet.body);
  const sessionDelta = currentWords - sessionStartWords;
  const wordsRemaining = Math.max(0, activeSheet.targetWords - currentWords);

  function setProjectWorkflowStatus(status: ProjectStatus) {
    updateProject((project) => ({
      ...project,
      status,
      updatedAt: getCurrentDate(),
      sheets: project.sheets.map((sheet) => {
        if (sheet.type === "素材") return sheet;
        if (
          status === "待发布" ||
          status === "已发布" ||
          status === "已归档" ||
          (status === "修改中" && (sheet.status === "已发布" || sheet.status === "已归档"))
        ) {
          return { ...sheet, status, updatedAt: getCurrentDate() };
        }
        return sheet;
      }),
    }));
  }

  function setSheetWorkflowStatus(status: ProjectStatus) {
    updateSheet((sheet) => ({
      ...sheet,
      status,
      updatedAt: getCurrentDate(),
    }));
  }

  function updateWritingBrief(field: keyof ProjectWritingBrief, value: string) {
    updateProject((project) => ({
      ...project,
      writingBrief: {
        ...getWritingBrief(project),
        [field]: value,
      },
      updatedAt: getCurrentDate(),
    }));
  }

  return (
    <div className="panel-stack">
      <ProjectInfoSection
        activeProject={activeProject}
        tagText={tagText}
        nextProjectStatus={nextProjectStatus}
        updateProject={updateProject}
        getCurrentDate={getCurrentDate}
        onSetProjectWorkflowStatus={setProjectWorkflowStatus}
      />
      <WritingBriefSection writingBrief={writingBrief} onUpdateWritingBrief={updateWritingBrief} />
      <SheetInfoSection
        activeSheet={activeSheet}
        nextSheetStatus={nextSheetStatus}
        updateSheet={updateSheet}
        getCurrentDate={getCurrentDate}
        onSetSheetWorkflowStatus={setSheetWorkflowStatus}
      />
      <ProjectProgressSection activeProject={activeProject} />
      <SheetProgressSection activeSheet={activeSheet} currentWords={currentWords} wordsRemaining={wordsRemaining} />
      <WritingSessionSection
        sessionStartWords={sessionStartWords}
        sessionDelta={sessionDelta}
        currentWords={currentWords}
        wordsRemaining={wordsRemaining}
        onResetWritingSession={onResetWritingSession}
      />
      <SheetStatsSection stats={stats} />
      <SheetOutlineSection headings={headings} onJumpToHeading={onJumpToHeading} />
    </div>
  );
}
