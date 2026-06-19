import { useCallback, useRef } from "react";

/**
 * 安定した関数 identity を返しつつ、呼び出し時には常に最新のクロージャを実行する。
 * （イベント購読や interval に渡しても stale closure にならない。）
 */
export function useCallbackRef<A extends unknown[], R>(
  fn: (...args: A) => R,
): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
