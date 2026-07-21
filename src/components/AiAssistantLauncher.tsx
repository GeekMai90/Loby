import { Button } from "@/components/ui/button";

interface AiAssistantLauncherProps {
  onOpen: () => void;
}

export function AiAssistantLauncher({ onOpen }: AiAssistantLauncherProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="assistant-launcher size-10 rounded-full p-0 active:translate-y-0"
      onClick={onOpen}
      aria-label="打开 AI 助手"
      title="打开 AI 助手"
    >
      <span className="assistant-launcher-glass" aria-hidden="true">
        <span className="assistant-launcher-fluid" />
      </span>
    </Button>
  );
}
