# BiliFlux

HTML-only realtime Bilibili stream extractor and player.

Open `index.html` in a browser (or serve it statically). The page fetches live rankings/popular lists from Bilibili APIs via CORS-friendly proxies, extracts `playurl` MP4 direct links (`platform=html5`), and plays them in a native `<video>` element.
