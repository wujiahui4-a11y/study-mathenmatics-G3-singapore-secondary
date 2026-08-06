"use strict";

const crypto = require("crypto");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REFERER = "https://www.bilibili.com";

// Fixed permutation table used to derive the WBI mixin key.
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

function baseHeaders(extra = {}) {
  return {
    "User-Agent": UA,
    Referer: REFERER,
    Origin: "https://www.bilibili.com",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    ...extra,
  };
}

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: baseHeaders(extraHeaders),
  });
  if (!res.ok) {
    throw new Error(`Upstream ${res.status} for ${url}`);
  }
  const json = await res.json();
  if (json.code !== 0 && json.code !== -101) {
    throw new Error(`Bilibili API error ${json.code}: ${json.message}`);
  }
  return json;
}

// ---- WBI signing --------------------------------------------------------

let wbiCache = { key: null, ts: 0 };

function getMixinKey(imgKey, subKey) {
  const raw = imgKey + subKey;
  let mixin = "";
  for (const idx of MIXIN_KEY_ENC_TAB) mixin += raw[idx];
  return mixin.slice(0, 32);
}

async function getWbiKeys() {
  const now = Date.now();
  if (wbiCache.key && now - wbiCache.ts < 30 * 60 * 1000) {
    return wbiCache.key;
  }
  const json = await fetchJson("https://api.bilibili.com/x/web-interface/nav");
  const imgUrl = json.data.wbi_img.img_url;
  const subUrl = json.data.wbi_img.sub_url;
  const imgKey = imgUrl.slice(imgUrl.lastIndexOf("/") + 1, imgUrl.lastIndexOf("."));
  const subKey = subUrl.slice(subUrl.lastIndexOf("/") + 1, subUrl.lastIndexOf("."));
  const key = getMixinKey(imgKey, subKey);
  wbiCache = { key, ts: now };
  return key;
}

function encWbi(params, mixinKey) {
  const wts = Math.round(Date.now() / 1000);
  const query = { ...params, wts };
  const sorted = Object.keys(query).sort();
  const filtered = sorted
    .map((k) => {
      const val = String(query[k]).replace(/[!'()*]/g, "");
      return `${encodeURIComponent(k)}=${encodeURIComponent(val)}`;
    })
    .join("&");
  const wRid = crypto.createHash("md5").update(filtered + mixinKey).digest("hex");
  return `${filtered}&w_rid=${wRid}`;
}

async function signedQuery(params) {
  const mixinKey = await getWbiKeys();
  return encWbi(params, mixinKey);
}

// ---- Normalization ------------------------------------------------------

function normalizeVideo(v) {
  const stat = v.stat || {};
  return {
    bvid: v.bvid,
    aid: v.aid,
    cid: v.cid,
    title: v.title,
    desc: v.desc || v.dynamic || "",
    pic: v.pic,
    duration: v.duration,
    pubdate: v.pubdate,
    owner: {
      name: v.owner ? v.owner.name : v.author,
      mid: v.owner ? v.owner.mid : v.mid,
      face: v.owner ? v.owner.face : undefined,
    },
    stat: {
      view: stat.view ?? v.play ?? 0,
      danmaku: stat.danmaku ?? v.video_review ?? 0,
      like: stat.like ?? 0,
      coin: stat.coin ?? 0,
      favorite: stat.favorite ?? v.favorites ?? 0,
      reply: stat.reply ?? 0,
    },
  };
}

// ---- Public API ---------------------------------------------------------

async function getPopular(pn = 1, ps = 20) {
  const url = `https://api.bilibili.com/x/web-interface/popular?pn=${pn}&ps=${ps}`;
  const json = await fetchJson(url);
  return (json.data.list || []).map(normalizeVideo);
}

async function search(keyword, page = 1) {
  const query = await signedQuery({
    search_type: "video",
    keyword,
    page,
    page_size: 30,
  });
  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`;
  const json = await fetchJson(url);
  const list = (json.data && json.data.result) || [];
  return list
    .filter((v) => v.bvid)
    .map((v) => ({
      bvid: v.bvid,
      aid: v.aid,
      title: (v.title || "").replace(/<[^>]+>/g, ""),
      desc: v.description || "",
      pic: v.pic && v.pic.startsWith("//") ? "https:" + v.pic : v.pic,
      duration: parseDuration(v.duration),
      pubdate: v.pubdate,
      owner: { name: v.author, mid: v.mid, face: v.upic ? "https:" + v.upic : undefined },
      stat: {
        view: v.play || 0,
        danmaku: v.video_review || 0,
        like: v.like || 0,
        favorite: v.favorites || 0,
        reply: v.review || 0,
      },
    }));
}

function parseDuration(str) {
  if (typeof str === "number") return str;
  if (!str) return 0;
  const parts = String(str).split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

async function getVideoInfo(bvid) {
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const json = await fetchJson(url);
  const d = json.data;
  return {
    ...normalizeVideo(d),
    cid: d.cid,
    pages: (d.pages || []).map((p) => ({ cid: p.cid, page: p.page, part: p.part, duration: p.duration })),
  };
}

/**
 * Resolves a directly-playable progressive MP4 stream URL for a video.
 * Uses platform=html5 + high_quality to obtain a single-file (durl) MP4 that a
 * browser <video> element can play once proxied with the correct Referer.
 */
async function getPlayUrl(bvid, cid, qn = 64) {
  if (!cid) {
    const info = await getVideoInfo(bvid);
    cid = info.cid;
  }
  const params = {
    bvid,
    cid,
    qn,
    fnval: 1,
    fnver: 0,
    fourk: 1,
    platform: "html5",
    high_quality: 1,
  };
  let json;
  try {
    const query = await signedQuery(params);
    json = await fetchJson(`https://api.bilibili.com/x/player/wbi/playurl?${query}`);
  } catch (err) {
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    json = await fetchJson(`https://api.bilibili.com/x/player/playurl?${qs}`);
  }
  const data = json.data;
  const durl = data.durl && data.durl[0];
  if (!durl) throw new Error("No playable stream returned by Bilibili");
  const qualities = (data.support_formats || []).map((f) => ({
    qn: f.quality,
    label: f.new_description || f.display_desc,
  }));
  return {
    cid,
    url: durl.url,
    backupUrls: durl.backup_url || [],
    quality: data.quality,
    format: data.format,
    duration: Math.round((data.timelength || 0) / 1000),
    size: durl.size,
    qualities,
  };
}

module.exports = {
  UA,
  REFERER,
  baseHeaders,
  getPopular,
  search,
  getVideoInfo,
  getPlayUrl,
};
