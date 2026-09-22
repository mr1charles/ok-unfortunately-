import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Polls an async fetcher on an interval. This is a deliberately simple
 * prototype substitute for real-time updates (websockets/SSE) so the world
 * map, marketplace, and auction countdowns stay reasonably fresh without
 * adding a second transport to the stack. A future pass could swap this
 * for a socket subscription without changing consuming components much.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
    if (intervalMs <= 0) return;
    const id = setInterval(reload, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}
