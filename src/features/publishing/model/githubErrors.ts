/**
 * [INPUT]: 依赖 GitHub 发布命令返回的用户可见错误文案
 * [OUTPUT]: 对外提供 githubErrorNeedsSettings，统一判定需要回到发布设置修复的授权与目标配置错误
 * [POS]: publishing model 的 GitHub 错误分流边界，被博客发布与文档站同步控制器共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function githubErrorNeedsSettings(message: string): boolean {
  return /尚未连接 GitHub|GitHub 连接已失效|仓库不存在或尚未授权|仓库已归档或停用|没有目标 GitHub 仓库的 Contents 写权限|没有足够的 GitHub 仓库权限|GitHub 仓库格式无效|GitHub 发布分支不能为空|找不到仓库、分支或文件|重新连接 GitHub/i.test(
    message,
  );
}
