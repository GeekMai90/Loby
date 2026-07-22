/**
 * [INPUT]: 依赖 React、浏览器 Canvas 颜色解析、lucide-react、shadcn/ui primitives、Animate UI Tooltip/Tabs、shared 复合控件与全局语义 Token
 * [OUTPUT]: 对外提供含双主题 Token 实时 HEX 色值、真实 Toast、Context Menu、Tooltip/Tabs 动效、动画触发入口与关闭回调的 DesignGallery 开发态组件陈列室
 * [POS]: design-gallery 的编辑区表面，以连续矩阵展示全部真实组件和交互状态，不接触业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  AlignLeft,
  BarChart3,
  Bold,
  Bot,
  Check,
  Clock3,
  Code2,
  Copy,
  FileText,
  Folder,
  ImageIcon,
  Italic,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Tabs as AnimateTabs,
  TabsContent as AnimateTabsContent,
  TabsContents as AnimateTabsContents,
  TabsList as AnimateTabsList,
  TabsTrigger as AnimateTabsTrigger,
} from "@/components/animate-ui/components/animate/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/animate-ui/components/animate/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuItemIcon,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SheetRow } from "@/features/library/components/SheetRow";
import { AppToast, type AppToastVariant } from "@/shared/components/AppToast";
import { LiquidGlassButton } from "@/shared/components/LiquidGlassButton";
import { NavigationItem } from "@/shared/components/NavigationItem";
import { showAppToast } from "@/shared/lib/appToast";
import { cn } from "@/shared/lib/utils";
import type { WritingSheet } from "@/shared/types";

const COLOR_TOKEN_GROUPS = [
  {
    name: "基础表面与文字",
    tokens: [
      { name: "Background", token: "--background" },
      { name: "Card", token: "--card" },
      { name: "Popover", token: "--popover" },
      { name: "Muted", token: "--muted" },
      { name: "Foreground", token: "--foreground" },
      { name: "Muted Foreground", token: "--muted-foreground" },
    ],
  },
  {
    name: "交互颜色",
    tokens: [
      { name: "Primary", token: "--primary" },
      { name: "Primary Foreground", token: "--primary-foreground" },
      { name: "Secondary", token: "--secondary" },
      { name: "Accent", token: "--accent" },
    ],
  },
  {
    name: "边界与焦点",
    tokens: [
      { name: "Border", token: "--border" },
      { name: "Input", token: "--input" },
      { name: "Ring", token: "--ring" },
      { name: "Separator", token: "--separator" },
    ],
  },
  {
    name: "状态反馈",
    tokens: [
      { name: "Destructive", token: "--destructive" },
      { name: "Success", token: "--status-success" },
      { name: "Warning", token: "--status-warning" },
    ],
  },
] as const;

const RADIUS_TOKENS = [
  { name: "sm", token: "--radius-sm", value: "6px", usage: "微型表面" },
  { name: "md", token: "--radius-md", value: "8px", usage: "紧凑控件" },
  { name: "lg", token: "--radius-lg", value: "10px", usage: "默认控件" },
  { name: "xl", token: "--radius-xl", value: "14px", usage: "卡片与浮层" },
  { name: "2xl", token: "--radius-2xl", value: "18px", usage: "Dialog 与面板" },
  { name: "3xl", token: "--radius-3xl", value: "22px", usage: "大型浮动表面" },
  { name: "4xl", token: "--radius-4xl", value: "26px", usage: "大型展示容器" },
] as const;

const FUNCTION_TABS = [
  { value: "media", label: "媒体", icon: ImageIcon },
  { value: "search", label: "查找替换", icon: Search },
  { value: "history", label: "历史版本", icon: Clock3 },
] as const;

const INFORMATION_TABS = [
  { value: "properties", label: "属性", icon: SlidersHorizontal },
  { value: "statistics", label: "统计", icon: BarChart3 },
] as const;

const TOAST_SAMPLES: ReadonlyArray<{ variant: AppToastVariant; title: string; description: string }> = [
  { variant: "success", title: "保存成功", description: "文稿已经保存到本地写作文件夹" },
  { variant: "error", title: "保存失败", description: "请检查文件权限后重试" },
  { variant: "warning", title: "存在未完成内容", description: "发布前请检查文稿中的占位标记" },
  { variant: "info", title: "已同步外部改动", description: "列表内容已经更新" },
];

const SAMPLE_SHEETS: WritingSheet[] = [
  {
    id: "gallery-sheet-active",
    title: "让写作自然发生",
    status: "初稿",
    targetWords: 1200,
    summary: "",
    body: "# 让写作自然发生\n用更少的干扰，承载更长的思考。",
    updatedAt: "2026-07-22T10:20:00.000Z",
  },
  {
    id: "gallery-sheet-inactive",
    title: "设计系统整理笔记",
    status: "修改中",
    targetWords: 800,
    summary: "",
    body: "# 设计系统整理笔记\n统一语义 Token 与组件使用边界。",
    updatedAt: "2026-07-21T16:30:00.000Z",
  },
  {
    id: "gallery-sheet-regular",
    title: "下一篇文章",
    status: "构思",
    targetWords: 1000,
    summary: "",
    body: "# 下一篇文章\n从一个清晰的问题开始。",
    updatedAt: "2026-07-20T09:10:00.000Z",
  },
] as const;

export function DesignGallery({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground" data-app-tooltip-scope>
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4" data-tauri-drag-region>
        <div className="flex min-w-0 items-center gap-2">
          <Code2 className="size-4 text-primary" aria-hidden="true" />
          <span className="text-body truncate font-semibold">设计系统</span>
          <span className="text-caption text-muted-foreground">22 个组件与基础规范</span>
          <span className="text-caption rounded-full bg-primary/10 px-2 py-0.5 font-bold tracking-[0.08em] text-primary uppercase">
            Dev only
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭设计系统" title="返回文稿" onClick={onClose}>
          <X />
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-background" aria-label="组件预览矩阵">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-stretch gap-px bg-[var(--separator)]">
          <ColorTokenCell mode="light" />
          <ColorTokenCell mode="dark" />
          <SheetRowCell />
          <ButtonCell />
          <InputCell />
          <TypographyCell />
          <RadiusScaleCell />
          <SelectionCell />
          <TextareaCell />
          <ToggleCell />
          <ProgressCell />
          <ToastCell />
          <SelectCell />
          <DropdownCell />
          <ContextMenuCell />
          <TooltipCell />
          <DialogCell />
          <NavigationCell />
          <FunctionSegmentedCell />
          <InformationSegmentedCell />
          <AnimateTabsCell />
          <LiquidGlassCell />
        </div>
      </main>
    </div>
  );
}

function GalleryCell({
  id,
  title,
  description,
  className,
  contentClassName,
  children,
}: {
  id: string;
  title: string;
  description: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("min-h-72 scroll-mt-4 bg-background p-5 text-foreground", className)}>
      <header>
        <h2 className="text-body font-semibold">{title}</h2>
        <p className="text-caption mt-1 leading-4 text-muted-foreground">{description}</p>
      </header>
      <div className={cn("flex min-h-52 items-center justify-center py-6", contentClassName)}>{children}</div>
    </section>
  );
}

function ColorTokenCell({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark";
  return (
    <GalleryCell
      id={`colors-${mode}`}
      title={`语义颜色 · ${dark ? "Dark" : "Light"}`}
      description={`index.css 中的${dark ? "暗色" : "亮色"}语义 Token；HEX 由浏览器按实际颜色实时换算`}
      className={cn("col-span-full", dark ? "dark" : "theme-scope-light")}
    >
      <div className="flex w-full max-w-5xl flex-col gap-6">
        {COLOR_TOKEN_GROUPS.map((group) => (
          <section key={group.name} className="min-w-0">
            <h3 className="text-caption mb-2 font-bold text-muted-foreground">{group.name}</h3>
            <div className="grid grid-cols-6 gap-x-3 gap-y-4">
              {group.tokens.map(({ name, token }) => (
                <ColorTokenSwatch key={token} name={name} token={token} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </GalleryCell>
  );
}

function ColorTokenSwatch({ name, token }: { name: string; token: string }) {
  const swatchRef = useRef<HTMLDivElement>(null);
  const [hexValue, setHexValue] = useState("读取中…");

  useLayoutEffect(() => {
    const swatch = swatchRef.current;
    if (!swatch) return;
    setHexValue(cssColorToHex(getComputedStyle(swatch).backgroundColor));
  }, [token]);

  return (
    <div className="min-w-0" data-color-token={token}>
      <div ref={swatchRef} className="aspect-[1.65] rounded-lg border border-border shadow-xs" style={{ background: `var(${token})` }} />
      <p className="text-caption mt-1.5 truncate font-medium">{name}</p>
      <code className="text-caption block break-all leading-4 text-muted-foreground">{token}</code>
      <code className="text-caption block font-semibold leading-4 text-foreground">{hexValue}</code>
    </div>
  );
}

function cssColorToHex(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return color;

  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  const channels = [red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("");
  const alphaChannel = alpha < 255 ? alpha.toString(16).padStart(2, "0") : "";
  return `#${channels}${alphaChannel}`.toUpperCase();
}

function TypographyCell() {
  return (
    <GalleryCell
      id="typography"
      title="文字层级"
      description="应用只使用六级字号；13px 是默认 UI 基尺寸，24px 是界面最大字号"
      className="col-span-full"
    >
      <div className="grid w-full gap-x-10 gap-y-5 sm:grid-cols-2">
        <div>
          <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">12px · Caption</span>
          <p className="text-caption mt-1 text-muted-foreground">辅助说明、时间、状态与补充信息</p>
        </div>
        <div>
          <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">13px · Base</span>
          <p className="text-app-base mt-1 font-medium">菜单、按钮与默认界面文字</p>
        </div>
        <div>
          <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">14px · Body</span>
          <p className="text-body mt-1">导航项、正文、主要控件文字与需要更清晰阅读的内容</p>
        </div>
        <div>
          <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">16px · Subtitle</span>
          <p className="text-subtitle mt-1 font-semibold">面板标题与重要分组标题</p>
        </div>
        <div>
          <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">18px · Title</span>
          <p className="text-title mt-1 font-semibold">页面标题与主要内容标题</p>
        </div>
        <div>
          <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">24px · Display</span>
          <p className="text-display mt-1 font-bold tracking-tight">落笔，让写作自然发生</p>
        </div>
      </div>
    </GalleryCell>
  );
}

function RadiusScaleCell() {
  return (
    <GalleryCell
      id="radius-scale"
      title="圆角尺度"
      description="直接读取 shadcn 圆角 Token；普通界面只使用这套倍率与 rounded-full"
      className="col-span-full"
    >
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {RADIUS_TOKENS.map(({ name, token, value, usage }) => (
          <div key={token} className="grid min-w-0 grid-cols-[88px_1fr] items-center gap-3">
            <div
              className="h-16 w-[88px] border border-primary/30 bg-primary/10 shadow-xs"
              style={{ borderRadius: `var(${token})` }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-body font-semibold">
                {name} · {value}
              </p>
              <code className="text-caption block truncate text-muted-foreground">{token}</code>
              <p className="text-caption mt-1 text-muted-foreground">{usage}</p>
            </div>
          </div>
        ))}
        <div className="grid min-w-0 grid-cols-[88px_1fr] items-center gap-3">
          <div className="h-16 w-[88px] rounded-full border border-primary/30 bg-primary/10 shadow-xs" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-body font-semibold">full</p>
            <code className="text-caption block text-muted-foreground">rounded-full</code>
            <p className="text-caption mt-1 text-muted-foreground">圆形与胶囊</p>
          </div>
        </div>
      </div>
    </GalleryCell>
  );
}

function ButtonCell() {
  const [count, setCount] = useState(0);
  return (
    <GalleryCell id="button" title="Button · 按钮" description="标准 variants、尺寸、透明交互面与禁用状态">
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => setCount((value) => value + 1)}>
            <Plus data-icon="inline-start" />
            新建文稿
          </Button>
          <Button variant="outline">取消</Button>
          <Button variant="ghost" size="icon" aria-label="更多操作">
            <MoreHorizontal />
          </Button>
          <Button variant="ghost" surface="transparent">
            <Plus data-icon="inline-start" />
            无背景
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" size="sm">
            <Trash2 data-icon="inline-start" />
            删除
          </Button>
          <Button disabled size="sm">
            不可用
          </Button>
        </div>
        <span className="text-caption text-muted-foreground">主按钮已点击 {count} 次</span>
      </div>
    </GalleryCell>
  );
}

function InputCell() {
  return (
    <GalleryCell id="input" title="Input · 输入框" description="默认、聚焦、无效与禁用输入状态">
      <div className="w-full max-w-64 space-y-3">
        <Input placeholder="文稿标题" />
        <div>
          <Input defaultValue="无效的文件名 /" aria-invalid />
          <p className="text-caption mt-1.5 text-destructive">文件名不能包含“/”</p>
        </div>
        <Input value="由系统管理" disabled readOnly />
      </div>
    </GalleryCell>
  );
}

function SelectCell() {
  const [value, setValue] = useState("markdown");
  return (
    <GalleryCell id="select" title="Select · 选择菜单" description="默认 176px 语义宽度；Trigger 与菜单等宽，超长条目单行截断">
      <div className="w-full max-w-64 space-y-2">
        <label className="text-caption font-medium" htmlFor="gallery-format-select">
          图片引用格式
        </label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger id="gallery-format-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="markdown">Markdown</SelectItem>
            <SelectItem value="obsidian">Obsidian WikiLink</SelectItem>
            <SelectItem value="html">HTML</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-caption text-muted-foreground">当前值：{value}</p>
      </div>
    </GalleryCell>
  );
}

function SelectionCell() {
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(true);
  return (
    <GalleryCell id="selection" title="Checkbox & Switch · 复选框与开关" description="布尔选择、开关与不可用状态">
      <div className="w-full max-w-64 space-y-4">
        <label className="text-body flex items-center justify-between gap-4">
          <span>保存时自动创建快照</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>
        <label className="text-body flex items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          <span>显示 Markdown 标记</span>
        </label>
        <label className="text-body flex items-center gap-2 text-muted-foreground">
          <Checkbox disabled />
          <span>云端同步（不可用）</span>
        </label>
      </div>
    </GalleryCell>
  );
}

function TextareaCell() {
  const [value, setValue] = useState("");
  return (
    <GalleryCell id="textarea" title="Textarea · 多行输入框" description="多行输入、占位提示与字数反馈">
      <div className="w-full max-w-72">
        <Textarea value={value} rows={4} placeholder="记录这次修改的原因…" onChange={(event) => setValue(event.target.value)} />
        <p className="text-caption mt-1.5 text-right text-muted-foreground">{value.length} / 200</p>
      </div>
    </GalleryCell>
  );
}

function ToggleCell() {
  const [formats, setFormats] = useState<string[]>(["bold"]);
  return (
    <GalleryCell id="toggle" title="Toggle Group · 切换按钮组" description="编辑器工具栏中的 pressed 与组合状态">
      <div className="flex flex-col items-center gap-4">
        <ToggleGroup type="multiple" variant="outline" spacing={0} value={formats} onValueChange={setFormats} aria-label="文字格式">
          <ToggleGroupItem value="bold" aria-label="粗体">
            <Bold />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="斜体">
            <Italic />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="下划线">
            <Underline />
          </ToggleGroupItem>
          <ToggleGroupItem value="align" aria-label="左对齐">
            <AlignLeft />
          </ToggleGroupItem>
        </ToggleGroup>
        <Toggle
          variant="outline"
          pressed={formats.includes("focus")}
          onPressedChange={(pressed) => setFormats(pressed ? [...formats, "focus"] : formats.filter((value) => value !== "focus"))}
        >
          专注模式
        </Toggle>
      </div>
    </GalleryCell>
  );
}

function ProgressCell() {
  const [progress, setProgress] = useState(64);
  return (
    <GalleryCell id="progress" title="Progress · 进度条" description="确定性进度、语义标签与动态更新">
      <div className="w-full max-w-72 space-y-4">
        <div className="text-caption flex items-center justify-between">
          <span className="font-medium">今日写作目标</span>
          <span className="tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} aria-label={`今日写作目标 ${progress}%`} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setProgress((value) => Math.max(0, value - 10))}>
            −10
          </Button>
          <Button size="sm" onClick={() => setProgress((value) => Math.min(100, value + 10))}>
            +10
          </Button>
        </div>
      </div>
    </GalleryCell>
  );
}

function ToastCell() {
  return (
    <GalleryCell
      id="toast"
      title="Toast · 消息提示"
      description="真实 AppToast 表面；静态比较四种状态，也可触发正式 Sonner 进入与退出动画"
      className="col-span-full"
      contentClassName="flex-col gap-5"
    >
      <div className="grid w-full max-w-[696px] justify-center gap-3 md:grid-cols-2">
        {TOAST_SAMPLES.map((toast) => (
          <AppToast key={toast.variant} {...toast} onClose={() => undefined} />
        ))}
      </div>
      <Button
        type="button"
        onClick={() =>
          showAppToast({
            variant: "success",
            title: "保存成功",
            description: "这是通过正式通知链路弹出的 Toast",
          })
        }
      >
        触发真实 Toast
      </Button>
    </GalleryCell>
  );
}

function DropdownCell() {
  const [action, setAction] = useState("尚未选择操作");
  return (
    <GalleryCell id="dropdown" title="Dropdown Menu · 下拉菜单" description="共享菜单、separator 与危险操作状态">
      <div className="flex flex-col items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              文稿操作
              <MoreHorizontal data-icon="inline-end" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuLabel>当前文稿</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setAction("已复制链接")}>
              <Copy />
              复制链接
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setAction("已移动文稿")}>
              <Folder />
              移动到…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setAction("已选择删除")}>
              <Trash2 />
              删除文稿
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-caption text-muted-foreground">{action}</span>
      </div>
    </GalleryCell>
  );
}

function ContextMenuCell() {
  const [action, setAction] = useState("尚未选择操作");
  return (
    <GalleryCell id="context-menu" title="Context Menu · 右键菜单" description="真实右键触发、子菜单、快捷键、separator 与危险操作">
      <div className="flex w-full max-w-72 flex-col items-center gap-3">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="text-body block truncate font-medium">设计系统整理笔记</strong>
                <span className="text-caption mt-0.5 block text-muted-foreground">在这个条目上点击鼠标右键</span>
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem onSelect={() => setAction("已复制文稿链接")}>
              <ContextMenuItemIcon>
                <Copy aria-hidden="true" />
              </ContextMenuItemIcon>
              复制链接
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <Folder aria-hidden="true" />
                移动到…
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-40">
                <ContextMenuItem onSelect={() => setAction("已移动到收件箱")}>收件箱</ContextMenuItem>
                <ContextMenuItem onSelect={() => setAction("已移动到随手记")}>随手记</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={() => setAction("已选择删除文稿")}>
              <ContextMenuItemIcon>
                <Trash2 aria-hidden="true" />
              </ContextMenuItemIcon>
              删除文稿
              <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <span className="text-caption text-muted-foreground">{action}</span>
      </div>
    </GalleryCell>
  );
}

function TooltipCell() {
  return (
    <GalleryCell id="tooltip" title="Tooltip · 工具提示" description="来自 Animate UI · 共享浮层在多个触发器之间以 spring 动画连续过渡">
      <TooltipProvider openDelay={700} closeDelay={120}>
        <Tooltip side="top" sideOffset={8}>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="AI 润色">
              <Sparkles />
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI 润色选中文本</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </GalleryCell>
  );
}

function DialogCell() {
  return (
    <GalleryCell
      id="dialog"
      title="Dialog · 对话框"
      description="左侧触发真实模态框；右侧常驻展示基础表面、层级与 footer"
      className="col-span-full"
      contentClassName="min-h-72"
    >
      <div className="grid w-full items-center gap-8 md:grid-cols-[minmax(180px,0.7fr)_minmax(320px,1.3fr)]">
        <div className="flex flex-col items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">打开真实对话框</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新文稿</DialogTitle>
                <DialogDescription>文稿会保存在当前本地写作目录中。</DialogDescription>
              </DialogHeader>
              <Input placeholder="文稿标题" />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>创建</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <span className="text-caption text-muted-foreground">包含 scrim、焦点接管和关闭动作</span>
        </div>

        <div className="text-body grid w-full max-w-sm gap-4 rounded-xl bg-background p-4 text-foreground ring-1 ring-foreground/10">
          <DialogHeader>
            <h3 className="text-subtitle font-heading leading-none font-medium">基础 Dialog 表面</h3>
            <p className="text-body text-muted-foreground">标题、说明、内容与 footer 位于同一表面。</p>
          </DialogHeader>
          <Input value="可直接检查的静态内容" readOnly />
          <DialogFooter>
            <Button variant="outline">取消</Button>
            <Button>确认</Button>
          </DialogFooter>
        </div>
      </div>
    </GalleryCell>
  );
}

function NavigationCell() {
  return (
    <GalleryCell
      id="navigation"
      title="Navigation Item · 左侧栏导航项"
      description="14px 文字 · 16px 图标 · 32px 高 · 水平 8px · 图文 6px · 项间 4px · 10px 圆角"
    >
      <div className="flex w-full max-w-64 flex-col gap-1 rounded-2xl border border-[var(--sidebar-glass-library-border)] bg-[var(--sidebar-glass-library-bg)] p-2 shadow-[var(--sidebar-glass-library-shadow)]">
        <NavigationItem selected active>
          <FileText />
          激活选择
        </NavigationItem>
        <NavigationItem selected active={false}>
          <Check />
          失焦选择
        </NavigationItem>
        <NavigationItem>
          <Folder />
          普通导航项
        </NavigationItem>
      </div>
    </GalleryCell>
  );
}

function SheetRowCell() {
  return (
    <GalleryCell
      id="sheet-row"
      title="列表栏文稿项"
      description="按真实列表尺寸竖向排列；首项为激活选择，其余为普通文稿项"
      className="row-span-2"
      contentClassName="min-h-0"
    >
      <div className="w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-card p-2">
        {SAMPLE_SHEETS.map((sheet, index) => (
          <SheetRow
            key={sheet.id}
            active
            sheet={sheet}
            projectTitle="收件箱"
            selected={index === 0}
            nextSelected={false}
            selectedBefore={false}
            selectedAfter={false}
            current={index === 0}
            dragging={false}
            dropPosition={null}
            reorderable={false}
            movable={false}
            onSelectSheet={() => undefined}
            onContextMenu={() => undefined}
            onStartPointerDrag={() => undefined}
            onSuppressClickAfterDrag={() => false}
          />
        ))}
      </div>
    </GalleryCell>
  );
}

function FunctionSegmentedCell() {
  const [value, setValue] = useState<(typeof FUNCTION_TABS)[number]["value"]>("media");
  return (
    <GalleryCell id="function-segmented" title="Tabs · 单图标" description="来自 Animate UI · 文稿功能栏的紧凑图标切换器">
      <AnimateTabs value={value} onValueChange={(nextValue) => setValue(nextValue as typeof value)} className="w-full max-w-64">
        <AnimateTabsList className="grid w-full grid-cols-3" aria-label="文稿功能">
          {FUNCTION_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <AnimateTabsTrigger key={tab.value} value={tab.value} aria-label={tab.label} title={tab.label}>
                <Icon aria-hidden="true" />
              </AnimateTabsTrigger>
            );
          })}
        </AnimateTabsList>
      </AnimateTabs>
    </GalleryCell>
  );
}

function InformationSegmentedCell() {
  const [value, setValue] = useState<(typeof INFORMATION_TABS)[number]["value"]>("properties");
  return (
    <GalleryCell id="information-segmented" title="Tabs · 图标与文字" description="来自 Animate UI · 文稿信息面板的属性/统计切换">
      <div className="w-full max-w-64 rounded-[var(--menu-radius)] border border-[var(--menu-border)] bg-[var(--menu-background)] p-4 shadow-[var(--menu-solid-shadow)] [--foreground:var(--menu-body-foreground)] [--muted-foreground:var(--menu-muted-foreground)]">
        <AnimateTabs value={value} onValueChange={(nextValue) => setValue(nextValue as typeof value)}>
          <AnimateTabsList className="grid w-full grid-cols-2" aria-label="文稿信息分类">
            {INFORMATION_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <AnimateTabsTrigger key={tab.value} value={tab.value}>
                  <Icon aria-hidden="true" />
                  <span>{tab.label}</span>
                </AnimateTabsTrigger>
              );
            })}
          </AnimateTabsList>
        </AnimateTabs>
      </div>
    </GalleryCell>
  );
}

function AnimateTabsCell() {
  return (
    <GalleryCell id="animate-tabs" title="Tabs · 内容切换" description="来自 Animate UI · spring 高亮、横向内容切换与自适应高度动画">
      <AnimateTabs defaultValue="writing" className="w-full max-w-72">
        <AnimateTabsList className="grid w-full grid-cols-3" aria-label="Animate UI 标签页示例">
          <AnimateTabsTrigger value="writing">写作</AnimateTabsTrigger>
          <AnimateTabsTrigger value="appearance">外观</AnimateTabsTrigger>
          <AnimateTabsTrigger value="assistant">AI 助手</AnimateTabsTrigger>
        </AnimateTabsList>
        <AnimateTabsContents className="rounded-xl border border-border bg-card">
          <AnimateTabsContent value="writing" className="p-4">
            <p className="text-body font-medium">专注写作</p>
            <p className="text-caption mt-1 text-muted-foreground">保持编辑器安静，让内容始终处于视觉中心。</p>
          </AnimateTabsContent>
          <AnimateTabsContent value="appearance" className="p-4">
            <p className="text-body font-medium">界面外观</p>
            <p className="text-caption mt-1 text-muted-foreground">亮色、暗色与系统模式共享同一套语义 Token。</p>
            <p className="text-caption mt-2 text-muted-foreground">切换时可观察内容横向滑动和容器高度变化。</p>
          </AnimateTabsContent>
          <AnimateTabsContent value="assistant" className="p-4">
            <p className="text-body font-medium">AI 助手</p>
            <p className="text-caption mt-1 text-muted-foreground">建议可审阅、修改可撤销，写作者始终拥有最终决定权。</p>
          </AnimateTabsContent>
        </AnimateTabsContents>
      </AnimateTabs>
    </GalleryCell>
  );
}

function LiquidGlassCell() {
  return (
    <GalleryCell id="liquid-glass" title="Liquid Glass Button · 液态玻璃按钮" description="明确保留的复合材质例外，不替代普通 Button">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-tint)] p-5">
        <LiquidGlassButton aria-label="AI 助手">
          <Sparkles className="size-4" />
        </LiquidGlassButton>
        <LiquidGlassButton active aria-label="AI 助手已打开">
          <Bot className="size-4" />
        </LiquidGlassButton>
        <LiquidGlassButton tone="danger" aria-label="关闭">
          <Trash2 className="size-4" />
        </LiquidGlassButton>
      </div>
    </GalleryCell>
  );
}
