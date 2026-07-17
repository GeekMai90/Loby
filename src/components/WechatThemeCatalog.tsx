import { Check, Copy, MoreHorizontal, Palette, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WechatThemePreferences } from "../lib/publishing/wechatThemeStore";
import type { WechatThemeManifest } from "../lib/publishing/wechatThemes";

interface WechatThemeCatalogProps {
  themes: WechatThemeManifest[];
  selectedThemeId: string;
  preferences: WechatThemePreferences;
  onSelect: (themeId: string) => void;
  onToggleFavorite: (themeId: string) => void;
  onSetDefault: (themeId: string) => void;
  onDuplicate?: (theme: WechatThemeManifest) => void;
  onRename?: (theme: WechatThemeManifest) => void;
  onDelete?: (theme: WechatThemeManifest) => void;
}

interface ThemeSection {
  id: "favorites" | "built-in" | "personal";
  label: string;
  themes: WechatThemeManifest[];
}

export function WechatThemeCatalog({
  themes,
  selectedThemeId,
  preferences,
  onSelect,
  onToggleFavorite,
  onSetDefault,
  onDuplicate,
  onRename,
  onDelete,
}: WechatThemeCatalogProps) {
  const favoriteIds = new Set(preferences.favoriteThemeIds);
  const sections: ThemeSection[] = [
    { id: "favorites", label: "收藏", themes: themes.filter((theme) => favoriteIds.has(theme.id)) },
    { id: "built-in", label: "系统自带", themes: themes.filter((theme) => theme.kind === "built-in") },
    { id: "personal", label: "用户自定义", themes: themes.filter((theme) => theme.kind === "personal") },
  ];

  return (
    <div className="flex flex-col gap-4" data-wechat-theme-catalog>
      {sections.map((section) =>
        section.id === "favorites" && section.themes.length === 0 ? null : (
          <section key={section.id} aria-labelledby={`wechat-theme-section-${section.id}`}>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <strong id={`wechat-theme-section-${section.id}`} className="text-xs font-medium text-muted-foreground">
                {section.label}
              </strong>
              <span className="text-[11px] tabular-nums text-muted-foreground/70">{section.themes.length}</span>
            </div>
            {section.themes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {section.themes.map((theme) => (
                  <ThemeCatalogItem
                    key={`${section.id}-${theme.id}`}
                    theme={theme}
                    selected={theme.id === selectedThemeId}
                    favorite={favoriteIds.has(theme.id)}
                    defaultTheme={theme.id === preferences.defaultThemeId}
                    onSelect={onSelect}
                    onToggleFavorite={onToggleFavorite}
                    onSetDefault={onSetDefault}
                    onDuplicate={onDuplicate}
                    onRename={onRename}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            ) : (
              <p className="px-2 py-3 text-xs text-muted-foreground">还没有用户自定义主题</p>
            )}
          </section>
        ),
      )}
    </div>
  );
}

interface ThemeCatalogItemProps {
  theme: WechatThemeManifest;
  selected: boolean;
  favorite: boolean;
  defaultTheme: boolean;
  onSelect: (themeId: string) => void;
  onToggleFavorite: (themeId: string) => void;
  onSetDefault: (themeId: string) => void;
  onDuplicate?: (theme: WechatThemeManifest) => void;
  onRename?: (theme: WechatThemeManifest) => void;
  onDelete?: (theme: WechatThemeManifest) => void;
}

function ThemeCatalogItem({
  theme,
  selected,
  favorite,
  defaultTheme,
  onSelect,
  onToggleFavorite,
  onSetDefault,
  onDuplicate,
  onRename,
  onDelete,
}: ThemeCatalogItemProps) {
  return (
    <div
      className={`group flex h-12 items-center rounded-lg border transition-colors ${
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted/70"
      }`}
      data-selected={selected ? "true" : undefined}
      data-theme-id={theme.id}
    >
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-l-lg px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-pressed={selected}
        onClick={() => onSelect(theme.id)}
      >
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
            selected ? "border-white/30 bg-white/12" : "border-border bg-muted/55"
          }`}
        >
          <Palette className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{theme.name}</span>
        {defaultTheme && (
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              selected ? "bg-white/16 text-white" : "bg-primary/10 text-primary"
            }`}
          >
            默认
          </span>
        )}
        {favorite && <Star className={`size-3.5 shrink-0 ${selected ? "fill-white" : "fill-current text-amber-500"}`} />}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={`mr-1 shrink-0 ${selected ? "text-white hover:bg-white/15 hover:text-white" : "text-muted-foreground"}`}
            aria-label={`管理主题「${theme.name}」`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem onSelect={() => onToggleFavorite(theme.id)}>
            <Star className={favorite ? "fill-current" : undefined} />
            {favorite ? "取消收藏" : "收藏"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={defaultTheme} onSelect={() => onSetDefault(theme.id)}>
            <Check /> {defaultTheme ? "当前默认主题" : "设为默认主题"}
          </DropdownMenuItem>
          {onDuplicate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onDuplicate(theme)}>
                <Copy /> 基于此主题创建
              </DropdownMenuItem>
            </>
          )}
          {theme.kind === "personal" && onRename && onDelete && (
            <>
              <DropdownMenuItem onSelect={() => onRename(theme)}>
                <Pencil /> 重命名
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(theme)}>
                <Trash2 /> 删除主题
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
