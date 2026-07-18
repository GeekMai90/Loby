import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function ContextMenu(props: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger(props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />;
}

function ContextMenuContent({ className, collisionPadding = 8, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        data-slot="context-menu-content"
        collisionPadding={collisionPadding}
        className={cn(
          "loby-glass-menu z-50 min-w-32 overflow-hidden rounded-lg p-1 text-popover-foreground duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] outline-hidden select-none hover:bg-[var(--menu-hover)] focus:bg-[var(--menu-hover)] focus:text-foreground focus:**:text-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-[var(--menu-danger-hover)] data-[variant=destructive]:focus:bg-[var(--menu-danger-hover)] data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:focus:**:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator data-slot="context-menu-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  );
}

export { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger };
