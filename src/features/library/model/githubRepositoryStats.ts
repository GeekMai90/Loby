/**
 * [INPUT]: 依赖公开 GitHub 仓库 API 返回的 stargazers_count，并以 Shields 公共缓存接口作为限流降级来源
 * [OUTPUT]: 对外提供按需读取并短时缓存 Loby GitHub Star 数的异步模型
 * [POS]: library 的远端只读统计边界；成功结果在进程内缓存，网络或响应异常统一降级为空值
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
const GITHUB_REPOSITORY_API_URL = "https://api.github.com/repos/GeekMai90/Loby";
const GITHUB_STARS_BADGE_API_URL = "https://img.shields.io/github/stars/GeekMai90/Loby.json";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface GitHubRepositoryResponse {
  stargazers_count?: unknown;
}

interface GitHubStarsBadgeResponse {
  message?: unknown;
  value?: unknown;
}

let cachedStars: { value: number; expiresAt: number } | null = null;
let pendingRequest: Promise<number | null> | null = null;

function parseStarCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value
    .trim()
    .toLowerCase()
    .replaceAll(",", "")
    .match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!match) {
    return null;
  }

  const multiplier = match[2] === "b" ? 1_000_000_000 : match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
  const parsed = Number(match[1]) * multiplier;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

async function readGitHubApiStarCount(): Promise<number | null> {
  try {
    const response = await fetch(GITHUB_REPOSITORY_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GitHubRepositoryResponse;
    return parseStarCount(payload.stargazers_count);
  } catch {
    return null;
  }
}

async function readGitHubStarsBadgeCount(): Promise<number | null> {
  try {
    const response = await fetch(GITHUB_STARS_BADGE_API_URL);
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GitHubStarsBadgeResponse;
    return parseStarCount(payload.value ?? payload.message);
  } catch {
    return null;
  }
}

export function getGitHubStarCount(): Promise<number | null> {
  const now = Date.now();
  if (cachedStars && cachedStars.expiresAt > now) {
    return Promise.resolve(cachedStars.value);
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = readGitHubApiStarCount()
    .then((starCount) => starCount ?? readGitHubStarsBadgeCount())
    .then((starCount) => {
      if (starCount === null) {
        return null;
      }

      cachedStars = {
        value: starCount,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return starCount;
    })
    .catch(() => null)
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}
