/**
 * [INPUT]: 依赖 React、lucide-react、shadcn/ui primitives、shared 复合控件与全局语义 Token
 * [OUTPUT]: 对外提供 DesignGallery 开发态组件陈列室与关闭回调入口
 * [POS]: design-gallery 的编辑区表面，以连续矩阵展示全部真实组件和交互状态，不接触业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import {
  AlignLeft,
  Bold,
  Bot,
  Check,
  Code2,
  Copy,
  FileText,
  Folder,
  Italic,
  MoreHorizontal,
  Plus,
  Settings2,
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
import { FunctionSegmentedTabs } from "@/shared/components/FunctionSegmentedTabs";
import { LiquidGlassButton } from "@/shared/components/LiquidGlassButton";
import { NavigationItem } from "@/shared/components/NavigationItem";

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

const SEGMENTED_TABS = [
  { value: "files", label: "文稿", icon: FileText },
  { value: "assistant", label: "AI", icon: Bot },
  { value: "settings", label: "设置", icon: Settings2 },
] as const;

export function DesignGallery({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground" data-app-tooltip-scope>
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4" data-tauri-drag-region>
        <div className="flex min-w-0 items-center gap-2">
          <Code2 className="size-4 text-primary" aria-hidden="true" />
          <span className="truncate text-sm font-semibold">设计系统</span>
          <span className="text-xs text-muted-foreground">15 个组件与基础规范</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-primary uppercase">
            Dev only
          </span>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭设计系统" title="返回文稿" onClick={onClose}>
          <X />
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-border" aria-label="组件预览矩阵">
        <div className="grid auto-rows-[290px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-px">
          <ColorTokenCell />
          <TypographyCell />
          <ButtonCell />
          <InputCell />
          <SelectCell />
          <SelectionCell />
          <TextareaCell />
          <ToggleCell />
          <ProgressCell />
          <DropdownCell />
          <TooltipCell />
          <DialogCell />
          <NavigationCell />
          <SegmentedCell />
          <LiquidGlassCell />
        </div>
      </main>
    </div>
  );
}

function GalleryCell({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 bg-background p-5">
      <header>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
      </header>
      <div className="flex h-[205px] items-center justify-center">{children}</div>
    </section>
  );
}

function ColorTokenCell() {
  return (
    <GalleryCell id="colors" title="语义颜色" description="index.css 中跨组件复用的核心语义 Token">
      <div className="grid w-full grid-cols-4 gap-x-3 gap-y-4">
        {COLOR_TOKENS.map(({ name, token }) => (
          <div key={token} className="min-w-0">
            <div className="aspect-[1.65] rounded-lg border border-border shadow-xs" style={{ background: `var(${token})` }} />
            <p className="mt-1.5 truncate text-[10px] font-medium">{name}</p>
            <code className="block truncate text-[9px] text-muted-foreground">{token}</code>
          </div>
        ))}
      </div>
    </GalleryCell>
  );
}

function TypographyCell() {
  return (
    <GalleryCell id="typography" title="文字层级" description="系统字体栈与常用界面层级">
      <div className="w-full space-y-3">
        <p className="text-2xl font-bold tracking-tight">落笔，让写作自然发生</p>
        <p className="text-base font-semibold">专业写作，从清晰的层级开始</p>
        <p className="text-sm leading-6">正文使用克制、稳定的系统字体，保持长时间阅读与编辑的舒适度。</p>
        <p className="text-xs text-muted-foreground">辅助信息 · 12px / Secondary foreground</p>
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
        <span className="text-[11px] text-muted-foreground">主按钮已点击 {count} 次</span>
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
          <p className="mt-1.5 text-[11px] text-destructive">文件名不能包含“/”</p>
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
        <label className="text-xs font-medium" htmlFor="gallery-format-select">
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
        <p className="text-[11px] text-muted-foreground">当前值：{value}</p>
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
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>保存时自动创建快照</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          <span>显示 Markdown 标记</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
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
        <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{value.length} / 200</p>
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
        <div className="flex items-center justify-between text-xs">
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
        <span className="text-[11px] text-muted-foreground">{action}</span>
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
    <GalleryCell id="dialog" title="Dialog" description="同表面 footer、焦点接管与关闭动作">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">打开对话框</Button>
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
    </GalleryCell>
  );
}

function NavigationCell() {
  const [selected, setSelected] = useState("drafts");
  return (
    <GalleryCell id="navigation" title="Navigation Item" description="Loby 侧栏的选择态、激活态与普通态">
      <div className="w-full max-w-56 rounded-xl border border-border bg-[var(--surface-soft)] p-2">
        <NavigationItem selected={selected === "drafts"} active onClick={() => setSelected("drafts")}>
          <FileText className="size-4" />
          草稿
        </NavigationItem>
        <NavigationItem selected={selected === "published"} active onClick={() => setSelected("published")}>
          <Check className="size-4" />
          已发布
        </NavigationItem>
        <NavigationItem selected={selected === "archive"} active={false} onClick={() => setSelected("archive")}>
          <Folder className="size-4" />
          归档
        </NavigationItem>
      </div>
    </GalleryCell>
  );
}

function SegmentedCell() {
  const [value, setValue] = useState<(typeof SEGMENTED_TABS)[number]["value"]>("files");
  return (
    <GalleryCell id="segmented" title="Function Segmented Tabs" description="Loby 多功能面板的模式切换器">
      <div className="w-full max-w-64">
        <FunctionSegmentedTabs value={value} tabs={[...SEGMENTED_TABS]} ariaLabel="面板模式" showLabels onValueChange={setValue} />
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
