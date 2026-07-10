import type { ProjectWritingBrief } from "../types";

interface WritingBriefSectionProps {
  writingBrief: ProjectWritingBrief;
  onUpdateWritingBrief: (field: keyof ProjectWritingBrief, value: string) => void;
}

export function WritingBriefSection({ writingBrief, onUpdateWritingBrief }: WritingBriefSectionProps) {
  return (
    <section className="panel-section">
      <h2>写作简报</h2>
      <label>
        目标读者
        <textarea
          value={writingBrief.audience}
          placeholder="这篇内容写给谁？他们已经知道什么，还卡在哪里？"
          onChange={(event) => onUpdateWritingBrief("audience", event.target.value)}
        />
      </label>
      <label>
        核心观点
        <textarea
          value={writingBrief.thesis}
          placeholder="这篇文章最终要让读者相信什么？"
          onChange={(event) => onUpdateWritingBrief("thesis", event.target.value)}
        />
      </label>
      <label>
        语气风格
        <input
          value={writingBrief.tone}
          placeholder="例如：清楚、克制、具体、有判断，不营销"
          onChange={(event) => onUpdateWritingBrief("tone", event.target.value)}
        />
      </label>
      <label>
        发布备注
        <textarea
          value={writingBrief.publishingNotes}
          placeholder="平台限制、配图要求、标题方向、必须避开的表达。"
          onChange={(event) => onUpdateWritingBrief("publishingNotes", event.target.value)}
        />
      </label>
    </section>
  );
}
