import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface WechatThemeStudioDialogsProps {
  renameOpen: boolean;
  renameDraft: string;
  deleteOpen: boolean;
  targetThemeName: string;
  onRenameOpenChange: (open: boolean) => void;
  onRenameDraftChange: (value: string) => void;
  onRename: () => void;
  onDeleteOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

export function WechatThemeStudioDialogs({
  renameOpen,
  renameDraft,
  deleteOpen,
  targetThemeName,
  onRenameOpenChange,
  onRenameDraftChange,
  onRename,
  onDeleteOpenChange,
  onDelete,
}: WechatThemeStudioDialogsProps) {
  return (
    <>
      <Dialog open={renameOpen} onOpenChange={onRenameOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名个人主题</DialogTitle>
            <DialogDescription>名称只用于主题列表，不会进入公众号正文。</DialogDescription>
          </DialogHeader>
          <Input
            value={renameDraft}
            maxLength={80}
            autoFocus
            onChange={(event) => onRenameDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRename();
            }}
          />
          <DialogFooter showCloseButton>
            <Button type="button" disabled={!renameDraft.trim()} onClick={onRename}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={onDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除「{targetThemeName || "这个主题"}」？</AlertDialogTitle>
            <AlertDialogDescription>主题和它的修改历史、AI 对话会一起删除，文章 Markdown 不受影响。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              删除主题
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
