/**
 * [INPUT]: 依赖 publishing.css 的共享打字机动画结构
 * [OUTPUT]: 对外提供 PublishTypewriterLoader
 * [POS]: publishing feature 的渠道无关加载反馈，被墨问、微信公众号草稿与应用级 GitHub 目标发布流程复用
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
export function PublishTypewriterLoader() {
  return (
    <div className="publish-typewriter-loader" aria-hidden="true">
      <div className="typewriter">
        <div className="slide">
          <i />
        </div>
        <div className="paper" />
        <div className="keyboard" />
      </div>
    </div>
  );
}
