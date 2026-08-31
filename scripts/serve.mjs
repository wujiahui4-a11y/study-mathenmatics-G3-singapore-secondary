// Minimal static file server for the packaged Scratch app in dist/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let rel = urlPath === '/' ? '/index.html' : urlPath;
    const target = path.normalize(path.join(DIST_DIR, rel));
    if (!target.startsWith(DIST_DIR)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(target).pipe(res);
  } catch (err) {
    res.writeHead(500).end('Server error');
  }
});

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error('[serve] dist/index.html not found. Run "npm run build" first.');
  process.exit(1);
}

server.listen(PORT, HOST, () => {
  console.log(`[serve] Serving dist/ at http://${HOST}:${PORT}/ (Ctrl+C to stop)`);
});
