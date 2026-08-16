/**
 * [INPUT]: 依赖 Tauri API
 * [OUTPUT]: 对外提供应用级发布目标、博客单篇/项目批量与帮助中心同步、GitHub 连接/仓库查询、微信公众号草稿与原生剪贴板、WordPress/墨问发布及 secret command 适配能力
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { Channel, invoke } from "@tauri-apps/api/core";
import { createDefaultPublishingTargetStore, type PublishingTargetStore } from "@/features/publishing/model/publishingTargets";

export interface WordPressPublishInput {
  siteUrl: string;
  username: string;
  title: string;
  content: string;
  excerpt: string;
  status: "draft" | "publish";
  images: PublishImageInput[];
}

export interface WordPressPublishResult {
  id: number;
  status: string;
  link: string;
}

export interface MowenPublishInput {
  body: Record<string, unknown>;
  tags: string[];
  visibility: MowenVisibility;
  images: PublishImageInput[];
}

export type MowenVisibility = "public" | "private";

export type MowenPublishProgress =
  | { stage: "preparing" }
  | { stage: "uploading"; completed: number; total: number }
  | { stage: "creating" }
  | { stage: "settingPrivacy" }
  | { stage: "finished" };

export interface PublishImageInput {
  source: string;
  alt: string;
  placeholder: string;
}

export interface WechatDraftSettings {
  appId: string;
  hasAppSecret: boolean;
  configured: boolean;
}

export interface SaveWechatDraftSettingsInput {
  appId: string;
  appSecret?: string;
}

export interface WechatDraftPublishInput {
  libraryPath: string;
  sourceId: string;
  title: string;
  author: string;
  digest: string;
  html: string;
  images: PublishImageInput[];
  coverSource: string;
  existingMediaId: string;
}

export type WechatDraftPublishProgress =
  | { stage: "checkingConnection" }
  | { stage: "uploadingImages"; completed: number; total: number }
  | { stage: "uploadingCover" }
  | { stage: "creating" }
  | { stage: "updating" }
  | { stage: "finished" };

export interface WechatDraftPublishResult {
  appId: string;
  mediaId: string;
  sourceHash: string;
  updated: boolean;
}

export interface WechatClipboardPreludeInput {
  description: string;
  title: string;
}

export interface GitHubDeviceAuthorization {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

export interface GitHubConnection {
  connected: boolean;
  login: string;
  avatarUrl: string;
  installationCount: number;
  repositoryCount: number;
  installationUrl: string;
  manageUrl: string;
}

export interface GitHubRepository {
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export interface BlogPublishInput {
  repository: string;
  branch: string;
  contentRoot: string;
  siteUrl: string;
  libraryPath: string;
  sourceId: string;
  title: string;
  body: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  slug: string;
  images: PublishImageInput[];
}

export interface BlogPublishResult {
  sourceId: string;
  slug: string;
  url: string;
  commitSha: string;
  sourceHash: string;
  draft: boolean;
  changed: boolean;
}

export interface BlogPublishBatchDocumentInput {
  sourceId: string;
  title: string;
  body: string;
  description: string;
  date: string;
  tags: string[];
  slug: string;
  images: PublishImageInput[];
}

export interface BlogPublishBatchInput {
  repository: string;
  branch: string;
  contentRoot: string;
  siteUrl: string;
  libraryPath: string;
  projectTitle: string;
  draft: boolean;
  documents: BlogPublishBatchDocumentInput[];
}

export interface BlogPublishBatchResult {
  commitSha: string;
  changed: boolean;
  publishedCount: number;
  documents: BlogPublishResult[];
}

export interface HelpCenterSyncGroupInput {
  id: string;
  label: string;
  directory: string;
  order: number;
  enabled: boolean;
}

export interface HelpCenterSyncDocumentInput {
  sourceId: string;
  title: string;
  description: string;
  body: string;
  slug: string;
  groupId: string;
  groupDirectory: string;
  images: PublishImageInput[];
}

export interface HelpCenterSyncInput {
  repository: string;
  branch: string;
  contentRoot: string;
  manifestPath: string;
  assetsRoot: string;
  siteUrl: string;
  libraryPath: string;
  projectId: string;
  projectTitle: string;
  mode: "project" | "document";
  deleteMissing: boolean;
  groups: HelpCenterSyncGroupInput[];
  documents: HelpCenterSyncDocumentInput[];
}

export interface HelpCenterSyncDocumentResult {
  sourceId: string;
  slug: string;
  url: string;
  sourceHash: string;
}

export interface HelpCenterSyncResult {
  commitSha: string;
  changed: boolean;
  syncedCount: number;
  documents: HelpCenterSyncDocumentResult[];
  deletedCount: number;
  deletedSourceIds: string[];
}

export type HelpCenterSyncProgress =
  | { stage: "checkingAuthorization" }
  | { stage: "preparing" }
  | { stage: "packaging"; completed: number; total: number }
  | { stage: "committing" }
  | { stage: "finished" };

export type BlogPublishProgress =
  | { stage: "checkingAuthorization" }
  | { stage: "preparing" }
  | { stage: "packaging"; completed: number; total: number }
  | { stage: "committing" }
  | { stage: "finished" };

export type PublishingSecretChannel = "wordpress" | "mowen";

export function isDesktopPublishingAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function savePublishingSecret(channel: PublishingSecretChannel, account: string, secret: string): Promise<void> {
  requireDesktopRuntime();
  await invoke("save_publishing_secret", { channel, account, secret });
}

export async function hasPublishingSecret(channel: PublishingSecretChannel, account: string): Promise<boolean> {
  if (!isDesktopPublishingAvailable()) return false;
  return invoke<boolean>("has_publishing_secret", { channel, account });
}

export async function deletePublishingSecret(channel: PublishingSecretChannel, account: string): Promise<void> {
  requireDesktopRuntime();
  await invoke("delete_publishing_secret", { channel, account });
}

export async function publishWordPressPost(request: WordPressPublishInput): Promise<WordPressPublishResult> {
  requireDesktopRuntime();
  return invoke<WordPressPublishResult>("publish_wordpress_post", { request });
}

export async function publishMowenNote(
  request: MowenPublishInput,
  onProgress?: (progress: MowenPublishProgress) => void,
): Promise<Record<string, unknown>> {
  requireDesktopRuntime();
  const progressChannel = new Channel<MowenPublishProgress>();
  progressChannel.onmessage = (progress) => onProgress?.(progress);
  return invoke<Record<string, unknown>>("publish_mowen_note", { request, onProgress: progressChannel });
}

export async function validateMowenApiKey(apiKey: string): Promise<void> {
  requireDesktopRuntime();
  await invoke("validate_mowen_api_key", { apiKey });
}

export async function validateSavedMowenApiKey(): Promise<void> {
  requireDesktopRuntime();
  await invoke("validate_saved_mowen_api_key");
}

export async function startGitHubDeviceFlow(): Promise<GitHubDeviceAuthorization> {
  requireDesktopRuntime();
  return invoke<GitHubDeviceAuthorization>("start_github_device_flow");
}

export async function completeGitHubDeviceFlow(authorization: GitHubDeviceAuthorization): Promise<GitHubConnection> {
  requireDesktopRuntime();
  return invoke<GitHubConnection>("complete_github_device_flow", {
    flowId: authorization.flowId,
  });
}

export async function getGitHubConnection(): Promise<GitHubConnection> {
  requireDesktopRuntime();
  return invoke<GitHubConnection>("get_github_connection");
}

export async function refreshGitHubConnection(): Promise<GitHubConnection> {
  requireDesktopRuntime();
  return invoke<GitHubConnection>("refresh_github_connection");
}

export async function listGitHubRepositories(): Promise<GitHubRepository[]> {
  requireDesktopRuntime();
  return invoke<GitHubRepository[]>("list_github_repositories");
}

export async function disconnectGitHub(): Promise<void> {
  requireDesktopRuntime();
  await invoke("disconnect_github");
}

export async function loadPublishingTargets(libraryPath: string): Promise<PublishingTargetStore> {
  if (!isDesktopPublishingAvailable()) return createDefaultPublishingTargetStore();
  return invoke<PublishingTargetStore>("load_publishing_targets", { libraryPath });
}

export async function savePublishingTargets(store: PublishingTargetStore): Promise<PublishingTargetStore> {
  if (!isDesktopPublishingAvailable()) return store;
  return invoke<PublishingTargetStore>("save_publishing_targets", { store });
}

export async function publishBlogPost(
  request: BlogPublishInput,
  onProgress?: (progress: BlogPublishProgress) => void,
): Promise<BlogPublishResult> {
  requireDesktopRuntime();
  const progressChannel = new Channel<BlogPublishProgress>();
  progressChannel.onmessage = (progress) => onProgress?.(progress);
  return invoke<BlogPublishResult>("publish_blog_post", { request, onProgress: progressChannel });
}

export async function publishBlogPosts(
  request: BlogPublishBatchInput,
  onProgress?: (progress: BlogPublishProgress) => void,
): Promise<BlogPublishBatchResult> {
  requireDesktopRuntime();
  const progressChannel = new Channel<BlogPublishProgress>();
  progressChannel.onmessage = (progress) => onProgress?.(progress);
  return invoke<BlogPublishBatchResult>("publish_blog_posts", { request, onProgress: progressChannel });
}

export async function syncHelpCenter(
  request: HelpCenterSyncInput,
  onProgress?: (progress: HelpCenterSyncProgress) => void,
): Promise<HelpCenterSyncResult> {
  requireDesktopRuntime();
  const progressChannel = new Channel<HelpCenterSyncProgress>();
  progressChannel.onmessage = (progress) => onProgress?.(progress);
  return invoke<HelpCenterSyncResult>("sync_help_center", { request, onProgress: progressChannel });
}

export async function loadWechatDraftSettings(): Promise<WechatDraftSettings> {
  if (!isDesktopPublishingAvailable()) return { appId: "", hasAppSecret: false, configured: false };
  return invoke<WechatDraftSettings>("load_wechat_draft_settings");
}

export async function saveWechatDraftSettings(request: SaveWechatDraftSettingsInput): Promise<WechatDraftSettings> {
  requireDesktopRuntime();
  return invoke<WechatDraftSettings>("save_wechat_draft_settings", { request });
}

export async function deleteWechatDraftSettings(): Promise<void> {
  requireDesktopRuntime();
  await invoke("delete_wechat_draft_settings");
}

export async function validateWechatDraftConnection(): Promise<void> {
  requireDesktopRuntime();
  await invoke("validate_wechat_draft_connection");
}

export async function publishWechatDraft(
  request: WechatDraftPublishInput,
  onProgress?: (progress: WechatDraftPublishProgress) => void,
): Promise<WechatDraftPublishResult> {
  requireDesktopRuntime();
  const progressChannel = new Channel<WechatDraftPublishProgress>();
  progressChannel.onmessage = (progress) => onProgress?.(progress);
  return invoke<WechatDraftPublishResult>("publish_wechat_draft", { request, onProgress: progressChannel });
}

export async function writeWechatClipboardPrelude(request: WechatClipboardPreludeInput): Promise<void> {
  requireDesktopRuntime();
  await invoke("write_wechat_clipboard_prelude", { request });
}

function requireDesktopRuntime() {
  if (!isDesktopPublishingAvailable()) throw new Error("请在落笔桌面应用中使用直接发布功能。");
}
