import * as React from "react";
import { ChevronRightIcon } from "lucide-react";
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
          "loby-solid-menu z-50 min-w-32 overflow-hidden rounded-[var(--menu-radius)] p-[var(--menu-padding)] text-[var(--menu-foreground)] duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
        "relative flex h-[26px] cursor-default items-center gap-2.5 rounded-[var(--menu-item-radius)] py-0.5 pr-2.5 pl-3.5 text-[13px] leading-[18px] outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:text-[var(--menu-highlight-foreground)] data-[variant=destructive]:focus:text-[var(--menu-highlight-foreground)] data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuItemIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span data-slot="context-menu-item-icon" className={cn("flex size-3.5 shrink-0 items-center justify-center", className)} {...props} />
  );
}

function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("loby-menu-separator my-1 h-px bg-[var(--menu-separator)]", className)}
      {...props}
    />
  );
}

function ContextMenuSub(props: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}

function ContextMenuSubTrigger({ className, children, ...props }: React.ComponentProps<typeof ContextMenuPrimitive.SubTrigger>) {
  return (
    <ContextMenuPrimitive.SubTrigger
      data-slot="context-menu-sub-trigger"
      className={cn(
        "relative flex h-[26px] cursor-default items-center gap-2.5 rounded-[var(--menu-item-radius)] py-0.5 pr-2.5 pl-3.5 text-[13px] leading-[18px] outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-open:bg-[var(--menu-highlight)] data-open:text-[var(--menu-highlight-foreground)] data-open:**:text-[var(--menu-highlight-foreground)] data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-3.5 shrink-0" />
    </ContextMenuPrimitive.SubTrigger>
  );
}

function ContextMenuSubContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.SubContent
        data-slot="context-menu-sub-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "loby-solid-menu z-50 min-w-32 origin-(--radix-context-menu-content-transform-origin) overflow-hidden rounded-[var(--menu-radius)] p-[var(--menu-padding)] text-[var(--menu-foreground)] duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
};
