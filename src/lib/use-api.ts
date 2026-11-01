import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { get } from "./api";

type State<T> = { data: T | null; error: unknown; loading: boolean; refreshing: boolean };

/**
 * Loads one address and reloads it each time the screen comes into view, so a change made
 * on another screen shows up at once. `loading` is only true for the first load.
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true, refreshing: false });
  const latest = useRef(0);

  const load = useCallback(
    async (mode: "first" | "refresh" | "silent") => {
      if (!path) return;
      const id = ++latest.current;
      if (mode === "first") setState((s) => ({ ...s, loading: s.data === null, error: null }));
      if (mode === "refresh") setState((s) => ({ ...s, refreshing: true }));
      try {
        const data = await get<T>(path);
        if (id === latest.current) setState({ data, error: null, loading: false, refreshing: false });
      } catch (error) {
        if (id === latest.current) setState((s) => ({ ...s, error, loading: false, refreshing: false }));
      }
    },
    [path],
  );

  useFocusEffect(
    useCallback(() => {
      void load("first");
    }, [load]),
  );

  return {
    ...state,
    reload: () => load("silent"),
    refresh: () => load("refresh"),
  };
}
