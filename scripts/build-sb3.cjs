#!/usr/bin/env node
/**
 * Builds a runnable Scratch 3.0 project archive (.sb3) from the repository's
 * project.json by downloading every referenced costume/sound asset from the
 * Scratch asset CDN and zipping them together with project.json.
 *
 * Downloaded assets are cached under .cache/assets so repeated runs are fast and
 * idempotent (offline once the cache is warm).
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const ROOT = path.resolve(__dirname, "..");
const PROJECT_JSON = path.join(ROOT, "project.json");
const CACHE_DIR = path.join(ROOT, ".cache", "assets");
const DIST_DIR = path.join(ROOT, "dist");
const OUT_SB3 = path.join(DIST_DIR, "project.sb3");

const ASSET_HOSTS = [
  (md5ext) => `https://assets.scratch.mit.edu/internalapi/asset/${md5ext}/get/`,
  (md5ext) => `https://assets.scratch.mit.edu/${md5ext}`,
];

const CONCURRENCY = 12;
const MAX_RETRIES = 4;

function collectAssets(project) {
  const assets = new Map(); // md5ext -> true
  for (const target of project.targets || []) {
    for (const costume of target.costumes || []) {
      if (costume.md5ext) assets.set(costume.md5ext, true);
    }
    for (const sound of target.sounds || []) {
      if (sound.md5ext) assets.set(sound.md5ext, true);
    }
  }
  return [...assets.keys()];
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadAsset(md5ext) {
  const cachePath = path.join(CACHE_DIR, md5ext);
  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0) {
    return fs.readFileSync(cachePath);
  }

  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    for (const buildUrl of ASSET_HOSTS) {
      const url = buildUrl(md5ext);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} for ${url}`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0) {
          lastErr = new Error(`Empty body for ${url}`);
          continue;
        }
        fs.writeFileSync(cachePath, buf);
        return buf;
      } catch (err) {
        lastErr = err;
      }
    }
    await sleep(500 * 2 ** attempt);
  }
  throw new Error(`Failed to download ${md5ext}: ${lastErr && lastErr.message}`);
}

async function runPool(items, worker) {
  let index = 0;
  let done = 0;
  const total = items.length;
  const results = new Array(total);
  async function next() {
    while (index < total) {
      const i = index++;
      results[i] = await worker(items[i], i);
      done++;
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`  downloaded ${done}/${total} assets\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, next));
  process.stdout.write("\n");
  return results;
}

async function main() {
  if (!fs.existsSync(PROJECT_JSON)) {
    throw new Error(`Missing project.json at ${PROJECT_JSON}`);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const raw = fs.readFileSync(PROJECT_JSON);
  const project = JSON.parse(raw.toString("utf8"));
  const assets = collectAssets(project);
  console.log(`Found ${assets.length} unique assets referenced by project.json`);

  const buffers = await runPool(assets, async (md5ext) => ({
    md5ext,
    data: await downloadAsset(md5ext),
  }));

  const zip = new JSZip();
  zip.file("project.json", raw);
  for (const { md5ext, data } of buffers) {
    zip.file(md5ext, data);
  }

  const sb3 = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(OUT_SB3, sb3);
  const mb = (sb3.length / (1024 * 1024)).toFixed(1);
  console.log(`Wrote ${OUT_SB3} (${mb} MB, ${assets.length + 1} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
