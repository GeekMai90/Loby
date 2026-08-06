/**
 * [INPUT]: 依赖 Animate UI Tabs primitives、Tailwind 语义字号 Token 与 Loby shared class 合并工具
 * [OUTPUT]: 对外提供套用 Loby 语义 Token、稳定选中背景的 Tabs、TabsList、TabsTrigger、TabsContents 与 TabsContent
 * [POS]: components/animate-ui 的 Tabs 成品入口；保留官方 spring 高亮与内容过渡并统一应用表面样式
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";

import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsContents as TabsContentsPrimitive,
  TabsHighlight as TabsHighlightPrimitive,
  TabsHighlightItem as TabsHighlightItemPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  type TabsContentProps as TabsContentPrimitiveProps,
  type TabsContentsProps as TabsContentsPrimitiveProps,
} from "@/components/animate-ui/primitives/animate/tabs";
import { cn } from "@/shared/lib/utils";

type TabsProps = TabsPrimitiveProps;

function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive className={cn("flex flex-col gap-2", className)} {...props} />;
}

type TabsListProps = TabsListPrimitiveProps;

function TabsList({ className, ...props }: TabsListProps) {
  return (
    <TabsHighlightPrimitive mode="parent" className="rounded-lg bg-background dark:bg-input">
      <TabsListPrimitive
        className={cn("inline-flex h-9 w-fit items-stretch justify-center rounded-lg bg-muted p-[3px] text-muted-foreground", className)}
        {...props}
      />
    </TabsHighlightPrimitive>
  );
}

type TabsTriggerProps = TabsTriggerPrimitiveProps;

function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsHighlightItemPrimitive value={props.value} className="flex-1">
      <TabsTriggerPrimitive
        className={cn(
          "text-app-base inline-flex h-full w-full flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 font-medium text-muted-foreground transition-colors duration-500 ease-in-out data-[state=active]:bg-background data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...props}
      />
    </TabsHighlightItemPrimitive>
  );
}

type TabsContentsProps = TabsContentsPrimitiveProps;

function TabsContents(props: TabsContentsProps) {
  return <TabsContentsPrimitive {...props} />;
}

type TabsContentProps = TabsContentPrimitiveProps;

function TabsContent({ className, ...props }: TabsContentProps) {
  return <TabsContentPrimitive className={cn("outline-none", className)} {...props} />;
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentsProps,
  type TabsContentProps,
};
