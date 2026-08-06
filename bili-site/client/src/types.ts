export interface VideoStat {
  view: number;
  danmaku: number;
  like?: number;
  coin?: number;
  favorite?: number;
  reply?: number;
}

export interface Owner {
  name?: string;
  mid?: number;
  face?: string;
}

export interface Video {
  bvid: string;
  aid?: number;
  cid?: number;
  title: string;
  desc?: string;
  pic: string;
  duration: number;
  pubdate?: number;
  owner: Owner;
  stat: VideoStat;
}

export interface VideoInfo extends Video {
  pages: { cid: number; page: number; part: string; duration: number }[];
}

export interface PlayInfo {
  cid: number;
  quality: number;
  format: string;
  duration: number;
  size?: number;
  qualities: { qn: number; label: string }[];
  streamUrl: string;
}
