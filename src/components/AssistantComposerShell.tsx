import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function AssistantComposerShell({ className, ...props }: ComponentProps<"form">) {
  return (
    <form
      data-slot="assistant-composer-shell"
      className={cn(
        "relative flex shrink-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-2.75 shadow-[0_1px_2px_rgb(0_0_0_/_3%)] focus-within:border-primary/35 focus-within:ring-3 focus-within:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}
