/**
 * [INPUT]: 依赖 lucide-react、shared 公共契约
 * [OUTPUT]: 对外提供 NewProjectDraft、ProjectIconOption、ProjectColorOption、项目/系统图标默认色、PROJECT_ICON_OPTIONS、PROJECT_COLOR_OPTIONS 等公开能力
 * [POS]: 写作库 feature 的稳定配置边界，集中 写作库 选项、默认值与持久化标识
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  Archive,
  BookMarked,
  BookOpen,
  BookText,
  Brain,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  ChartPie,
  Code2,
  Coffee,
  Compass,
  Dumbbell,
  FileText,
  Film,
  FolderKanban,
  GraduationCap,
  Globe2,
  Heart,
  Home,
  Inbox,
  Library,
  Lightbulb,
  ListTodo,
  ListTree,
  MapPinned,
  Megaphone,
  Mic,
  Music2,
  Newspaper,
  NotebookPen,
  Palette,
  Plane,
  Rss,
  Rocket,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ProjectGoalUnit, PublishingGroupMapping } from "@/shared/types";

export interface NewProjectDraft {
  title: string;
  icon: string;
  iconColor: string;
  goalEnabled?: boolean;
  goalUnit?: ProjectGoalUnit;
  goalTarget?: number;
  publishingTargetId?: string;
  publishingGroupMappings?: PublishingGroupMapping[];
}

export interface ProjectIconOption {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export interface ProjectColorOption {
  id: string;
  label: string;
  value: string;
}

export const DEFAULT_PROJECT_ICON = "library";
export const DEFAULT_PROJECT_ICON_COLOR = "#007aff";
export const DEFAULT_SYSTEM_ICON_COLOR = "#8e8e93";
export const DEFAULT_NEW_PROJECT_TITLE = "无标题";

export const PROJECT_ICON_OPTIONS: ProjectIconOption[] = [
  { id: "library", label: "项目", Icon: Library },
  { id: "blog", label: "博客", Icon: Rss },
  { id: "article", label: "文章", Icon: Newspaper },
  { id: "book", label: "书稿", Icon: BookOpen },
  { id: "series", label: "系列", Icon: BookMarked },
  { id: "column", label: "专栏", Icon: BookText },
  { id: "notes", label: "笔记", Icon: NotebookPen },
  { id: "inbox", label: "收件箱", Icon: Inbox },
  { id: "draft", label: "草稿", Icon: FileText },
  { id: "research", label: "研究", Icon: Lightbulb },
  { id: "outline", label: "大纲", Icon: ListTree },
  { id: "checklist", label: "清单", Icon: ListTodo },
  { id: "goal", label: "目标", Icon: Target },
  { id: "course", label: "课程", Icon: GraduationCap },
  { id: "client", label: "客户", Icon: BriefcaseBusiness },
  { id: "team", label: "协作", Icon: Users },
  { id: "campaign", label: "营销", Icon: Megaphone },
  { id: "podcast", label: "播客", Icon: Mic },
  { id: "video", label: "视频", Icon: Film },
  { id: "photo", label: "图像", Icon: Camera },
  { id: "design", label: "设计", Icon: Palette },
  { id: "travel", label: "旅行", Icon: Plane },
  { id: "place", label: "地点", Icon: MapPinned },
  { id: "life", label: "生活", Icon: Home },
  { id: "personal", label: "个人", Icon: Heart },
  { id: "archive", label: "归档", Icon: Archive },
  { id: "brain", label: "思考", Icon: Brain },
  { id: "business", label: "企业", Icon: Building2 },
  { id: "calendar", label: "日程", Icon: CalendarDays },
  { id: "analytics", label: "数据", Icon: ChartPie },
  { id: "code", label: "开发", Icon: Code2 },
  { id: "coffee", label: "咖啡", Icon: Coffee },
  { id: "compass", label: "探索", Icon: Compass },
  { id: "fitness", label: "运动", Icon: Dumbbell },
  { id: "kanban", label: "看板", Icon: FolderKanban },
  { id: "website", label: "网站", Icon: Globe2 },
  { id: "music", label: "音乐", Icon: Music2 },
  { id: "launch", label: "发布", Icon: Rocket },
  { id: "shop", label: "商店", Icon: ShoppingBag },
  { id: "inspiration", label: "灵感", Icon: Sparkles },
];

export const PROJECT_COLOR_OPTIONS: ProjectColorOption[] = [
  { id: "charcoal", label: "炭黑", value: "#1d1d1f" },
  { id: "gray", label: "灰色", value: "#8e8e93" },
  { id: "blue", label: "蓝色", value: "#007aff" },
  { id: "sky", label: "天蓝", value: "#32ade6" },
  { id: "cyan", label: "青色", value: "#5ac8fa" },
  { id: "teal", label: "蓝绿色", value: "#30b0c7" },
  { id: "mint", label: "薄荷", value: "#00c7be" },
  { id: "green", label: "绿色", value: "#34c759" },
  { id: "lime", label: "青柠", value: "#9acd32" },
  { id: "yellow", label: "黄色", value: "#ffcc00" },
  { id: "gold", label: "金色", value: "#ffb340" },
  { id: "orange", label: "橙色", value: "#ff9500" },
  { id: "coral", label: "珊瑚", value: "#ff6961" },
  { id: "red", label: "红色", value: "#ff3b30" },
  { id: "rose", label: "玫瑰", value: "#ff6482" },
  { id: "pink", label: "粉色", value: "#ff2d55" },
  { id: "purple", label: "紫色", value: "#af52de" },
  { id: "violet", label: "紫罗兰", value: "#bf5af2" },
  { id: "indigo", label: "靛蓝", value: "#5856d6" },
  { id: "brown", label: "棕色", value: "#a2845e" },
];

export function getProjectIconOption(iconId?: string): ProjectIconOption {
  return PROJECT_ICON_OPTIONS.find((option) => option.id === iconId) ?? PROJECT_ICON_OPTIONS[0];
}

export function getProjectIconColor(color?: string): string {
  if (color && PROJECT_COLOR_OPTIONS.some((option) => option.value === color)) return color;
  return DEFAULT_PROJECT_ICON_COLOR;
}
