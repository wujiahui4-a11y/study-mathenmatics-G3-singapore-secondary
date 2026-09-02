// Build pipeline for the Scratch project in this repo.
//
//   project.json (+ assets fetched from Scratch's CDN)
//     -> self-contained project.sb3
//     -> standalone TurboWarp HTML app (index.html + assets/)  in dist/
//
// The script is idempotent: downloaded assets are cached in .cache/assets and
// re-used on subsequent runs, so re-running only re-packages.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import Packager from '@turbowarp/packager';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_JSON = path.join(ROOT, 'project.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'assets');
const DIST_DIR = path.join(ROOT, 'dist');
const SB3_PATH = path.join(ROOT, '.cache', 'project.sb3');

const ASSET_HOST = 'https://assets.scratch.mit.edu/internalapi/asset';
const CONCURRENCY = 16;
const MAX_RETRIES = 4;

function log(...args) {
  console.log('[build]', ...args);
}

function collectAssetIds(project) {
  const ids = new Set();
  for (const target of project.targets || []) {
    for (const costume of target.costumes || []) {
      ids.add(costume.md5ext || `${costume.assetId}.${costume.dataFormat}`);
    }
    for (const sound of target.sounds || []) {
      ids.add(sound.md5ext || `${sound.assetId}.${sound.dataFormat}`);
    }
  }
  return [...ids];
}

async function downloadAsset(md5ext) {
  const dest = path.join(CACHE_DIR, md5ext);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    return { md5ext, cached: true };
  }
  const url = `${ASSET_HOST}/${md5ext}/get/`;
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error('empty response');
      fs.writeFileSync(dest, buf);
      return { md5ext, cached: false };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error(`Failed to download ${md5ext}: ${lastError}`);
}

async function downloadAll(ids) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const queue = [...ids];
  let cachedCount = 0;
  let fetchedCount = 0;
  const failures = [];

  async function worker() {
    while (queue.length) {
      const md5ext = queue.pop();
      try {
        const { cached } = await downloadAsset(md5ext);
        if (cached) cachedCount++;
        else fetchedCount++;
      } catch (err) {
        failures.push(String(err));
      }
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  log(
    `assets ready: ${cachedCount} cached, ${fetchedCount} downloaded, ` +
      `${failures.length} failed (${((Date.now() - started) / 1000).toFixed(1)}s)`
  );
  if (failures.length) {
    for (const f of failures.slice(0, 10)) log('  -', f);
    throw new Error(`${failures.length} asset(s) could not be downloaded.`);
  }
}

async function buildSb3(ids) {
  const zip = new JSZip();
  zip.file('project.json', fs.readFileSync(PROJECT_JSON));
  for (const md5ext of ids) {
    zip.file(md5ext, fs.readFileSync(path.join(CACHE_DIR, md5ext)));
  }
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.mkdirSync(path.dirname(SB3_PATH), { recursive: true });
  fs.writeFileSync(SB3_PATH, buf);
  log(`packed project.sb3 (${(buf.length / 1e6).toFixed(1)} MB)`);
  return buf;
}

async function packageToDist(sb3) {
  const loaded = await Packager.loadProject(sb3, () => {});
  const packager = new Packager.Packager();
  packager.project = loaded;
  packager.options.target = 'zip'; // index.html + separate assets/ folder
  packager.options.turbo = true; // FNAF-style projects need turbo mode
  packager.options.autoplay = true;
  packager.options.controls.greenFlag.enabled = true;
  packager.options.controls.stopAll.enabled = true;
  packager.options.controls.fullscreen.enabled = true;
  packager.options.app.packageName = 'study-mathenmatics-g3';
  packager.options.app.windowTitle = 'study-mathenmatics-G3-singapore-secondary';

  const result = await packager.package();
  const zip = await JSZip.loadAsync(Buffer.from(result.data));

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    const target = path.join(DIST_DIR, entry.name);
    if (entry.dir) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
  }
  log(`wrote ${entries.length} files to dist/`);
}

async function main() {
  if (!fs.existsSync(PROJECT_JSON)) {
    throw new Error(`project.json not found at ${PROJECT_JSON}`);
  }
  const project = JSON.parse(fs.readFileSync(PROJECT_JSON, 'utf8'));
  const ids = collectAssetIds(project);
  log(`project references ${ids.length} unique assets`);
  await downloadAll(ids);
  const sb3 = await buildSb3(ids);
  await packageToDist(sb3);
  log('done. Run "npm run serve" to play the project.');
}

main().catch((err) => {
  console.error('[build] FAILED:', err);
  process.exit(1);
});
