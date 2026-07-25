/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、写作库模块
 * [OUTPUT]: 对外提供 DiscardChangesDialog、FieldChangeDialog
 * [POS]: 写作库 feature 的界面组合单元，连接 写作库 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldTypeLabel } from "@/features/library/constants/propertyFields";
import type { PendingFieldChange } from "@/features/editor/components/document-properties/types";

export function DiscardChangesDialog({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  return (
    <AlertDialog open onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存更改？</AlertDialogTitle>
          <AlertDialogDescription>关闭后，本次对属性、选项和默认值的更改都会丢失。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>继续编辑</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            放弃更改
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FieldChangeDialog({
  change,
  replacement,
  onReplacementChange,
  onCancel,
  onRemoveField,
  onRemoveOption,
  onChangeType,
}: {
  change: PendingFieldChange;
  replacement: string;
  onReplacementChange: (value: string) => void;
  onCancel: () => void;
  onRemoveField: (deleteValues: boolean) => void;
  onRemoveOption: (replacement?: string) => void;
  onChangeType: (mode: "convert" | "clear") => void;
}) {
  const replacementOptions =
    change.kind === "removeOption" ? (change.definition.options ?? []).filter((option) => option.id !== change.option.id) : [];
  const title = change.kind === "removeField" ? "移除属性" : change.kind === "removeOption" ? "删除预设选项" : "更改属性类型";

  return (
    <AlertDialog open onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>将影响 {change.usage} 篇文稿。</p>
              {change.kind === "removeField" && (
                <p>移除“{change.definition.label}”后，可以保留文稿中的原始 YAML 值，也可以同时删除这些值。</p>
              )}
              {change.kind === "removeOption" && <p>“{change.option.label}”正在被使用。请选择替代选项，或者清空这些文稿中的该值。</p>}
              {change.kind === "changeType" && (
                <p>
                  “{change.definition.label}”将从{fieldTypeLabel(change.definition.type)}改为{fieldTypeLabel(change.nextType)}。可兼容转换
                  {change.usage - change.incompatible} 篇，无法转换 {change.incompatible} 篇。
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {change.kind === "removeOption" && replacementOptions.length > 0 && (
          <Select value={replacement} onValueChange={onReplacementChange}>
            <SelectTrigger width="full">
              <SelectValue placeholder="选择替代选项" />
            </SelectTrigger>
            <SelectContent>
              {replacementOptions.map((option) => (
                <SelectItem key={option.id} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
          {change.kind === "removeField" && (
            <>
              <AlertDialogAction variant="destructive" onClick={() => onRemoveField(true)}>
                删除属性和值
              </AlertDialogAction>
              <AlertDialogAction onClick={() => onRemoveField(false)}>保留 YAML 值并移除</AlertDialogAction>
            </>
          )}
          {change.kind === "removeOption" && (
            <>
              <AlertDialogAction variant="destructive" onClick={() => onRemoveOption()}>
                清空并删除
              </AlertDialogAction>
              {replacementOptions.length > 0 && (
                <AlertDialogAction disabled={!replacement} onClick={() => onRemoveOption(replacement)}>
                  替换并删除
                </AlertDialogAction>
              )}
            </>
          )}
          {change.kind === "changeType" && (
            <>
              <AlertDialogAction variant="destructive" onClick={() => onChangeType("clear")}>
                清空现有值
              </AlertDialogAction>
              <AlertDialogAction onClick={() => onChangeType("convert")}>转换可兼容值</AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
