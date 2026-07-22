/**
 * [INPUT]: 依赖 React、lucide-react、shadcn/ui primitives、shared 复合控件与全局语义 Token
 * [OUTPUT]: 对外提供 DesignGallery 开发态组件陈列室与关闭回调入口
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
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SheetRow } from "@/features/library/components/SheetRow";
import { FunctionSegmentedTabs } from "@/shared/components/FunctionSegmentedTabs";
import { LiquidGlassButton } from "@/shared/components/LiquidGlassButton";
import { MenuSegmentedTabs } from "@/shared/components/MenuSegmentedTabs";
import { NavigationItem } from "@/shared/components/NavigationItem";
import { cn } from "@/shared/lib/utils";
import type { WritingSheet } from "@/shared/types";

const COLOR_TOKENS = [
  { name: "Primary", token: "--primary" },
  { name: "Background", token: "--background" },
  { name: "Foreground", token: "--foreground" },
  { name: "Muted", token: "--muted" },
  { name: "Border", token: "--border" },
  { name: "Destructive", token: "--destructive" },
  { name: "Success", token: "--status-success" },
  { name: "Warning", token: "--status-warning" },
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
          <span className="text-caption text-muted-foreground">19 个组件与基础规范</span>
          <span className="text-caption rounded-full bg-primary/10 px-2 py-0.5 font-bold tracking-[0.08em] text-primary uppercase">
            Dev only
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭设计系统" title="返回文稿" onClick={onClose}>
          <X />
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-border" aria-label="组件预览矩阵">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-stretch gap-px">
          <ColorTokenCell mode="light" />
          <ColorTokenCell mode="dark" />
          <SheetRowCell />
          <ButtonCell />
          <InputCell />
          <TypographyCell />
          <RadiusScaleCell />
          <SelectCell />
          <SelectionCell />
          <TextareaCell />
          <ToggleCell />
          <ProgressCell />
          <DropdownCell />
          <TooltipCell />
          <DialogCell />
          <NavigationCell />
          <FunctionSegmentedCell />
          <InformationSegmentedCell />
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
      description={`index.css 中的${dark ? "暗色" : "亮色"}语义 Token，不依赖当前应用主题`}
      className={cn("col-span-full", dark ? "dark" : "theme-scope-light")}
    >
      <div className="grid w-full max-w-4xl grid-cols-4 gap-x-4 gap-y-4">
        {COLOR_TOKENS.map(({ name, token }) => (
          <div key={token} className="min-w-0">
            <div className="aspect-[1.65] rounded-lg border border-border shadow-xs" style={{ background: `var(${token})` }} />
            <p className="text-caption mt-1.5 truncate font-medium">{name}</p>
            <code className="text-caption block break-all leading-4 text-muted-foreground">{token}</code>
          </div>
        ))}
      </div>
    </GalleryCell>
  );
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
    <GalleryCell id="button" title="Button" description="标准 variants、尺寸与禁用状态">
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
    <GalleryCell id="input" title="Input" description="默认、聚焦、无效与禁用输入状态">
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
    <GalleryCell id="select" title="Select" description="共享菜单材质、选中标记与键盘行为">
      <div className="w-full max-w-64 space-y-2">
        <label className="text-caption font-medium" htmlFor="gallery-format-select">
          图片引用格式
        </label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger id="gallery-format-select" className="w-full">
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
    <GalleryCell id="selection" title="Checkbox & Switch" description="布尔选择、开关与不可用状态">
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
    <GalleryCell id="textarea" title="Textarea" description="多行输入、占位提示与字数反馈">
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
    <GalleryCell id="toggle" title="Toggle Group" description="编辑器工具栏中的 pressed 与组合状态">
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
    <GalleryCell id="progress" title="Progress" description="确定性进度、语义标签与动态更新">
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

function DropdownCell() {
  const [action, setAction] = useState("尚未选择操作");
  return (
    <GalleryCell id="dropdown" title="Dropdown Menu" description="共享菜单、separator 与危险操作状态">
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

function TooltipCell() {
  return (
    <GalleryCell id="tooltip" title="Tooltip" description="鼠标与键盘触发的轻量解释层">
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" aria-label="AI 润色">
              <Sparkles />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            AI 润色选中文本
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </GalleryCell>
  );
}

function DialogCell() {
  return (
    <GalleryCell
      id="dialog"
      title="Dialog"
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

        <div className="text-body grid w-full max-w-sm gap-4 rounded-xl bg-[var(--surface)] p-4 text-popover-foreground ring-1 ring-foreground/10">
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
      title="左侧栏 Navigation Item"
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
      <div className="w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-[var(--surface)] p-2">
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
    <GalleryCell id="function-segmented" title="功能栏切换器" description="FunctionSegmentedTabs · 文稿功能栏的图标切换器">
      <div className="w-full max-w-64">
        <FunctionSegmentedTabs value={value} tabs={[...FUNCTION_TABS]} ariaLabel="文稿功能" onValueChange={setValue} />
      </div>
    </GalleryCell>
  );
}

function InformationSegmentedCell() {
  const [value, setValue] = useState<(typeof INFORMATION_TABS)[number]["value"]>("properties");
  return (
    <GalleryCell id="information-segmented" title="信息栏功能切换器" description="MenuSegmentedTabs · 文稿信息面板的属性/统计切换">
      <div className="w-full max-w-64 rounded-[var(--menu-radius)] border border-[var(--menu-border)] bg-[var(--menu-background)] p-4 shadow-[var(--menu-solid-shadow)] [--foreground:var(--menu-body-foreground)] [--muted-foreground:var(--menu-muted-foreground)]">
        <MenuSegmentedTabs value={value} tabs={[...INFORMATION_TABS]} ariaLabel="文稿信息分类" showLabels onValueChange={setValue} />
      </div>
    </GalleryCell>
  );
}

function LiquidGlassCell() {
  return (
    <GalleryCell id="liquid-glass" title="Liquid Glass Button" description="明确保留的复合材质例外，不替代普通 Button">
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
