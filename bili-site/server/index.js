"use strict";

const path = require("path");
const { Readable } = require("stream");
const express = require("express");
const bili = require("./bilibili");

// Pipe a fetch() web-body to an Express response without crashing on client
// disconnects or upstream errors.
function pipeUpstream(upstream, res) {
  const node = Readable.fromWeb(upstream.body);
  node.on("error", () => {
    if (!res.headersSent) res.status(502);
    res.end();
  });
  res.on("close", () => node.destroy());
  node.pipe(res);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");

function asyncHandler(fn) {
  return (req, res) => fn(req, res).catch((err) => {
    console.error(`[api] ${req.method} ${req.originalUrl} ->`, err.message);
    res.status(502).json({ error: err.message || "Upstream error" });
  });
}

// ---- Metadata API -------------------------------------------------------

app.get("/api/feed", asyncHandler(async (req, res) => {
  const pn = Math.max(1, parseInt(req.query.pn, 10) || 1);
  const ps = Math.min(30, Math.max(1, parseInt(req.query.ps, 10) || 20));
  const list = await bili.getPopular(pn, ps);
  res.set("Cache-Control", "no-store");
  res.json({ list, pn, ps });
}));

app.get("/api/search", asyncHandler(async (req, res) => {
  const keyword = String(req.query.q || "").trim();
  if (!keyword) return res.json({ list: [] });
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const list = await bili.search(keyword, page);
  res.set("Cache-Control", "no-store");
  res.json({ list, page });
}));

app.get("/api/video/:bvid", asyncHandler(async (req, res) => {
  const info = await bili.getVideoInfo(req.params.bvid);
  res.json(info);
}));

app.get("/api/play/:bvid", asyncHandler(async (req, res) => {
  const cid = req.query.cid ? Number(req.query.cid) : undefined;
  const qn = req.query.qn ? Number(req.query.qn) : 64;
  const play = await bili.getPlayUrl(req.params.bvid, cid, qn);
  // Hand back our own proxied stream endpoint, never the raw signed URL.
  const streamPath = `/api/stream/${req.params.bvid}?cid=${play.cid}&qn=${qn}`;
  res.json({ ...play, url: undefined, backupUrls: undefined, streamUrl: streamPath });
}));

// ---- Stream proxy: really pull the video bytes from Bilibili -------------

app.get("/api/stream/:bvid", asyncHandler(async (req, res) => {
  const cid = req.query.cid ? Number(req.query.cid) : undefined;
  const qn = req.query.qn ? Number(req.query.qn) : 64;
  const play = await bili.getPlayUrl(req.params.bvid, cid, qn);
  const candidates = [play.url, ...(play.backupUrls || [])].filter(Boolean);

  let upstream;
  let lastErr;
  for (const target of candidates) {
    try {
      const headers = bili.baseHeaders();
      if (req.headers.range) headers.Range = req.headers.range;
      upstream = await fetch(target, { headers });
      if (upstream.ok || upstream.status === 206) break;
      lastErr = new Error(`Upstream stream ${upstream.status}`);
      upstream = null;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!upstream) throw lastErr || new Error("Unable to open stream");

  res.status(upstream.status);
  const passthrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ];
  for (const h of passthrough) {
    const val = upstream.headers.get(h);
    if (val) res.set(h, val);
  }
  if (!upstream.headers.get("accept-ranges")) res.set("Accept-Ranges", "bytes");
  res.set("Cache-Control", "public, max-age=3600");

  pipeUpstream(upstream, res);
}));

// ---- Image proxy (thumbnails / avatars are Referer-protected) ------------

app.get("/api/img", asyncHandler(async (req, res) => {
  let target = String(req.query.url || "");
  if (!target) return res.status(400).end();
  if (target.startsWith("//")) target = "https:" + target;
  if (!/^https?:\/\/[^/]*hdslb\.com\//.test(target)) {
    return res.status(400).json({ error: "Only hdslb.com images allowed" });
  }
  const upstream = await fetch(target, { headers: bili.baseHeaders() });
  if (!upstream.ok) return res.status(upstream.status).end();
  res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
  res.set("Cache-Control", "public, max-age=86400");
  pipeUpstream(upstream, res);
}));

// ---- Static frontend ----------------------------------------------------

const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) res.status(404).send("Frontend not built. Run `npm run build`.");
  });
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err.message);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`bili-site server listening on http://0.0.0.0:${PORT}`);
});
