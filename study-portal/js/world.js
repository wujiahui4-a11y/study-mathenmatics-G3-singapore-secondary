/* Study Portal — arena map: generation, collision, line of sight.
   The map is generated from the room code, so every player builds the
   identical arena without anyone having to download it. */
(function (SA) {
  'use strict';

  var CFG = SA.CFG;

  function World(seed) {
    this.seed = seed >>> 0;
    this.cols = CFG.COLS;
    this.rows = CFG.ROWS;
    this.tile = CFG.TILE;
    this.w = this.cols * this.tile;
    this.h = this.rows * this.tile;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.deco = new Uint8Array(this.cols * this.rows);
    this.spawns = [];
    this.generate();
  }

  World.prototype.idx = function (cx, cy) { return cy * this.cols + cx; };
  World.prototype.at = function (cx, cy) {
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 1;
    return this.grid[cy * this.cols + cx];
  };
  World.prototype.solidAt = function (x, y) {
    return this.at(Math.floor(x / this.tile), Math.floor(y / this.tile)) === 1;
  };

  World.prototype.fill = function (x, y, w, h, v) {
    for (var cy = y; cy < y + h; cy++) {
      for (var cx = x; cx < x + w; cx++) {
        if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) continue;
        this.grid[cy * this.cols + cx] = v;
      }
    }
  };

  World.prototype.generate = function () {
    var rnd = SA.rng(this.seed);
    var C = this.cols, R = this.rows, i;

    /* outer wall */
    for (var cy = 0; cy < R; cy++) {
      for (var cx = 0; cx < C; cx++) {
        this.grid[cy * C + cx] = (cx === 0 || cy === 0 || cx === C - 1 || cy === R - 1) ? 1 : 0;
      }
    }

    /* blocks are mirrored across the centre so no corner of the map is unfair */
    var blocks = 20 + Math.floor(rnd() * 8);
    for (i = 0; i < blocks; i++) {
      var bw = 2 + Math.floor(rnd() * 5);
      var bh = 2 + Math.floor(rnd() * 4);
      var bx = 2 + Math.floor(rnd() * (C / 2 - bw - 3));
      var by = 2 + Math.floor(rnd() * (R - bh - 4));
      this.fill(bx, by, bw, bh, 1);
      this.fill(C - bx - bw, R - by - bh, bw, bh, 1);
    }

    /* crate clusters and single pillars break up the open ground */
    var clusters = 10 + Math.floor(rnd() * 6);
    for (i = 0; i < clusters; i++) {
      var kx = 3 + Math.floor(rnd() * (C - 7));
      var ky = 3 + Math.floor(rnd() * (R - 7));
      var shape = Math.floor(rnd() * 3);
      if (shape === 0) { this.fill(kx, ky, 2, 2, 1); }
      else if (shape === 1) { this.fill(kx, ky, 3, 1, 1); this.fill(kx + 1, ky + 1, 1, 2, 1); }
      else { this.fill(kx, ky, 1, 3, 1); this.fill(kx + 1, ky, 2, 1, 1); }
      this.fill(C - 1 - kx, R - 1 - ky, 1, 1, 1);
    }
    var pillars = 26 + Math.floor(rnd() * 16);
    for (i = 0; i < pillars; i++) {
      var px = 2 + Math.floor(rnd() * (C - 4));
      var py = 2 + Math.floor(rnd() * (R - 4));
      this.fill(px, py, 1, 1, 1);
      this.fill(C - 1 - px, R - 1 - py, 1, 1, 1);
    }

    /* one clear cross keeps the arena readable and always connected */
    var midY = Math.floor(R / 2), midX = Math.floor(C / 2);
    this.fill(1, midY - 1, C - 2, 3, 0);
    this.fill(midX - 1, 1, 3, R - 2, 0);
    var ly = 4 + Math.floor(rnd() * 6);
    this.fill(1, ly, C - 2, 2, 0);
    this.fill(1, R - ly - 2, C - 2, 2, 0);

    /* a walled central room with four doorways — a natural fight pit */
    var rw = 9, rh = 7;
    var rx = Math.floor((C - rw) / 2), ry = Math.floor((R - rh) / 2);
    this.fill(rx, ry, rw, rh, 1);
    this.fill(rx + 1, ry + 1, rw - 2, rh - 2, 0);
    this.fill(rx + Math.floor(rw / 2), ry, 1, 1, 0);
    this.fill(rx + Math.floor(rw / 2), ry + rh - 1, 1, 1, 0);
    this.fill(rx, ry + Math.floor(rh / 2), 1, 1, 0);
    this.fill(rx + rw - 1, ry + Math.floor(rh / 2), 1, 1, 0);

    this.pruneUnreachable();
    this.buildSpawns(rnd);
    this.buildDeco(rnd);
  };

  /* keep only the biggest connected floor area */
  World.prototype.pruneUnreachable = function () {
    var C = this.cols, R = this.rows;
    var seen = new Uint8Array(C * R);
    var start = -1;
    for (var i = 0; i < this.grid.length; i++) { if (!this.grid[i]) { start = i; break; } }
    if (start < 0) return;
    var stack = [start];
    seen[start] = 1;
    while (stack.length) {
      var cur = stack.pop();
      var cx = cur % C, cy = (cur - cx) / C;
      var n = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (var k = 0; k < 4; k++) {
        var nx = n[k][0], ny = n[k][1];
        if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
        var ni = ny * C + nx;
        if (seen[ni] || this.grid[ni]) continue;
        seen[ni] = 1; stack.push(ni);
      }
    }
    for (var j = 0; j < this.grid.length; j++) if (!this.grid[j] && !seen[j]) this.grid[j] = 1;
  };

  World.prototype.buildSpawns = function (rnd) {
    var t = this.tile, list = [];
    for (var cy = 2; cy < this.rows - 2; cy++) {
      for (var cx = 2; cx < this.cols - 2; cx++) {
        if (this.at(cx, cy)) continue;
        /* prefer open pockets: all 8 neighbours free */
        var open = true;
        for (var dy = -1; dy <= 1 && open; dy++) {
          for (var dx = -1; dx <= 1; dx++) if (this.at(cx + dx, cy + dy)) { open = false; break; }
        }
        if (open) list.push({ x: cx * t + t / 2, y: cy * t + t / 2 });
      }
    }
    /* shuffle deterministically */
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    this.spawns = list.length ? list : [{ x: this.w / 2, y: this.h / 2 }];
  };

  World.prototype.buildDeco = function (rnd) {
    for (var i = 0; i < this.grid.length; i++) {
      this.deco[i] = this.grid[i] ? 0 : (rnd() < 0.055 ? 1 + Math.floor(rnd() * 3) : 0);
    }
  };

  World.prototype.randomSpawn = function (avoid, minDist) {
    var best = null, bestScore = -1;
    for (var tries = 0; tries < 14; tries++) {
      var s = this.spawns[Math.floor(Math.random() * this.spawns.length)];
      var score = 1e9;
      if (avoid) {
        for (var i = 0; i < avoid.length; i++) {
          var a = avoid[i];
          if (!a || !a.alive) continue;
          score = Math.min(score, SA.dist(s.x, s.y, a.x, a.y));
        }
      }
      if (score > bestScore) { bestScore = score; best = s; }
      if (score > (minDist || 520)) break;
    }
    return { x: best.x, y: best.y };
  };

  /* push a circle out of any wall it overlaps */
  World.prototype.collideCircle = function (x, y, r) {
    var t = this.tile;
    var c0 = Math.floor((x - r) / t), c1 = Math.floor((x + r) / t);
    var r0 = Math.floor((y - r) / t), r1 = Math.floor((y + r) / t);
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        if (!this.at(cx, cy)) continue;
        var wx = cx * t, wy = cy * t;
        var nx = SA.clamp(x, wx, wx + t);
        var ny = SA.clamp(y, wy, wy + t);
        var dx = x - nx, dy = y - ny;
        var d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 0.0001) {
          var d = Math.sqrt(d2);
          x += (dx / d) * (r - d);
          y += (dy / d) * (r - d);
        } else {
          /* centre inside the tile — push out along the shallowest axis */
          var left = x - wx, right = wx + t - x, top = y - wy, bottom = wy + t - y;
          var m = Math.min(left, right, top, bottom);
          if (m === left) x = wx - r; else if (m === right) x = wx + t + r;
          else if (m === top) y = wy - r; else y = wy + t + r;
        }
      }
    }
    x = SA.clamp(x, r, this.w - r);
    y = SA.clamp(y, r, this.h - r);
    return { x: x, y: y };
  };

  /* straight line test used by bots (and the focus beam) */
  World.prototype.losClear = function (x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var len = Math.hypot(dx, dy);
    if (len < 1) return true;
    var steps = Math.ceil(len / (this.tile * 0.4));
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (this.solidAt(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  };

  SA.World = World;

})(window.SA);
