/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 对外提供 useLatestCallback
 * [POS]: shared 层的跨功能复用的 React 与平台行为，不持有具体业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useCallback, useLayoutEffect, useRef } from "react";

/** Keep callback identity stable while invoking the latest render's implementation. */
export function useLatestCallback<Arguments extends unknown[], Result>(callback: (...args: Arguments) => Result) {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Arguments) => callbackRef.current(...args), []);
}
