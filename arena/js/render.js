/* Skill Arena — canvas renderer and particle effects. */
(function (SA) {
  'use strict';

  var CFG = SA.CFG;

  /* ------------------------------------------------------------------- FX */
  function FX() { this.parts = []; this.beams = []; this.texts = []; this.shake = 0; }

  FX.prototype.spark = function (x, y, color, n, speed) {
    n = n || 5;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = (speed || 120) * (0.3 + Math.random());
      this.parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.3, max: 0.55, r: 1.5 + Math.random() * 2, c: color });
    }
  };

  FX.prototype.boom = function (x, y, radius, color) {
    var n = Math.min(46, 12 + radius / 4);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = radius * (1.4 + Math.random() * 1.8);
      this.parts.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.32 + Math.random() * 0.4, max: 0.72, r: 2 + Math.random() * 4,
        c: color || (Math.random() < 0.5 ? '#ffb020' : '#ff6a3d'), glow: true
      });
    }
    this.parts.push({ ring: true, x: x, y: y, r: 6, tr: radius, life: 0.32, max: 0.32, c: color || '#ffc46b' });
    this.shake = Math.min(16, this.shake + radius / 12);
  };

  FX.prototype.beam = function (x0, y0, x1, y1, color) {
    this.beams.push({ x0: x0, y0: y0, x1: x1, y1: y1, c: color, life: 0.24, max: 0.24 });
    this.shake = Math.min(12, this.shake + 3);
  };

  FX.prototype.text = function (x, y, str, color, big) {
    this.texts.push({ x: x, y: y, s: str, c: color, life: 0.85, max: 0.85, big: !!big, vy: -34 });
  };

  FX.prototype.ring = function (x, y, radius, color) {
    this.parts.push({ ring: true, x: x, y: y, r: 8, tr: radius, life: 0.5, max: 0.5, c: color });
  };

  FX.prototype.step = function (dt) {
    var i, p;
    for (i = this.parts.length - 1; i >= 0; i--) {
      p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      if (p.ring) { p.r += (p.tr - p.r) * Math.min(1, dt * 10); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - Math.min(1, dt * 3.4));
      p.vy *= (1 - Math.min(1, dt * 3.4));
    }
    for (i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (i = this.texts.length - 1; i >= 0; i--) {
      var t = this.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= (1 - Math.min(1, dt * 2));
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    this.shake *= (1 - Math.min(1, dt * 6));
    if (this.shake < 0.2) this.shake = 0;
  };

  /* -------------------------------------------------------------- Renderer */
  function Renderer(canvas, minimap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mini = minimap;
    this.mctx = minimap ? minimap.getContext('2d') : null;
    this.fx = new FX();
    this.cam = { x: 0, y: 0 };
    this.dpr = 1;
    this.w = 0; this.h = 0;
    this.miniBase = null;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = this.canvas.clientWidth || window.innerWidth;
    var h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr; this.w = w; this.h = h;
    /* keep roughly the same slice of the arena on screen at any window size */
    this.zoom = SA.clamp(Math.min(w / 1000, h / 620), 0.85, 1.9);
    this.vw = w / this.zoom;
    this.vh = h / this.zoom;
  };

  Renderer.prototype.centerOn = function (x, y, snap) {
    var tx = SA.clamp(x - this.vw / 2, 0, Math.max(0, this.world.w - this.vw));
    var ty = SA.clamp(y - this.vh / 2, 0, Math.max(0, this.world.h - this.vh));
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
    else {
      this.cam.x += (tx - this.cam.x) * 0.16;
      this.cam.y += (ty - this.cam.y) * 0.16;
    }
  };

  Renderer.prototype.draw = function (view, dt) {
    var ctx = this.ctx, world = view.world;
    this.world = world;
    this.fx.step(dt);

    if (this.canvas.width !== Math.round((this.canvas.clientWidth || window.innerWidth) * this.dpr)) this.resize();

    var me = view.players[view.meId];
    if (me) this.centerOn(me.rx, me.ry, view.snapCam);
    view.snapCam = false;

    var shakeX = 0, shakeY = 0;
    if (this.fx.shake > 0.2) {
      shakeX = (Math.random() - 0.5) * this.fx.shake;
      shakeY = (Math.random() - 0.5) * this.fx.shake;
    }
    var camX = Math.round(this.cam.x + shakeX), camY = Math.round(this.cam.y + shakeY);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-camX, -camY);

    this.drawFloor(ctx, camX, camY);
    this.drawPickups(ctx, view);
    this.drawMines(ctx, view);
    this.drawWalls(ctx, camX, camY);
    this.drawTurrets(ctx, view);
    this.drawBullets(ctx, view);
    this.drawPlayers(ctx, view);
    this.drawFx(ctx);

    ctx.restore();
    this.drawVignette(ctx, me);
    this.drawMinimap(view);
  };

  Renderer.prototype.drawFloor = function (ctx, camX, camY) {
    var w = this.world, T = w.tile;
    var c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(w.cols - 1, Math.ceil((camX + this.vw) / T));
    var r0 = Math.max(0, Math.floor(camY / T)), r1 = Math.min(w.rows - 1, Math.ceil((camY + this.vh) / T));

    ctx.fillStyle = '#141a27';
    ctx.fillRect(camX, camY, this.vw, this.vh);

    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        if (w.at(cx, cy)) continue;
        var x = cx * T, y = cy * T;
        ctx.fillStyle = ((cx + cy) & 1) ? '#18203040' : '#1b2434';
        ctx.fillRect(x, y, T, T);
        var d = w.deco[cy * w.cols + cx];
        if (d) {
          ctx.fillStyle = d === 1 ? 'rgba(80,120,190,.10)' : (d === 2 ? 'rgba(120,200,180,.08)' : 'rgba(150,140,220,.08)');
          ctx.beginPath();
          ctx.arc(x + T / 2, y + T / 2, T * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    /* grid */
    ctx.strokeStyle = 'rgba(255,255,255,.028)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = c0; gx <= c1 + 1; gx++) { ctx.moveTo(gx * T, r0 * T); ctx.lineTo(gx * T, (r1 + 1) * T); }
    for (var gy = r0; gy <= r1 + 1; gy++) { ctx.moveTo(c0 * T, gy * T); ctx.lineTo((c1 + 1) * T, gy * T); }
    ctx.stroke();
  };

  Renderer.prototype.drawWalls = function (ctx, camX, camY) {
    var w = this.world, T = w.tile;
    var c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(w.cols - 1, Math.ceil((camX + this.vw) / T));
    var r0 = Math.max(0, Math.floor(camY / T) - 1), r1 = Math.min(w.rows - 1, Math.ceil((camY + this.vh) / T) + 1);

    /* drop shadow pass */
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        if (!w.at(cx, cy) || w.at(cx, cy + 1)) continue;
        ctx.fillRect(cx * T + 3, cy * T + 8, T, T);
      }
    }
    for (cy = r0; cy <= r1; cy++) {
      for (cx = c0; cx <= c1; cx++) {
        if (!w.at(cx, cy)) continue;
        var x = cx * T, y = cy * T;
        ctx.fillStyle = '#2c3654';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = 'rgba(0,0,0,.10)';
        ctx.fillRect(x + 6, y + 6, T - 12, T - 12);
        if (!w.at(cx, cy - 1)) { ctx.fillStyle = '#42527d'; ctx.fillRect(x, y, T, 6); }
        if (!w.at(cx - 1, cy)) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x, y, 4, T); }
        if (!w.at(cx, cy + 1)) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x, y + T - 5, T, 5); }
      }
    }
  };

  Renderer.prototype.drawPickups = function (ctx, view) {
    var t = performance.now() / 1000;
    for (var i = 0; i < view.pickups.length; i++) {
      var p = view.pickups[i];
      var bob = Math.sin(t * 3 + i) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.shadowColor = p.type === 0 ? '#39d98a' : '#5cc8ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = p.type === 0 ? '#39d98a' : '#5cc8ff';
      ctx.beginPath();
      roundRect(ctx, -9, -9, 18, 18, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0e1520';
      if (p.type === 0) { ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-2, -6, 4, 12); }
      else { ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, -1); ctx.lineTo(2, 6); ctx.lineTo(-2, 6); ctx.lineTo(-5, -1); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  };

  Renderer.prototype.drawMines = function (ctx, view) {
    var t = performance.now() / 1000;
    for (var i = 0; i < view.mines.length; i++) {
      var m = view.mines[i];
      var pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.fillStyle = 'rgba(255,90,70,' + (0.18 + pulse * 0.25) + ')';
      ctx.beginPath(); ctx.arc(m.x, m.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#252c3f';
      ctx.beginPath(); ctx.arc(m.x, m.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,80,60,' + (0.4 + pulse * 0.6) + ')';
      ctx.beginPath(); ctx.arc(m.x, m.y, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  };

  Renderer.prototype.drawTurrets = function (ctx, view) {
    for (var i = 0; i < view.turrets.length; i++) {
      var t = view.turrets[i];
      var col = SA.COLORS[t.c % SA.COLORS.length];
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.arc(2, 4, 15, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(t.ang);
      ctx.fillStyle = '#2a3350';
      ctx.fillRect(-2, -4, 22, 8);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.drawBullets = function (ctx, view) {
    for (var i = 0; i < view.bullets.length; i++) {
      var b = view.bullets[i];
      var col = SA.COLORS[b.c % SA.COLORS.length];
      if (b.kind === 2) {
        ctx.fillStyle = '#39405c';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = (performance.now() % 250 < 125) ? '#ff5f5f' : '#7a2020';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillStyle = col;
      /* short motion streak */
      ctx.beginPath();
      var tx = b.x - Math.cos(b.ang) * b.r * 2.2, ty = b.y - Math.sin(b.ang) * b.r * 2.2;
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = b.r * 1.7;
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.42, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  Renderer.prototype.drawPlayers = function (ctx, view) {
    var ids = Object.keys(view.players);
    for (var i = 0; i < ids.length; i++) {
      var p = view.players[ids[i]];
      if (!p.alive) continue;
      var isMe = ids[i] === view.meId;
      var cloaked = !!(p.flags & 2);
      if (cloaked && !isMe) {
        ctx.globalAlpha = 0.16;
      } else if (cloaked) {
        ctx.globalAlpha = 0.45;
      }
      var col = SA.COLORS[p.c % SA.COLORS.length];
      var R = CFG.PLAYER_R;

      ctx.save();
      ctx.translate(p.rx, p.ry);

      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.beginPath(); ctx.ellipse(2, 6, R, R * 0.85, 0, 0, Math.PI * 2); ctx.fill();

      /* barrel */
      ctx.save();
      ctx.rotate(p.rang);
      ctx.fillStyle = '#20263a';
      roundRect(ctx, R - 5, -4.5, 20, 9, 3); ctx.fill();
      ctx.fillStyle = shade(col, -18);
      roundRect(ctx, R - 3, -3, 16, 6, 2.5); ctx.fill();
      ctx.restore();

      /* body */
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(0,0,0,.35)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath(); ctx.arc(-R * 0.28, -R * 0.3, R * 0.42, 0, Math.PI * 2); ctx.fill();

      if (p.flags & 16) { /* spawn protection */
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.shield > 0) {
        ctx.strokeStyle = 'rgba(110,200,255,.75)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.stroke();
      }
      if (p.flags & 64) { /* poisoned */
        ctx.fillStyle = 'rgba(120,220,90,.25)';
        ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.fill();
      }
      if (p.flags & 32) { /* slowed */
        ctx.strokeStyle = 'rgba(120,210,255,.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.arc(0, 0, R + 9, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      /* name + bars */
      var by = p.ry - R - 20;
      ctx.font = '600 12px "Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      var label = p.name + '  ' + 'Lv' + p.level;
      ctx.strokeText(label, p.rx, by);
      ctx.fillStyle = isMe ? '#ffffff' : '#dfe6f6';
      ctx.fillText(label, p.rx, by);

      var bw = 42, hpFrac = SA.clamp(p.hp / Math.max(1, p.maxHp), 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      roundRect(ctx, p.rx - bw / 2, by + 5, bw, 5, 2.5); ctx.fill();
      ctx.fillStyle = hpFrac > 0.5 ? '#39d98a' : (hpFrac > 0.22 ? '#ffb020' : '#ff5f5f');
      roundRect(ctx, p.rx - bw / 2, by + 5, bw * hpFrac, 5, 2.5); ctx.fill();
      if (p.shield > 0) {
        var sf = SA.clamp(p.shield / Math.max(1, p.shieldMax || p.shield), 0, 1);
        ctx.fillStyle = 'rgba(110,200,255,.9)';
        roundRect(ctx, p.rx - bw / 2, by + 11, bw * sf, 3, 1.5); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
  };

  Renderer.prototype.drawFx = function (ctx) {
    var i, p;
    for (i = 0; i < this.fx.beams.length; i++) {
      var b = this.fx.beams[i];
      var a = b.life / b.max;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = b.c; ctx.shadowBlur = 20;
      ctx.strokeStyle = b.c;
      ctx.lineWidth = 4 + 12 * (1 - a);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.restore();
    }
    for (i = 0; i < this.fx.parts.length; i++) {
      p = this.fx.parts[i];
      var al = SA.clamp(p.life / p.max, 0, 1);
      if (p.ring) {
        ctx.globalAlpha = al * 0.8;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 3 + 6 * (1 - al);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.globalAlpha = al;
        if (p.glow) { ctx.shadowColor = p.c; ctx.shadowBlur = 10; }
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * al + 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (i = 0; i < this.fx.texts.length; i++) {
      var t = this.fx.texts[i];
      ctx.globalAlpha = SA.clamp(t.life / t.max, 0, 1);
      ctx.font = (t.big ? '800 20px' : '700 14px') + ' "Segoe UI",system-ui,sans-serif';
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.s, t.x, t.y);
      ctx.fillStyle = t.c;
      ctx.fillText(t.s, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  };

  Renderer.prototype.drawVignette = function (ctx, me) {
    if (!me) return;
    var hurt = 1 - SA.clamp(me.hp / Math.max(1, me.maxHp), 0, 1);
    if (hurt < 0.35) return;
    var g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.32, this.w / 2, this.h / 2, this.h * 0.78);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, 'rgba(255,20,20,' + ((hurt - 0.35) * 0.55).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
  };

  Renderer.prototype.drawMinimap = function (view) {
    if (!this.mctx) return;
    var w = view.world, ctx = this.mctx;
    var W = this.mini.width, H = this.mini.height;
    if (!this.miniBase || this.miniBaseSeed !== w.seed) {
      var off = document.createElement('canvas');
      off.width = W; off.height = H;
      var octx = off.getContext('2d');
      octx.fillStyle = '#0f1522';
      octx.fillRect(0, 0, W, H);
      var sx = W / w.cols, sy = H / w.rows;
      octx.fillStyle = '#39456a';
      for (var cy = 0; cy < w.rows; cy++) {
        for (var cx = 0; cx < w.cols; cx++) {
          if (w.at(cx, cy)) octx.fillRect(Math.floor(cx * sx), Math.floor(cy * sy), Math.ceil(sx), Math.ceil(sy));
        }
      }
      this.miniBase = off;
      this.miniBaseSeed = w.seed;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.miniBase, 0, 0);
    var kx = W / w.w, ky = H / w.h;
    var ids = Object.keys(view.players);
    for (var i = 0; i < ids.length; i++) {
      var p = view.players[ids[i]];
      if (!p.alive) continue;
      var isMe = ids[i] === view.meId;
      if ((p.flags & 2) && !isMe) continue;
      ctx.fillStyle = isMe ? '#ffffff' : SA.COLORS[p.c % SA.COLORS.length];
      ctx.beginPath();
      ctx.arc(p.rx * kx, p.ry * ky, isMe ? 3.4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    /* viewport box */
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.cam.x * kx, this.cam.y * ky, this.vw * kx, this.vh * ky);
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = SA.clamp((n >> 16) + amt, 0, 255);
    var g = SA.clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = SA.clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  SA.Renderer = Renderer;
  SA.roundRect = roundRect;

})(window.SA);
