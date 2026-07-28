/**
 * [INPUT]: 依赖 AI 助手运行展示的稳定产品文案约定
 * [OUTPUT]: 对外提供模型首个有效事件到达前的友好轮换文案、切换间隔与无连续重复的随机洗牌
 * [POS]: AI 助手运行投影的等候文案策略，不改变 Runtime phase，也不伪造 reasoning 或工具事件
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

export const ASSISTANT_MODEL_WAITING_LABELS = [
  "思索中…",
  "考虑中…",
  "处理中…",
  "梳理思路…",
  "推敲表达…",
  "组织内容…",
  "理清头绪…",
  "琢磨一下…",
  "酝酿中…",
  "打磨中…",
  "连接想法…",
  "寻找线索…",
  "再想一层…",
  "咔哒咔哒…",
  "嗖嗖运转…",
] as const;

export const ASSISTANT_MODEL_WAITING_LABEL_INTERVAL_MS = 7_000;

export function shuffledAssistantModelWaitingLabels(previousLabel?: string, random: () => number = Math.random): string[] {
  const labels = [...ASSISTANT_MODEL_WAITING_LABELS];
  for (let index = labels.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [labels[index], labels[swapIndex]] = [labels[swapIndex], labels[index]];
  }
  if (labels.length > 1 && labels[0] === previousLabel) {
    [labels[0], labels[1]] = [labels[1], labels[0]];
  }
  return labels;
}
