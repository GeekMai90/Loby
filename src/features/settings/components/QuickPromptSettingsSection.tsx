/**
 * [INPUT]: 依赖 shadcn/ui 基础控件、lucide-react、React 运行时、shared 公共契约、AI 助手模块、设置模块
 * [OUTPUT]: 对外提供 AI 设置首页的 QuickPromptSettingsEntry 与接管内容区的 QuickPromptSettingsPage
 * [POS]: settings feature 的快捷提示二级设置边界，管理列表与编辑临时状态，不拥有提示持久化
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { AiQuickPrompt } from "@/shared/types";
import {
  MAX_AI_QUICK_PROMPTS,
  MAX_AI_QUICK_PROMPT_CONTENT_LENGTH,
  MAX_AI_QUICK_PROMPT_TITLE_LENGTH,
} from "@/features/assistant/model/quickPrompts";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { SettingsSection } from "@/features/settings/components/SettingsControls";

interface QuickPromptSettingsPageProps {
  prompts: AiQuickPrompt[];
  ready: boolean;
  onAdd: (title: string, content: string) => void;
  onEdit: (promptId: string, title: string, content: string) => void;
  onDelete: (promptId: string) => void;
  onMove: (promptId: string, direction: -1 | 1) => void;
  onBack: () => void;
}

export function QuickPromptSettingsEntry({ prompts, ready, onOpen }: { prompts: AiQuickPrompt[]; ready: boolean; onOpen: () => void }) {
  return (
    <SettingsSection title="快捷提示">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.25 text-left transition-colors hover:bg-muted/55 focus-visible:bg-muted/55 focus-visible:outline-none"
        onClick={onOpen}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">我的提示</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {ready
              ? `保存常用指令，在 AI 输入框中通过 / 快速调用 · 已创建 ${prompts.length}/${MAX_AI_QUICK_PROMPTS} 条`
              : "保存常用指令，在 AI 输入框中通过 / 快速调用 · 正在读取…"}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </SettingsSection>
  );
}

export function QuickPromptSettingsPage({ prompts, ready, onAdd, onEdit, onDelete, onMove, onBack }: QuickPromptSettingsPageProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AiQuickPrompt | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AiQuickPrompt | null>(null);
  const atLimit = prompts.length >= MAX_AI_QUICK_PROMPTS;
  const canSave = Boolean(title.trim() && content.trim());

  function openEditor(prompt?: AiQuickPrompt) {
    setEditingPrompt(prompt ?? null);
    setTitle(prompt?.title ?? "");
    setContent(prompt?.content ?? "");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingPrompt(null);
    setTitle("");
    setContent("");
  }

  function savePrompt() {
    if (!canSave) return;
    if (editingPrompt) onEdit(editingPrompt.id, title, content);
    else onAdd(title, content);
    closeEditor();
  }

  return (
    <>
      <div className="flex flex-col gap-4.5">
        <div className="flex min-h-10 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Button type="button" variant="ghost" size="icon-sm" title="返回 AI 助手设置" aria-label="返回 AI 助手设置" onClick={onBack}>
              <ChevronLeft />
            </Button>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-foreground">快捷提示</h4>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {ready ? `已创建 ${prompts.length}/${MAX_AI_QUICK_PROMPTS} 条` : "正在读取当前写作文件夹…"}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!ready || atLimit} onClick={() => openEditor()}>
            <Plus />
            新建
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-[var(--settings-dialog-divider)] bg-[var(--settings-dialog-section-background)]">
          {prompts.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs leading-5 text-muted-foreground">
              创建常用提示后，可以在新对话或输入框的 / 菜单中快速使用。
            </div>
          ) : (
            prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{prompt.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{prompt.content}</p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="上移"
                    disabled={index === 0}
                    onClick={() => onMove(prompt.id, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="下移"
                    disabled={index === prompts.length - 1}
                    onClick={() => onMove(prompt.id, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" title="编辑" onClick={() => openEditor(prompt)}>
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="删除"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(prompt)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? "编辑快捷提示" : "新建快捷提示"}</DialogTitle>
            <DialogDescription>界面展示标题，发送给 AI 的是完整提示词内容。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              标题
              <Input
                value={title}
                maxLength={MAX_AI_QUICK_PROMPT_TITLE_LENGTH}
                placeholder="例如：润色当前文章"
                autoFocus
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              提示词内容
              <Textarea
                className="min-h-40 resize-y"
                value={content}
                maxLength={MAX_AI_QUICK_PROMPT_CONTENT_LENGTH}
                placeholder="输入实际发送给 AI 助手的提示词…"
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={closeEditor}>
              取消
            </Button>
            <Button type="button" disabled={!canSave} onClick={savePrompt}>
              {editingPrompt ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`删除“${deleteTarget?.title ?? "这个快捷提示"}”？`}
        message="删除后将无法从新对话和输入框菜单中使用。"
        confirmLabel="删除"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
