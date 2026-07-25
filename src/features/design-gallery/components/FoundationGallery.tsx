/**
 * [INPUT]: 依赖全局六级字体、shadcn 圆角 Token、现有公共阴影与 Primary focus ring
 * [OUTPUT]: 对外提供 FoundationGallery，连续展示 Typography、Radius 与四级 Shadow 候选规范
 * [POS]: design-gallery 的基础规范展台，先列出真实尺度和收敛候选，再进入交互组件陈列
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */

const RADIUS_TOKENS = [
  { name: "sm", token: "--radius-sm", value: "6px", usage: "微型表面" },
  { name: "md", token: "--radius-md", value: "8px", usage: "紧凑控件" },
  { name: "lg", token: "--radius-lg", value: "10px", usage: "默认控件" },
  { name: "xl", token: "--radius-xl", value: "14px", usage: "卡片与浮层" },
  { name: "2xl", token: "--radius-2xl", value: "18px", usage: "Dialog 与面板" },
  { name: "3xl", token: "--radius-3xl", value: "22px", usage: "大型浮动表面" },
  { name: "4xl", token: "--radius-4xl", value: "26px", usage: "大型展示容器" },
] as const;

const SHADOW_LEVELS = [
  {
    name: "Subtle",
    source: "--form-field-shadow",
    value: "0 1px 2px",
    usage: "输入框、消息气泡、Chip",
    shadow: "var(--form-field-shadow)",
  },
  {
    name: "Raised",
    source: "--editor-image-action-shadow",
    value: "0 4px 14px",
    usage: "卡片、工具条、普通浮层",
    shadow: "var(--editor-image-action-shadow)",
  },
  {
    name: "Overlay",
    source: "--menu-solid-shadow",
    value: "双层投影",
    usage: "菜单、Toast、Dialog",
    shadow: "var(--menu-solid-shadow)",
  },
  {
    name: "Focus",
    source: "ring-3 ring-primary/20",
    value: "3px Primary ring",
    usage: "键盘焦点、选中确认",
    className: "ring-3 ring-primary/20",
  },
] as const;

export function FoundationGallery() {
  return (
    <>
      <section id="typography" className="col-span-full min-h-72 scroll-mt-4 bg-background p-5 text-foreground">
        <header>
          <h2 className="text-body font-semibold">文字层级</h2>
          <p className="text-caption mt-1 leading-4 text-muted-foreground">
            应用只使用六级字号；13px 是默认 UI 基尺寸，24px 是界面最大字号
          </p>
        </header>
        <div className="grid min-h-52 w-full items-center gap-x-10 gap-y-5 py-6 sm:grid-cols-2">
          {[
            ["12px · Caption", "text-caption text-muted-foreground", "辅助说明、时间、状态与补充信息"],
            ["13px · Base", "text-app-base", "菜单、按钮与默认界面文字"],
            ["14px · Body", "text-body", "导航项、正文、主要控件文字与需要更清晰阅读的内容"],
            ["16px · Subtitle", "text-subtitle font-semibold", "面板标题与重要分组标题"],
            ["18px · Title", "text-title font-semibold", "页面标题与主要内容标题"],
            ["24px · Display", "text-display font-bold tracking-tight", "落笔，让写作自然发生"],
          ].map(([label, className, sample]) => (
            <div key={label}>
              <span className="text-caption font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
              <p className={`mt-1 ${className}`}>{sample}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="radius-scale" className="col-span-full min-h-72 scroll-mt-4 bg-background p-5 text-foreground">
        <header>
          <h2 className="text-body font-semibold">圆角尺度</h2>
          <p className="text-caption mt-1 leading-4 text-muted-foreground">
            直接读取 shadcn 圆角 Token；普通界面只使用这套倍率与 rounded-full
          </p>
        </header>
        <div className="grid min-h-52 w-full items-center gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
          {RADIUS_TOKENS.map(({ name, token, value, usage }) => (
            <div key={token} className="grid min-w-0 grid-cols-[88px_1fr] items-center gap-3">
              <div className="h-16 w-[88px] border border-primary/30 bg-primary/10 shadow-xs" style={{ borderRadius: `var(${token})` }} />
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
            <div className="h-16 w-[88px] rounded-full border border-primary/30 bg-primary/10 shadow-xs" />
            <div className="min-w-0">
              <p className="text-body font-semibold">full</p>
              <code className="text-caption block text-muted-foreground">rounded-full</code>
              <p className="text-caption mt-1 text-muted-foreground">圆形与胶囊</p>
            </div>
          </div>
        </div>
      </section>

      <section id="shadow-scale" className="col-span-full min-h-72 scroll-mt-4 bg-background p-5 text-foreground">
        <header>
          <h2 className="text-body font-semibold">阴影四级候选</h2>
          <p className="text-caption mt-1 leading-4 text-muted-foreground">
            从现有真实阴影中抽出 Subtle、Raised、Overlay 与 Focus 四级；当前先用于逐项确认，确认后再迁移组件别名
          </p>
        </header>
        <div className="grid min-h-52 w-full items-center gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {SHADOW_LEVELS.map(({ name, source, value, usage, ...sample }) => (
            <article key={name} className="min-w-0">
              <div
                className={`h-24 rounded-xl border border-border bg-card ${"className" in sample ? sample.className : ""}`}
                style={"shadow" in sample ? { boxShadow: sample.shadow } : undefined}
                aria-hidden="true"
              />
              <p className="text-body mt-4 font-semibold">
                {name} · {value}
              </p>
              <code className="text-caption mt-0.5 block break-all text-muted-foreground">{source}</code>
              <p className="text-caption mt-1 text-muted-foreground">{usage}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
