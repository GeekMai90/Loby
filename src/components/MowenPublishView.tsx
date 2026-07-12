import { Check, CircleAlert, KeyRound } from "lucide-react";

export type MowenPublishState = "checking" | "unconfigured" | "ready" | "publishing" | "success" | "error";

interface MowenPublishViewProps {
  state: MowenPublishState;
  title: string;
  characterCount: number;
  progress: number;
  progressLabel: string;
  errorMessage: string;
  errorNeedsSettings: boolean;
  onCancel: () => void;
  onPublish: () => void;
  onOpenSettings: () => void;
}

export function MowenPublishView({
  state,
  title,
  characterCount,
  progress,
  progressLabel,
  errorMessage,
  errorNeedsSettings,
  onCancel,
  onPublish,
  onOpenSettings,
}: MowenPublishViewProps) {
  return (
    <>
      <div key={state} className={`mowen-publish-body state-${state}`}>
        {(state === "ready" || state === "checking" || state === "publishing") && (
          <DocumentSummary title={title} characterCount={characterCount} />
        )}

        {state === "checking" && (
          <div className="mowen-publish-progress" role="status">
            <div className="mowen-publish-progress-track indeterminate" aria-hidden="true">
              <span />
            </div>
            <p>正在检查发布设置…</p>
          </div>
        )}

        {state === "unconfigured" && (
          <div className="mowen-publish-message configuration">
            <span className="mowen-publish-message-icon">
              <KeyRound size={21} />
            </span>
            <h3>需要先配置墨问笔记</h3>
            <p>发布前请先前往设置验证 API Key。</p>
          </div>
        )}

        {state === "publishing" && (
          <div className="mowen-publish-progress" role="status" aria-label={`${progressLabel}，${progress}%`}>
            <div className="mowen-publish-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>{progressLabel}</p>
          </div>
        )}

        {state === "success" && (
          <div className="mowen-publish-message success" role="status">
            <span className="mowen-publish-message-icon">
              <Check size={24} strokeWidth={2.4} />
            </span>
            <h3>发布成功</h3>
            <p title={title}>《{title}》已发布到墨问笔记。</p>
          </div>
        )}

        {state === "error" && (
          <div className="mowen-publish-message error" role="alert">
            <span className="mowen-publish-message-icon">
              <CircleAlert size={22} />
            </span>
            <h3>发布失败</h3>
            <p>{errorMessage || "暂时无法发布，请稍后重试。"}</p>
          </div>
        )}
      </div>

      <footer className="mowen-publish-footer">
        {state === "success" ? (
          <button type="button" className="primary-button" onClick={onCancel}>
            完成
          </button>
        ) : state === "publishing" || state === "checking" ? (
          <button type="button" className="primary-button" disabled>
            {state === "publishing" ? "发布中…" : "检查中…"}
          </button>
        ) : (
          <>
            <button type="button" className="secondary-button" onClick={onCancel}>
              取消
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={state === "unconfigured" || errorNeedsSettings ? onOpenSettings : onPublish}
            >
              {state === "unconfigured" || errorNeedsSettings ? "前往设置" : state === "error" ? "重试" : "发布"}
            </button>
          </>
        )}
      </footer>
    </>
  );
}

function DocumentSummary({ title, characterCount }: { title: string; characterCount: number }) {
  return (
    <div className="direct-publish-document mowen-document-summary">
      <strong>{title}</strong>
      <small>{characterCount} 个字符 · 公开发布</small>
    </div>
  );
}
