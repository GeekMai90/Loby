import { useCallback, useLayoutEffect, useRef } from "react";

/** Keep callback identity stable while invoking the latest render's implementation. */
export function useLatestCallback<Arguments extends unknown[], Result>(callback: (...args: Arguments) => Result) {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Arguments) => callbackRef.current(...args), []);
}
