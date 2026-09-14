/* Small split-build bootstrap. Assets may arrive as text from Apps Script;
   blob URLs give modules the correct MIME type on both supported hosts. */
(async function () {
  'use strict';
  const urls = { 1: '__PART_BASE__?p=1', 2: '__PART_BASE__?p=2', 3: '__PART_BASE__?p=3', 4: '__PART_BASE__?p=4', 5: '__PART_BASE__?p=5' };
  const panel = document.createElement('div');
  panel.id = 'jjLoader';
  panel.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-content:center;gap:16px;padding:24px;background:#111923;color:#edf5ff;text-align:center;font:16px Arial';
  panel.innerHTML = '<strong style="font-size:28px">Loading JJS</strong><span id="jjLoadStatus" role="status" aria-live="polite">Loading game files…</span><progress aria-label="Game loading progress" style="width:280px;max-width:80vw"></progress><button type="button" hidden>Try again</button>';
  document.body.appendChild(panel);
  const status = panel.querySelector('span'), bar = panel.querySelector('progress'), retry = panel.querySelector('button');
  retry.addEventListener('click', () => location.reload());
  const bytes = new Map(), totals = new Map(), ready = new Set();
  const started = Date.now(), names = {1: 'graphics', 2: 'multiplayer', 5: 'game code'};
  const bridge = window.google && window.google.script && window.google.script.run;
  const controllers = new Set();
  let failed = false;
  function progress() {
    if (failed) return;
    const loaded = [...bytes.values()].reduce((a, b) => a+b, 0);
    const waiting = [1, 2, 5].filter(id => !ready.has(id)).map(id => names[id]).join(', ');
    status.textContent = 'Loading game files: ' + ready.size + '/3 ready · ' + Math.floor((Date.now()-started)/1000) + 's'
      + (waiting ? ' · waiting for ' + waiting : '') + (loaded ? ' · ' + (loaded/1048576).toFixed(1) + ' MB received' : '');
    if (totals.size === 3 && [...totals.values()].every(n => n > 0)) {
      bar.max = [...totals.values()].reduce((a, b) => a+b, 0); bar.value = loaded;
    }
  }
  const heartbeat = setInterval(progress, 1000);
  function serverDownload(id) {
    // HTML-service frames have a native RPC bridge. Avoid fetching the public
    // /exec URL from its Google-hosted iframe (redirects/auth/CORS can stall).
    return new Promise((resolve, reject) => {
      let finished = false;
      const timer = setTimeout(() => finish(new Error('Timed out waiting for ' + (names[id] || 'music') + '. Please try again.')), 45000);
      function finish(error, value) {
        if (finished) return;
        finished = true; clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      }
      const match = urls[id].match(/[?&]v=([a-f0-9]{40})(?:&|$)/);
      try {
        bridge.withSuccessHandler(value => {
          if (typeof value !== 'string' || !value.trim() || /^\s*</.test(value))
            return finish(new Error('The server returned an invalid game file.'));
          finish(null, value);
        }).withFailureHandler(error => {
          const message = String(error && error.message || error);
          finish(new Error(/getGamePart|not found/i.test(message)
            ? 'Update Apps Script with getGamePart and deploy a new version.' : message));
        }).getGamePart(id, match ? match[1] : '');
      } catch (_) {
        finish(new Error('Update Apps Script with getGamePart and deploy a new version.'));
      }
    });
  }
  async function download(id, report = true) {
    if (bridge) {
      const code = await serverDownload(id);
      if (report && !failed) { bytes.set(id, new Blob([code]).size); ready.add(id); progress(); }
      return code;
    }
    // Static hosting retains streamed fetch. A stalled transfer fails after
    // 30 seconds without data, with a 90-second total cap; no long retry loop.
    const controller = new AbortController(); controllers.add(controller);
    let idleTimer;
    const totalTimer = setTimeout(() => controller.abort(), 90000);
    function touch() { clearTimeout(idleTimer); idleTimer = setTimeout(() => controller.abort(), 30000); }
    touch();
    try {
      const response = await fetch(urls[id], { signal: controller.signal });
      if (!response.ok) throw new Error('File p' + id + ' returned HTTP ' + response.status);
      if (/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('The server returned a web page instead of game code.');
      if (report) { bytes.set(id, 0); totals.set(id, Number(response.headers.get('content-length'))); }
      let code;
      if (!response.body) code = await response.text();
      else {
        const reader = response.body.getReader(), chunks = []; let size = 0;
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          touch(); chunks.push(value); size += value.length;
          if (report) { bytes.set(id, size); progress(); }
        }
        code = await new Blob(chunks).text();
      }
      if (!code.trim() || /^\s*</.test(code)) throw new Error('The server returned an invalid game file.');
      if (report && !failed) { ready.add(id); progress(); }
      return code;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Loading ' + (names[id] || 'music') + ' stalled. Please try again.');
      throw error;
    } finally { clearTimeout(idleTimer); clearTimeout(totalTimer); controllers.delete(controller); }
  }
  function blob(code) { return URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); }
  function classic(code) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = blob(code);
      script.onload = () => { URL.revokeObjectURL(script.src); resolve(); };
      script.onerror = () => { URL.revokeObjectURL(script.src); reject(new Error('A game script could not start.')); };
      document.head.appendChild(script);
    });
  }
  try {
    const [three, mqtt, game] = await Promise.all([download(1), download(2), download(5)]);
    clearInterval(heartbeat);
    bar.removeAttribute('value'); status.textContent = 'Preparing the map…';
    await classic(mqtt);
    const threeURL = blob(three);
    const module = game.replace('from "three"', 'from ' + JSON.stringify(threeURL));
    if (module === game) throw new Error('The game files are from different builds. Reload to try again.');
    const gameURL = blob(module);
    try { await import(gameURL); }
    finally { URL.revokeObjectURL(gameURL); URL.revokeObjectURL(threeURL); }
    panel.remove(); window.JJLOADER = { ready: true };
    // Music must not compete with the map and renderer during startup.
    for (const id of [3, 4]) download(id, false).then(classic).catch(() => {});
  } catch (error) {
    failed = true; clearInterval(heartbeat); controllers.forEach(c => c.abort()); bar.hidden = true; retry.hidden = false;
    status.textContent = 'Could not load JJS. ' + (error.message || 'Check your connection and try again.');
    window.JJLOADER = { ready: false, error: String(error) };
  }
})();
