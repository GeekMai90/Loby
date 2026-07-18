import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

type DropdownMenuInteractionMode = "keyboard" | "pointer";

type DropdownMenuInteractionContextValue = {
  getMode: () => DropdownMenuInteractionMode;
  getTrigger: () => HTMLElement | null;
  setMode: (mode: DropdownMenuInteractionMode) => void;
  setTrigger: (trigger: HTMLElement) => void;
};

const DropdownMenuInteractionContext = React.createContext<DropdownMenuInteractionContextValue | null>(null);

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const modeRef = React.useRef<DropdownMenuInteractionMode>("keyboard");
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const getMode = React.useCallback(() => modeRef.current, []);
  const getTrigger = React.useCallback(() => triggerRef.current, []);
  const setMode = React.useCallback((mode: DropdownMenuInteractionMode) => {
    modeRef.current = mode;
  }, []);
  const setTrigger = React.useCallback((trigger: HTMLElement) => {
    triggerRef.current = trigger;
  }, []);
  const interaction = React.useMemo(() => ({ getMode, getTrigger, setMode, setTrigger }), [getMode, getTrigger, setMode, setTrigger]);

  return (
    <DropdownMenuInteractionContext.Provider value={interaction}>
      <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
    </DropdownMenuInteractionContext.Provider>
  );
}

function DropdownMenuPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({ onKeyDown, onPointerDown, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  const interaction = React.useContext(DropdownMenuInteractionContext);

  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      onKeyDown={(event) => {
        if (interaction) {
          interaction.setMode("keyboard");
          interaction.setTrigger(event.currentTarget);
        }
        onKeyDown?.(event);
      }}
      onPointerDown={(event) => {
        if (interaction) {
          interaction.setMode("pointer");
          interaction.setTrigger(event.currentTarget);
        }
        onPointerDown?.(event);
      }}
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 4,
  collisionPadding = 8,
  onCloseAutoFocus,
  onKeyDown,
  onPointerDown,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const interaction = React.useContext(DropdownMenuInteractionContext);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented || interaction?.getMode() !== "pointer") return;

          requestAnimationFrame(() => {
            const trigger = interaction.getTrigger();
            if (trigger && document.activeElement === trigger) trigger.blur();
          });
        }}
        onKeyDown={(event) => {
          interaction?.setMode("keyboard");
          onKeyDown?.(event);
        }}
        onPointerDown={(event) => {
          interaction?.setMode("pointer");
          onPointerDown?.(event);
        }}
        onPointerDownOutside={(event) => {
          interaction?.setMode("pointer");
          onPointerDownOutside?.(event);
        }}
        className={cn(
          "loby-glass-menu z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg px-1.5 py-1 text-popover-foreground duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-default items-center gap-2 rounded-md px-2.5 py-1 text-[13px] outline-hidden select-none hover:bg-[var(--menu-hover)] focus:bg-[var(--menu-hover)] focus:text-foreground focus:**:text-foreground data-inset:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:bg-[var(--menu-danger-hover)] data-[variant=destructive]:focus:bg-[var(--menu-danger-hover)] data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:focus:**:text-destructive data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-1 pr-9 pl-2.5 text-[13px] outline-hidden select-none hover:bg-[var(--menu-hover)] focus:bg-[var(--menu-hover)] focus:text-foreground focus:**:text-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2.5 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-md py-1 pr-9 pl-2.5 text-[13px] outline-hidden select-none hover:bg-[var(--menu-hover)] focus:bg-[var(--menu-hover)] focus:text-foreground focus:**:text-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2.5 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1.5 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-foreground", className)}
      {...props}
    />
  );
}

function DropdownMenuSub({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  showChevron = true,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
  showChevron?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2.5 py-1 text-[13px] outline-hidden select-none hover:bg-[var(--menu-hover)] focus:bg-[var(--menu-hover)] focus:text-foreground focus:**:text-foreground data-inset:pl-8 data-open:bg-[var(--menu-selected)] data-open:text-foreground data-open:**:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      {showChevron && <ChevronRightIcon className="ml-auto" />}
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  onKeyDown,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  const interaction = React.useContext(DropdownMenuInteractionContext);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        data-slot="dropdown-menu-sub-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        onKeyDown={(event) => {
          interaction?.setMode("keyboard");
          onKeyDown?.(event);
        }}
        onPointerDown={(event) => {
          interaction?.setMode("pointer");
          onPointerDown?.(event);
        }}
        className={cn(
          "loby-glass-menu z-50 min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-lg px-1.5 py-1 text-popover-foreground duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
