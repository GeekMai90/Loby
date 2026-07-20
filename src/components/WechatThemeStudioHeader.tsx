import { Check, ChevronDown, MoreHorizontal, Palette, Redo2, Save, Undo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getWechatThemeMenuActions } from "../lib/publishing/wechatThemeMenu";
import { WECHAT_THEMES, type WechatThemeManifest } from "../lib/publishing/wechatThemes";
import { WechatCopyButton } from "./WechatCopyButton";
import { WindowControls } from "./WindowControls";

export type WechatThemeManualSaveState = "idle" | "saving" | "saved" | "error";

interface WechatThemeStudioHeaderProps {
  theme: WechatThemeManifest;
  favoriteThemes: WechatThemeManifest[];
  personalThemes: WechatThemeManifest[];
  favoriteThemeIds: string[];
  defaultThemeId: string;
  undoCount: number;
  redoCount: number;
  previewHtml?: string;
  previewBusy: boolean;
  assistantBusy: boolean;
  manualSaveState: WechatThemeManualSaveState;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onSelectTheme: (themeId: string) => void;
  onToggleFavorite: (theme: WechatThemeManifest) => void;
  onSetDefault: (theme: WechatThemeManifest) => void;
  onDuplicate: (theme: WechatThemeManifest) => void;
  onExport: (theme: WechatThemeManifest) => void;
  onRename: (theme: WechatThemeManifest) => void;
  onDelete: (theme: WechatThemeManifest) => void;
  onImport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}

export function WechatThemeStudioHeader({
  theme,
  favoriteThemes,
  personalThemes,
  favoriteThemeIds,
  defaultThemeId,
  undoCount,
  redoCount,
  previewHtml,
  previewBusy,
  assistantBusy,
  manualSaveState,
  onClose,
  onMinimize,
  onToggleMaximize,
  onSelectTheme,
  onToggleFavorite,
  onSetDefault,
  onDuplicate,
  onExport,
  onRename,
  onDelete,
  onImport,
  onUndo,
  onRedo,
  onSave,
}: WechatThemeStudioHeaderProps) {
  const sharedThemeMenuProps = {
    selectedThemeId: theme.id,
    favoriteThemeIds,
    defaultThemeId,
    onSelect: onSelectTheme,
    onToggleFavorite,
    onSetDefault,
    onDuplicate,
    onExport,
    onRename,
    onDelete,
  };

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3"
      data-tauri-drag-region
      onDoubleClick={onToggleMaximize}
    >
      <WindowControls onClose={onClose} onMinimize={onMinimize} onToggleMaximize={onToggleMaximize} />
      <strong className="min-w-0 truncate text-sm font-medium" data-tauri-drag-region>
        公众号主题编辑器
      </strong>
      <div className="min-w-0 flex-1" data-tauri-drag-region />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-56 gap-2 bg-background/80" data-no-window-drag>
            <ThemeSwatches theme={theme} />
            <span className="truncate">{theme.name}</span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="flex max-h-[min(70vh,560px)] w-52 flex-col overflow-hidden">
          <div className="min-h-0 overflow-y-auto">
            {favoriteThemes.length > 0 && <DropdownMenuLabel>收藏</DropdownMenuLabel>}
            {favoriteThemes.map((item) => (
              <ThemeMenuItem key={`favorite-${item.id}`} theme={item} {...sharedThemeMenuProps} />
            ))}
            {favoriteThemes.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>系统自带</DropdownMenuLabel>
            {WECHAT_THEMES.map((item) => (
              <ThemeMenuItem key={`built-in-${item.id}`} theme={item} {...sharedThemeMenuProps} />
            ))}
            {personalThemes.length > 0 && <DropdownMenuSeparator />}
            {personalThemes.length > 0 && <DropdownMenuLabel>用户自定义</DropdownMenuLabel>}
            {personalThemes.map((item) => (
              <ThemeMenuItem key={`personal-${item.id}`} theme={item} {...sharedThemeMenuProps} />
            ))}
          </div>
          <DropdownMenuSeparator className="shrink-0" />
          <div className="shrink-0">
            <DropdownMenuItem className="gap-2" onSelect={onImport}>
              <Upload />
              <span className="min-w-0 flex-1 truncate">导入主题</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="flex items-center gap-0.5" role="group" aria-label="主题修改历史" data-no-window-drag>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={theme.kind !== "personal" || undoCount === 0}
          onClick={onUndo}
          title={undoCount > 0 ? `撤销上一次主题修改（还有 ${undoCount} 步）` : "没有可撤销的修改"}
        >
          <Undo2 />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={theme.kind !== "personal" || redoCount === 0}
          onClick={onRedo}
          title={redoCount > 0 ? `重做主题修改（还有 ${redoCount} 步）` : "没有可重做的修改"}
        >
          <Redo2 />
        </Button>
      </div>
      <WechatCopyButton html={previewHtml} busy={previewBusy} />
      <Button
        type="button"
        size="sm"
        variant={manualSaveState === "error" ? "destructive" : "default"}
        disabled={theme.kind !== "personal" || assistantBusy || manualSaveState === "saving"}
        onClick={onSave}
        title={theme.kind === "built-in" ? "内置主题无需保存；通过 AI 修改后会自动创建个人副本" : "再次确认当前主题已经保存"}
        data-no-window-drag
      >
        {manualSaveState === "saved" ? <Check /> : <Save />}
        {manualSaveState === "saving"
          ? "保存中…"
          : manualSaveState === "saved"
            ? "已保存"
            : manualSaveState === "error"
              ? "保存失败"
              : "保存主题"}
      </Button>
    </header>
  );
}

