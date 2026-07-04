interface ProgressBarProps {
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="progress">
      <span style={{ width: `${value}%` }} />
    </div>
  );
}
