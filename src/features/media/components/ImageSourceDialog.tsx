/**
 * [INPUT]: 依赖 Dialog/Button/Input、Unsplash/翻译 native command 适配、WritingSheet 与 editor 的本地/裁剪后插入回调
 * [OUTPUT]: 对外提供图片来源选择、支持中文搜索词翻译的固定尺寸 Unsplash 随机/搜索浏览、带无感预加载退避的 AI/手动搜索准备态与 16:9 横版裁剪确认的 ImageSourceDialog
 * [POS]: media feature 的交互边界；只负责选择和裁剪状态，不直接写正文或接触 API Key，最终保存/插入由调用方完成
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CropImagePreview } from "@/features/media/components/CropImagePreview";
import {
  UnsplashPreparationView,
  type UnsplashPreparationStage,
  type UnsplashPreparationVariant,
} from "@/features/media/components/UnsplashPreparationView";
import { containsChinese, type SearchQueryTranslationResult } from "@/features/media/model/searchTranslation";
import { buildUnsplashCrop, CROP_ZOOM_DEFAULT, type CropAspect } from "@/features/media/model/crop";
import type { WritingSheet } from "@/shared/types";
import { ArrowLeft, Check, ChevronDown, FileImage, Globe2, Grid2X2, KeyRound, Loader2, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type UIEvent } from "react";
import {
  getRandomUnsplashPhotos,
  getUnsplashSettings,
  searchUnsplashPhotos,
  UNSPLASH_RANDOM_BATCH_SIZE,
  type UnsplashCrop,
  type UnsplashPhoto,
  type UnsplashSettings,
} from "@/features/media/model/unsplash";

type ImageSourceStep = "source" | "search" | "crop";
type ResultsMode = "random" | "search";

const CROP_ASPECTS: CropAspect[] = [
  { width: 16, height: 9, label: "16:9" },
  { width: 3, height: 2, label: "3:2" },
  { width: 4, height: 3, label: "4:3" },
  { width: 1, height: 1, label: "1:1" },
];

const RESULTS_PRELOAD_DISTANCE = 480;
const LOAD_MORE_RETRY_BASE_DELAY = 1000;
const LOAD_MORE_RETRY_MAX_DELAY = 8000;

type SearchRunOutcome = "success" | "empty" | "failed" | "cancelled";

interface ImageSourceDialogProps {
  open: boolean;
  sheet: WritingSheet;
  onOpenChange: (open: boolean) => void;
  onInsertLocal: () => Promise<boolean>;
  onInsertUnsplash: (photo: UnsplashPhoto, crop: UnsplashCrop) => Promise<boolean>;
  aiRecommendationEnabled: boolean;
  onGenerateQuery?: (sheet: WritingSheet) => Promise<string>;
  onTranslateQuery?: (query: string) => Promise<SearchQueryTranslationResult>;
  onOpenSettings: () => void;
}

export function ImageSourceDialog({
  open,
  sheet,
  onOpenChange,
  onInsertLocal,
  onInsertUnsplash,
  aiRecommendationEnabled,
  onGenerateQuery,
  onTranslateQuery,
  onOpenSettings,
}: ImageSourceDialogProps) {
  const [step, setStep] = useState<ImageSourceStep>("source");
  const [settings, setSettings] = useState<UnsplashSettings | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [resultsMode, setResultsMode] = useState<ResultsMode>("random");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null);
  const [aspect, setAspect] = useState<CropAspect>(CROP_ASPECTS[0]);
  const [focusX, setFocusX] = useState(0.5);
  const [focusY, setFocusY] = useState(0.5);
  const [zoom, setZoom] = useState(CROP_ZOOM_DEFAULT);
  const [gridVisible, setGridVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparationStage, setPreparationStage] = useState<UnsplashPreparationStage | null>(null);
  const [preparationVariant, setPreparationVariant] = useState<UnsplashPreparationVariant>("recommendation");
  const [searching, setSearching] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const searchRequestRef = useRef(0);
  const inFlightPagesRef = useRef(new Set<number>());
  const loadedPagesRef = useRef(new Set<number>());
  const randomLoadingRef = useRef(false);
  const activeQueryRef = useRef("");
  const loadMoreFailureCountRef = useRef(0);
  const loadMoreRetryAtRef = useRef(0);
  const hasUnsplashKey = settings?.configured === true;

  useEffect(() => {
    if (!open) return;
    setStep("source");
    setSettings(null);
    setSettingsError("");
    setResultsMode("random");
    setQuery("");
    setResults([]);
    setTotalPages(0);
    setPage(1);
    setSelectedPhoto(null);
    setAspect(CROP_ASPECTS[0]);
    setFocusX(0.5);
    setFocusY(0.5);
    setZoom(CROP_ZOOM_DEFAULT);
    setGridVisible(false);
    setBusy(false);
    setPreparationStage(null);
    setPreparationVariant("recommendation");
    setSearching(false);
    setTranslating(false);
    setError("");
    setNotice("");
    searchRequestRef.current += 1;
    inFlightPagesRef.current.clear();
    loadedPagesRef.current.clear();
    randomLoadingRef.current = false;
    activeQueryRef.current = "";
    resetLoadMoreBackoff(loadMoreFailureCountRef, loadMoreRetryAtRef);

    let cancelled = false;
    void getUnsplashSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((cause) => {
        if (!cancelled) setSettingsError(errorMessage(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && busy) return;
    onOpenChange(nextOpen);
  }

  async function openUnsplashSearch() {
    setStep("search");
    setError("");
    setNotice("");
    setPreparationVariant("recommendation");
    const currentSettings = settings ?? (await loadSettings());
    if (!currentSettings?.configured) return;

    if (!aiRecommendationEnabled || !onGenerateQuery) {
      await loadRandomPhotos(true);
      return;
    }

    setPreparationStage("analyzing");
    let nextQuery: string;
    try {
      nextQuery = await onGenerateQuery(sheet);
    } catch {
      setPreparationStage(null);
      setNotice("AI 推荐暂时不可用，已切换到随机图片。");
      await loadRandomPhotos(true);
      return;
    }

    setQuery(nextQuery);
    setPreparationStage("searching");
    const outcome = await runSearch(nextQuery, 1);
    if (outcome === "empty" || outcome === "failed") {
      setNotice(outcome === "empty" ? "AI 推荐词没有找到合适图片，已切换到随机图片。" : "AI 推荐搜索暂时不可用，已切换到随机图片。");
      await loadRandomPhotos(true);
    }
    setPreparationStage(null);
  }

  async function loadSettings(): Promise<UnsplashSettings | null> {
    try {
      const loaded = await getUnsplashSettings();
      setSettings(loaded);
      return loaded;
    } catch (cause) {
      setSettingsError(errorMessage(cause));
      return null;
    }
  }

  const loadRandomPhotos = useCallback(async (reset: boolean) => {
    if (randomLoadingRef.current) return;
    if (!reset && Date.now() < loadMoreRetryAtRef.current) return;
    randomLoadingRef.current = true;
    if (reset) {
      searchRequestRef.current += 1;
      inFlightPagesRef.current.clear();
      loadedPagesRef.current.clear();
      activeQueryRef.current = "";
      setResultsMode("random");
      setQuery("");
      setResults([]);
      setTotalPages(0);
      setPage(1);
      resetLoadMoreBackoff(loadMoreFailureCountRef, loadMoreRetryAtRef);
    }
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearching(true);
    setError("");
    try {
      const incoming = await getRandomUnsplashPhotos(UNSPLASH_RANDOM_BATCH_SIZE);
      if (searchRequestRef.current !== requestId) return;
      setResults((current) => (reset ? mergeUniquePhotos([], incoming) : mergeUniquePhotos(current, incoming)));
      resetLoadMoreBackoff(loadMoreFailureCountRef, loadMoreRetryAtRef);
    } catch (cause) {
      if (searchRequestRef.current !== requestId) return;
      setError(errorMessage(cause));
      if (reset) setResults([]);
      scheduleLoadMoreRetry(loadMoreFailureCountRef, loadMoreRetryAtRef);
    } finally {
      randomLoadingRef.current = false;
      if (searchRequestRef.current === requestId) setSearching(false);
    }
  }, []);

  const runSearch = useCallback(async (value: string, nextPage: number): Promise<SearchRunOutcome> => {
    const normalizedQuery = value.trim();
    if (!normalizedQuery) {
      setError("请输入搜索关键词。");
      return "failed";
    }
    if (nextPage > 1 && activeQueryRef.current !== normalizedQuery) return "cancelled";
    if (nextPage > 1 && Date.now() < loadMoreRetryAtRef.current) return "cancelled";
    if (inFlightPagesRef.current.has(nextPage)) return "cancelled";
    if (nextPage > 1 && loadedPagesRef.current.has(nextPage)) return "cancelled";
    if (nextPage === 1) {
      randomLoadingRef.current = false;
      setResultsMode("search");
      activeQueryRef.current = normalizedQuery;
      loadedPagesRef.current.clear();
      setResults([]);
      setTotalPages(0);
      setPage(1);
      resetLoadMoreBackoff(loadMoreFailureCountRef, loadMoreRetryAtRef);
    }
    inFlightPagesRef.current.add(nextPage);
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearching(true);
    setError("");
    try {
      const result = await searchUnsplashPhotos(normalizedQuery, nextPage);
      if (searchRequestRef.current !== requestId) return "cancelled";
      loadedPagesRef.current.add(nextPage);
      setResults((current) => (nextPage === 1 ? mergeUniquePhotos([], result.results) : mergeUniquePhotos(current, result.results)));
      setTotalPages(result.totalPages);
      setPage(nextPage);
      resetLoadMoreBackoff(loadMoreFailureCountRef, loadMoreRetryAtRef);
      return result.results.length > 0 ? "success" : "empty";
    } catch (cause) {
      if (searchRequestRef.current !== requestId) return "cancelled";
      setError(errorMessage(cause));
      if (nextPage === 1) setResults([]);
      scheduleLoadMoreRetry(loadMoreFailureCountRef, loadMoreRetryAtRef);
      return "failed";
    } finally {
      inFlightPagesRef.current.delete(nextPage);
      if (searchRequestRef.current === requestId) setSearching(false);
    }
  }, []);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setPreparationVariant("manual-search");
    const shouldTranslate = Boolean(onTranslateQuery && containsChinese(query));
    setPreparationStage(shouldTranslate ? "translating" : "searching");
    try {
      let searchQuery = query;
      if (shouldTranslate && onTranslateQuery) {
        setTranslating(true);
        const resolved = await onTranslateQuery(query);
        setNotice(resolved.notice);
        searchQuery = resolved.effectiveQuery;
        setPreparationStage("searching");
      }
      await runSearch(searchQuery, 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setTranslating(false);
      setPreparationStage(null);
    }
  }

  function selectPhoto(photo: UnsplashPhoto) {
    setSelectedPhoto(photo);
    setFocusX(0.5);
    setFocusY(0.5);
    setZoom(CROP_ZOOM_DEFAULT);
    setAspect(CROP_ASPECTS[0]);
    setGridVisible(false);
    setError("");
    setStep("crop");
  }

  function handleAspectChange(nextAspect: CropAspect) {
    setAspect(nextAspect);
    setGridVisible(false);
  }

  function resetCrop() {
    setAspect(CROP_ASPECTS[0]);
    setFocusX(0.5);
    setFocusY(0.5);
    setZoom(CROP_ZOOM_DEFAULT);
    setGridVisible(false);
  }

  function buildCrop(): UnsplashCrop | null {
    return selectedPhoto ? buildUnsplashCrop(selectedPhoto, aspect, focusX, focusY, zoom) : null;
  }

  async function confirmUnsplashImage() {
    const crop = buildCrop();
    if (!selectedPhoto || !crop) {
      setError("这张图片暂时无法裁剪，请重新选择。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const inserted = await onInsertUnsplash(selectedPhoto, crop);
      if (inserted) onOpenChange(false);
      else setError("图片没有插入成功，请稍后重试。");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function insertLocalImage() {
    setBusy(true);
    setError("");
    try {
      const inserted = await onInsertLocal();
      if (inserted) onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const crop = buildCrop();
  const hasMoreResults = totalPages > page;
  const isInitialSearch = (searching || translating) && results.length === 0;
  const isPreparing = preparationStage !== null;

  function handleResultsScroll(event: UIEvent<HTMLDivElement>) {
    const container = event.currentTarget;
    const remainingDistance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (searching || translating || remainingDistance > Math.max(RESULTS_PRELOAD_DISTANCE, container.clientHeight)) {
      return;
    }
    if (resultsMode === "random") {
      void loadRandomPhotos(false);
      return;
    }
    if (hasMoreResults) void runSearch(activeQueryRef.current || query, page + 1);
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton
        className={
          step === "source"
            ? "w-[min(520px,calc(100vw-32px))] !max-w-[min(520px,calc(100vw-32px))]"
            : "h-[min(780px,calc(100vh-48px))] max-h-[min(780px,calc(100vh-48px))] w-[min(1120px,calc(100vw-48px))] !max-w-[min(1120px,calc(100vw-48px))] overflow-hidden"
        }
      >
        {step === "source" && (
          <>
            <DialogHeader>
              <DialogTitle>选择图片来源</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="group flex min-h-32 flex-col items-start justify-between rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => void insertLocalImage()}
                disabled={busy}
              >
                <FileImage className="size-6 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.7} />
                <span>
                  <span className="block text-sm font-semibold">本地图片</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">从访达选择图片并插入。</span>
                </span>
              </button>
              <button
                type="button"
                className="group flex min-h-32 flex-col items-start justify-between rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                onClick={() => void openUnsplashSearch()}
                disabled={busy}
              >
                <Globe2 className="size-6 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.7} />
                <span>
                  <span className="block text-sm font-semibold">在线搜索</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">从 Unsplash 挑选。</span>
                </span>
              </button>
            </div>
            {settingsError && <p className="m-0 text-xs text-destructive">{settingsError}</p>}
          </>
        )}

        {step === "search" && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogHeader className="!flex-row items-center gap-4 pr-8">
              <DialogTitle>Unsplash</DialogTitle>
              {hasUnsplashKey && (
                <form className="flex min-w-0 flex-1 items-center justify-end gap-2" onSubmit={submitSearch}>
                  <div className="relative min-w-0 w-full max-w-[360px]">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-9 pl-9"
                      value={query}
                      maxLength={160}
                      placeholder="输入关键词，例如 宁静的湖面"
                      disabled={isPreparing || translating}
                      onChange={(event) => {
                        setQuery(event.target.value);
                      }}
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={isPreparing || searching || translating || !query.trim()}>
                    {isInitialSearch || isPreparing ? <Loader2 className="animate-spin" /> : <Search />}
                    搜索
                  </Button>
                </form>
              )}
            </DialogHeader>

            {!hasUnsplashKey ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
                <KeyRound className="size-7 text-muted-foreground" strokeWidth={1.6} />
                <div>
                  <p className="m-0 text-sm font-medium">需要 Unsplash API Key</p>
                  <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">请在设置 → 写作 → 在线图片中填写你自己的 Key。</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onOpenSettings}>
                  去设置
                </Button>
              </div>
            ) : isPreparing ? (
              <UnsplashPreparationView
                stage={preparationStage}
                aiEnabled={aiRecommendationEnabled && Boolean(onGenerateQuery)}
                variant={preparationVariant}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4">
                {(notice || error) && (
                  <div className="grid gap-1">
                    {notice && <p className="m-0 text-xs text-muted-foreground">{notice}</p>}
                    {error && <p className="m-0 text-xs text-destructive">{error}</p>}
                  </div>
                )}
                <div onScroll={handleResultsScroll} className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {results.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        className="group relative h-48 min-h-0 overflow-hidden rounded-lg bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        onClick={() => selectPhoto(photo)}
                      >
                        <img
                          src={photo.urls.small || photo.urls.thumb}
                          alt={photoLabel(photo)}
                          loading="lazy"
                          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim-strong via-scrim to-transparent px-3 pt-8 pb-2 text-left">
                          <span className="block truncate text-xs font-medium text-primary-foreground" title={photoLabel(photo)}>
                            {photoLabel(photo)}
                          </span>
                        </span>
                      </button>
                    ))}
                    {!searching && results.length === 0 && !error && (
                      <div className="col-span-full grid min-h-48 place-items-center text-xs text-muted-foreground">
                        {resultsMode === "random"
                          ? "暂时没有可展示的图片，请稍后重试或输入关键词搜索。"
                          : "没有找到匹配的图片，请换个关键词再试。"}
                      </div>
                    )}
                    {isInitialSearch && (
                      <div className="col-span-full grid min-h-48 place-items-center text-xs text-muted-foreground">
                        <Loader2 className="size-5 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "crop" && selectedPhoto && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <DialogHeader>
              <div className="flex items-center gap-2 pr-8">
                <Button type="button" variant="ghost" size="icon-sm" aria-label="返回搜索结果" onClick={() => setStep("search")}>
                  <ArrowLeft />
                </Button>
                <div className="min-w-0">
                  <DialogTitle>裁剪图片</DialogTitle>
                </div>
              </div>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted/20 p-1">
              <CropImagePreview
                photo={selectedPhoto}
                aspect={aspect}
                focusX={focusX}
                focusY={focusY}
                zoom={zoom}
                gridVisible={gridVisible}
                onFocusXChange={setFocusX}
                onFocusYChange={setFocusY}
                onZoomChange={setZoom}
                onGridVisibleChange={setGridVisible}
              />
            </div>
            {error && <p className="m-0 text-xs text-destructive">{error}</p>}
            <DialogFooter className="mt-0 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-border/70 pt-3">
              <Button type="button" variant="outline" className="justify-self-start" onClick={() => setStep("search")} disabled={busy}>
                返回
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" aria-label="选择裁剪比例">
                    <Grid2X2 />
                    <span>{cropAspectDisplayLabel(aspect.label)}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-40">
                  <DropdownMenuLabel>裁剪比例</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={aspect.label}
                    onValueChange={(value) => {
                      const nextAspect = CROP_ASPECTS.find((option) => option.label === value);
                      if (nextAspect) handleAspectChange(nextAspect);
                    }}
                  >
                    {CROP_ASPECTS.map((option) => (
                      <DropdownMenuRadioItem key={option.label} value={option.label}>
                        {cropAspectDisplayLabel(option.label)}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={resetCrop}>
                    <RotateCcw />
                    重置
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" className="justify-self-end" onClick={() => void confirmUnsplashImage()} disabled={busy || !crop}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />}
                下载并插入
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function mergeUniquePhotos(existing: UnsplashPhoto[], incoming: UnsplashPhoto[]): UnsplashPhoto[] {
  const ids = new Set(existing.map((photo) => photo.id));
  const merged = [...existing];
  for (const photo of incoming) {
    if (ids.has(photo.id)) continue;
    ids.add(photo.id);
    merged.push(photo);
  }
  return merged;
}

function retryDelayForFailure(failureCount: number): number {
  return Math.min(LOAD_MORE_RETRY_BASE_DELAY * 2 ** Math.max(0, failureCount - 1), LOAD_MORE_RETRY_MAX_DELAY);
}

function resetLoadMoreBackoff(failureCountRef: { current: number }, retryAtRef: { current: number }) {
  failureCountRef.current = 0;
  retryAtRef.current = 0;
}

function scheduleLoadMoreRetry(failureCountRef: { current: number }, retryAtRef: { current: number }) {
  failureCountRef.current += 1;
  retryAtRef.current = Date.now() + retryDelayForFailure(failureCountRef.current);
}

function photoLabel(photo: UnsplashPhoto): string {
  return photo.description.trim() || photo.altDescription.trim() || "未命名图片";
}

function cropAspectDisplayLabel(label: string): string {
  return label === CROP_ASPECTS[0].label ? `${label}（默认）` : label;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
