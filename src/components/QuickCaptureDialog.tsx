import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface QuickCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (body: string) => void;
}

export function QuickCaptureDialog({ open, onClose, onSave }: QuickCaptureDialogProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setBody("");
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [open]);

  function save() {
    if (!body.trim()) return;
    onSave(body);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-130">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
              <Lightbulb size={17} />
            </span>
            <div>
              <DialogTitle>快速记录</DialogTitle>
              <DialogDescription>保存到“笔记／随手记”，以后可以移动到项目继续写。</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          className="min-h-44 resize-y text-[15px] leading-6"
          placeholder="记下刚刚想到的内容……"
          aria-label="快速记录内容"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save} disabled={!body.trim()}>
            保存到随手记
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
