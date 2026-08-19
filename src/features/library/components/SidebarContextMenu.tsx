/**
 * [INPUT]: 依赖右键菜单状态与动作、当前项目/文稿移动上下文、发布/导入回调、共享 ContextMenu primitives
 * [OUTPUT]: 对外提供 SidebarContextMenu 写作库右键菜单内容
 * [POS]: 写作库 feature 的菜单视图边界，只组合项目、分组与文稿菜单，不拥有 context state、持久化或跨功能导航时序
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  Archive,
  Clock3,
  CloudUpload,
  Columns3Cog,
  Copy,
  ExternalLink,
  FileSliders,
  FolderOpen,
  ImageIcon,
  Import as ImportIcon,
  Pin,
  Search,
  Settings2,
  Star,
  Text,
  Trash2,
} from "lucide-react";
import type { DocumentRailTab, WritingProject, WritingSheet } from "@/shared/types";
import type { SidebarContextMenuState } from "@/features/library/hooks/useSidebarContextMenu";
import type { SheetMoveTarget } from "@/features/library/model/projectCreation";
import type { SheetMoveSourceLocation } from "@/features/library/model/sheetMoveMenu";
import { SheetMoveContextMenu } from "@/features/library/components/SheetMoveContextMenu";
import { ContextMenuContent, ContextMenuItem, ContextMenuItemIcon, ContextMenuSeparator } from "@/components/ui/context-menu";

export interface SidebarContextMenuActions {
  closeSidebarContextMenu: () => void;
  editContextProject: () => void;
  manageContextDocumentProperties: () => void;
  formatContextSheet: () => void;
  editContextProjectGroup: () => void;
  showSidebarContextTargetInFinder: () => Promise<void>;
  toggleContextArchive: () => void;
  contextArchiveLabel: () => string;
  requestDeleteProjectFromContextMenu: () => void;
  requestDeleteProjectGroupFromContextMenu: () => void;
  toggleContextPinned: () => void;
  contextPinnedLabel: () => string;
  toggleContextFavorite: () => void;
  contextFavoriteLabel: () => string;
  duplicateContextSheet: () => void;
  requestDeleteSheetFromContextMenu: () => void;
  openContextSheetFunctionRail: (tab: DocumentRailTab) => void;
  openContextSheetWithDefaultApplication: () => Promise<void>;
}

export interface SidebarContextSheetEntry {
  project: WritingProject;
  sheet: WritingSheet;
}

interface SidebarContextHugoTarget {
  blogName: string;
}

interface SidebarContextDocsTarget {
  siteName: string;
}

export interface SidebarContextMenuProps {
  context: SidebarContextMenuState;
  actions: SidebarContextMenuActions;
  projects: WritingProject[];
  fileManagerName: string;
  contextSheetEntries: SidebarContextSheetEntry[];
  contextSheetSources: SheetMoveSourceLocation[];
  contextSheetHugoTarget?: SidebarContextHugoTarget;
  contextSheetDocsTarget?: SidebarContextDocsTarget;
  onOpenProjectHugoBatchPublish: (projectId: string) => void;
  onOpenProjectHelpCenterSync: (projectId: string) => void;
  onImportMarkdown: (projectId: string) => void;
  onMoveSheets: (sheetIds: string[], target: SheetMoveTarget) => void;
  onOpenMoveSheetDialog: (sheetIds: string[]) => void;
  onOpenSheetHelpCenterSync: (projectId: string, sheetId: string) => void;
}

export function SidebarContextMenu({
  context,
  actions,
  projects,
  fileManagerName,
  contextSheetEntries,
  contextSheetSources,
  contextSheetHugoTarget,
  contextSheetDocsTarget,
  onOpenProjectHugoBatchPublish,
  onOpenProjectHelpCenterSync,
  onImportMarkdown,
  onMoveSheets,
  onOpenMoveSheetDialog,
  onOpenSheetHelpCenterSync,
}: SidebarContextMenuProps) {
  const contextSheetIds = contextSheetEntries.map(({ sheet }) => sheet.id);
  const contextSheetCount = contextSheetEntries.length;

  return (
    <ContextMenuContent className="w-52">
      {context.kind === "project" && context.projectId && (
        <>
          <ContextMenuItem onSelect={actions.editContextProject}>
            <ContextMenuItemIcon>
              <Columns3Cog aria-hidden="true" />
            </ContextMenuItemIcon>
            项目设置
          </ContextMenuItem>
          <ContextMenuItem onSelect={actions.manageContextDocumentProperties}>
            <ContextMenuItemIcon>
              <FileSliders aria-hidden="true" />
            </ContextMenuItemIcon>
            文稿属性
          </ContextMenuItem>
          {contextSheetHugoTarget ? (
            <ContextMenuItem
              className="min-w-0"
              onSelect={() => {
                actions.closeSidebarContextMenu();
                onOpenProjectHugoBatchPublish(context.projectId!);
              }}
            >
              <ContextMenuItemIcon>
                <CloudUpload aria-hidden="true" />
              </ContextMenuItemIcon>
              <span className="min-w-0 truncate" title={`批量发布到${contextSheetHugoTarget.blogName}…`}>
                批量发布到{contextSheetHugoTarget.blogName}…
              </span>
            </ContextMenuItem>
          ) : null}
          {contextSheetDocsTarget ? (
            <ContextMenuItem
              className="min-w-0"
              onSelect={() => {
                actions.closeSidebarContextMenu();
                onOpenProjectHelpCenterSync(context.projectId!);
              }}
            >
              <ContextMenuItemIcon>
                <CloudUpload aria-hidden="true" />
              </ContextMenuItemIcon>
              <span className="min-w-0 truncate" title={`发布到${contextSheetDocsTarget.siteName}…`}>
                发布到{contextSheetDocsTarget.siteName}…
              </span>
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem
            onSelect={() => {
              actions.closeSidebarContextMenu();
              onImportMarkdown(context.projectId!);
            }}
          >
            <ContextMenuItemIcon>
              <ImportIcon aria-hidden="true" />
            </ContextMenuItemIcon>
            导入 Markdown…
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {context.kind === "sheet" && contextSheetCount === 1 && (
        <>
          <ContextMenuItem onSelect={actions.formatContextSheet}>
            <ContextMenuItemIcon>
              <Text aria-hidden="true" />
            </ContextMenuItemIcon>
            中文排版优化
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {context.kind === "project-group" && context.groupId && (
        <ContextMenuItem onSelect={actions.editContextProjectGroup}>
          <ContextMenuItemIcon>
            <Settings2 aria-hidden="true" />
          </ContextMenuItemIcon>
          分组设置
        </ContextMenuItem>
      )}
      {context.kind !== "sheet" && (
        <>
          <ContextMenuItem onSelect={() => void actions.showSidebarContextTargetInFinder()}>
            {(context.kind === "project" || context.kind === "project-group") && (
              <ContextMenuItemIcon>
                <FolderOpen aria-hidden="true" />
              </ContextMenuItemIcon>
            )}
            在{fileManagerName}中显示
          </ContextMenuItem>
          {context.kind === "project" && (
            <ContextMenuItem onSelect={actions.toggleContextArchive}>
              <ContextMenuItemIcon>
                <Archive aria-hidden="true" />
              </ContextMenuItemIcon>
              {actions.contextArchiveLabel()}
            </ContextMenuItem>
          )}
        </>
      )}
      {context.kind === "project" && <ContextMenuSeparator />}
      {context.kind === "project" && (
        <ContextMenuItem variant="destructive" onSelect={actions.requestDeleteProjectFromContextMenu}>
          <ContextMenuItemIcon>
            <Trash2 aria-hidden="true" />
          </ContextMenuItemIcon>
          删除项目
        </ContextMenuItem>
      )}
      {context.kind === "project-group" && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={actions.requestDeleteProjectGroupFromContextMenu}>
            <ContextMenuItemIcon>
              <Trash2 aria-hidden="true" />
            </ContextMenuItemIcon>
            删除分组
          </ContextMenuItem>
        </>
      )}
      {context.kind === "sheet" && (
        <>
          {contextSheetCount === 1 && (
            <>
              <ContextMenuItem onSelect={actions.toggleContextPinned}>
                <ContextMenuItemIcon>
                  <Pin aria-hidden="true" />
                </ContextMenuItemIcon>
                {actions.contextPinnedLabel()}
              </ContextMenuItem>
              <ContextMenuItem onSelect={actions.toggleContextFavorite}>
                <ContextMenuItemIcon>
                  <Star aria-hidden="true" />
                </ContextMenuItemIcon>
                {actions.contextFavoriteLabel()}
              </ContextMenuItem>
              <ContextMenuItem onSelect={actions.duplicateContextSheet}>
                <ContextMenuItemIcon>
                  <Copy aria-hidden="true" />
                </ContextMenuItemIcon>
                创建副本
              </ContextMenuItem>
            </>
          )}
          <SheetMoveContextMenu
            projects={projects}
            sources={contextSheetSources}
            onMove={(target) => {
              actions.closeSidebarContextMenu();
              onMoveSheets(contextSheetIds, target);
            }}
            onOpenMore={() => {
              actions.closeSidebarContextMenu();
              onOpenMoveSheetDialog(contextSheetIds);
            }}
          />
          {contextSheetCount > 1 && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={actions.requestDeleteSheetFromContextMenu}>
                <ContextMenuItemIcon>
                  <Trash2 aria-hidden="true" />
                </ContextMenuItemIcon>
                删除 {contextSheetCount} 篇文稿
              </ContextMenuItem>
            </>
          )}
          {contextSheetCount === 1 && (
            <>
              <ContextMenuItem onSelect={actions.toggleContextArchive}>
                <ContextMenuItemIcon>
                  <Archive aria-hidden="true" />
                </ContextMenuItemIcon>
                {actions.contextArchiveLabel()}
              </ContextMenuItem>
              {contextSheetDocsTarget ? (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => {
                      actions.closeSidebarContextMenu();
                      if (context.projectId && context.sheetId) {
                        onOpenSheetHelpCenterSync(context.projectId, context.sheetId);
                      }
                    }}
                  >
                    <ContextMenuItemIcon>
                      <CloudUpload aria-hidden="true" />
                    </ContextMenuItemIcon>
                    同步到{contextSheetDocsTarget.siteName}…
                  </ContextMenuItem>
                </>
              ) : null}
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => actions.openContextSheetFunctionRail("media")}>
                <ContextMenuItemIcon>
                  <ImageIcon aria-hidden="true" />
                </ContextMenuItemIcon>
                查看媒体
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => actions.openContextSheetFunctionRail("search")}>
                <ContextMenuItemIcon>
                  <Search aria-hidden="true" />
                </ContextMenuItemIcon>
                查找替换
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => actions.openContextSheetFunctionRail("history")}>
                <ContextMenuItemIcon>
                  <Clock3 aria-hidden="true" />
                </ContextMenuItemIcon>
                查看历史版本
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => void actions.openContextSheetWithDefaultApplication()}>
                <ContextMenuItemIcon>
                  <ExternalLink aria-hidden="true" />
                </ContextMenuItemIcon>
                使用默认应用打开
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => void actions.showSidebarContextTargetInFinder()}>
                <ContextMenuItemIcon>
                  <FolderOpen aria-hidden="true" />
                </ContextMenuItemIcon>
                在{fileManagerName}中显示
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={actions.requestDeleteSheetFromContextMenu}>
                <ContextMenuItemIcon>
                  <Trash2 aria-hidden="true" />
                </ContextMenuItemIcon>
                删除文稿
              </ContextMenuItem>
            </>
          )}
        </>
      )}
    </ContextMenuContent>
  );
}
