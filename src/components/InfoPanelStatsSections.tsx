import { ProgressBar } from "./ProgressBar";
import { projectProgress, projectWordCount, sheetProgress } from "../lib/text";
import type { SheetHeading } from "../lib/markdownOutline";
import type { WritingProject, WritingSheet } from "../types";

export function ProjectProgressSection({ activeProject }: { activeProject: WritingProject }) {
  return (
    <section className="panel-section">
      <h2>项目进度</h2>
      <div className="metric-row">
        <span>项目总字数</span>
        <strong>{projectWordCount(activeProject)}</strong>
      </div>
      <div className="metric-row">
        <span>项目完成度</span>
        <strong>{projectProgress(activeProject)}%</strong>
      </div>
      <div className="metric-row">
        <span>稿件卡片</span>
        <strong>{activeProject.sheets.length}</strong>
      </div>
      <ProgressBar value={projectProgress(activeProject)} />
    </section>
  );
}

export function SheetProgressSection({
  activeSheet,
  currentWords,
  wordsRemaining,
}: {
  activeSheet: WritingSheet;
  currentWords: number;
  wordsRemaining: number;
}) {
  return (
    <section className="panel-section">
      <h2>当前稿件进度</h2>
      <div className="metric-row">
        <span>当前字数</span>
        <strong>{currentWords}</strong>
      </div>
      <div className="metric-row">
        <span>完成度</span>
        <strong>{sheetProgress(activeSheet)}%</strong>
      </div>
      <div className="metric-row">
        <span>距目标</span>
        <strong>{wordsRemaining === 0 ? "已达成" : `${wordsRemaining} 字`}</strong>
      </div>
      <ProgressBar value={sheetProgress(activeSheet)} />
    </section>
  );
}

export function WritingSessionSection({
  sessionStartWords,
  sessionDelta,
  currentWords,
  wordsRemaining,
  onResetWritingSession,
}: {
  sessionStartWords: number;
  sessionDelta: number;
  currentWords: number;
  wordsRemaining: number;
  onResetWritingSession: () => void;
}) {
  return (
    <section className="panel-section">
      <div className="panel-section-title-row">
        <h2>本次写作</h2>
        <button className="text-button" onClick={onResetWritingSession}>
          重置
        </button>
      </div>
      <div className="metric-grid">
        <div>
          <span>起点</span>
          <strong>{sessionStartWords}</strong>
        </div>
        <div>
          <span>净增</span>
          <strong>{sessionDelta >= 0 ? `+${sessionDelta}` : sessionDelta}</strong>
        </div>
        <div>
          <span>当前</span>
          <strong>{currentWords}</strong>
        </div>
        <div>
          <span>目标差距</span>
          <strong>{wordsRemaining}</strong>
        </div>
      </div>
    </section>
  );
}

interface SheetStats {
  characters: number;
  paragraphs: number;
  headings: number;
  readingMinutes: number;
}

export function SheetStatsSection({ stats }: { stats: SheetStats }) {
  return (
    <section className="panel-section">
      <h2>稿件统计</h2>
      <div className="metric-grid">
        <div>
          <span>字符</span>
          <strong>{stats.characters}</strong>
        </div>
        <div>
          <span>段落</span>
          <strong>{stats.paragraphs}</strong>
        </div>
        <div>
          <span>标题</span>
          <strong>{stats.headings}</strong>
        </div>
        <div>
          <span>阅读</span>
          <strong>{stats.readingMinutes} 分钟</strong>
        </div>
      </div>
    </section>
  );
}

export function SheetOutlineSection({ headings, onJumpToHeading }: { headings: SheetHeading[]; onJumpToHeading: (line: number) => void }) {
  return (
    <section className="panel-section">
      <h2>稿件大纲</h2>
      <div className="heading-list">
        {headings.map((heading) => (
          <button
            key={heading.id}
            className="heading-row"
            style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
            onClick={() => onJumpToHeading(heading.line)}
          >
            <span>H{heading.level}</span>
            <strong>{heading.text}</strong>
          </button>
        ))}
        {headings.length === 0 && <p className="muted-text">当前稿件还没有 Markdown 标题。</p>}
      </div>
    </section>
  );
}
