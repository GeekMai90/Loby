/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 对外提供 useIsInView、type UseIsInViewOptions
 * [POS]: shared 层的跨功能复用的 React 与平台行为，不持有具体业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import * as React from "react";
import { useInView, type UseInViewOptions } from "motion/react";

interface UseIsInViewOptions {
  inView?: boolean;
  inViewOnce?: boolean;
  inViewMargin?: UseInViewOptions["margin"];
}

function useIsInView<T extends HTMLElement = HTMLElement>(ref: React.Ref<T>, options: UseIsInViewOptions = {}) {
  const { inView, inViewOnce = false, inViewMargin = "0px" } = options;
  const localRef = React.useRef<T>(null);
  React.useImperativeHandle(ref, () => localRef.current as T);
  const inViewResult = useInView(localRef, {
    once: inViewOnce,
    margin: inViewMargin,
  });
  const isInView = !inView || inViewResult;
  return { ref: localRef, isInView };
}

export { useIsInView, type UseIsInViewOptions };
