/**
 * [INPUT]: 依赖 React 19 的 act 环境约定与 Vitest 每个测试 worker 的全局对象
 * [OUTPUT]: 为 happy-dom React 测试声明受支持的 act 环境，避免异步状态更新被无关警告淹没
 * [POS]: renderer 测试基础设施；不修改产品运行时状态，也不替代测试中的 act 边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
const reactTestEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };

reactTestEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
