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