interface ThemeMenuItemProps {
  theme: WechatThemeManifest;
  selectedThemeId: string;
  favoriteThemeIds: string[];
  defaultThemeId: string;
  onSelect: (themeId: string) => void;
  onToggleFavorite: (theme: WechatThemeManifest) => void;
  onSetDefault: (theme: WechatThemeManifest) => void;
  onDuplicate: (theme: WechatThemeManifest) => void;
  onExport: (theme: WechatThemeManifest) => void;
  onRename: (theme: WechatThemeManifest) => void;
  onDelete: (theme: WechatThemeManifest) => void;
}

function ThemeMenuItem({
  theme,
  selectedThemeId,
  favoriteThemeIds,
  defaultThemeId,
  onSelect,
  onToggleFavorite,
  onSetDefault,
  onDuplicate,
  onExport,
  onRename,
  onDelete,
}: ThemeMenuItemProps) {
  const actions = getWechatThemeMenuActions(theme);
  const selected = selectedThemeId === theme.id;
  const favorite = favoriteThemeIds.includes(theme.id);
  const defaultTheme = defaultThemeId === theme.id;
  return (
    <div
      className={`flex h-[26px] min-w-0 items-center rounded-[var(--menu-item-radius)] transition-colors hover:bg-[var(--menu-highlight)] hover:text-[var(--menu-highlight-foreground)] hover:**:text-[var(--menu-highlight-foreground)] focus-within:bg-[var(--menu-highlight)] focus-within:text-[var(--menu-highlight-foreground)] focus-within:**:text-[var(--menu-highlight-foreground)] ${
        selected ? "bg-[var(--menu-highlight)] text-[var(--menu-highlight-foreground)] **:text-[var(--menu-highlight-foreground)]" : ""
      }`}
      data-selected={selected ? "true" : undefined}
    >
      <DropdownMenuItem
        className="min-w-0 flex-1 gap-2 rounded-r-none bg-transparent focus:bg-transparent data-[highlighted]:bg-transparent"
        onSelect={() => onSelect(theme.id)}
      >
        <Palette />
        <span className="min-w-0 flex-1 truncate">{theme.name}</span>
        {defaultTheme && <span className="text-[10px] text-muted-foreground">默认</span>}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          showChevron={false}
          aria-label={`管理主题「${theme.name}」`}
          className="h-[26px] w-8 shrink-0 justify-center rounded-l-none bg-transparent p-0 hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent"
        >
          <MoreHorizontal />
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-32">
          <DropdownMenuItem onSelect={() => onToggleFavorite(theme)}>{favorite ? "取消收藏" : "收藏"}</DropdownMenuItem>
          <DropdownMenuItem disabled={defaultTheme} onSelect={() => onSetDefault(theme)}>
            {defaultTheme ? "当前默认主题" : "设为默认主题"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onDuplicate(theme)}>基于此主题创建</DropdownMenuItem>
          {actions.includes("export") && <DropdownMenuItem onSelect={() => onExport(theme)}>导出主题</DropdownMenuItem>}
          {actions.includes("rename") && (
            <>
              <DropdownMenuItem onSelect={() => onRename(theme)}>重命名</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(theme)}>
                删除主题
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </div>
  );
}

function ThemeSwatches({ theme }: { theme: WechatThemeManifest }) {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-md border border-border bg-muted/55"
      title={`${theme.name}主题`}
    >
      <Palette className="size-3" />
    </span>
  );
}
