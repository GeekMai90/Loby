/**
 * [INPUT]: 依赖 SettingsDialog 的公开 props 与 React lazy/Suspense
 * [OUTPUT]: 对外提供 SettingsDialogHost，将设置对话框的按需加载边界保留在 settings feature
 * [POS]: settings feature 的 surface host；不拥有设置值、tab 状态或跨功能持久化，只负责懒加载和关闭时的空渲染
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { lazy, Suspense } from "react";
import type { SettingsDialogProps } from "@/features/settings/components/SettingsDialog";

const SettingsDialog = lazy(() =>
  import("@/features/settings/components/SettingsDialog").then((module) => ({ default: module.SettingsDialog })),
);

export type SettingsDialogHostProps = SettingsDialogProps;

export function SettingsDialogHost(props: SettingsDialogHostProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <SettingsDialog {...props} />
    </Suspense>
  );
}
