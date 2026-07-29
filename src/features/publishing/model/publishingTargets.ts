/**
 * [INPUT]: 依赖无外部状态，仅接收应用级发布目标持久化数据
 * [OUTPUT]: 对外提供 GitHub 博客发布目标、空目标仓库、麦先生说自用模板与可用性判定
 * [POS]: publishing model 的应用级目标契约，隔离 provider 连接、可添加模板、已保存实例与项目模型
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export const DEFAULT_GITHUB_BLOG_TARGET_ID = "github-blog";

export interface GitHubBlogPublishingTarget {
  id: string;
  kind: "githubHugoBlog";
  enabled: boolean;
  blogName: string;
  menuLabel: string;
  repository: string;
  branch: string;
  contentRoot: string;
  siteUrl: string;
}

export type PublishingTarget = GitHubBlogPublishingTarget;

export interface PublishingTargetStore {
  version: 1;
  targets: PublishingTarget[];
}

export function createDefaultGitHubBlogTarget(): GitHubBlogPublishingTarget {
  return {
    id: DEFAULT_GITHUB_BLOG_TARGET_ID,
    kind: "githubHugoBlog",
    enabled: false,
    blogName: "GitHub 博客",
    menuLabel: "发布到博客",
    repository: "",
    branch: "main",
    contentRoot: "content/posts",
    siteUrl: "",
  };
}

export function createMaixianshengGitHubBlogTarget(): GitHubBlogPublishingTarget {
  return {
    id: DEFAULT_GITHUB_BLOG_TARGET_ID,
    kind: "githubHugoBlog",
    enabled: true,
    blogName: "麦先生说博客",
    menuLabel: "麦先生说博客",
    repository: "GeekMai90/maixiansheng-blog",
    branch: "main",
    contentRoot: "content/posts",
    siteUrl: "https://blog.geekmailab.com",
  };
}

export function createDefaultPublishingTargetStore(): PublishingTargetStore {
  return { version: 1, targets: [] };
}

export function githubBlogTargets(store: PublishingTargetStore): GitHubBlogPublishingTarget[] {
  return store.targets.filter((target): target is GitHubBlogPublishingTarget => target.kind === "githubHugoBlog");
}

export function enabledGitHubBlogTargets(store: PublishingTargetStore): GitHubBlogPublishingTarget[] {
  return githubBlogTargets(store).filter(isPublishingTargetReady);
}

export function isPublishingTargetReady(target: GitHubBlogPublishingTarget): boolean {
  return (
    target.enabled &&
    Boolean(target.blogName.trim()) &&
    Boolean(target.menuLabel.trim()) &&
    /^[^/\s]+\/[^/\s]+$/.test(target.repository.trim()) &&
    Boolean(target.branch.trim()) &&
    target.contentRoot.trim().startsWith("content/") &&
    /^https?:\/\//i.test(target.siteUrl.trim())
  );
}

export function replacePublishingTarget(store: PublishingTargetStore, target: PublishingTarget): PublishingTargetStore {
  const exists = store.targets.some((item) => item.id === target.id);
  return {
    version: 1,
    targets: exists ? store.targets.map((item) => (item.id === target.id ? target : item)) : [...store.targets, target],
  };
}
