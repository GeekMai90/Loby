/**
 * [INPUT]: 依赖无外部状态，仅接收应用级发布目标持久化数据
 * [OUTPUT]: 对外提供 GitHub 博客/文档站目标、空目标仓库、目标显示与可用性判定
 * [POS]: publishing model 的应用级目标契约；集中描述“发布到哪里”，项目只通过稳定 target ID 建立使用关系
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export const LEGACY_GITHUB_BLOG_TARGET_ID = "github-blog";

interface GitHubPublishingTargetBase {
  id: string;
  enabled: boolean;
  repository: string;
  branch: string;
  contentRoot: string;
  siteUrl: string;
}

export interface GitHubBlogPublishingTarget extends GitHubPublishingTargetBase {
  kind: "githubHugoBlog";
  blogName: string;
  menuLabel: string;
}

export interface GitHubDocsPublishingTarget extends GitHubPublishingTargetBase {
  kind: "githubDocsSite";
  siteName: string;
  manifestPath: string;
  assetsRoot: string;
}

export type PublishingTarget = GitHubBlogPublishingTarget | GitHubDocsPublishingTarget;

export interface PublishingTargetStore {
  version: 1;
  targets: PublishingTarget[];
}

export function createDefaultGitHubBlogTarget(): GitHubBlogPublishingTarget {
  return {
    id: createTargetId("blog"),
    kind: "githubHugoBlog",
    enabled: true,
    blogName: "GitHub 博客",
    menuLabel: "发布到博客",
    repository: "",
    branch: "main",
    contentRoot: "content/posts",
    siteUrl: "",
  };
}

export function createDefaultGitHubDocsTarget(): GitHubDocsPublishingTarget {
  return {
    id: createTargetId("docs"),
    kind: "githubDocsSite",
    enabled: true,
    siteName: "GitHub 文档网站",
    repository: "",
    branch: "main",
    contentRoot: "src/content/docs",
    manifestPath: "src/data/loby-docs.json",
    assetsRoot: "public/images/docs",
    siteUrl: "",
  };
}

export function createDefaultPublishingTargetStore(): PublishingTargetStore {
  return { version: 1, targets: [] };
}

export function githubPublishingTargets(store: PublishingTargetStore): PublishingTarget[] {
  return store.targets.filter(isGitHubPublishingTarget);
}

export function enabledGitHubPublishingTargets(store: PublishingTargetStore): PublishingTarget[] {
  return githubPublishingTargets(store).filter(isPublishingTargetReady);
}

export function githubBlogTargets(store: PublishingTargetStore): GitHubBlogPublishingTarget[] {
  return store.targets.filter((target): target is GitHubBlogPublishingTarget => target.kind === "githubHugoBlog");
}

export function publishingTargetById(store: PublishingTargetStore, targetId: string | undefined): PublishingTarget | undefined {
  if (!targetId) return undefined;
  return store.targets.find((target) => target.id === targetId);
}

export function isGitHubPublishingTarget(target: PublishingTarget): boolean {
  return target.kind === "githubHugoBlog" || target.kind === "githubDocsSite";
}

export function publishingTargetName(target: PublishingTarget): string {
  return target.kind === "githubHugoBlog" ? target.blogName.trim() || "GitHub 博客" : target.siteName.trim() || "GitHub 文档网站";
}

export function publishingTargetActionLabel(target: PublishingTarget): string {
  if (target.kind === "githubHugoBlog") return target.menuLabel.trim() || "发布到博客";
  return `同步到${publishingTargetName(target)}`;
}

export function isPublishingTargetReady(target: PublishingTarget): boolean {
  const commonReady =
    target.enabled &&
    Boolean(publishingTargetName(target)) &&
    /^[^/\s]+\/[^/\s]+$/.test(target.repository.trim()) &&
    Boolean(target.branch.trim()) &&
    isSafeRepositoryPath(target.contentRoot) &&
    /^https?:\/\//i.test(target.siteUrl.trim());
  if (!commonReady) return false;
  if (target.kind === "githubHugoBlog") {
    return Boolean(target.menuLabel.trim()) && target.contentRoot.trim().startsWith("content/");
  }
  return isSafeRepositoryPath(target.manifestPath) && isSafeRepositoryPath(target.assetsRoot);
}

export function replacePublishingTarget(store: PublishingTargetStore, target: PublishingTarget): PublishingTargetStore {
  const exists = store.targets.some((item) => item.id === target.id);
  return {
    version: 1,
    targets: exists ? store.targets.map((item) => (item.id === target.id ? target : item)) : [...store.targets, target],
  };
}

function createTargetId(type: "blog" | "docs"): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `github-${type}-${suffix}`;
}

function isSafeRepositoryPath(value: string): boolean {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "");
  return (
    Boolean(normalized) &&
    normalized.split("/").every((segment) => segment && segment !== "." && segment !== ".." && !segment.startsWith("."))
  );
}
