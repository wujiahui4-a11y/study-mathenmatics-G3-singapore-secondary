# study-mathematics-G3-singapore-secondary

A Scratch 3.0 project. The game logic and stage/sprite definitions live in
[`project.json`](./project.json); the referenced costume and sound assets are
fetched on demand from Scratch's public asset CDN.

## Development environment

Requirements: Node.js 18+ (Node 22 recommended) and npm.

```bash
npm install      # install tooling (TurboWarp packager + jszip)
npm run build    # download assets, bundle dist/project.sb3, package dist/index.html
npm run serve    # serve the playable project at http://localhost:8000
```

Then open http://localhost:8000 and click the green flag to play.

### What the build does

- `npm run build:sb3` reads `project.json`, downloads every referenced costume
  and sound from `assets.scratch.mit.edu` (cached under `.cache/assets`), and
  zips them with `project.json` into `dist/project.sb3` — a standard Scratch
  `.sb3` file that can be opened in the Scratch editor or TurboWarp.
- `npm run build:html` uses the [TurboWarp packager](https://github.com/TurboWarp/packager)
  to turn `dist/project.sb3` into a single self-contained, offline-runnable
  `dist/index.html` (Scratch VM + renderer + all assets embedded).

Generated artifacts (`node_modules/`, `dist/`, `.cache/`) are git-ignored.
