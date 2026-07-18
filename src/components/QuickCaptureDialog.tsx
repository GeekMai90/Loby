import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { clearQuickCaptureDraft, loadQuickCaptureDraft, saveQuickCaptureDraft } from "@/lib/quickCapture";

interface QuickCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (body: string) => void;
}

export function QuickCaptureDialog({ open, onClose, onSave }: QuickCaptureDialogProps) {
  const [body, setBody] = useState(loadQuickCaptureDraft);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [open]);

  function save() {
    if (!body.trim()) return;
    onSave(body);
    clearQuickCaptureDraft();
    setBody("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="block overflow-hidden rounded-3xl border border-white/65 bg-popover/80 p-0 shadow-2xl backdrop-blur-3xl focus-within:ring-1 focus-within:ring-primary/15 sm:max-w-140 dark:border-white/10"
      >
        <DialogTitle className="sr-only">快速记录</DialogTitle>
        <DialogDescription className="sr-only">输入内容并发送到随手记</DialogDescription>
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => {
            const nextBody = event.target.value;
            setBody(nextBody);
            saveQuickCaptureDraft(nextBody);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          className="block min-h-64 resize-none rounded-none border-0 bg-transparent px-6 pt-5 pr-6 pb-20 text-[18px] leading-[22px] caret-primary shadow-none placeholder:text-muted-foreground/70 focus-visible:border-0 focus-visible:ring-0 md:text-[18px]"
          style={{ fieldSizing: "fixed" }}
          placeholder="记下刚刚想到的内容……"
          aria-label="快速记录内容"
        />
        <Button
          size="icon-lg"
          className="absolute right-5 bottom-5 size-11 rounded-full shadow-none disabled:bg-muted disabled:text-muted-foreground"
          onClick={save}
          disabled={!body.trim()}
          aria-label="发送"
          title="发送（Command + Enter）"
          aria-keyshortcuts="Meta+Enter Control+Enter"
        >
          <ArrowUp className="size-5" strokeWidth={2.4} />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
