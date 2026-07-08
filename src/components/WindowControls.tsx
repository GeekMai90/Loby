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
