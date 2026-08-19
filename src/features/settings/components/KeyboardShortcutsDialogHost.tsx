/**
 * [INPUT]: 依赖 KeyboardShortcutsDialog 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 KeyboardShortcutsDialogHost，将快捷键浏览 surface 的按需加载边界保留在 settings feature
 * [POS]: settings feature 的快捷键 surface host；不拥有快捷键数据、搜索状态或应用菜单状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { KeyboardShortcutsDialogProps } from "@/features/settings/components/KeyboardShortcutsDialog";

const KeyboardShortcutsDialog = lazy(() =>
  import("@/features/settings/components/KeyboardShortcutsDialog").then((module) => ({
    default: module.KeyboardShortcutsDialog,
  })),
);

export type KeyboardShortcutsDialogHostProps = KeyboardShortcutsDialogProps;

export function KeyboardShortcutsDialogHost(props: KeyboardShortcutsDialogHostProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <KeyboardShortcutsDialog {...props} />
    </Suspense>
  );
}
