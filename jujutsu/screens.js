/* Two existing tower consoles. Photos travel in bounded room packets;
   HTTPS video files play locally with a shared start time and muted audio. */
(function () {
  'use strict';
  const W = JJIWORLD, J = JJJJS, D = JJINTERACTION_DATA.screens;
  const V = (a) => new THREE.Vector3(...a), now = () => performance.now() / 1000;
  const states = [null, null], assets = new Map(), incoming = new Map(), views = new Map(), requested = new Map();
  const completed = new Set();
  let root = null, queue = [], lastPacket = 0, version = 0, opened = -1, ticket = 0;
  const controls = D.map(s => V(J.data.parts[s.control].slice(0, 3)).sub(V(J.data.origin)));
  const partPos = id => V(J.data.parts[id].slice(0, 3)).sub(V(J.data.origin));
  const MAX_PHOTO = 48000, CHUNK = 8000;
  const panel = document.createElement('div'); panel.style.cssText = 'position:fixed;inset:0;z-index:180;display:none;align-items:center;justify-content:center;background:#080f1bd9;color:white;font:15px system-ui';
  const card = document.createElement('div'); card.style.cssText = 'width:min(420px,88vw);max-height:85vh;overflow:auto;padding:24px;border-radius:16px;background:#172538;box-shadow:0 15px 70px #0008';
  panel.appendChild(card); document.body.appendChild(panel);
  function node(tag, text) {const e = document.createElement(tag); if (text) e.textContent = text; card.appendChild(e); return e;}
  const title = node('h2', 'Building screen');
  node('p', '选择照片，或填写 HTTPS 视频直链。房间内其他玩家也能看到。');
  const imageInput = node('input'); imageInput.type = 'file'; imageInput.accept = 'image/png,image/jpeg,image/webp'; imageInput.setAttribute('aria-label', '选择投屏照片');
  const photo = node('button', '投放照片 / Show photo'); photo.type = 'button';
  node('p', '视频：HTTPS MP4 / WebM 直链（静音循环）。网站需要允许跨域播放；网页、YouTube 页面链接不能直接作为视频。');
  const url = node('input'); url.type = 'url'; url.placeholder = 'https://…/video.mp4'; url.setAttribute('aria-label', '视频直链'); url.style.cssText = 'box-sizing:border-box;width:100%;padding:10px';
  const video = node('button', '投放视频 / Show video'); video.type = 'button';
  const stop = node('button', '停止投放 / Stop'), close = node('button', '返回游戏 / Close');
  const status = node('p', ''); status.setAttribute('role', 'status');
  for (const b of [photo, video, stop, close]) b.style.cssText = 'padding:10px 14px;margin:10px 8px 0 0;border-radius:7px;border:1px solid #9edbff;background:#254563;color:#fff;font:inherit';
  const inputActive = gameInputActive;
  gameInputActive = function () {return opened < 0 && inputActive();};
  function nearConsole(e) {
    if (!W.active() || !e || e.dead || e.rag) return -1;
    for (let n = 0; n < controls.length; n++) if (W.reachable(e, controls[n], 8)) return n;
    return -1;
  }
  function closePanel() {opened = -1; ticket++; panel.style.display = 'none';}
  function openNearby() {
    if (!gameInputActive() || !W.available(player)) return false;
    const n = nearConsole(player); if (n < 0) return false;
    opened = n; title.textContent = 'Building screen ' + (n + 1); status.textContent = ''; panel.style.display = 'flex';
    if (document.exitPointerLock) document.exitPointerLock();
    if (window.JJFIGHT) JJFIGHT.clearInput();
    for (const key of Object.keys(keys)) keys[key] = false;
    close.focus(); return true;
  }
  function validURL(value) {
    if (typeof value !== 'string' || value.length > 1800) return false;
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && /\.(mp4|webm)$/i.test(u.pathname) && !/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u.hostname) && !u.hostname.startsWith('[');
    } catch (_) {return false;}
  }
  function validPhoto(value) {return typeof value === 'string' && value.length <= MAX_PHOTO && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value);}
  function canEdit(id, n) {const e = W.actor(id); return Number.isInteger(n) && !!D[n] && !!e && !e.dead && !e.rag && W.reachable(e, controls[n], 8);}
  function send(m) {W.send(m);}
  function packet(m) {if (W.authority()) receive(Object.assign({id: W.online() ? MPJJ.id : 'local', epoch: W.epoch}, m)); else send(m);}
  function commit(n, kind, value) {
    const id = W.epoch + ':screen:' + ++version;
    if (kind === 'image') assets.set(id, value);
    states[n] = {kind, id, url: kind === 'video' ? value : '', start: now()};
    const keep = new Set(states.filter(Boolean).map(s => s.id)); for (const id of assets.keys()) if (!keep.has(id)) assets.delete(id);
    W.snapshot(); if (kind === 'image') share(id);
  }
  function share(id, to) {
    if (!assets.has(id)) return;
    const key = (to || '*') + id;
    if (now() - (requested.get(key) || -10) < 1.5) return; requested.set(key, now());
    const text = assets.get(id), count = Math.ceil(text.length / CHUNK);
    for (let i = 0; i < count; i++) queue.push({t: 'wi-media-asset', to, asset: id, count, index: i, text: text.slice(i * CHUNK, (i + 1) * CHUNK)});
    queue = queue.slice(-180);
  }
  function snapshot() {return states.map(s => s ? {kind: s.kind, id: s.id, url: s.url, age: Math.max(0, now() - s.start)} : null);}
  function receiveState(list) {
    if (!Array.isArray(list) || list.length !== 2) return;
    if (!list.every(s => s === null || s && ['image','video','off'].includes(s.kind) && typeof s.id === 'string' && s.id.length < 100 && Number.isFinite(s.age) && s.age >= 0 && (s.kind !== 'video' || validURL(s.url)))) return;
    list.forEach((s, n) => {states[n] = s ? {...s, start: now() - s.age} : null;});
    const keep = new Set(states.filter(Boolean).map(s => s.id)); for (const id of assets.keys()) if (!keep.has(id)) assets.delete(id);
  }
  function assemble(m, key) {
    if (typeof m.asset !== 'string' || m.asset.length > 100 || !Number.isInteger(m.count) || m.count < 1 || m.count > 6 || !Number.isInteger(m.index) || m.index < 0 || m.index >= m.count || typeof m.text !== 'string' || m.text.length > CHUNK) return null;
    if (!incoming.has(key)) {
      if (incoming.size >= 8) return null;
      incoming.set(key, {parts: new Array(m.count), count: m.count, at: now(), screen: m.screen, id: m.id});
    }
    const s = incoming.get(key); if (s.count !== m.count || s.screen !== m.screen || s.id !== m.id) return null;
    s.parts[m.index] = m.text;
    if (Array.from(s.parts).some(x => typeof x !== 'string')) return null;
    incoming.delete(key); const result = s.parts.join(''); return validPhoto(result) ? result : null;
  }
  function receive(m) {
    if (typeof m.t !== 'string' || !m.t.startsWith('wi-media-')) return false;
    if (m.t === 'wi-media-set' && W.authority() && canEdit(m.id, m.screen)) {
      if (m.kind === 'video' && validURL(m.url)) commit(m.screen, 'video', m.url);
      else if (m.kind === 'off') commit(m.screen, 'off', '');
    } else if (m.t === 'wi-media-upload' && W.authority() && canEdit(m.id, m.screen)) {
      const key = 'upload:' + m.id + ':' + m.asset;
      if (completed.has(key)) return true;
      const photo = assemble(m, key);
      if (photo && canEdit(m.id, m.screen)) {completed.add(key); if (completed.size > 32) completed.delete(completed.values().next().value); commit(m.screen, 'image', photo);}
    } else if (m.t === 'wi-media-get' && W.authority() && W.actor(m.id)) {
      share(m.asset, m.id);
    } else if (m.t === 'wi-media-asset' && !W.authority() && m.id === W.hostId && states.some(s => s?.id === m.asset)) {
      const photo = assemble(m, 'asset:' + m.asset); if (photo) assets.set(m.asset, photo);
    }
    return true;
  }
  async function uploadPhoto() {
    const file = imageInput.files?.[0], n = opened, token = ++ticket;
    if (n < 0 || !file) {status.textContent = '请先选择照片。'; return;}
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 12 * 1024 * 1024) {status.textContent = '请选择小于 12 MB 的 PNG、JPEG 或 WebP 照片。'; return;}
    status.textContent = '正在准备照片…'; photo.disabled = true;
    let objectURL = null;
    try {
      objectURL = URL.createObjectURL(file); const img = new Image();
      await new Promise((resolve, reject) => {img.onload = resolve; img.onerror = reject; img.src = objectURL;});
      if (token !== ticket || opened !== n || nearConsole(player) !== n) return;
      const canvas = document.createElement('canvas'); const ratio = Math.min(1, 512 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * ratio)); canvas.height = Math.max(1, Math.round(img.height * ratio));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let value = canvas.toDataURL('image/jpeg', .72);
      for (let quality = .6; value.length > MAX_PHOTO && quality >= .2; quality -= .1) value = canvas.toDataURL('image/jpeg', quality);
      if (value.length > MAX_PHOTO) {canvas.width = Math.max(1, Math.round(canvas.width / 2)); canvas.height = Math.max(1, Math.round(canvas.height / 2)); canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); value = canvas.toDataURL('image/jpeg', .6);}
      if (!validPhoto(value)) {status.textContent = '照片内容太复杂，请裁剪后重试。'; return;}
      const asset = 'upload:' + Date.now().toString(36) + ':' + token, count = Math.ceil(value.length / CHUNK);
      for (let i = 0; i < count; i++) {
        const m = {t: 'wi-media-upload', screen: n, asset, index: i, count, text: value.slice(i * CHUNK, (i + 1) * CHUNK)};
        if (W.authority()) packet(m); else queue.push(m, {...m});
      }
      status.textContent = '照片已发送，正在投放。';
    } catch (_) {status.textContent = '无法读取这张照片，请换一张重试。';}
    finally {if (objectURL) URL.revokeObjectURL(objectURL); photo.disabled = false;}
  }
  photo.addEventListener('click', uploadPhoto);
  video.addEventListener('click', () => {
    const value = url.value.trim(); if (opened < 0 || nearConsole(player) !== opened) return;
    if (!validURL(value)) {status.textContent = '请输入 HTTPS 的 .mp4 或 .webm 视频直链。'; return;}
    packet({t: 'wi-media-set', screen: opened, kind: 'video', url: value}); status.textContent = '视频已发送，正在加载。';
  });
  stop.addEventListener('click', () => {if (opened >= 0) packet({t: 'wi-media-set', screen: opened, kind: 'off'});});
  close.addEventListener('click', closePanel);
  panel.addEventListener('keydown', e => {if (e.code === 'Escape') closePanel(); e.stopPropagation();});
  function dropView(n) {
    const v = views.get(n); if (!v) return;
    if (v.video) {v.video.pause(); v.video.removeAttribute('src'); v.video.load();}
    root?.remove(v.mesh); v.mesh.geometry.dispose(); v.mesh.material.dispose(); v.texture?.dispose(); views.delete(n);
  }
  function makeView(n, s) {
    dropView(n);
    const p = J.data.parts[D[n].part], geo = new THREE.PlaneGeometry(p[12], p[13]);
    const material = new THREE.MeshBasicMaterial({color: 0xffffff, side: THREE.DoubleSide, toneMapped: false});
    const mesh = new THREE.Mesh(geo, material); mesh.name = 'Shared tower screen ' + (n + 1);
    // Roblox front is local -Z. Keep the replacement just ahead of the original.
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(J.transform(p)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -p[14] / 2 - .04)).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    root.add(mesh); const v = {id: s.id, mesh, texture: null, video: null, failed: false}; views.set(n, v);
    const fail = () => {if (views.get(n) !== v) return; v.failed = true; material.color.setHex(0x293c51); if (opened === n) status.textContent = '媒体加载失败：请检查文件地址和跨域权限，或重新投放照片。';};
    if (s.kind === 'image') {
      const img = new Image();
      img.onload = () => {if (views.get(n) !== v) return; v.texture = new THREE.Texture(img); v.texture.colorSpace = THREE.SRGBColorSpace; v.texture.needsUpdate = true; material.map = v.texture; material.needsUpdate = true;};
      img.onerror = fail; img.src = assets.get(s.id);
    } else {
      const el = document.createElement('video'); v.video = el; el.crossOrigin = 'anonymous'; el.muted = true; el.defaultMuted = true; el.loop = true; el.playsInline = true; el.preload = 'metadata';
      el.addEventListener('error', fail);
      el.addEventListener('loadedmetadata', () => {if (views.get(n) !== v) return; if (Number.isFinite(el.duration) && el.duration > 0) el.currentTime = (now() - states[n].start) % el.duration; el.play().catch(fail);});
      v.texture = new THREE.VideoTexture(el); v.texture.colorSpace = THREE.SRGBColorSpace; material.map = v.texture; material.needsUpdate = true; el.src = s.url;
    }
    return v;
  }
  function tick() {
    if (!root) {root = new THREE.Group(); root.name = 'Shared building screens'; scene.add(root);}
    if (opened >= 0 && nearConsole(player) !== opened) closePanel();
    const t = now();
    for (const [id, transfer] of incoming) if (t - transfer.at > 12) incoming.delete(id);
    if (queue.length && t - lastPacket > .05) {lastPacket = t; send(queue.shift());}
    states.forEach((s, n) => {
      if (!s || s.kind === 'off') {dropView(n); return;}
      const near = player.pos.distanceToSquared(partPos(D[n].part)) < (window.JJPOTATO?.enabled ? 360 : 650) ** 2 && !document.hidden;
      if (!near) {const v = views.get(n); if (v) {v.mesh.visible = false; v.video?.pause();} return;}
      if (s.kind === 'image' && !assets.has(s.id)) {
        dropView(n);
        if (t - (requested.get(s.id) || -10) > 2) {requested.set(s.id, t); send({t: 'wi-media-get', asset: s.id});}
        return;
      }
      let v = views.get(n); if (!v || v.id !== s.id) v = makeView(n, s);
      v.mesh.visible = true;
      if (v.video && !v.failed && v.video.readyState >= 2) {
        const d = v.video.duration, target = Number.isFinite(d) && d > 0 ? (t - s.start) % d : 0;
        if (Math.abs(v.video.currentTime - target) > 1.2) v.video.currentTime = target;
        if (v.video.paused) v.video.play().catch(() => {});
      }
    });
  }
  function clear() {
    closePanel(); states.fill(null); for (const n of [...views.keys()]) dropView(n);
    if (root) scene.remove(root); root = null; incoming.clear(); assets.clear(); requested.clear(); completed.clear(); queue = [];
  }
  window.JJBROADCAST = {nearConsole, openNearby, receive, receiveState, snapshot, tick, clear, validURL,
    audit: () => ({screens: snapshot(), assets: assets.size, incoming: incoming.size, queued: queue.length, views: views.size, opened})};
})();
