/* =========================================================================
   JUJUTSU BATTLEGROUND — ONLINE MODE
   Fight your friends in the same arena instead of the training dummies.

   This block is appended inside the game's own module, so it can reach the
   things the game already declares: player, enemies, Enemy, scene, THREE,
   makeAnimeRig, hurtPlayer, applyProjPlayer, updatePlayer, switchChar ...
   Every hook checks MP.active first, so the offline game is untouched.

   Each player owns their own health. When your attack lands on somebody, the
   hit is sent to them and they apply it to themselves, then tell everyone
   their new health — the same model the arena and Baldi games use.
   ========================================================================= */
(function () {
  'use strict';

  /* ----------------------------------------------------------------- relay */
  var BROKERS = [
    { url: 'wss://broker.emqx.io:8084/mqtt', name: 'relay 1' },
    { url: 'wss://broker.hivemq.com:8884/mqtt', name: 'relay 2' },
    { url: 'wss://test.mosquitto.org:8081/mqtt', name: 'relay 3' }
  ];
  var TOPIC_ROOT = 'jujutsu/v1/';
  var ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var SEND_HZ = 14;

  function uid() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  }
  function roomCode() {
    var out = '', buf = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) out += ALPHABET[buf[i] % ALPHABET.length];
    return out;
  }
  function nowS() { return performance.now() / 1000; }

  function connectBroker(broker, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (!window.mqtt) return reject(new Error('no networking library'));
      var settled = false;
      var client = window.mqtt.connect(broker.url, {
        clientId: 'jj_' + uid(), keepalive: 30, connectTimeout: timeoutMs || 9000,
        reconnectPeriod: 4000, resubscribe: true, queueQoSZero: false, clean: true
      });
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { client.end(true); } catch (e) {}
        reject(new Error('no answer'));
      }, (timeoutMs || 9000) + 1500);
      client.on('connect', function () {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(client);
      });
      client.on('error', function (err) {
        if (settled) return;
        settled = true; clearTimeout(timer);
        try { client.end(true); } catch (e) {}
        reject(err);
      });
    });
  }

  /* Everyone talks on one topic here: this game is a free-for-all brawl and
     each fighter owns their own health, so there is no host to route through. */
  function Relay() {
    this.conns = []; this.selfId = uid(); this.outSeq = 0;
    this.lastSeq = {}; this.senderConn = {}; this.connected = false;
  }
  Relay.prototype.start = function (opts) {
    var self = this;
    this.onMsg = opts.onMsg;
    this.onStatus = opts.onStatus || function () {};
    this.topic = TOPIC_ROOT + opts.code + '/all';
    return new Promise(function (resolve, reject) {
      var pending = BROKERS.length, done = false, errs = [];
      BROKERS.forEach(function (b) {
        connectBroker(b, 9000).then(function (client) {
          self.attach(client, b); pending--;
          if (!done) { done = true; self.connected = true; resolve(opts.code); }
        }).catch(function (e) {
          errs.push(b.name + ' ' + ((e && e.message) || 'blocked')); pending--;
          if (!pending && !done) reject(new Error(errs.join(', ')));
        });
      });
    });
  };
  Relay.prototype.attach = function (client, broker) {
    var self = this;
    client.__name = broker.name;
    this.conns.push(client);
    client.subscribe(this.topic, { qos: 0 }, function () {});
    client.on('message', function (t, payload) { self.handle(payload, client); });
    client.on('connect', function () { client.subscribe(self.topic, { qos: 0 }, function () {}); self.report(); });
    client.on('close', function () { self.report(); });
    this.report();
  };
  Relay.prototype.live = function () {
    var out = [];
    for (var i = 0; i < this.conns.length; i++) if (this.conns[i].connected) out.push(this.conns[i].__name);
    return out;
  };
  Relay.prototype.report = function () {
    var live = this.live();
    this.onStatus(live.length ? 'online' : 'off',
      live.length ? 'connected via ' + live.join(' + ') : 'reconnecting…');
  };
  Relay.prototype.handle = function (payload, client) {
    var msg;
    try { msg = JSON.parse(payload.toString()); } catch (e) { return; }
    if (!msg.__s || msg.__s === this.selfId) return;      // never hear ourselves
    var last = this.lastSeq[msg.__s] || 0;
    if (msg.__q <= last) return;                          // already had it elsewhere
    this.lastSeq[msg.__s] = msg.__q;
    this.senderConn[msg.__s] = client;
    if (this.onMsg) this.onMsg(msg);
  };
  Relay.prototype.targets = function () {
    var list = [];
    for (var k in this.senderConn) {
      var c = this.senderConn[k];
      if (c && c.connected && list.indexOf(c) < 0) list.push(c);
    }
    return list.length ? list : this.conns;
  };
  Relay.prototype.pub = function (obj) {
    if (!this.conns.length) return;
    obj.__s = this.selfId; obj.__q = ++this.outSeq;
    var text = JSON.stringify(obj), to = this.targets();
    for (var i = 0; i < to.length; i++) {
      if (!to[i].connected) continue;
      try { to[i].publish(this.topic, text, { qos: 0 }); } catch (e) {}
    }
  };
  Relay.prototype.stop = function () {
    this.connected = false;
    var conns = this.conns; this.conns = [];
    conns.forEach(function (c) {
      try { c.end(false); setTimeout(function () { try { c.end(true); } catch (e) {} }, 1000); }
      catch (e) { try { c.end(true); } catch (e2) {} }
    });
  };

  /* ------------------------------------------------------------------ state */
  var MP = window.MPJJ = {
    active: false, code: null, id: uid(), name: '',
    relay: null, fighters: {},        // id -> { id, name, char, e (Enemy), tx, tz, tyaw, ... }
    sendAcc: 0, kills: 0, deaths: 0, joined: false
  };

  function el(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------- UI */
  function injectUI() {
    var css = document.createElement('style');
    css.textContent = [
      '#jjLobby{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;',
      'background:rgba(4,6,12,.93);color:#eaf0ff;font-family:"Segoe UI",Arial,sans-serif}',
      '#jjLobby .box{width:min(520px,92vw);background:#111726;border:1px solid #2b3category;',
      'border:1px solid #2b3350;border-radius:14px;padding:24px}',
      '#jjLobby h2{margin:0 0 4px;font-size:24px;letter-spacing:2px;color:#7fd4ff}',
      '#jjLobby .sub{color:#93a0be;font-size:13px;line-height:1.55;margin-bottom:16px}',
      '#jjLobby label{display:block;font-size:11px;letter-spacing:1px;color:#7e8bab;margin:12px 0 5px}',
      '#jjLobby input{width:100%;background:#0b1018;border:1px solid #2c3453;color:#eaf0ff;border-radius:8px;',
      'padding:10px 12px;font:inherit;font-size:15px;text-transform:uppercase}',
      '#jjLobby input:focus{outline:none;border-color:#7fd4ff}',
      '#jjLobby .row{display:flex;gap:8px;margin-top:14px}',
      '#jjLobby button{flex:1;background:#2f6df6;border:0;color:#fff;border-radius:8px;padding:12px;',
      'font:inherit;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.5px}',
      '#jjLobby button.ghost{background:#222c46;color:#cfd8ee}',
      '#jjLobby .code{font-size:30px;letter-spacing:8px;text-align:center;color:#ffd76a;margin:10px 0}',
      '#jjLobby .list{background:#0b1018;border:1px solid #26314c;border-radius:8px;padding:10px;',
      'margin-top:12px;font-size:13px;min-height:58px}',
      '#jjStatus{font-size:12px;color:#8b97b5;margin-top:12px;min-height:16px}',
      '#jjStatus.err{color:#ff8f84}',
      '#jjScore{position:fixed;right:14px;top:96px;z-index:20;display:none;min-width:186px;',
      'background:rgba(8,12,22,.72);border:1px solid rgba(255,255,255,.12);border-radius:10px;',
      'padding:8px 10px;font:12px/1.6 "Segoe UI",Arial,sans-serif;color:#eaf0ff}',
      '#jjScore .hd{font-size:10px;letter-spacing:1px;color:#7e8bab;margin-bottom:4px}',
      '#jjScore .r{display:flex;gap:8px}',
      '#jjScore .r .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#jjScore .r.me .n{color:#7fd4ff;font-weight:700}',
      '#jjFeed{position:fixed;left:14px;bottom:110px;z-index:20;display:flex;flex-direction:column-reverse;',
      'gap:4px;font:12px "Segoe UI",Arial,sans-serif;color:#eaf0ff;max-width:320px}',
      '#jjFeed div{background:rgba(8,12,22,.75);border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:4px 9px}',
      '#jjOnline{position:absolute;left:50%;transform:translateX(-50%);bottom:76px;',
      'background:#2f6df6;border:0;color:#fff;border-radius:10px;padding:12px 26px;cursor:pointer;',
      'font:700 15px "Segoe UI",Arial,sans-serif;letter-spacing:1px}',
      '#jjLook{position:fixed;inset:0;z-index:55;display:none;align-items:center;justify-content:center;',
      'background:rgba(3,6,14,.55);cursor:pointer;font-family:"Segoe UI",Arial,sans-serif}',
      '#jjLook .c{background:#111726;border:1px solid #2b3350;border-radius:12px;padding:22px 34px;text-align:center}',
      '#jjLook b{display:block;font-size:24px;letter-spacing:2px;color:#7fd4ff}',
      '#jjLook span{display:block;margin-top:8px;font-size:13px;color:#93a0be}',
      'body.jjLocked,body.jjLocked *{cursor:none!important}'
    ].join('');
    document.head.appendChild(css);

    var wrap = document.createElement('div');
    wrap.innerHTML = [
      '<div id="jjLobby"><div class="box">',
      '  <h2>ONLINE MATCH</h2>',
      '  <div class="sub">Fight your friends in the same arena. Everyone picks Gojo or Naoya and',
      '    can switch with C. The training dummies step out while you brawl.</div>',
      '  <label>YOUR NAME</label><input id="jjName" maxlength="10" placeholder="PLAYER">',
      '  <div id="jjJoinBox">',
      '    <label>ROOM CODE (leave empty to create one)</label>',
      '    <input id="jjCode" maxlength="6" placeholder="E.G. K4RM2P">',
      '    <div class="row"><button id="jjCreate">CREATE A ROOM</button>',
      '    <button id="jjJoin" class="ghost">JOIN A ROOM</button></div>',
      '  </div>',
      '  <div id="jjRoomBox" style="display:none">',
      '    <label>ROOM CODE — TELL YOUR FRIENDS</label>',
      '    <div class="code" id="jjCodeOut">------</div>',
      '    <div class="list" id="jjList"></div>',
      '    <div class="row"><button id="jjFight">ENTER THE ARENA</button>',
      '    <button id="jjLeave" class="ghost">LEAVE</button></div>',
      '  </div>',
      '  <div id="jjStatus"></div>',
      '  <div class="row"><button id="jjBack" class="ghost">BACK</button></div>',
      '</div></div>',
      '<div id="jjScore"></div>',
      '<div id="jjFeed"></div>',
      '<div id="jjLook"><div class="c"><b>CLICK TO LOOK AROUND</b>',
      '<span>mouse looks · Esc frees the cursor</span></div></div>'
    ].join('');
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    var btn = document.createElement('button');
    btn.id = 'jjOnline';
    btn.textContent = 'PLAY ONLINE WITH FRIENDS';
    var m = el('menu');
    if (m) m.appendChild(btn);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();                       // the menu itself starts the offline game
      openLobby();
    });

    el('jjBack').addEventListener('click', closeLobby);
    el('jjCreate').addEventListener('click', function () { createRoom(); });
    el('jjJoin').addEventListener('click', function () { joinRoom(); });
    el('jjLeave').addEventListener('click', function () { leaveRoom(); openLobby(); });
    el('jjFight').addEventListener('click', function () { enterArena(); });
    el('jjCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') joinRoom(); });

    /* The game drops back to its title screen whenever pointer lock is lost.
       During a match that reads as "you left the room", so it is kept shut and
       a small card hands the mouse back instead. */
    el('jjLook').addEventListener('mousedown', function (e) {
      e.preventDefault();
      e.stopPropagation();                       // do not throw a punch while re-locking
      grabMouse();
    });
    document.addEventListener('pointerlockchange', lookWatch);
    setInterval(lookWatch, 200);
  }

  function grabMouse() {
    var cv = renderer.domElement;
    if (!cv || !cv.requestPointerLock) return;
    var pr = null;
    try { pr = cv.requestPointerLock({ unadjustedMovement: true }); } catch (e) { pr = null; }
    if (pr && pr.catch) pr.catch(function () { try { cv.requestPointerLock(); } catch (e2) {} });
  }

  function lookWatch() {
    if (!MP.active) { document.body.classList.remove('jjLocked'); return; }
    var m = el('menu');
    if (m && m.style.display !== 'none') m.style.display = 'none';
    var isLocked = document.pointerLockElement === renderer.domElement;
    document.body.classList.toggle('jjLocked', isLocked);
    el('jjLook').style.display = isLocked ? 'none' : 'flex';
  }

  function status(text, bad) {
    var s = el('jjStatus');
    s.textContent = text || '';
    s.className = bad ? 'err' : '';
  }
  function openLobby() {
    el('jjLobby').style.display = 'flex';
    el('jjJoinBox').style.display = '';
    el('jjRoomBox').style.display = 'none';
    status('');
    try { el('jjName').value = localStorage.getItem('jj_name') || ''; } catch (e) {}
  }
  function closeLobby() { el('jjLobby').style.display = 'none'; }

  function myName() {
    var v = (el('jjName').value || '').trim().toUpperCase().slice(0, 10);
    if (!v) v = 'PLAYER' + Math.floor(Math.random() * 90 + 10);
    try { localStorage.setItem('jj_name', v); } catch (e) {}
    return v;
  }

  function createRoom() {
    MP.name = myName();
    var code = (el('jjCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || roomCode();
    connect(code);
  }
  function joinRoom() {
    var code = (el('jjCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { status('Type the room code your friend sent you.', true); return; }
    MP.name = myName();
    connect(code);
  }

  function connect(code) {
    status('Connecting…');
    el('jjCreate').disabled = el('jjJoin').disabled = true;
    MP.code = code;
    MP.relay = new Relay();
    MP.relay.start({
      code: code,
      onStatus: function (s, t) { if (!MP.active) status(t, s !== 'online'); },
      onMsg: onMessage
    }).then(function () {
      el('jjCreate').disabled = el('jjJoin').disabled = false;
      el('jjJoinBox').style.display = 'none';
      el('jjRoomBox').style.display = '';
      el('jjCodeOut').textContent = code;
      MP.joined = true;
      renderList();
      status('Room ' + code + ' is open. Anyone with the code can walk in.');
      MP.relay.pub({ t: 'hi', id: MP.id, n: MP.name, c: player.char });
    }).catch(function (e) {
      el('jjCreate').disabled = el('jjJoin').disabled = false;
      status('Could not reach a relay (' + (e && e.message ? e.message : 'blocked') + ').', true);
    });
  }

  function leaveRoom() {
    if (MP.relay) {
      if (MP.relay.connected) MP.relay.pub({ t: 'bye', id: MP.id });
      MP.relay.stop();
    }
    for (var id in MP.fighters) dropFighter(id);
    MP.relay = null; MP.active = false; MP.joined = false; MP.fighters = {};
    el('jjScore').style.display = 'none';
    el('jjFeed').innerHTML = '';
    el('jjLook').style.display = 'none';
    document.body.classList.remove('jjLocked');
  }

  function renderList() {
    var html = '<div><b style="color:#7fd4ff">' + MP.name + '</b> — you</div>';
    for (var id in MP.fighters) html += '<div><b>' + MP.fighters[id].name + '</b></div>';
    var n = Object.keys(MP.fighters).length;
    html += '<div style="color:#8b97b5;margin-top:6px">' +
      (n ? (n + 1) + ' fighters in the room.' : 'Waiting for someone to join…') + '</div>';
    el('jjList').innerHTML = html;
  }

  /* ------------------------------------------------------------ the arena */
  function enterArena() {
    MP.active = true;
    closeLobby();
    /* the training dummies leave: this is a duel now */
    for (var i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].net) continue;
      scene.remove(enemies[i].rig.root);
      enemies.splice(i, 1);
    }
    player.hp = player.maxHp; player.dead = false; player.proj = 0;
    player.pos.set((Math.random() - .5) * 30, 0, (Math.random() - .5) * 30);
    el('jjScore').style.display = 'block';
    updateScore();
    feed('You entered room ' + MP.code);
    if (typeof showSplash === 'function') showSplash('FIGHT', MP.code, '#7fd4ff');
    if (window.__game && !window.__game.started) window.__game.start();
    var cv = renderer.domElement;
    if (cv && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (e) {} }
    MP.relay.pub({ t: 'hi', id: MP.id, n: MP.name, c: player.char });
  }

  /* A remote fighter is a real Enemy, so every punch, Red, palm and frame the
     game already knows how to do lands on them without special cases. */
  function makeFighter(id, name, char) {
    var e = new Enemy(0, 0, 'dummy');
    e.net = { id: id };
    e.name = name;
    e.kind = 'remote';
    scene.remove(e.rig.root);
    e.rig = makeAnimeRig(char === 'naoya' ? NAOYA_CFG : GOJO_CFG);
    e.rig.root.add(e.hpSpr);
    scene.add(e.rig.root);
    e.maxHp = 100; e.hp = 100;
    e.drawBars();
    var f = { id: id, name: name, char: char, e: e, tx: 0, tz: 0, tyaw: 0, seen: nowS() };
    MP.fighters[id] = f;
    return f;
  }

  function dropFighter(id) {
    var f = MP.fighters[id];
    if (!f) return;
    var i = enemies.indexOf(f.e);
    if (i >= 0) enemies.splice(i, 1);
    scene.remove(f.e.rig.root);
    delete MP.fighters[id];
  }

  function fighterFor(id, name, char) {
    var f = MP.fighters[id];
    if (f && char && f.char !== char) { dropFighter(id); f = null; }   // they switched fighter
    if (!f) {
      f = makeFighter(id, name || '???', char || 'gojo');
      enemies.push(f.e);
      renderList();
      updateScore();
    }
    if (name) f.name = name;
    return f;
  }

  /* ------------------------------------------------------------- messages */
  function onMessage(m) {
    if (!m || !m.id || m.id === MP.id) return;
    if (m.t === 'hi') {
      var f = fighterFor(m.id, m.n, m.c);
      f.seen = nowS();
      feed('<b>' + esc(m.n || '???') + '</b> joined');
      if (MP.relay) MP.relay.pub({ t: 'hi2', id: MP.id, n: MP.name, c: player.char });
      return;
    }
    if (m.t === 'hi2') { fighterFor(m.id, m.n, m.c).seen = nowS(); return; }
    if (m.t === 'bye') {
      if (MP.fighters[m.id]) feed('<b>' + esc(MP.fighters[m.id].name) + '</b> left');
      dropFighter(m.id); renderList(); updateScore();
      return;
    }
    if (m.t === 's') {                                  // state
      var g = fighterFor(m.id, m.n, m.c);
      g.seen = nowS();
      g.tx = m.x; g.tz = m.z; g.tyaw = m.y / 100;
      g.ty = m.h / 10;
      if (g.e.pos.x === 0 && g.e.pos.z === 0) { g.e.pos.set(m.x, g.ty, m.z); }
      g.e.hp = m.hp; g.e.maxHp = m.mx || 100;
      g.e.dead = !!m.d;
      g.e.rig.root.visible = !m.d;
      g.remoteFramed = !!m.f;
      g.moving = !!m.mv;
      g.e.drawBars();
      return;
    }
    if (m.t === 'hit' && m.to === MP.id) {              // somebody landed one on us
      var k = null;
      if (m.kx || m.ky || m.kz) k = new THREE.Vector3(m.kx || 0, m.ky || 0, m.kz || 0);
      hurtPlayer(m.d, k);
      MP.lastHitBy = m.id;
      if (player.dead) {
        MP.deaths++;
        if (MP.relay) MP.relay.pub({ t: 'died', id: MP.id, by: m.id });
        updateScore();
      }
      return;
    }
    if (m.t === 'proj' && m.to === MP.id) { applyProjPlayer(m.a); return; }
    if (m.t === 'died') {
      var who = MP.fighters[m.id];
      var killer = m.by === MP.id ? { name: MP.name } : MP.fighters[m.by];
      if (m.by === MP.id) { MP.kills++; }
      feed('<b>' + esc(killer ? killer.name : '???') + '</b> defeated <b>' +
        esc(who ? who.name : '???') + '</b>');
      if (who) { who.kills = who.kills || 0; }
      if (MP.fighters[m.by]) MP.fighters[m.by].kills = (MP.fighters[m.by].kills || 0) + 1;
      if (who) who.deaths = (who.deaths || 0) + 1;
      updateScore();
      return;
    }
  }

  function feed(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    el('jjFeed').appendChild(d);
    while (el('jjFeed').children.length > 5) el('jjFeed').removeChild(el('jjFeed').firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 7000);
  }

  function updateScore() {
    var rows = [{ n: MP.name, k: MP.kills, d: MP.deaths, me: true }];
    for (var id in MP.fighters) {
      var f = MP.fighters[id];
      rows.push({ n: f.name, k: f.kills || 0, d: f.deaths || 0 });
    }
    rows.sort(function (a, b) { return b.k - a.k; });
    var html = '<div class="hd">ROOM ' + (MP.code || '') + '</div>';
    rows.forEach(function (r) {
      html += '<div class="r' + (r.me ? ' me' : '') + '"><span class="n">' + esc(r.n) +
        '</span><span>' + r.k + '</span><span style="color:#8b97b5">' + r.d + '</span></div>';
    });
    el('jjScore').innerHTML = html;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* --------------------------------------------------------------- hooks */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    _updatePlayer(dt);
    if (!MP.active) return;
    stepFighters(dt);
    sendState(dt);
  };

  /* remote fighters are driven by the network, never by the dummy AI */
  var _enemyUpdate = Enemy.prototype.update;
  Enemy.prototype.update = function (dt) {
    if (!this.net) return _enemyUpdate.call(this, dt);
    /* keep the parts of the enemy tick that are purely cosmetic */
    if (this.frameT > 0) this.frameT -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    this.animT += dt;
    if (this.rig && this.rig.root) {
      this.rig.root.position.copy(this.pos);
      this.rig.root.rotation.y = this.facing;
    }
  };

  /* our attacks tell the other player they were hit; they own their health */
  var _enemyDamage = Enemy.prototype.damage;
  Enemy.prototype.damage = function (amount, knock, opts) {
    if (!this.net) return _enemyDamage.call(this, amount, knock, opts);
    if (this.dead) return;
    var msg = { t: 'hit', id: MP.id, to: this.net.id, d: amount };
    if (knock) { msg.kx = round2(knock.x); msg.ky = round2(knock.y); msg.kz = round2(knock.z); }
    if (MP.relay) MP.relay.pub(msg);
    /* local feedback right away, their broadcast corrects the bar */
    this.hp = Math.max(0, this.hp - amount);
    this.drawBars();
    if (typeof spark === 'function') {
      spark(this.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0xff4455, 5, 10);
    }
    if (typeof damageNumber === 'function') {
      damageNumber(this.pos.clone().add(new THREE.Vector3(0, 5.2, 0)), String(Math.round(amount)), '#ffd76a');
    }
  };

  var _enemyProj = Enemy.prototype.applyProj;
  Enemy.prototype.applyProj = function (amount, byPlayer) {
    if (!this.net) return _enemyProj.call(this, amount, byPlayer);
    if (MP.relay) MP.relay.pub({ t: 'proj', id: MP.id, to: this.net.id, a: amount });
  };

  /* ------------------------------------------------------------ per frame */
  function stepFighters(dt) {
    var k = Math.min(1, dt * 12);
    for (var id in MP.fighters) {
      var f = MP.fighters[id];
      if (nowS() - f.seen > 12) { dropFighter(id); renderList(); updateScore(); continue; }
      var e = f.e;
      e.pos.x += (f.tx - e.pos.x) * k;
      e.pos.z += (f.tz - e.pos.z) * k;
      if (f.ty != null) e.pos.y += (f.ty - e.pos.y) * k;
      var d = ((f.tyaw - e.facing + Math.PI) % (Math.PI * 2)) - Math.PI;
      e.facing += d * k;
      /* a little walk bob so they do not slide about like a statue */
      if (e.rig && e.rig.root) {
        e.rig.root.position.copy(e.pos);
        e.rig.root.rotation.y = e.facing;
      }
    }
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  function sendState(dt) {
    MP.sendAcc += dt;
    if (MP.sendAcc < 1 / SEND_HZ || !MP.relay || !MP.relay.connected) return;
    MP.sendAcc = 0;
    MP.relay.pub({
      t: 's', id: MP.id, n: MP.name, c: player.char,
      x: round2(player.pos.x), z: round2(player.pos.z), h: Math.round(player.pos.y * 10),
      y: Math.round(player.facing * 100),
      hp: Math.round(player.hp), mx: Math.round(player.maxHp),
      d: player.dead ? 1 : 0, f: player.frameT > 0 ? 1 : 0,
      mv: (player.vel.x * player.vel.x + player.vel.z * player.vel.z) > 1 ? 1 : 0
    });
  }

  window.addEventListener('beforeunload', function () {
    if (MP.relay && MP.relay.connected) MP.relay.pub({ t: 'bye', id: MP.id });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectUI);
  else injectUI();

})();
