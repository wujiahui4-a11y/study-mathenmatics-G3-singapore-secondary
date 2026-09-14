/* Small split-build bootstrap. Assets may arrive as text from Apps Script;
   blob URLs give modules the correct MIME type on both supported hosts. */
(async function () {
  'use strict';
  const urls = { 1: '__PART_BASE__?p=1', 2: '__PART_BASE__?p=2', 3: '__PART_BASE__?p=3', 4: '__PART_BASE__?p=4', 5: '__PART_BASE__?p=5' };
  const panel = document.createElement('div');
  panel.id = 'jjLoader';
  panel.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-content:center;gap:16px;padding:24px;background:#111923;color:#edf5ff;text-align:center;font:16px Arial';
  panel.innerHTML = '<strong style="font-size:28px">Loading JJS</strong><span id="jjLoadStatus" role="status" aria-live="polite">Downloading game files…</span><progress aria-label="Game download progress" style="width:280px;max-width:80vw"></progress><button type="button" hidden>Try again</button>';
  document.body.appendChild(panel);
  const status = panel.querySelector('span'), bar = panel.querySelector('progress'), retry = panel.querySelector('button');
  retry.addEventListener('click', () => location.reload());
  const bytes = new Map(), totals = new Map();
  let failed = false;
  function progress() {
    if (failed) return;
    const loaded = [...bytes.values()].reduce((a, b) => a+b, 0);
    status.textContent = 'Downloading game files… ' + (loaded/1048576).toFixed(1) + ' MB';
    if (totals.size === 3 && [...totals.values()].every(n => n > 0)) {
      bar.max = [...totals.values()].reduce((a, b) => a+b, 0); bar.value = loaded;
    }
  }
  async function download(id, report = true) {
    // Two retries cover temporary upstream errors, with a finite timeout.
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90000);
      try {
        const response = await fetch(urls[id], { signal: controller.signal });
        if (!response.ok) throw new Error('File p' + id + ' returned HTTP ' + response.status);
        if (/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('File p' + id + ' returned a web page instead of game code');
        if (report) { bytes.set(id, 0); totals.set(id, Number(response.headers.get('content-length'))); }
        if (!response.body) return await response.text();
        const reader = response.body.getReader(), chunks = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          chunks.push(value); size += value.length;
          if (report) { bytes.set(id, size); progress(); }
        }
        const buffer = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
        return new TextDecoder().decode(buffer);
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 500*(attempt+1)));
      } finally { clearTimeout(timer); }
    }
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
    failed = true; bar.hidden = true; retry.hidden = false;
    status.textContent = 'Could not load JJS. ' + (error.message || 'Check your connection and try again.');
    window.JJLOADER = { ready: false, error: String(error) };
  }
})();
