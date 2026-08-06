import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Play,
  ThumbsUp,
  Coins,
  Star,
  MessageSquare,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  Layers,
} from "lucide-react";
import { fetchVideo, fetchPlay, fetchFeed, proxiedImage } from "../api";
import type { VideoInfo, PlayInfo, Video } from "../types";
import { formatCount, formatDuration, timeAgo } from "../format";

export default function Watch() {
  const { bvid } = useParams<{ bvid: string }>();
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [play, setPlay] = useState<PlayInfo | null>(null);
  const [cid, setCid] = useState<number | undefined>(undefined);
  const [qn, setQn] = useState(64);
  const [retryTick, setRetryTick] = useState(0);
  const [loadingPlay, setLoadingPlay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load metadata + related when the video changes.
  useEffect(() => {
    if (!bvid) return;
    setInfo(null);
    setPlay(null);
    setCid(undefined);
    setQn(64);
    setError(null);
    setLoadingPlay(true);
    window.scrollTo({ top: 0 });

    fetchVideo(bvid)
      .then((v) => {
        setInfo(v);
        setCid(v.cid);
      })
      .catch((e) => setError((e as Error).message));

    fetchFeed(1, 18)
      .then((d) => setRelated(d.list.filter((v) => v.bvid !== bvid)))
      .catch(() => {});
  }, [bvid]);

  // Extract the playable stream whenever bvid/cid/quality changes.
  useEffect(() => {
    if (!bvid || cid === undefined) return;
    let cancelled = false;
    setLoadingPlay(true);
    setError(null);
    fetchPlay(bvid, cid, qn)
      .then((p) => {
        if (cancelled) return;
        setPlay(p);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoadingPlay(false));
    return () => {
      cancelled = true;
    };
  }, [bvid, cid, qn, retryTick]);

  const s = info?.stat;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <div className="min-w-0">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-bili-muted hover:text-white mb-3 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Back to feed
        </Link>

        {/* Player */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-card ring-1 ring-bili-line">
          {play && (
            <video
              key={play.streamUrl}
              ref={videoRef}
              src={play.streamUrl}
              poster={info ? proxiedImage(info.pic) : undefined}
              controls
              autoPlay
              playsInline
              className="w-full h-full"
            />
          )}
          {loadingPlay && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-sm text-gray-200">
                <Loader2 className="w-8 h-8 animate-spin text-bili-pink" />
                Extracting stream from Bilibili…
              </div>
            </div>
          )}
          {error && !loadingPlay && (
            <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-red-200 max-w-sm">Failed to extract stream: {error}</p>
                <button
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="px-4 py-2 rounded-full bg-bili-pink text-sm font-semibold hover:bg-bili-pinkdark transition"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Controls row: quality + parts */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {play && play.qualities.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-bili-muted">Quality</span>
              <select
                value={qn}
                onChange={(e) => setQn(Number(e.target.value))}
                className="bg-bili-card border border-bili-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-bili-pink"
              >
                {play.qualities.map((q) => (
                  <option key={q.qn} value={q.qn}>
                    {q.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {play && (
            <span className="text-xs text-bili-muted">
              Now playing {play.format.toUpperCase()} · {formatDuration(play.duration)} · streamed live
            </span>
          )}
        </div>

        {/* Multi-part selector */}
        {info && info.pages.length > 1 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Layers className="w-4 h-4 text-bili-pink" /> Parts ({info.pages.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {info.pages.map((p) => (
                <button
                  key={p.cid}
                  onClick={() => setCid(p.cid)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                    p.cid === cid
                      ? "bg-bili-pink border-bili-pink text-white"
                      : "bg-bili-card border-bili-line hover:border-bili-pink"
                  }`}
                >
                  P{p.page} · {p.part.slice(0, 18)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Title + meta */}
        {info ? (
          <div className="mt-4 animate-fade-up">
            <h1 className="text-lg sm:text-xl font-bold leading-snug">{info.title}</h1>
            <div className="mt-3 flex items-center gap-3">
              {info.owner.face ? (
                <img
                  src={proxiedImage(info.owner.face)}
                  className="w-10 h-10 rounded-full object-cover"
                  alt=""
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-bili-line grid place-items-center">
                  {info.owner.name?.[0]}
                </span>
              )}
              <div>
                <p className="text-sm font-medium">{info.owner.name}</p>
                <p className="text-xs text-bili-muted">{timeAgo(info.pubdate)}</p>
              </div>
              <div className="ml-auto flex items-center gap-4 text-sm text-bili-muted">
                <Stat icon={<Play className="w-4 h-4" />} value={formatCount(s?.view)} />
                <Stat icon={<ThumbsUp className="w-4 h-4" />} value={formatCount(s?.like)} />
                <Stat icon={<Coins className="w-4 h-4" />} value={formatCount(s?.coin)} />
                <Stat icon={<Star className="w-4 h-4" />} value={formatCount(s?.favorite)} />
                <Stat icon={<MessageSquare className="w-4 h-4" />} value={formatCount(s?.reply)} />
              </div>
            </div>
            {info.desc && (
              <p className="mt-4 text-sm text-gray-300 whitespace-pre-wrap rounded-xl bg-bili-panel/60 border border-bili-line p-4">
                {info.desc}
              </p>
            )}
          </div>
        ) : (
          !error && (
            <div className="mt-4 space-y-3">
              <div className="h-6 w-3/4 rounded bg-bili-card animate-pulse" />
              <div className="h-10 w-1/2 rounded bg-bili-card animate-pulse" />
            </div>
          )
        )}
      </div>

      {/* Sidebar: up next */}
      <aside>
        <h2 className="text-sm font-semibold text-bili-muted mb-3">Up next</h2>
        <div className="flex flex-col gap-3">
          {related.slice(0, 15).map((v) => (
            <Link
              key={v.bvid}
              to={`/watch/${v.bvid}`}
              className="group flex gap-3 rounded-xl p-1.5 hover:bg-bili-card transition"
            >
              <div className="relative w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-bili-card">
                <img
                  src={proxiedImage(v.pic)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-[10px]">
                  {formatDuration(v.duration)}
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-bili-pink transition">
                  {v.title}
                </h3>
                <p className="mt-1 text-[11px] text-bili-muted truncate">{v.owner.name}</p>
                <p className="text-[11px] text-bili-muted">{formatCount(v.stat.view)} views</p>
              </div>
            </Link>
          ))}
          {related.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-1.5">
                <div className="w-40 aspect-video rounded-lg bg-bili-card animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded bg-bili-card animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-bili-card animate-pulse" />
                </div>
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}
