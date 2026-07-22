/**
 * [INPUT]: 依赖 同目录稳定契约
 * [OUTPUT]: 对外提供 WindowControls
 * [POS]: shared 层的跨功能复用的界面基础，不依赖具体 feature
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
interface WindowControlsProps {
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
}

export function WindowControls({ onClose, onMinimize, onToggleMaximize }: WindowControlsProps) {
  return (
    <div className="window-controls" aria-label="窗口控制">
      <button className="window-control close" onClick={onClose} aria-label="关闭窗口" />
      <button className="window-control minimize" onClick={onMinimize} aria-label="最小化窗口" />
      <button className="window-control zoom" onClick={onToggleMaximize} aria-label="最大化窗口" />
    </div>
  );
}
