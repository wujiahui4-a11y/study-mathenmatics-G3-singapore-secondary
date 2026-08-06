import { Link } from "react-router-dom";
import { Play, MessageSquare } from "lucide-react";
import type { Video } from "../types";
import { proxiedImage } from "../api";
import { formatCount, formatDuration, timeAgo } from "../format";

export default function VideoCard({ video, index = 0 }: { video: Video; index?: number }) {
  return (
    <Link
      to={`/watch/${video.bvid}`}
      className="group flex flex-col animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-bili-card shadow-card">
        <img
          src={proxiedImage(video.pic)}
          alt={video.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/75 text-[11px] font-medium tabular-nums">
          {formatDuration(video.duration)}
        </span>
        <div className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition">
          <span className="grid place-items-center w-14 h-14 rounded-full bg-bili-pink/90 shadow-glow scale-90 group-hover:scale-100 transition">
            <Play className="w-6 h-6 text-white translate-x-0.5" fill="currentColor" />
          </span>
        </div>
      </div>

      <div className="mt-2.5 flex gap-2.5">
        {video.owner.face ? (
          <img
            src={proxiedImage(video.owner.face)}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-bili-line shrink-0 mt-0.5 grid place-items-center text-xs text-bili-muted">
            {video.owner.name?.[0] ?? "?"}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-bili-pink transition">
            {video.title}
          </h3>
          <p className="mt-1 text-xs text-bili-muted truncate">{video.owner.name}</p>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-bili-muted">
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" /> {formatCount(video.stat.view)}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {formatCount(video.stat.danmaku)}
            </span>
            {video.pubdate ? <span className="ml-auto">{timeAgo(video.pubdate)}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-bili-card">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
      <div className="mt-2.5 flex gap-2.5">
        <div className="w-8 h-8 rounded-full bg-bili-card shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 rounded bg-bili-card w-full" />
          <div className="h-3.5 rounded bg-bili-card w-2/3" />
          <div className="h-3 rounded bg-bili-card w-1/3 mt-2" />
        </div>
      </div>
    </div>
  );
}
