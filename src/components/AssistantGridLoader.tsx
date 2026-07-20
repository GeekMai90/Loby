import { cn } from "@/lib/utils";

interface AssistantGridLoaderProps {
  className?: string;
}

export function AssistantGridLoader({ className }: AssistantGridLoaderProps) {
  return (
    <span data-slot="assistant-grid-loader" className={cn("assistant-grid-loader", className)} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}
