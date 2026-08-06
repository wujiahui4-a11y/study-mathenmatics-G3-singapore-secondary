# BiliStream

A Bilibili streaming website with a modern UI that pulls a **live feed of real
Bilibili videos** and **truly extracts and plays the underlying video streams**
— it does not embed or open bilibili.com. Video bytes are resolved and proxied
through the backend so they play in a normal HTML5 `<video>` element.

## How it works

1. **Live feed** — the backend calls Bilibili's public endpoints
   (`x/web-interface/popular`, `x/web-interface/wbi/search/type`) to list current
   trending / searched videos with thumbnails and stats.
2. **Stream extraction** — for a chosen video it resolves the `cid`
   (`x/web-interface/view`) and then the real stream URL via the play-URL API
   (`x/player/wbi/playurl`, with **WBI request signing**), requesting a
   directly-playable progressive MP4 (`platform=html5`).
3. **Byte proxy** — the raw `*.bilivideo.com` stream is Referer-protected and
   cross-origin, so the backend proxies it (`/api/stream/:bvid`), injecting the
   required `Referer`/`User-Agent` headers and forwarding HTTP `Range` requests
   so seeking works. Thumbnails/avatars are proxied the same way (`/api/img`).

## Architecture

- `server/` — Express API + stream/image proxy + serves the built client.
  - `server/bilibili.js` — WBI signing and Bilibili API/stream extraction.
- `client/` — Vite + React + TypeScript + Tailwind UI.

## Run it

```bash
npm run install:all   # install server + client deps
npm run build         # build the React client
npm start             # serve everything on http://localhost:3000
```

Development (hot reload; client on :5173 proxying /api to the server on :3000):

```bash
npm run install:all
npm run dev
```

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/feed?pn=&ps=` | Live trending feed |
| `GET /api/search?q=&page=` | Search videos |
| `GET /api/video/:bvid` | Video metadata + parts |
| `GET /api/play/:bvid?cid=&qn=` | Resolve extraction info + proxied stream URL |
| `GET /api/stream/:bvid?cid=&qn=` | Proxied video byte stream (Range-enabled) |
| `GET /api/img?url=` | Proxied hdslb.com image |

> For demo / educational use. Respect Bilibili's Terms of Service and copyright.
