/**
 * [INPUT]: 依赖 React Context 运行时
 * [OUTPUT]: 对外提供要求 Provider 必须存在的 getStrictContext 泛型工厂
 * [POS]: shared/lib 的无领域 React 工具；为 Animate UI 等共享 primitives 提供显式缺失上下文错误
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";

function getStrictContext<T>(
  name?: string,
): readonly [({ value, children }: { value: T; children?: React.ReactNode }) => React.JSX.Element, () => T] {
  const Context = React.createContext<T | undefined>(undefined);

  const Provider = ({ value, children }: { value: T; children?: React.ReactNode }) => (
    <Context.Provider value={value}>{children}</Context.Provider>
  );

  const useSafeContext = () => {
    const context = React.useContext(Context);
    if (context === undefined) {
      throw new Error(`useContext must be used within ${name ?? "a Provider"}`);
    }
    return context;
  };

  return [Provider, useSafeContext] as const;
}

export { getStrictContext };
