import { Archive, Check, ChevronDown, Download, PenLine } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { getSheetHeadings } from "../lib/markdownOutline";
import {
  getNextProjectStatus,
  getPublishingChecklist,
  getWritingBrief,
  PROJECT_STATUS_FLOW,
} from "../lib/projectModel";
import { countWords, projectProgress, projectWordCount, sheetProgress, sheetStats } from "../lib/text";
import type { ProjectStatus, ProjectWritingBrief, SheetType, WritingProject, WritingSheet } from "../types";

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
      <section className="panel-section">
        <h2>项目信息</h2>
        <label>
          状态
          <select
            value={activeProject.status}
            onChange={(event) =>
              updateProject((project) => ({ ...project, status: event.target.value as ProjectStatus, updatedAt: getCurrentDate() }))
            }
          >
            {PROJECT_STATUS_FLOW.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          目标平台
          <input
            value={activeProject.targetPlatform}
            placeholder="公众号 / 小红书 / 网站 / 书稿"
            onChange={(event) =>
              updateProject((project) => ({ ...project, targetPlatform: event.target.value, updatedAt: getCurrentDate() }))
            }
          />
        </label>
        <label>
          目标字数
          <input
            type="number"
            value={activeProject.targetWords}
            onChange={(event) =>
              updateProject((project) => ({ ...project, targetWords: Number(event.target.value), updatedAt: getCurrentDate() }))
            }
          />
        </label>
        <label>
          标签
          <input
            value={tagText}
            placeholder="产品, 写作软件, AI Native"
            onChange={(event) =>
              updateProject((project) => ({
                ...project,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
                updatedAt: getCurrentDate(),
              }))
            }
          />
        </label>
        <label>
          描述
          <textarea
            value={activeProject.description}
            onChange={(event) =>
              updateProject((project) => ({ ...project, description: event.target.value, updatedAt: getCurrentDate() }))
            }
          />
        </label>
        <div className="workflow-actions">
          {nextProjectStatus && (
            <button className="secondary-button" onClick={() => setProjectWorkflowStatus(nextProjectStatus)}>
              <ChevronDown size={16} /> 推进到{nextProjectStatus}
            </button>
          )}
          <button className="secondary-button" onClick={() => setProjectWorkflowStatus("待发布")}>
            <Download size={16} /> 待发布
          </button>
          <button className="primary-button" onClick={() => setProjectWorkflowStatus("已发布")}>
            <Check size={16} /> 已发布
          </button>
          {(activeProject.status === "已发布" || activeProject.status === "已归档") && (
            <button className="secondary-button" onClick={() => setProjectWorkflowStatus("已归档")} disabled={activeProject.status === "已归档"}>
              <Archive size={16} /> 归档
            </button>
          )}
          {(activeProject.status === "已发布" || activeProject.status === "已归档") && (
            <button className="secondary-button" onClick={() => setProjectWorkflowStatus("修改中")}>
              <PenLine size={16} /> 恢复修改
            </button>
          )}
        </div>
      </section>

      <section className="panel-section">
        <h2>写作简报</h2>
        <label>
          目标读者
          <textarea
            value={writingBrief.audience}
            placeholder="这篇内容写给谁？他们已经知道什么，还卡在哪里？"
            onChange={(event) => updateWritingBrief("audience", event.target.value)}
          />
        </label>
        <label>
          核心观点
          <textarea
            value={writingBrief.thesis}
            placeholder="这篇文章最终要让读者相信什么？"
            onChange={(event) => updateWritingBrief("thesis", event.target.value)}
          />
        </label>
        <label>
          语气风格
          <input
            value={writingBrief.tone}
            placeholder="例如：清楚、克制、具体、有判断，不营销"
            onChange={(event) => updateWritingBrief("tone", event.target.value)}
          />
        </label>
        <label>
          发布备注
          <textarea
            value={writingBrief.publishingNotes}
            placeholder="平台限制、配图要求、标题方向、必须避开的表达。"
            onChange={(event) => updateWritingBrief("publishingNotes", event.target.value)}
          />
        </label>
      </section>

      <section className="panel-section">
        <h2>稿件信息</h2>
        <label>
          类型
          <select
            value={activeSheet.type}
            onChange={(event) => updateSheet((sheet) => ({ ...sheet, type: event.target.value as SheetType, updatedAt: getCurrentDate() }))}
          >
            {(["正文", "章节", "提纲", "素材", "发布版本"] as SheetType[]).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          状态
          <select
            value={activeSheet.status}
            onChange={(event) => updateSheet((sheet) => ({ ...sheet, status: event.target.value as ProjectStatus, updatedAt: getCurrentDate() }))}
          >
            {PROJECT_STATUS_FLOW.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <div className="workflow-actions">
          {nextSheetStatus && (
            <button className="secondary-button" onClick={() => setSheetWorkflowStatus(nextSheetStatus)}>
              <ChevronDown size={16} /> 推进到{nextSheetStatus}
            </button>
          )}
          <button className="secondary-button" onClick={() => setSheetWorkflowStatus("待发布")} disabled={activeSheet.status === "待发布"}>
            <Download size={16} /> 待发布
          </button>
          <button className="primary-button" onClick={() => setSheetWorkflowStatus("已发布")} disabled={activeSheet.status === "已发布"}>
            <Check size={16} /> 已发布
          </button>
          {(activeSheet.status === "已发布" || activeSheet.status === "已归档") && (
            <button className="secondary-button" onClick={() => setSheetWorkflowStatus("修改中")}>
              <PenLine size={16} /> 恢复修改
            </button>
          )}
        </div>
        <label>
          目标字数
          <input
            type="number"
            value={activeSheet.targetWords}
            onChange={(event) =>
              updateSheet((sheet) => ({ ...sheet, targetWords: Number(event.target.value), updatedAt: getCurrentDate() }))
            }
          />
        </label>
        <label>
          摘要
          <textarea
            value={activeSheet.summary}
            onChange={(event) => updateSheet((sheet) => ({ ...sheet, summary: event.target.value, updatedAt: getCurrentDate() }))}
          />
        </label>
      </section>

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
    </div>
  );
}
