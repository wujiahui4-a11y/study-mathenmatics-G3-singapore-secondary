import type { Video, VideoInfo, PlayInfo } from "./types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export function proxiedImage(url?: string): string {
  if (!url) return "";
  return `/api/img?url=${encodeURIComponent(url)}`;
}

export function fetchFeed(pn: number, ps = 24): Promise<{ list: Video[]; pn: number }> {
  return get(`/api/feed?pn=${pn}&ps=${ps}`);
}

export function searchVideos(q: string, page = 1): Promise<{ list: Video[]; page: number }> {
  return get(`/api/search?q=${encodeURIComponent(q)}&page=${page}`);
}

export function fetchVideo(bvid: string): Promise<VideoInfo> {
  return get(`/api/video/${bvid}`);
}

export function fetchPlay(bvid: string, cid?: number, qn = 64): Promise<PlayInfo> {
  const params = new URLSearchParams();
  if (cid) params.set("cid", String(cid));
  params.set("qn", String(qn));
  return get(`/api/play/${bvid}?${params.toString()}`);
}
