/**
 * [INPUT]: 依赖 React 运行时
 * [OUTPUT]: 对外提供 useViewportWidth
 * [POS]: shared 层的跨功能复用的 React 与平台行为，不持有具体业务状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useState } from "react";

export function useViewportWidth() {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    function syncViewportWidth() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", syncViewportWidth);
    return () => window.removeEventListener("resize", syncViewportWidth);
  }, []);

  return viewportWidth;
}
