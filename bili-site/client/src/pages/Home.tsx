import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, AlertTriangle, Search as SearchIcon } from "lucide-react";
import VideoCard, { VideoCardSkeleton } from "../components/VideoCard";
import { fetchFeed, searchVideos } from "../api";
import type { Video } from "../types";

const GRID =
  "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-4 gap-y-6";

export default function Home() {
  const [params] = useSearchParams();
  const query = params.get("q")?.trim() ?? "";

  const [videos, setVideos] = useState<Video[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (pageToLoad: number, replace = false) => {
      setLoading(true);
      setError(null);
      try {
        const data = query
          ? await searchVideos(query, pageToLoad)
          : await fetchFeed(pageToLoad);
        const incoming = data.list.filter((v) => {
          if (seen.current.has(v.bvid)) return false;
          seen.current.add(v.bvid);
          return true;
        });
        if (incoming.length === 0) setDone(true);
        setVideos((prev) => (replace ? incoming : [...prev, ...incoming]));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query]
  );

  // Reset + initial load whenever the query changes.
  useEffect(() => {
    seen.current = new Set();
    setVideos([]);
    setPage(1);
    setDone(false);
    load(1, true);
  }, [query, load]);

  // Infinite scroll.
  useEffect(() => {
    if (done || loading) return;
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => {
            const next = p + 1;
            load(next);
            return next;
          });
        }
      },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [done, loading, load]);

  function refresh() {
    setRefreshing(true);
    seen.current = new Set();
    setVideos([]);
    setPage(1);
    setDone(false);
    load(1, true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          {query ? (
            <>
              <SearchIcon className="w-5 h-5 text-bili-pink" />
              Results for “{query}”
            </>
          ) : (
            "Popular right now"
          )}
        </h1>
        {!query && (
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-bili-card border border-bili-line
                       text-sm font-medium hover:border-bili-pink hover:text-bili-pink transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Couldn’t reach Bilibili: {error}</span>
          <button onClick={refresh} className="ml-auto underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      <div className={GRID}>
        {videos.map((v, i) => (
          <VideoCard key={v.bvid} video={v} index={i} />
        ))}
        {loading &&
          Array.from({ length: 12 }).map((_, i) => <VideoCardSkeleton key={`sk-${i}`} />)}
      </div>

      {!loading && videos.length === 0 && !error && (
        <div className="py-24 text-center text-bili-muted">No videos found.</div>
      )}

      <div ref={sentinel} className="h-10" />
      {done && videos.length > 0 && (
        <p className="py-8 text-center text-sm text-bili-muted">You’ve reached the end.</p>
      )}
    </div>
  );
}
