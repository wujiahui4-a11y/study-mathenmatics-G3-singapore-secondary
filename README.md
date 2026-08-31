# study-mathenmatics-G3-singapore-secondary

A Scratch 3.0 project (`project.json`) — a Five Nights at Freddy's–style fan game.
The repository stores the raw `project.json`; the ~360 costume and sound assets it
references are pulled from Scratch's public asset CDN at build time.

## Running locally

Requirements: Node.js 18+ (Node 22 recommended).

```bash
npm install       # install dev dependencies
npm run build     # download assets, pack project.sb3, and package a standalone app into dist/
npm run serve     # serve dist/ at http://localhost:8080
```

Or run both build and serve together:

```bash
npm run dev
```

Then open http://localhost:8080 and click the green flag to play.

## How it works

`npm run build` (`scripts/build.mjs`):

1. Parses `project.json` and collects every referenced asset (`md5ext`).
2. Downloads assets from `https://assets.scratch.mit.edu` into `.cache/assets/`
   (cached, so re-runs are fast and offline-friendly).
3. Zips `project.json` + assets into `.cache/project.sb3`.
4. Uses the [TurboWarp packager](https://github.com/TurboWarp/packager) to produce a
   standalone HTML app (with a separate `assets/` folder) in `dist/`.

`npm run serve` (`scripts/serve.mjs`) is a tiny static file server for `dist/`.
Set `PORT` to change the port (default `8080`).

## Cloud Agent environment

`.cursor/environment.json` configures the Cloud Agent dev environment:

- `install`: `npm ci && npm run build`
- `terminals`: runs `npm run serve` so the project is available on port `8080`.
