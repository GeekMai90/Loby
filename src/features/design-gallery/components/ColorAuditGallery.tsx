/**
 * [INPUT]: 依赖 React、浏览器 Canvas 颜色解析、colorAudit 源码审计结果与全局语义 Token
 * [OUTPUT]: 对外提供 ColorAuditGallery，分开展示亮暗基础色板、亮色语义映射、材质效果、引用位置、领域裸色与收敛候选
 * [POS]: design-gallery 的颜色治理展台；亮暗主题均先按真实值去重，再呈现语义与效果层，避免把 Token 数量误判成颜色数量
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import {
  RAW_COLOR_GROUPS,
  RAW_COLOR_RECORDS,
  SEMANTIC_COLOR_GROUPS,
  SEMANTIC_COLOR_TOKENS,
  SPECIAL_VISUAL_COLOR_TOKENS,
  UNRESOLVED_RAW_COLORS,
  UNUSED_SEMANTIC_COLOR_TOKENS,
  type RawColorRecord,
  type SemanticColorToken,
} from "@/features/design-gallery/colorAudit";
import { cn } from "@/shared/lib/utils";

const FOUNDATION_COLOR_TOKENS = SEMANTIC_COLOR_TOKENS.filter((token) => token.kind !== "effect");
const CORE_COLOR_SECTIONS = [
  {
    title: "表面层级",
    roles: [
      { label: "主背景", token: "--background", level: "Surface 01", usage: "应用主画布与默认页面背景" },
      { label: "柔和背景", token: "--background-soft", level: "Surface 02", usage: "轻微分区、图片承载与低对比容器" },
      { label: "次级背景", token: "--muted", level: "Surface 03", usage: "次级卡片、轨道、标签与用户消息" },
      { label: "悬停背景", token: "--background-hover", level: "State Hover", usage: "普通内容和行项目的悬停状态" },
    ],
  },
  {
    title: "边界层级",
    roles: [
      { label: "普通边框", token: "--border", level: "Border 01", usage: "输入框、卡片和普通控件边界" },
      { label: "强边框", token: "--separator-strong", level: "Border 02", usage: "需要明确分区的边界与结构线" },
    ],
  },
  {
    title: "文字层级",
    roles: [
      { label: "主文字", token: "--foreground", level: "Text 01", usage: "标题、正文与主要操作文字" },
      { label: "次级文字", token: "--muted-foreground", level: "Text 02", usage: "说明、元数据、占位与辅助信息" },
      { label: "三级文字", token: "--foreground-tertiary", level: "Text 03", usage: "更弱的标记、行号与装饰信息" },
    ],
  },
  {
    title: "操作与状态",
    roles: [
      { label: "主要操作", token: "--primary", level: "Action Primary", usage: "主按钮、激活选择与焦点" },
      { label: "成功", token: "--status-success", level: "Status Success", usage: "完成、连接成功与新增结果" },
      { label: "警告", token: "--status-warning", level: "Status Warning", usage: "提醒、待确认与风险提示" },
      { label: "危险", token: "--destructive", level: "Status Danger", usage: "删除、失败与不可逆操作" },
    ],
  },
] as const;

export function ColorAuditGallery() {
  return (
    <>
      <FoundationColorCell mode="light" />
      <FoundationColorCell mode="dark" />
      <ColorTokenCell mode="light" />
      <EffectTokenCell />
      <ColorAuditSummaryCell />
      <RawColorAuditCell />
    </>
  );
}

function AuditCell({
  id,
  title,
  description,
  className,
  children,
}: {
  id: string;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("min-h-72 scroll-mt-4 bg-background p-5 text-foreground", className)}>
      <header>
        <h2 className="text-body font-semibold">{title}</h2>
        <p className="text-caption mt-1 leading-4 text-muted-foreground">{description}</p>
      </header>
      <div className="flex min-h-52 items-stretch justify-center py-6">{children}</div>
    </section>
  );
}

function ColorTokenCell({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark";
  const tokenGridRef = useRef<HTMLDivElement>(null);
  const [resolvedValues, setResolvedValues] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    if (!tokenGridRef.current) return;
    const nextValues: Record<string, string> = {};
    for (const swatch of tokenGridRef.current.querySelectorAll<HTMLElement>("[data-color-preview]")) {
      const token = swatch.dataset.colorPreview;
      if (token) nextValues[token] = cssColorToHex(getComputedStyle(swatch).backgroundColor);
    }
    setResolvedValues(nextValues);
  }, [mode]);

  return (
    <AuditCell
      id={`colors-${mode}`}
      title={`语义映射 · ${dark ? "Dark" : "Light"}`}
      description={`同一种实际颜色可以承载多个职责；这里按 Token 展示${dark ? "暗色" : "亮色"}语义、声明值与真实消费者，不再混入阴影和渐变`}
      className={cn("col-span-full", dark ? "dark" : "theme-scope-light")}
    >
      <div ref={tokenGridRef} className="flex w-full flex-col gap-8">
        {SEMANTIC_COLOR_GROUPS.map((group) => {
          const tokens = SEMANTIC_COLOR_TOKENS.filter((token) => token.group === group && token.kind !== "effect");
          if (tokens.length === 0) return null;
          return (
            <section key={group} className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-caption font-bold text-muted-foreground">{group}</h3>
                <span className="text-caption text-muted-foreground">{tokens.length} 项</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
                {tokens.map((token) => (
                  <ColorTokenSwatch key={token.token} colorToken={token} mode={mode} resolvedValue={resolvedValues[token.token]} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AuditCell>
  );
}

interface FoundationColorGroup {
  hex: string;
  tokens: SemanticColorToken[];
}

function FoundationColorCell({ mode }: { mode: "light" | "dark" }) {
  const dark = mode === "dark";
  const probeRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<FoundationColorGroup[] | null>(null);
  const resolvedByToken = Object.fromEntries(
    (groups ?? []).flatMap((group) => group.tokens.map((token) => [token.token, group.hex] as const)),
  );

  useLayoutEffect(() => {
    if (!probeRef.current) return;
    const grouped = new Map<string, SemanticColorToken[]>();
    for (const probe of probeRef.current.querySelectorAll<HTMLElement>("[data-foundation-token]")) {
      const tokenName = probe.dataset.foundationToken;
      const token = FOUNDATION_COLOR_TOKENS.find((candidate) => candidate.token === tokenName);
      if (!token) continue;
      const hex = cssColorToHex(getComputedStyle(probe).backgroundColor);
      if (!/^#[\dA-F]{6}(?:[\dA-F]{2})?$/.test(hex) || hex === TRANSPARENT_HEX) continue;
      grouped.set(hex, [...(grouped.get(hex) ?? []), token]);
    }
    setGroups([...grouped.entries()].map(([hex, tokens]) => ({ hex, tokens })));
  }, [mode]);

  return (
    <AuditCell
      id={`foundation-colors-${mode}`}
      title={`基础颜色 · ${dark ? "Dark" : "Light"}`}
      description={`按浏览器解析后的${dark ? "暗色" : "亮色"}实际颜色值去重；每张卡片列出共用该颜色的全部语义别名，供逐项决定保留、合并或作为领域例外`}
      className={cn(dark ? "dark" : "theme-scope-light", "col-span-full")}
    >
      <div className="w-full">
        <div className="mb-10 space-y-7">
          <header>
            <h3 className="text-body font-semibold">核心 UI 语义</h3>
            <p className="text-caption mt-1 text-muted-foreground">
              先按正常 UI 层级确认这些基础角色，再处理其余品牌色、状态派生色和领域颜色
            </p>
          </header>
          {CORE_COLOR_SECTIONS.map((section) => (
            <section key={section.title}>
              <h4 className="text-caption mb-3 font-bold text-muted-foreground">{section.title}</h4>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
                {section.roles.map((role) => (
                  <article
                    key={role.token}
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                    data-core-color={role.token}
                  >
                    <div className="h-20 border-b border-border" style={{ background: `var(${role.token})` }} aria-hidden="true" />
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-body font-semibold">{role.label}</p>
                          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{role.level}</span>
                        </div>
                        <code className="text-caption font-semibold">{resolvedByToken[role.token] ?? "读取中…"}</code>
                      </div>
                      <code className="text-caption mt-2 block break-all text-muted-foreground">{role.token}</code>
                      <p className="text-caption mt-1 leading-4 text-muted-foreground">{role.usage}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/35 px-4 py-3">
          <div>
            <p className="text-body font-medium">全部实际颜色</p>
            <p className="text-caption mt-0.5 text-muted-foreground">核心语义之后的完整去重色板，用于逐项决定合并或保留</p>
          </div>
          <strong className="text-body tabular-nums">{groups ? `${groups.length} 色` : "解析中…"}</strong>
        </div>
        {groups && groups.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3">
            {groups.map((group) => (
              <article
                key={group.hex}
                className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs"
                data-foundation-color={group.hex}
              >
                <div className="h-24 border-b border-border" style={{ background: group.hex }} aria-hidden="true" />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-body font-semibold">{group.hex}</code>
                    <span className="text-caption text-muted-foreground">{group.tokens.length} 个语义</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {group.tokens.map((token) => (
                      <code key={token.token} className="rounded-md bg-muted px-1.5 py-1 text-[10px] leading-3 text-muted-foreground">
                        {token.token}
                      </code>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-caption py-8 text-center text-muted-foreground">正在解析{dark ? "暗色" : "亮色"}主题的实际颜色值…</p>
        )}
        <div
          ref={probeRef}
          className={cn(
            dark ? "dark" : "theme-scope-light",
            "pointer-events-none fixed -left-[9999px] top-0 size-px overflow-hidden opacity-0",
          )}
          aria-hidden="true"
        >
          {FOUNDATION_COLOR_TOKENS.map((token) => (
            <i key={token.token} data-foundation-token={token.token} style={colorTokenPreviewStyle(token)} />
          ))}
        </div>
      </div>
    </AuditCell>
  );
}

function EffectTokenCell() {
  const effectTokens = SEMANTIC_COLOR_TOKENS.filter((token) => token.kind === "effect");
  const groups = SEMANTIC_COLOR_GROUPS.filter((group) => effectTokens.some((token) => token.group === group));
  return (
    <AuditCell
      id="effects-light"
      title="现有阴影与材质 · Light"
      description="阴影、渐变和滤镜从颜色清单中独立出来；这里保留现状供四级阴影收敛时逐项映射"
      className="theme-scope-light col-span-full"
    >
      <div className="flex w-full flex-col gap-8">
        {groups.map((group) => {
          const tokens = effectTokens.filter((token) => token.group === group);
          return (
            <section key={group} className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-caption font-bold text-muted-foreground">{group}</h3>
                <span className="text-caption text-muted-foreground">{tokens.length} 项</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
                {tokens.map((token) => (
                  <ColorTokenSwatch key={token.token} colorToken={token} mode="light" />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AuditCell>
  );
}

function ColorTokenSwatch({
  colorToken,
  mode,
  resolvedValue,
}: {
  colorToken: SemanticColorToken;
  mode: "light" | "dark";
  resolvedValue?: string;
}) {
  const declaredValue = mode === "dark" ? colorToken.darkValue : colorToken.lightValue;
  return (
    <article
      className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-xs"
      data-color-token={colorToken.token}
      data-color-used={colorToken.used ? "true" : "false"}
    >
      <div
        className="aspect-[1.85] rounded-lg border border-border"
        style={colorTokenPreviewStyle(colorToken)}
        data-color-preview={colorToken.kind === "effect" ? undefined : colorToken.token}
        aria-hidden="true"
      />
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-caption min-w-0 truncate font-semibold">{colorToken.label}</p>
        <span
          className={cn(
            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            colorToken.used ? "bg-status-success/10 text-status-success" : "bg-status-warning/10 text-status-warning",
          )}
        >
          {colorToken.used ? "使用中" : "未使用"}
        </span>
      </div>
      <code className="text-caption mt-0.5 block break-all leading-4 text-muted-foreground">{colorToken.token}</code>
      <code className="text-caption block truncate font-semibold leading-4 text-foreground" title={declaredValue}>
        {colorToken.kind === "effect" ? "材质 Token" : (resolvedValue ?? "读取中…")}
      </code>
      <p className="mt-1 truncate text-[10px] leading-4 text-muted-foreground" title={declaredValue}>
        定义：{declaredValue}
      </p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
        {colorToken.directLocations.length > 0
          ? `源码直接引用 ${colorToken.directLocations.length} 处`
          : colorToken.indirectTokens.length > 0
            ? `由 ${colorToken.indirectTokens.slice(0, 2).join("、")} 间接引用`
            : "产品源码无引用"}
      </p>
      {colorToken.directLocations.slice(0, 2).map((location) => (
        <code key={`${location.path}:${location.line}`} className="mt-0.5 block truncate text-[10px] leading-4 text-muted-foreground">
          {location.path}:{location.line}
        </code>
      ))}
      {colorToken.migrationNote && (
        <p className="mt-2 border-t border-border pt-2 text-[10px] leading-4 text-status-warning">{colorToken.migrationNote}</p>
      )}
    </article>
  );
}

function ColorAuditSummaryCell() {
  const lightProbeRef = useRef<HTMLDivElement>(null);
  const darkProbeRef = useRef<HTMLDivElement>(null);
  const [analysis, setAnalysis] = useState<{ light: PaletteAnalysis; dark: PaletteAnalysis } | null>(null);

  useLayoutEffect(() => {
    if (!lightProbeRef.current || !darkProbeRef.current) return;
    setAnalysis({ light: analyzeResolvedPalette(lightProbeRef.current), dark: analyzeResolvedPalette(darkProbeRef.current) });
  }, []);

  const solidTokens = SEMANTIC_COLOR_TOKENS.filter((token) => token.kind !== "effect");
  return (
    <AuditCell
      id="color-audit-summary"
      title="Color Audit · 颜色审计"
      description="从 index.css 与当前 renderer 源码实时生成；未使用、重复和近似结果不依赖手工色表"
      className="col-span-full"
    >
      <div className="w-full space-y-5">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <AuditMetric
            label="语义颜色与材质"
            value={SEMANTIC_COLOR_TOKENS.length}
            note={`已过滤 ${SPECIAL_VISUAL_COLOR_TOKENS.length} 个特殊视觉 Token`}
          />
          <AuditMetric label="产品未使用 Token" value={UNUSED_SEMANTIC_COLOR_TOKENS.length} note="含间接引用分析" />
          <AuditMetric
            label="领域裸色"
            value={RAW_COLOR_RECORDS.filter((record) => record.decision === "domain").length}
            note="用户/发布内容数据"
          />
          <AuditMetric
            label="未语义化 UI 裸色"
            value={UNRESOLVED_RAW_COLORS.length}
            note={UNRESOLVED_RAW_COLORS.length === 0 ? "当前已清零" : "仍需迁移"}
            warning={UNRESOLVED_RAW_COLORS.length > 0}
          />
        </div>
        <AuditFinding title="未使用 Token" description="无直接、Tailwind utility 或别名链路引用；设计系统自身展示不计为使用。">
          {UNUSED_SEMANTIC_COLOR_TOKENS.length === 0 ? (
            <p className="text-caption text-status-success">未使用 Token 已清零。</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {UNUSED_SEMANTIC_COLOR_TOKENS.map((token) => (
                <code key={token.token} className="rounded-md bg-status-warning/10 px-2 py-1 text-[11px] text-status-warning">
                  {token.token}
                </code>
              ))}
            </div>
          )}
        </AuditFinding>
        <div className="grid gap-4 lg:grid-cols-2">
          <AuditFinding title="完全同值" description="同值可能是有意别名；仅在语义和生命周期一致时合并。">
            <DuplicateList groups={analysis?.light.exactGroups ?? []} emptyLabel="亮色值解析中…" />
          </AuditFinding>
          <AuditFinding title="近似色候选" description="RGB 距离不超过 12；这是人工复核候选，不自动合并。">
            <NearColorList pairs={analysis?.light.nearPairs ?? []} emptyLabel="亮色值解析中…" />
          </AuditFinding>
          <AuditFinding title="暗色完全同值" description="暗色覆写后仍完全相同的 Token 组。">
            <DuplicateList groups={analysis?.dark.exactGroups ?? []} emptyLabel="暗色值解析中…" />
          </AuditFinding>
          <AuditFinding title="暗色近似候选" description="检查深色表面是否存在无意义的细碎层级。">
            <NearColorList pairs={analysis?.dark.nearPairs ?? []} emptyLabel="暗色值解析中…" />
          </AuditFinding>
        </div>
        <ColorProbes ref={lightProbeRef} className="theme-scope-light" tokens={solidTokens} />
        <ColorProbes ref={darkProbeRef} className="dark" tokens={solidTokens} />
      </div>
    </AuditCell>
  );
}

function ColorProbes({ ref, className, tokens }: { ref: Ref<HTMLDivElement>; className: string; tokens: SemanticColorToken[] }) {
  return (
    <div
      ref={ref}
      className={cn(className, "pointer-events-none fixed -left-[9999px] top-0 size-px overflow-hidden opacity-0")}
      aria-hidden="true"
    >
      {tokens.map((token) => (
        <i key={token.token} data-audit-token={token.token} style={colorTokenPreviewStyle(token)} />
      ))}
    </div>
  );
}

function AuditMetric({ label, value, note, warning = false }: { label: string; value: number; note: string; warning?: boolean }) {
  return (
    <div className="bg-card p-4">
      <p className="text-caption text-muted-foreground">{label}</p>
      <strong className={cn("text-display mt-1 block tabular-nums", warning ? "text-status-warning" : "text-foreground")}>{value}</strong>
      <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
    </div>
  );
}

function AuditFinding({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="text-caption mt-1 text-muted-foreground">{description}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RawColorAuditCell() {
  return (
    <AuditCell
      id="hardcoded-colors"
      title="Hard-coded Colors · 写死颜色"
      description="逐项标出当前裸色值、源码位置和用途；普通 UI 必须清零，领域内容 palette 与应用 Token 隔离"
      className="col-span-full"
    >
      <div className="w-full space-y-3">
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-body",
            UNRESOLVED_RAW_COLORS.length === 0
              ? "border-status-success/30 bg-status-success/10 text-status-success"
              : "border-status-warning/30 bg-status-warning/10 text-status-warning",
          )}
        >
          {UNRESOLVED_RAW_COLORS.length === 0
            ? "普通应用 UI 裸色已清零；下方均为用户内容、编辑器主题或发布产物中的领域颜色。"
            : `仍有 ${UNRESOLVED_RAW_COLORS.length} 个普通 UI 裸色需要迁移。`}
        </div>
        {RAW_COLOR_GROUPS.map((group) => {
          const records = RAW_COLOR_RECORDS.filter((record) => record.group === group);
          const unresolved = records.some((record) => record.decision === "unresolved");
          return (
            <details key={group} open={unresolved} className="rounded-xl border border-border bg-card">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-body font-semibold">
                <span>{group}</span>
                <span className={cn("text-caption", unresolved ? "text-status-warning" : "text-muted-foreground")}>
                  {records.length} 色
                </span>
              </summary>
              <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
                {records.map((record) => (
                  <RawColorCard key={record.key} record={record} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </AuditCell>
  );
}

function RawColorCard({ record }: { record: RawColorRecord }) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-background p-3">
      <div className="flex items-start gap-3">
        <span
          className="size-11 shrink-0 rounded-lg border border-border shadow-xs"
          style={{ background: record.cssValue }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <code className="text-caption break-all font-semibold">{record.value}</code>
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                record.decision === "domain" ? "bg-muted text-muted-foreground" : "bg-status-warning/10 text-status-warning",
              )}
            >
              {record.decision === "domain" ? "领域色" : "待迁移"}
            </span>
          </div>
          <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{record.purpose}</p>
        </div>
      </div>
      <div className="mt-2 border-t border-border pt-2">
        {record.locations.slice(0, 4).map((location) => (
          <div key={`${location.path}:${location.line}`} className="mb-1 last:mb-0" title={location.snippet}>
            <code className="block truncate text-[10px] leading-4 text-foreground">
              {location.path}:{location.line}
            </code>
            <p className="truncate text-[10px] leading-4 text-muted-foreground">{location.snippet}</p>
          </div>
        ))}
        {record.locations.length > 4 && <p className="text-[10px] text-muted-foreground">另有 {record.locations.length - 4} 处同值引用</p>}
      </div>
    </article>
  );
}

interface ExactColorGroup {
  hex: string;
  tokens: string[];
}
interface NearColorPair {
  left: { token: string; hex: string };
  right: { token: string; hex: string };
  distance: number;
}
interface PaletteAnalysis {
  exactGroups: ExactColorGroup[];
  nearPairs: NearColorPair[];
}
const TRANSPARENT_HEX = `#${"0".repeat(8)}`;

function analyzeResolvedPalette(root: HTMLElement): PaletteAnalysis {
  const entries = Array.from(root.querySelectorAll<HTMLElement>("[data-audit-token]"))
    .map((element) => ({ token: element.dataset.auditToken ?? "", hex: cssColorToHex(getComputedStyle(element).backgroundColor) }))
    .filter((entry) => /^#[\dA-F]{6}(?:[\dA-F]{2})?$/.test(entry.hex) && entry.hex !== TRANSPARENT_HEX);
  const exactMap = new Map<string, string[]>();
  for (const entry of entries) exactMap.set(entry.hex, [...(exactMap.get(entry.hex) ?? []), entry.token]);
  const exactGroups = [...exactMap.entries()]
    .filter(([, tokens]) => tokens.length > 1)
    .map(([hex, tokens]) => ({ hex, tokens }))
    .sort((left, right) => right.tokens.length - left.tokens.length)
    .slice(0, 12);
  const nearPairs: NearColorPair[] = [];
  for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
      const left = entries[leftIndex];
      const right = entries[rightIndex];
      if (left.hex === right.hex || left.hex.length !== 7 || right.hex.length !== 7) continue;
      const distance = rgbDistance(left.hex, right.hex);
      if (distance <= 12) nearPairs.push({ left, right, distance });
    }
  }
  nearPairs.sort((left, right) => left.distance - right.distance);
  return { exactGroups, nearPairs: nearPairs.slice(0, 12) };
}

function DuplicateList({ groups, emptyLabel }: { groups: ExactColorGroup[]; emptyLabel: string }) {
  if (groups.length === 0) return <p className="text-caption text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div
          key={`${group.hex}:${group.tokens.join(",")}`}
          className="grid grid-cols-[18px_72px_1fr] items-start gap-2 text-[11px] leading-4"
        >
          <span className="mt-0.5 size-4 rounded border border-border" style={{ background: group.hex }} />
          <code className="font-semibold">{group.hex}</code>
          <code className="break-all text-muted-foreground">{group.tokens.join(" · ")}</code>
        </div>
      ))}
    </div>
  );
}

function NearColorList({ pairs, emptyLabel }: { pairs: NearColorPair[]; emptyLabel: string }) {
  if (pairs.length === 0) return <p className="text-caption text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-2">
      {pairs.map((pair) => (
        <div key={`${pair.left.token}:${pair.right.token}`} className="grid grid-cols-[38px_1fr] items-start gap-2 text-[11px] leading-4">
          <span className="flex overflow-hidden rounded border border-border">
            <i className="h-5 flex-1" style={{ background: pair.left.hex }} />
            <i className="h-5 flex-1" style={{ background: pair.right.hex }} />
          </span>
          <div className="min-w-0">
            <code className="block break-all">
              {pair.left.token} · {pair.right.token}
            </code>
            <span className="text-muted-foreground">
              {pair.left.hex} / {pair.right.hex} · 距离 {pair.distance.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function colorTokenPreviewStyle(token: SemanticColorToken): CSSProperties {
  if (token.kind === "channel") return { background: `rgb(var(${token.token}))` };
  if (token.kind === "effect" && token.token.includes("shadow")) return { background: "var(--card)", boxShadow: `var(${token.token})` };
  if (token.kind === "effect" && token.token.includes("filter")) return { background: "var(--primary)", filter: `var(${token.token})` };
  if (token.kind === "effect" && /\bsolid\b/.test(token.lightValue)) return { background: "var(--card)", border: `var(${token.token})` };
  return { background: `var(${token.token})` };
}

function rgbDistance(left: string, right: string) {
  const a = [left.slice(1, 3), left.slice(3, 5), left.slice(5, 7)].map((value) => Number.parseInt(value, 16));
  const b = [right.slice(1, 3), right.slice(3, 5), right.slice(5, 7)].map((value) => Number.parseInt(value, 16));
  return Math.sqrt(a.reduce((sum, channel, index) => sum + (channel - b[index]) ** 2, 0));
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
  return `#${channels}${alpha < 255 ? alpha.toString(16).padStart(2, "0") : ""}`.toUpperCase();
}
