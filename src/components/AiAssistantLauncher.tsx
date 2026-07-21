import { Carrot } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AiAssistantLauncherProps {
  onOpen: () => void;
}

export function AiAssistantLauncher({ onOpen }: AiAssistantLauncherProps) {
  return (
    <Button
      variant="outline"
      className="assistant-launcher h-10 rounded-full border-border/70 bg-background/88 px-3.5 text-[13px] font-semibold shadow-[0_10px_28px_rgb(35_52_72_/_12%),inset_0_1px_0_rgb(255_255_255_/_72%)] backdrop-blur-xl hover:bg-background"
      onClick={onOpen}
      aria-label="打开 AI 助手"
      title="打开 AI 助手"
    >
      <Carrot aria-hidden="true" />
      <span>AI 助手</span>
    </Button>
  );
}
