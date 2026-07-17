import clsx from "clsx";

export type AssistantMessageSurfaceRole = "user" | "assistant" | "system";

export function assistantMessageRootClassName(role: AssistantMessageSurfaceRole, error = false): string {
  return clsx(
    "max-w-full leading-[1.55]",
    role === "user" && "group ml-auto grid w-full min-w-0 justify-items-end gap-1.5 text-foreground",
    role === "assistant" && "bg-transparent px-1.25 py-0.5 text-foreground",
    role === "system" && "rounded-lg border border-border bg-muted/40 p-2.5",
    error && "border-destructive/25 bg-destructive/6 text-destructive",
  );
}
