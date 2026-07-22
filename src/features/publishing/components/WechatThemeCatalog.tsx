/**
 * [INPUT]: 依赖 lucide-react、shadcn/ui 基础控件、发布模块、shared 公共契约
 * [OUTPUT]: 对外提供 WechatThemeCatalog
 * [POS]: 发布 feature 的界面组合单元，连接 发布 状态与共享 UI，不持有跨功能应用状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Check, Copy, MoreHorizontal, Palette, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WechatThemePreferences } from "@/features/publishing/model/wechatThemeStore";
import type { WechatThemeManifest } from "@/features/publishing/model/wechatThemes";
import { NavigationItem } from "@/shared/components/NavigationItem";

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
    { id: "personal", label: "自定义", themes: themes.filter((theme) => theme.kind === "personal") },
  ];

  return (
    <div className="flex flex-col gap-4" data-wechat-theme-catalog>
      {sections.map((section) =>
        section.id === "favorites" && section.themes.length === 0 ? null : (
          <section key={section.id} aria-labelledby={`wechat-theme-section-${section.id}`}>
            <div className="mb-1.5 px-1">
              <strong id={`wechat-theme-section-${section.id}`} className="text-xs font-medium text-muted-foreground">
                {section.label}
              </strong>
            </div>
            {section.themes.length > 0 ? (
              <div className="flex flex-col gap-1">
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
    <div className="group relative">
      <NavigationItem
        selected={selected}
        active
        className="pr-9"
        aria-pressed={selected}
        data-selected={selected ? "true" : undefined}
        data-theme-id={theme.id}
        onClick={() => onSelect(theme.id)}
      >
        <Palette size={16} />
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{theme.name}</span>
        {defaultTheme && (
          <span className={`shrink-0 text-[10px] font-medium ${selected ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
            默认
          </span>
        )}
        {favorite && <Star className={`size-3.5 shrink-0 fill-current ${selected ? "text-primary-foreground/80" : "text-amber-500"}`} />}
      </NavigationItem>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={`absolute top-1/2 right-1 -translate-y-1/2 transition-colors active:-translate-y-1/2 ${
              selected ? "text-primary-foreground/80 hover:bg-white/15 hover:text-primary-foreground" : "text-muted-foreground"
            }`}
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
