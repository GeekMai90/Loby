/**
 * [INPUT]: 依赖 React、Radix DropdownMenu、lucide-react、Tailwind 语义字号 Token 与 shared class 合并工具
 * [OUTPUT]: 对外提供点击菜单根节点、触发器、阻止窗口拖拽的浮层、条目、勾选/单选、图标、快捷键、分隔线与子菜单 primitives
 * [POS]: components/ui 的标准点击菜单基础；统一键鼠焦点、Portal 窗口交互、共享菜单材质和紧凑条目几何，不承载业务动作
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";

import { cn } from "@/shared/lib/utils";
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
        data-no-window-drag
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
          "loby-solid-menu z-50 max-h-(--radix-dropdown-menu-content-available-height) w-(--radix-dropdown-menu-trigger-width) min-w-32 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-[var(--menu-radius)] p-[var(--menu-padding)] text-[var(--menu-foreground)] duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
        "group/dropdown-menu-item text-app-base relative flex h-[26px] cursor-default items-center gap-1.5 rounded-[var(--menu-item-radius)] px-2 py-0.5 leading-[18px] outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:hover:text-[var(--menu-highlight-foreground)] data-[variant=destructive]:focus:text-[var(--menu-highlight-foreground)] data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
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
        "text-app-base relative flex h-[26px] cursor-default items-center gap-1.5 rounded-[var(--menu-item-radius)] py-0.5 pr-7 pl-2 leading-[18px] outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center"
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
  selectionStyle = "indicator",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  inset?: boolean;
  selectionStyle?: "indicator" | "highlight";
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "text-app-base relative flex h-[26px] cursor-default items-center gap-1.5 rounded-[var(--menu-item-radius)] py-0.5 pl-2 leading-[18px] outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        selectionStyle === "highlight"
          ? "pr-2 data-[state=checked]:bg-[var(--menu-highlight)] data-[state=checked]:text-[var(--menu-highlight-foreground)] data-[state=checked]:**:text-[var(--menu-highlight-foreground)]"
          : "pr-7",
        className,
      )}
      {...props}
    >
      {selectionStyle === "indicator" && (
        <span
          className="pointer-events-none absolute right-2 flex items-center justify-center"
          data-slot="dropdown-menu-radio-item-indicator"
        >
          <DropdownMenuPrimitive.ItemIndicator>
            <CheckIcon />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
      )}
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
      className={cn("text-caption px-2 py-1 font-medium text-muted-foreground data-inset:pl-7", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("loby-menu-separator my-1 h-px bg-[var(--menu-separator)]", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-caption ml-auto tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-[var(--menu-highlight-foreground)]",
        className,
      )}
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
        "text-app-base flex h-[26px] cursor-default items-center gap-1.5 rounded-[var(--menu-item-radius)] px-2 py-0.5 leading-[18px] outline-hidden select-none hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus:bg-[var(--menu-highlight)] focus:text-[var(--menu-highlight-foreground)] focus:**:text-[var(--menu-highlight-foreground)] data-inset:pl-7 data-open:bg-[var(--menu-highlight)] data-open:text-[var(--menu-highlight-foreground)] data-open:**:text-[var(--menu-highlight-foreground)] data-disabled:pointer-events-none data-disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
      {showChevron && <ChevronRightIcon className="ml-auto size-3.5" />}
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
        data-no-window-drag
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
          "loby-solid-menu z-50 min-w-[96px] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-[var(--menu-radius)] p-[var(--menu-padding)] text-[var(--menu-foreground)] duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
