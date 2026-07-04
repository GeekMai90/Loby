import clsx from "clsx";
import { Bot, Check, FileText, Image, PenLine, Save, Sparkles } from "lucide-react";
import type { AiSuggestion, DiffLine } from "../../types";

interface AiReviewToolsProps {
  suggestion: AiSuggestion | null;
  diffLines: DiffLine[];
  busy: boolean;
  onCodexInlineEdit: () => void;
  onPolish: () => void;
  onTitle: () => void;
  onSummary: () => void;
  onImageIdeas: () => void;
  onSaveNote: () => void;
  onAccept: () => void;
  onReject: () => void;
}

export function AiReviewTools({
  suggestion,
  diffLines,
  busy,
  onCodexInlineEdit,
  onPolish,
  onTitle,
  onSummary,
  onImageIdeas,
  onSaveNote,
  onAccept,
  onReject,
}: AiReviewToolsProps) {
  const isNoteSuggestion = suggestion?.reviewMode === "note";

  return (
    <>
      <section className="panel-section">
        <h2>本地审阅工具</h2>
        <button className="action-row" onClick={onCodexInlineEdit} disabled={busy}>
          <Bot size={16} />
          <span>
            <strong>Codex 改写选区</strong>
            <small>调用 CLI，返回后进入 diff 审阅</small>
          </span>
        </button>
        <button className="action-row" onClick={onPolish}>
          <Sparkles size={16} />
          <span>
            <strong>生成本地润色 diff</strong>
            <small>不用调用 CLI，验证审阅交互</small>
          </span>
        </button>
        <button className="action-row" onClick={onTitle}>
          <PenLine size={16} />
          <span>
            <strong>生成标题备选</strong>
            <small>基于当前稿件卡片生成 3 个方向</small>
          </span>
        </button>
        <button className="action-row" onClick={onSummary}>
          <FileText size={16} />
          <span>
            <strong>总结当前稿件</strong>
            <small>提取主题、结构和下一步写作缺口</small>
          </span>
        </button>
        <button className="action-row" onClick={onImageIdeas}>
          <Image size={16} />
          <span>
            <strong>生成配图构思</strong>
            <small>生成封面、正文图和素材卡方向</small>
          </span>
        </button>
      </section>

      {suggestion && (
        <section className="panel-section suggestion">
          <h2>{suggestion.title}</h2>
          {isNoteSuggestion ? (
            <pre className="note-suggestion">{suggestion.result}</pre>
          ) : (
            <div className="diff-view" aria-label="AI 建议差异">
              {diffLines.map((line) => (
                <div key={line.id} className={clsx("diff-line", `diff-${line.kind}`)}>
                  <span>{line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "}</span>
                  <code>{line.text || " "}</code>
                </div>
              ))}
            </div>
          )}
          <div className="button-row">
            {isNoteSuggestion && (
              <button className="primary-button" onClick={onSaveNote}>
                <Save size={16} /> 保存为素材卡片
              </button>
            )}
            {!isNoteSuggestion && (
              <button className="primary-button" onClick={onAccept}>
                <Check size={16} /> 接受
              </button>
            )}
            <button className="secondary-button" onClick={onReject}>
              {isNoteSuggestion ? "关闭" : "拒绝"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
