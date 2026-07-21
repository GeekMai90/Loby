import { forwardRef, type ComponentProps } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const AssistantComposerTextarea = forwardRef<HTMLTextAreaElement, ComponentProps<typeof Textarea>>(
  ({ className, rows = 2, ...props }, ref) => (
    <Textarea
      ref={ref}
      rows={rows}
      className={cn(
        "min-h-[calc(2lh+0.5rem)] resize-none rounded-none border-0 px-1 pt-2 pb-0 shadow-none placeholder:text-muted-foreground/65 focus-visible:border-transparent focus-visible:ring-0",
        className,
      )}
      {...props}
    />
  ),
);

AssistantComposerTextarea.displayName = "AssistantComposerTextarea";
