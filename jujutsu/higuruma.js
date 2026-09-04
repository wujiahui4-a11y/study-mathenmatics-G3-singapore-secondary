/* =======================================================================
   HIROMI HIGURUMA
   Deadly Sentencing 誅伏賜死. He was a defence lawyer and he still works
   like one: nothing he does is an attack until it has been ESTABLISHED.
   Every move of his either puts a charge on somebody or carries one out,
   and the black sword at the end of it is not a weapon so much as a
   sentence being executed.

     1  EXECUTIONER'S     死刑執行人の剣 — the black blade. It does not
        SWORD             glow, it does not spark; it opens a line
     2  GAVEL             木槌 — brought down where he points, and what
                          is under it is on the record
     3  EVIDENCE          証拠 — the papers go out, stick, and pull taut
     4  JUDGEMAN          裁判長 — the court rises, and the verdict comes
                          down as a column with a gavel behind it
     R  RECESS            休廷 — one rap, the dock comes up out of the
                          floor, and he is behind it

   Two rules for the look:

     · A CHARGE, AND THEN A SENTENCE. Anything he lands leaves a small
       brass seal turning over the body it landed on. While that seal is
       up, everything of his hits harder — so his damage is not in any
       one move, it is in the order he does them in.
     · HIS COLOURS ARE A COURTROOM AND NOT A FIGHT. Oak, brass, paper,
       and a cold blue-white for the verdict. The sword is the only
       black thing on the roster that is drawn with a WHITE edge and no
       glow at all: everything else in the game says "this is cursed
       energy", and the point of that blade is that it is not.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  var INK = 0x14141a, EDGE = 0xf2f4f8;
  var BRASS = 0xd8a441, BRASS_D = 0x8f6a22;
  var OAK = 0x7a5230, OAK_D = 0x4e3320;
  var PAPER = 0xf2ecd9, PAPER_D = 0xcfc5a8;
  var LAW = 0xbfd4ff, LAW2 = 0xeaf2ff;
  var SUIT = 0x232833, SUIT_D = 0x161a22, SHIRT = 0xe8e8ee, TIE = 0x5a1f28;

  var HG = window.JJHIGURUMA = { props: [] };

  var JCD = { j1: 7, j2: 9, j3: 10, j4: 19, jr: 10 };

  var HIG_CFG = {
    higuruma: true, face: false,
    torso: SUIT, pants: 0x1e222b, shoes: 0x14161c, skin: 0xd8b89a
  };

  /* ---------------------------------------------------------------- rig
     A tired man in a suit he has slept in. The hair is long, unbrushed
     and falls over one eye; the eyes have shadows under them; the tie is
     pulled loose and the collar is open. Nothing about him should look
     like a fighter until the sword is out.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.higuruma) return r;
    var head = r.head, spine = r.spine;
    var hair = 0x241d1a, hairD = 0x151010;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .82 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the hair: long, heavy, and not looked after */
    var cap = box(1.04, .38, 1.06, hair); cap.position.set(0, .95, -.02); head.add(cap);
    var back = box(1.0, .92, .42, hairD); back.position.set(0, .5, -.52); head.add(back);
    for (s = -1; s <= 1; s += 2) {
      var sd = box(.2, 1.0, .98, s < 0 ? hair : hairD);
      sd.position.set(.48 * s, .5, -.04);
      head.add(sd);
    }
    /* An uneven fringe, cut clear of the eyes except for the one long
       piece that hangs over the left of his face — the same lesson the
       first Mahito head taught: hair that reaches y=.5 is hair that
       covers the eyes, and a man with no face reads as a mannequin. */
    var FR = [[-.42, .96, .32], [-.24, .92, .40], [-.06, .98, .34],
              [.12, .90, .42], [.3, .96, .34], [.44, 1.0, .28]];
    for (i = 0; i < FR.length; i++) {
      var fr = box(.2, FR[i][2], .13, i % 2 ? hair : hairD);
      fr.position.set(FR[i][0], FR[i][1], .48);
      fr.rotation.z = -.24 + i * .09;
      head.add(fr);
    }
    /* the piece he never pushes out of the way */
    var lock = box(.15, .74, .14, hairD);
    lock.position.set(-.34, .72, .46);
    lock.rotation.z = .14;
    head.add(lock);
    /* a couple of strands past the jaw */
    for (s = -1; s <= 1; s += 2) {
      var st = box(.13, .72, .14, hairD);
      st.position.set(.42 * s, .3, .36);
      st.rotation.z = .1 * s;
      head.add(st);
    }

    /* the eyes, and the shadows that are most of his face */
    var eL = box(.16, .1, .05, 0xdfe4ea, true); eL.position.set(-.2, .55, .46); head.add(eL);
    var eR = box(.16, .1, .05, 0xdfe4ea, true); eR.position.set(.2, .55, .46); head.add(eR);
    var iL = box(.08, .08, .06, 0x3a2a20, true); iL.position.set(-.2, .55, .48); head.add(iL);
    var iR = box(.08, .08, .06, 0x3a2a20, true); iR.position.set(.2, .55, .48); head.add(iR);
    for (s = -1; s <= 1; s += 2) {
      var bag = box(.2, .07, .05, 0x9a7d68);
      bag.position.set(.2 * s, .45, .47);
      head.add(bag);
    }
    var brL = box(.2, .05, .05, hairD); brL.position.set(-.2, .68, .47); brL.rotation.z = .1; head.add(brL);
    var brR = box(.2, .05, .05, hairD); brR.position.set(.2, .68, .47); brR.rotation.z = -.1; head.add(brR);
    /* stubble along the jaw, and a flat mouth */
    var jaw = box(.66, .2, .68, 0xa88b72); jaw.position.set(0, .19, .04); head.add(jaw);
    var mouth = box(.24, .04, .05, 0x8a6a58); mouth.position.set(0, .3, .46); head.add(mouth);

    /* the suit: an open jacket, a shirt with the collar undone, and a
       tie pulled down about four inches */
    var shirt = box(.66, 1.0, .5, SHIRT); shirt.position.set(0, .68, .3); spine.add(shirt);
    /* the tie hangs IN FRONT of the shirt, which the first pass did not:
       the shirt slab's face is at z=.55 and the tie was at .48 */
    var tie = box(.17, .8, .1, TIE); tie.position.set(.04, .48, .60); tie.rotation.z = .07; spine.add(tie);
    var knot = box(.21, .18, .13, 0x431620); knot.position.set(.05, .94, .60); spine.add(knot);
    for (s = -1; s <= 1; s += 2) {
      var col = box(.22, .3, .16, SHIRT);
      col.position.set(.22 * s, 1.02, .38);
      col.rotation.z = .3 * s;
      spine.add(col);
      var lap = box(.34, 1.34, .17, SUIT);
      lap.position.set(.52 * s, .62, .3);
      lap.rotation.z = -.12 * s;
      spine.add(lap);
      var rev = box(.2, .5, .19, SUIT_D);
      rev.position.set(.4 * s, .94, .32);
      rev.rotation.z = -.34 * s;
      spine.add(rev);
    }
    var backp = box(1.22, 1.3, .22, SUIT); backp.position.set(0, .62, -.34); spine.add(backp);
    var coll2 = box(.78, .28, .66, SUIT_D); coll2.position.set(0, 1.14, -.04); spine.add(coll2);
    /* the tail of a rumpled jacket */
    var tail = box(1.1, .5, .5, SUIT); tail.position.set(0, -.1, -.06); spine.add(tail);
    return r;
  };

  CHARS.higuruma = {
    name: 'HIROMI HIGURUMA', sub: 'DEADLY SENTENCING',
    cfg: HIG_CFG, glow: '#d8a441',
    moves: [
      { key: 'LMB', lbl: 'Punch', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: "Executioner's Sword", cd: 'j1', max: JCD.j1 },
      { key: '2', lbl: 'Gavel', cd: 'j2', max: JCD.j2 },
      { key: '3', lbl: 'Evidence', cd: 'j3', max: JCD.j3 },
      { key: '4', lbl: 'Judgeman', cd: 'j4', max: JCD.j4 },
      { key: 'R', lbl: 'Recess', cd: 'jr', max: JCD.jr }
    ]
  };
  try { CHARS.higuruma.portrait = makePortrait(HIG_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.j1 = 0; cds.j2 = 0; cds.j3 = 0; cds.j4 = 0; cds.jr = 0;

  /* --------------------------------------------------------------- help */
  function ready(key) {
    return player.char === 'higuruma' && !player.dead && !busy() && cds[key] <= 0 &&
      !player.react && !(window.JJNAOYA && window.JJNAOYA.busy());
  }
  function start(type, dur, key, name, sub) {
    cds[key] = JCD[key];
    player.action = { type: type, t: 0, dur: dur, stage: 0 };
    if (name) { try { showSplash(name, sub || '', '#d8a441'); } catch (e) {} }
    return player.action;
  }
  function aim() {
    return new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  }
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }
  function later(ms, fn) {
    setTimeout(function () { if (typeof scene !== 'undefined') fn(); }, ms);
  }
  function mat(c, rough) {
    return new THREE.MeshStandardMaterial({ color: c, roughness: rough == null ? .8 : rough, flatShading: true });
  }
  function part(g, w, h, d, x, y, z, c) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    m.castShadow = Math.max(w, h, d) > 1;
    g.add(m);
    return m;
  }
  function keep(o) { HG.props.push(o); return o; }
  function drop(o) {
    if (!o) return;
    var i = HG.props.indexOf(o);
    if (i >= 0) HG.props.splice(i, 1);
    if (o.parent) o.parent.remove(o); else scene.remove(o);
    o.traverse(function (c) {
      if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
    });
  }

  /* =====================================================================
     THE CHARGE
     Nothing he does is an attack until it has been established. Anything
     of his that lands leaves a brass seal turning over the body, and
     while it is up everything else of his hits harder — so his damage is
     never in one move, it is in the order they go in.
     ================================================================== */
  var CHARGE = { secs: 6, bonus: .45 };

  function chargeOn(e) { return !!(e && e.__court && e.__court > 0); }
  function bonus(e) { return chargeOn(e) ? 1 + CHARGE.bonus : 1; }

  function sealOver(e) {
    if (!e || e.dead) return;
    var had = chargeOn(e);
    e.__court = CHARGE.secs;
    if (had) return;                                  // one seal, refreshed
    var g = new THREE.Group();
    var ring = FX.billboard(FX.T.ring, BRASS, .95);
    ring.scale.setScalar(2.2);
    g.add(ring);
    var bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, .12, .12),
      new THREE.MeshBasicMaterial({ color: BRASS, toneMapped: false }));
    g.add(bar);
    for (var s = -1; s <= 1; s += 2) {
      var pan = new THREE.Mesh(new THREE.BoxGeometry(.5, .1, .5),
        new THREE.MeshBasicMaterial({ color: BRASS_D, toneMapped: false }));
      pan.position.set(.72 * s, -.34, 0);
      g.add(pan);
      var wire = new THREE.Mesh(new THREE.BoxGeometry(.06, .34, .06),
        new THREE.MeshBasicMaterial({ color: BRASS_D, toneMapped: false }));
      wire.position.set(.72 * s, -.17, 0);
      g.add(wire);
    }
    var post = new THREE.Mesh(new THREE.BoxGeometry(.12, .6, .12),
      new THREE.MeshBasicMaterial({ color: BRASS, toneMapped: false }));
    post.position.y = .3;
    g.add(post);
    scene.add(g);
    keep(g);
    var t = 0;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      if (!e || e.dead || !(e.__court > 0)) { drop(g); return false; }
      e.__court -= dt;
      g.position.copy(e.pos).add(new THREE.Vector3(0, 5, 0));
      g.rotation.y += dt * 1.4;
      var f = Math.min(1, Math.min(t * 4, e.__court * 2));
      g.scale.setScalar(.55 * f * (1 + Math.sin(t * 5) * .05));
      g.children.forEach(function (c) { if (c.material) c.material.opacity = f; c.material.transparent = true; });
      return true;
    } });
    FX.mote(e.pos.clone().add(new THREE.Vector3(0, 4.6, 0)), BRASS, 2.4, .35);
  }
  HG.seal = sealOver;
  HG.charged = chargeOn;

  /* a strike of his, which is always the same shape: it lands, it is
     worth more if there is already a seal up, and it leaves one */
  function rule(e, amount, kb, opt) {
    if (!e || e.dead) return;
    var was = chargeOn(e);
    var o = opt || {};
    e.damage(Math.round(amount * bonus(e)), kb, {
      react: o.react === undefined ? 'stagger' : o.react,
      reactDur: o.reactDur || .6, spark: o.spark == null ? BRASS : o.spark,
      stun: o.stun, bleed: o.bleed !== false, death: o.death || 'sever',
      noFrameBonus: o.noFrameBonus
    });
    if (was) {
      /* the sentence carried out on a charge that was already up */
      FX.cross(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), LAW2, 7, .22);
      FX.rings(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), BRASS, 2,
        { maxR: 8, life: .4, ground: false, gap: 34 });
    }
    if (o.mark !== false) sealOver(e);
  }

  /* =====================================================================
     THE PROPS
     A courtroom's worth: the black sword, a gavel, and the dock.
     ================================================================== */

  /* THE EXECUTIONER'S SWORD. Black with a white edge and no glow at all —
     every other blade in this game is made of cursed energy and says so,
     and the entire point of this one is that it is not. */
  function buildSword() {
    var g = new THREE.Group();
    part(g, .3, .34, .34, 0, -.5, 0, 0x2a2028);        // the pommel
    part(g, .22, 1.0, .22, 0, .1, 0, 0x1d1a20);        // the grip
    for (var i = 0; i < 5; i++) {
      part(g, .26, .06, .26, 0, -.28 + i * .2, 0, 0x0e0c10);
    }
    part(g, 1.4, .16, .3, 0, .72, 0, 0x33303a);        // the guard
    part(g, .4, .22, .34, 0, .84, 0, BRASS_D);
    /* the blade: matte black, dead flat, with one pale line down it */
    var blade = part(g, .5, 6.4, .16, 0, 4.05, 0, INK);
    blade.castShadow = true;
    var lip = new THREE.Mesh(new THREE.BoxGeometry(.09, 6.4, .18),
      new THREE.MeshBasicMaterial({ color: EDGE, toneMapped: false }));
    lip.position.set(.25, 4.05, 0);
    g.add(lip);
    part(g, .5, .8, .16, 0, 7.5, 0, INK).rotation.z = .0;
    var tip = part(g, .3, .7, .14, 0, 7.9, 0, INK);
    tip.rotation.z = .0;
    return g;
  }
  HG.buildSword = buildSword;

  function buildGavel(scale) {
    var g = new THREE.Group();
    var s = scale || 1;
    part(g, 3.4 * s, 1.5 * s, 1.5 * s, 0, 0, 0, OAK);           // the head
    part(g, 3.5 * s, .3 * s, 1.6 * s, 0, .7 * s, 0, OAK_D);
    for (var i = -1; i <= 1; i += 2) {
      part(g, .3 * s, 1.6 * s, 1.6 * s, 1.6 * i * s, 0, 0, BRASS);
    }
    part(g, .5 * s, 4.4 * s, .5 * s, 0, -2.6 * s, 0, OAK_D);    // the handle
    part(g, .7 * s, .4 * s, .7 * s, 0, -4.9 * s, 0, BRASS_D);
    return g;
  }
  HG.buildGavel = buildGavel;

  /* the seal a gavel leaves on the floor: a brass ring with the scales
     stamped inside it */
  function stamp(at, r) {
    var g = new THREE.Group();
    var ring = FX.billboard(FX.T.ring, BRASS, .9);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(r);
    g.add(ring);
    var inner = FX.billboard(FX.T.spokes, BRASS_D, .55);
    inner.rotation.x = -Math.PI / 2;
    inner.scale.setScalar(r * .7);
    g.add(inner);
    g.position.set(at.x, .09, at.z);
    scene.add(g);
    var t = 0;
    addFx({ t: 2.4, update: function (dd) {
      this.t -= dd; t += dd;
      g.rotation.y += dd * .5;
      var f = Math.min(1, t * 5) * Math.min(1, this.t / .8);
      g.children.forEach(function (c) { c.material.opacity = f * .9; });
      if (this.t <= 0) {
        scene.remove(g);
        g.children.forEach(function (c) { c.material.dispose(); });
        return false;
      }
      return true;
    } });
  }
  HG.stamp = stamp;

  /* =====================================================================
     1 · EXECUTIONER'S SWORD  死刑執行人の剣
     He draws it out of nothing and brings it down. One cut, straight, no
     flourish — a sentence being carried out is not a flourish.
     ================================================================== */
  var SW = { dmg: 36, reach: 11, step: 20, arc: .3 };

  function castSword() {
    if (!ready('j1')) return;
    var a = start('j1', 1.1, 'j1', "EXECUTIONER'S SWORD", '死刑執行人の剣');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepSword(a, dt) {
    var p = player, d = a.dir;
    /* it appears in his hand as a line before it is a blade */
    if (a.stage < 1) {
      a.stage = 1;
      var sw = buildSword();
      p.rig.elbowR.add(sw);
      sw.position.set(0, -1.1, 0);
      sw.rotation.x = Math.PI * .5;
      sw.scale.set(.02, .02, .02);
      a.sw = sw;
      var t = 0;
      addFx({ t: 1e9, update: function (dd) {
        t += dd;
        if (typeof scene === 'undefined' || !sw.parent) return false;
        /* out of nothing, held, and then put away */
        var k = t < .2 ? E.out(t / .2) : (t > .85 ? Math.max(0, 1 - (t - .85) / .2) : 1);
        sw.scale.set(k, k, k);
        if (t > 1.1) { sw.parent.remove(sw); drop(sw); return false; }
        return true;
      } });
      FX.mote(p.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), EDGE, 2.2, .25);
    }
    if (a.t < .34) { p.vel.x *= .7; p.vel.z *= .7; return; }
    if (a.t < .5) { p.vel.x = d.x * SW.step; p.vel.z = d.z * SW.step; return; }
    p.vel.x *= .6; p.vel.z *= .6;
    if (a.stage < 2) {
      a.stage = 2;
      var at = p.pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.6, 0));
      /* the cut: black, with a white core. Nothing else in the game is
         drawn this way round, which is the point */
      FX.slash(at.clone(), new THREE.Vector3(0, -1, 0), INK, 18, .3);
      FX.slash(at.clone(), new THREE.Vector3(0, -1, 0), EDGE, 13, .2);
      FX.cutLine(at.clone().add(new THREE.Vector3(0, 5, 0)),
        at.clone().add(new THREE.Vector3(0, -5, 0)), EDGE, 1.1, .34);
      FX.mangaLines(.8, .26);
      addShake(2.2);
      if (typeof hitstop === 'function') hitstop(.14);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(at, SW.reach, d, SW.arc).forEach(function (e) {
        if (!e || e.dead) return;
        var kb = d.clone().multiplyScalar(14); kb.y = 9;
        rule(e, SW.dmg, kb, {
          react: 'slash', reactDur: .8, spark: EDGE, stun: .7, death: 'halve' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)),
          new THREE.Vector3(0, -1, 0), 16, 2.1);
        FX.cutLine(e.pos.clone().add(new THREE.Vector3(0, 5.4, 0)),
          e.pos.clone().add(new THREE.Vector3(0, -.4, 0)), EDGE, .8, .3);
      });
    }
  }

  /* =====================================================================
     2 · GAVEL  木槌
     Brought down where he points. Whatever is under it goes on the
     record, and the record is what the rest of his kit is paid out of.
     ================================================================== */
  var GV = { dmg: 30, radius: 7.5, out: 10 };

  function dropGavel(at, ghost) {
    var g = buildGavel(1);
    g.position.copy(at).add(new THREE.Vector3(0, 22, 0));
    g.rotation.z = .5;
    scene.add(g);
    keep(g);
    var t = 0, hit = false;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      g.position.y = Math.max(2.2, 22 - 130 * t * t);
      g.rotation.z = .5 * Math.max(0, 1 - t * 5);
      if (!hit && g.position.y <= 2.3) {
        hit = true;
        stamp(at, GV.radius * 1.7);
        FX.flash('#ffe9c0', .4, .22);
        FX.rings(new THREE.Vector3(at.x, .12, at.z), BRASS, 4,
          { maxR: GV.radius * 2.4, life: .7, gap: 38 });
        FX.cracks(new THREE.Vector3(at.x, .1, at.z), 16, 22, OAK_D);
        FX.dust(new THREE.Vector3(at.x, 0, at.z), 12, 0xd6c8ae, 16, 5);
        FX.impact(at.clone().add(new THREE.Vector3(0, 1.6, 0)), BRASS, 4);
        FX.mangaLines(.8, .28);
        addShake(3);
        if (typeof hitstop === 'function') hitstop(.16);
        try { sfx.redBoom(); } catch (e) {}
        if (!ghost) {
          enemiesNear(at.clone().add(new THREE.Vector3(0, 2, 0)), GV.radius).forEach(function (e) {
            if (!e || e.dead) return;
            var kb = e.pos.clone().sub(at).setY(0);
            if (kb.lengthSq() < .01) kb.set(1, 0, 0);
            kb.normalize().multiplyScalar(10); kb.y = 13;
            rule(e, GV.dmg, kb, { react: 'blow', reactDur: .8, stun: .8, death: 'flat' });
          });
        }
      }
      if (t > 1.1) {
        /* it lifts and is gone, the way a gavel is not left lying about */
        g.position.y = 2.2 + (t - 1.1) * 40;
        g.children.forEach(function (c) {
          c.material.transparent = true;
          c.material.opacity = Math.max(0, 1 - (t - 1.1) / .4);
        });
      }
      if (t > 1.55) { drop(g); return false; }
      return true;
    } });
    return g;
  }

  function castGavel() {
    if (!ready('j2')) return;
    var a = start('j2', 1.15, 'j2', 'GAVEL', '木槌');
    var d = aim();
    /* it comes down on whoever is in front, or on the ground he pointed at */
    var near = null, nd = 26;
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .5 || dist > nd) return;
      if (to.clone().normalize().dot(d) < .1) return;
      nd = dist; near = e;
    });
    a.at = near ? new THREE.Vector3(near.pos.x, 0, near.pos.z)
                : player.pos.clone().addScaledVector(d, GV.out).setY(0);
    a.dir = d;
    player.iframes = Math.max(player.iframes, .5);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepGavel(a, dt) {
    var p = player;
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1 && a.t > .38) {
      a.stage = 1;
      FX.ring(new THREE.Vector3(a.at.x, .1, a.at.z), BRASS, { maxR: GV.radius, life: .5, ground: true });
      dropGavel(a.at.clone());
    }
  }

  /* =====================================================================
     3 · EVIDENCE  証拠
     Sheets of it, out in a fan. They stick to whatever they reach and
     then pull taut, which is the part that hurts.
     ================================================================== */
  var EV = { dmg: 26, sheets: 26, reach: 20, radius: 5.5 };

  function sheet(from, to, life) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.25),
      new THREE.MeshStandardMaterial({ color: Math.random() < .3 ? PAPER_D : PAPER,
        roughness: .95, side: THREE.DoubleSide }));
    /* a couple of lines of type on it, so it reads as a document */
    var ink = new THREE.Mesh(new THREE.PlaneGeometry(.6, .05),
      new THREE.MeshBasicMaterial({ color: 0x4a463c, toneMapped: false, side: THREE.DoubleSide }));
    ink.position.set(0, .3, .01); m.add(ink);
    var ink2 = ink.clone(); ink2.position.set(-.08, .12, .01); ink2.scale.x = .7; m.add(ink2);
    var ink3 = ink.clone(); ink3.position.set(-.02, -.06, .01); ink3.scale.x = .85; m.add(ink3);
    m.position.copy(from);
    scene.add(m);
    var t = 0, L = life || .85;
    var spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      var k = Math.min(1, t / (L * .55));
      m.position.lerpVectors(from, to, E.out(k));
      m.position.y += Math.sin(k * Math.PI) * 1.6;
      if (k < 1) {
        m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; m.rotation.z += spin.z * dt;
      } else {
        /* stuck: it stops turning and lies against them */
        m.rotation.x *= .9; m.rotation.z *= .9;
      }
      if (t > L) {
        scene.remove(m);
        m.traverse(function (c) { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
        return false;
      }
      return true;
    } });
    return m;
  }

  function castEvidence() {
    if (!ready('j3')) return;
    var a = start('j3', 1.25, 'j3', 'EVIDENCE', '証拠');
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .4);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepEvidence(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .85; p.vel.z *= .85;
    if (a.stage < 1 && a.t > .3) {
      a.stage = 1;
      var from = p.pos.clone().add(new THREE.Vector3(0, 2.4, 0));
      var side = new THREE.Vector3(-d.z, 0, d.x);
      /* the fan */
      for (var i = 0; i < EV.sheets; i++) {
        var k = (i / (EV.sheets - 1)) - .5;
        var to = from.clone()
          .addScaledVector(d, EV.reach * (.55 + Math.random() * .6))
          .addScaledVector(side, k * 13 + (Math.random() - .5) * 3);
        to.y = .6 + Math.random() * 3.4;
        sheet(from.clone(), to, .95);
      }
      FX.streaks(from.clone(), PAPER, 6, 14, .8);
      addShake(.7);
    }
    if (a.stage < 2 && a.t > .74) {
      a.stage = 2;
      /* and they pull taut */
      var at = p.pos.clone().addScaledVector(d, EV.reach * .55).add(new THREE.Vector3(0, 2, 0));
      FX.mangaLines(.7, .24);
      addShake(1.8);
      if (typeof hitstop === 'function') hitstop(.1);
      enemiesNear(at, EV.radius + 5, d, 0).forEach(function (e) {
        if (!e || e.dead) return;
        var body = e.pos.clone().add(new THREE.Vector3(0, 2.2, 0));
        /* a dozen of them land on this one and go tight */
        for (var s = 0; s < 10; s++) {
          var a2 = Math.random() * TAU;
          sheet(body.clone().add(new THREE.Vector3(Math.cos(a2) * 4, Math.random() * 3 - 1, Math.sin(a2) * 4)),
            body.clone().add(new THREE.Vector3(Math.cos(a2) * .9, Math.random() * 2 - 1, Math.sin(a2) * .9)), .7);
        }
        FX.impact(body.clone(), PAPER, 2.6);
        FX.cross(body.clone(), EDGE, 6, .2);
        FX.blood(body.clone(), d, 12, 1.8);
        rule(e, EV.dmg, d.clone().multiplyScalar(7).setY(6), {
          react: 'stagger', reactDur: .9, spark: PAPER, stun: .9, death: 'dice' });
      });
    }
  }

  /* =====================================================================
     4 · JUDGEMAN  裁判長
     The court itself. It rises behind him, hears the thing, and hands
     down a column of cold light with a gavel coming after it.
     ================================================================== */
  var JM = { dmg: 44, radius: 9, dur: 3.2 };

  function buildJudge() {
    var g = new THREE.Group();
    /* a robe with nobody in it, which is the whole idea */
    part(g, 4.6, 7.0, 3.0, 0, 4.6, 0, 0x1b1b22);
    part(g, 5.6, 1.2, 3.4, 0, 8.4, 0, 0x111116);       // the shoulders
    part(g, 5.0, .4, 3.2, 0, 1.2, 0, BRASS_D);          // the hem
    for (var i = 0; i < 4; i++) {
      part(g, .22, 6.0, .22, -1.4 + i * .95, 4.6, 1.55, 0x0b0b10);
    }
    /* the head: a flat mask under a flat cap, and no face on it */
    part(g, 2.0, 2.0, 1.6, 0, 9.9, .2, 0xd9d3c4);
    var slit = new THREE.Mesh(new THREE.BoxGeometry(1.3, .16, .1),
      new THREE.MeshBasicMaterial({ color: 0x1a1a20, toneMapped: false }));
    slit.position.set(0, 9.9, 1.02);
    g.add(slit);
    part(g, 3.4, .3, 3.4, 0, 11.1, .1, 0x0d0d12);       // the cap
    part(g, 1.0, .3, 1.0, 1.5, 11.3, .1, BRASS);
    /* the arms, and the gavel in one of them */
    g.__arms = [];
    for (var s = -1; s <= 1; s += 2) {
      var arm = new THREE.Group();
      arm.position.set(2.6 * s, 8.2, .2);
      part(arm, .8, 3.4, .8, 0, -1.6, 0, 0x1b1b22);
      part(arm, .9, .6, .9, 0, -3.5, .2, 0xd8bda2);
      g.add(arm);
      g.__arms.push(arm);
    }
    var gav = buildGavel(.55);
    gav.position.set(2.6, 4.4, .6);
    gav.rotation.z = .3;
    g.add(gav);
    g.__gavel = gav;
    /* the bench in front of it */
    part(g, 8.0, 2.4, 2.0, 0, 1.4, 3.2, OAK);
    part(g, 8.6, .4, 2.4, 0, 2.7, 3.2, OAK_D);
    return g;
  }
  HG.buildJudge = buildJudge;

  /* the verdict: a column of cold light standing on somebody */
  function column(at, life, r) {
    var g = new THREE.Group();
    for (var i = 0; i < 3; i++) {
      var m = FX.billboard(FX.T.streak, i ? LAW : LAW2, .8);
      m.scale.set((r || 5) * (1 - i * .22), 40, 1);
      m.position.y = 18;
      m.rotation.y = i * 1.1;
      g.add(m);
    }
    g.position.set(at.x, 0, at.z);
    scene.add(g);
    var t = 0, L = life || 1.1;
    addFx({ t: 1e9, update: function (dd) {
      t += dd;
      if (typeof scene === 'undefined') return false;
      var f = Math.min(1, t * 6) * Math.max(0, 1 - Math.max(0, t - L * .6) / (L * .4));
      g.children.forEach(function (c, i) {
        c.material.opacity = f * (.85 - i * .18);
        c.scale.x = (r || 5) * (1 - i * .22) * (1 + Math.sin(t * 9 + i) * .06);
      });
      g.rotation.y += dd * .8;
      if (t > L) {
        scene.remove(g);
        g.children.forEach(function (c) { c.material.dispose(); });
        return false;
      }
      return true;
    } });
    FX.ring(new THREE.Vector3(at.x, .12, at.z), LAW, { maxR: (r || 5) * 2, life: .6, ground: true });
  }
  HG.column = column;

  function callJudge(behind, at, dir, ghost) {
    var j = buildJudge();
    j.position.set(behind.x, -16, behind.z);
    j.rotation.y = Math.atan2(at.x - behind.x, at.z - behind.z);
    scene.add(j);
    keep(j);
    var t = 0, spoke = false, fell = false;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      if (t < .7) {
        j.position.y = -16 + E.out(t / .7) * 16;
        if (Math.random() < dt * 30) {
          FX.mote(j.position.clone().add(new THREE.Vector3(
            (Math.random() - .5) * 8, 2 + Math.random() * 9, (Math.random() - .5) * 4)), BRASS, 1.6, .3);
        }
      } else j.position.y = 0;

      /* the verdict is read */
      if (!spoke && t > .9) {
        spoke = true;
        column(at, 1.5, 6);
        FX.flash('#eaf2ff', .45, .26);
        FX.rings(new THREE.Vector3(at.x, .12, at.z), LAW, 3, { maxR: JM.radius * 2, life: .8, gap: 44 });
        stamp(at, JM.radius * 1.6);
        addShake(2);
        try { sfx.raise(); } catch (e) {}
        if (!ghost) {
          enemiesNear(at.clone().add(new THREE.Vector3(0, 2, 0)), JM.radius).forEach(function (e) {
            if (!e || e.dead) return;
            sealOver(e);
            e.stunT = Math.max(e.stunT || 0, 1.2);
            e.anchorT = .8;
            e.anchorPos.copy(e.pos);
          });
        }
      }
      /* and the gavel comes after it */
      if (spoke && !fell && t > 1.7) {
        fell = true;
        if (j.__arms && j.__arms[1]) j.__arms[1].rotation.x = -1.4;
        if (j.__gavel) j.__gavel.rotation.z = -1.1;
        var arm = j.__arms && j.__arms[1];
        var s2 = 0;
        addFx({ t: .3, update: function (dd) {
          this.t -= dd; s2 += dd;
          if (arm) arm.rotation.x = -1.4 + E.out(s2 / .3) * 1.7;
          if (j.__gavel) j.__gavel.rotation.z = -1.1 + E.out(s2 / .3) * 1.4;
          return this.t > 0;
        } });
        later(200, function () {
          FX.flash('#ffe9c0', .6, .3);
          FX.impact(at.clone().add(new THREE.Vector3(0, 2, 0)), BRASS, 5);
          FX.rings(new THREE.Vector3(at.x, .12, at.z), BRASS, 5,
            { maxR: JM.radius * 2.6, life: .9, gap: 38 });
          FX.cracks(new THREE.Vector3(at.x, .1, at.z), 22, 28, OAK_D);
          FX.dust(new THREE.Vector3(at.x, 0, at.z), 16, 0xd6c8ae, 22, 6);
          FX.mangaLines(1, .34);
          addShake(4.2);
          if (typeof hitstop === 'function') hitstop(.22);
          try { sfx.redBoom(); } catch (e) {}
          if (!ghost) {
            enemiesNear(at.clone().add(new THREE.Vector3(0, 2, 0)), JM.radius).forEach(function (e) {
              if (!e || e.dead) return;
              e.anchorT = 0;
              rule(e, JM.dmg, new THREE.Vector3(0, -14, 0), {
                react: 'blow', reactDur: 1.1, spark: LAW2, stun: 1.1, death: 'flat' });
            });
          }
        });
      }
      if (t > JM.dur) {
        /* the court rises */
        var s3 = 0;
        addFx({ t: 1e9, update: function (dd) {
          s3 += dd;
          j.position.y = -22 * s3;
          if (s3 > .9) { drop(j); return false; }
          return true;
        } });
        return false;
      }
      return true;
    } });
    return j;
  }

  function castJudge() {
    if (!ready('j4')) return;
    var a = start('j4', 1.5, 'j4', 'JUDGEMAN', '裁判長');
    var d = aim();
    var near = null, nd = 30;
    enemies.forEach(function (e) {
      if (!e || e.dead) return;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .5 || dist > nd) return;
      if (to.clone().normalize().dot(d) < 0) return;
      nd = dist; near = e;
    });
    a.at = near ? new THREE.Vector3(near.pos.x, 0, near.pos.z)
                : player.pos.clone().addScaledVector(d, 14).setY(0);
    a.dir = d;
    player.iframes = Math.max(player.iframes, 1.4);
    FX.letterbox(true);
    later(3200, function () { FX.letterbox(false); });
    try { sfx.raise(); } catch (e) {}
  }
  function stepJudge(a, dt) {
    var p = player, d = a.dir;
    p.vel.set(0, 0, 0);
    if (a.stage < 1 && a.t > .5) {
      a.stage = 1;
      /* It presides over the accused, not over him — so it comes up BEYOND
         them and off to one side, facing back. Behind him is where the
         chase camera lives: the first cut of this put a judge's bench
         across the bottom of the lens, and the second put it somewhere
         nobody would ever see it. */
      var side = new THREE.Vector3(-d.z, 0, d.x);
      var behind = a.at.clone().addScaledVector(d, 11).addScaledVector(side, 8);
      behind.y = 0;
      FX.cracks(new THREE.Vector3(behind.x, .06, behind.z), 12, 16, OAK_D);
      addShake(1.6);
      callJudge(behind, a.at.clone(), d.clone());
    }
  }

  /* =====================================================================
     R · RECESS  休廷
     One rap, and the dock comes up out of the floor between him and it.
     ================================================================== */
  var RC = { dmg: 14, back: 15, radius: 6 };

  function raiseDock(at, dir, ghost) {
    var g = new THREE.Group();
    part(g, 9.0, 3.2, 1.4, 0, 1.6, 0, OAK);
    part(g, 9.4, .4, 1.8, 0, 3.4, 0, OAK_D);
    for (var i = -3; i <= 3; i++) {
      part(g, .5, 2.6, 1.5, i * 1.3, 1.5, .1, i % 2 ? OAK_D : OAK);
    }
    part(g, 9.2, .3, 1.6, 0, .2, 0, BRASS_D);
    g.position.set(at.x, -4, at.z);
    g.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(g);
    keep(g);
    var t = 0, hit = false;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      g.position.y = Math.min(0, -4 + 26 * t);
      if (!hit && t > .16) {
        hit = true;
        FX.rings(new THREE.Vector3(at.x, .12, at.z), OAK, 3, { maxR: RC.radius * 2, life: .55, gap: 36 });
        FX.dust(new THREE.Vector3(at.x, 0, at.z), 10, 0xd6c8ae, 14, 5);
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 12, 14, OAK_D);
        addShake(1.6);
        try { sfx.redBoom(); } catch (e) {}
        if (!ghost) {
          enemiesNear(at.clone().add(new THREE.Vector3(0, 2, 0)), RC.radius).forEach(function (e) {
            if (!e || e.dead) return;
            var kb = e.pos.clone().sub(at).setY(0);
            if (kb.lengthSq() < .01) kb.copy(dir);
            kb.normalize().multiplyScalar(18); kb.y = 14;
            rule(e, RC.dmg, kb, { react: 'blow', reactDur: .7, death: 'dice' });
          });
        }
      }
      if (t > 2.6) {
        var s = (t - 2.6) / .5;
        g.position.y = -4 * s;
        if (s > 1) { drop(g); return false; }
      }
      return true;
    } });
    return g;
  }

  function castRecess() {
    if (!ready('jr')) return;
    var a = start('jr', .9, 'jr', 'RECESS', '休廷');
    a.dir = aim();
    a.from = player.pos.clone();
    player.iframes = Math.max(player.iframes, 1);
    try { sfx.whoosh(); } catch (e) {}
  }
  function stepRecess(a, dt) {
    var p = player, d = a.dir;
    if (a.stage < 1) {
      a.stage = 1;
      var at = a.from.clone().addScaledVector(d, 4.5);
      at.y = 0;
      FX.impact(a.from.clone().add(new THREE.Vector3(0, 2.4, 0)), BRASS, 2.2);
      FX.cross(a.from.clone().add(new THREE.Vector3(0, 2.4, 0)), BRASS, 4, .16);
      raiseDock(at, d);
    }
    /* and he takes the recess */
    if (a.t < .34) {
      p.vel.x = -d.x * RC.back; p.vel.z = -d.z * RC.back;
      if (Math.random() < .5 && typeof ghostAfterimage === 'function') {
        ghostAfterimage(p.rig, BRASS_D, .22);
      }
    } else { p.vel.x *= .8; p.vel.z *= .8; }
  }

  /* =====================================================================
     POSES
     He does not fight, he presents. Everything is a gesture toward
     something else: a hand out for the sheets, a hand up for the court,
     and the sword brought down two-handed like a man who has decided.
     ================================================================== */
  function poseHiguruma(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'j1': {                     // both hands up, and down through it
        rp(r);
        var up = out(Math.min(1, t / .32));
        var cut = t > .5 ? out(Math.min(1, (t - .5) / .16)) : 0;
        r.shoulderR.rotation.x = -2.5 * up + 3.1 * cut;
        r.shoulderL.rotation.x = -2.4 * up + 2.6 * cut;
        r.shoulderR.rotation.z = -.3 * up + .2 * cut;
        r.shoulderL.rotation.z = .5 * up - .3 * cut;
        r.elbowR.rotation.x = -.3 * up - .2 * cut;
        r.elbowL.rotation.x = -.7 * up + .3 * cut;
        r.spine.rotation.x = -.3 * up + .8 * cut;
        r.neck.rotation.x = -.3 * up + .7 * cut;
        r.hipL.rotation.x = -.4 * up + .3 * cut; r.kneeL.rotation.x = .7 * up;
        r.hipR.rotation.x = .3 * up - .5 * cut; r.kneeR.rotation.x = .5 * up;
        r.hips.position.y = r.hipsBaseY - .2 * up - .3 * cut;
        return true;
      }
      case 'j2': {                     // a hand raised, and brought down flat
        rp(r);
        var rz = out(Math.min(1, t / .3));
        var dn = t > .34 ? out(Math.min(1, (t - .34) / .14)) : 0;
        r.shoulderR.rotation.x = -2.7 * rz + 2.4 * dn;
        r.shoulderR.rotation.z = -.2 * rz;
        r.elbowR.rotation.x = -.4 * rz + .2 * dn;
        r.shoulderL.rotation.x = -.3 * rz;
        r.elbowL.rotation.x = -1.1 * rz;
        r.spine.rotation.x = -.24 * rz + .5 * dn;
        r.spine.rotation.y = -.24 * rz + .3 * dn;
        r.neck.rotation.x = -.34 * rz + .6 * dn;
        r.hipL.rotation.x = -.24 * rz; r.kneeL.rotation.x = .44 * rz + .2 * dn;
        r.hipR.rotation.x = -.2 * rz; r.kneeR.rotation.x = .4 * rz + .2 * dn;
        r.hips.position.y = r.hipsBaseY - .16 * rz - .24 * dn;
        return true;
      }
      case 'j3': {                     // presented: one arm out, palm up
        rp(r);
        var pr = out(Math.min(1, t / .28));
        var thr = t > .68 ? out(Math.min(1, (t - .68) / .16)) : 0;
        r.shoulderR.rotation.x = -1.55 * pr - .5 * thr;
        r.shoulderR.rotation.z = -.6 * pr + .5 * thr;
        r.elbowR.rotation.x = -.5 * pr + .4 * thr;
        r.shoulderL.rotation.x = -1.0 * pr - .3 * thr;
        r.shoulderL.rotation.z = .7 * pr - .4 * thr;
        r.elbowL.rotation.x = -.9 * pr + .5 * thr;
        r.spine.rotation.x = -.12 * pr + .3 * thr;
        r.spine.rotation.y = .3 * pr - .5 * thr;
        r.neck.rotation.y = -.2 * pr + .34 * thr;
        r.hipL.rotation.x = -.2 * pr; r.kneeL.rotation.x = .38 * pr;
        r.hipR.rotation.x = -.16 * pr; r.kneeR.rotation.x = .32 * pr;
        r.hips.position.y = r.hipsBaseY - .18 * pr;
        return true;
      }
      case 'j4': {                     // stands, and lifts one hand for it
        rp(r);
        var ri = out(Math.min(1, t / .5));
        var hold = t > .6 ? Math.min(1, (t - .6) / .4) : 0;
        r.shoulderR.rotation.x = -2.85 * ri;
        r.shoulderR.rotation.z = -.34 * ri + Math.sin(t * 2.4) * .04 * hold;
        r.elbowR.rotation.x = -.26 * ri;
        r.shoulderL.rotation.x = -.34 * ri;
        r.elbowL.rotation.x = -.9 * ri;
        r.spine.rotation.x = -.26 * ri;
        r.neck.rotation.x = -.5 * ri;
        r.hipL.rotation.x = -.14 * ri; r.kneeL.rotation.x = .26 * ri;
        r.hipR.rotation.x = -.12 * ri; r.kneeR.rotation.x = .22 * ri;
        r.hips.position.y = r.hipsBaseY - .1 * ri;
        return true;
      }
      case 'jr': {                     // one rap, and he steps back off it
        rp(r);
        var rap = out(Math.min(1, t / .12));
        var bk = t > .16 ? out(Math.min(1, (t - .16) / .3)) : 0;
        r.shoulderR.rotation.x = -1.5 * rap + 1.2 * bk;
        r.shoulderR.rotation.z = -.24 * rap;
        r.elbowR.rotation.x = -1.3 * rap + .9 * bk;
        r.shoulderL.rotation.x = -.4 * rap - .5 * bk;
        r.elbowL.rotation.x = -1.0 * rap;
        r.spine.rotation.x = .18 * rap - .5 * bk;
        r.neck.rotation.x = .12 * rap - .3 * bk;
        r.hipL.rotation.x = -.3 * rap - .4 * bk; r.kneeL.rotation.x = .5 * rap + .6 * bk;
        r.hipR.rotation.x = -.2 * rap + .3 * bk; r.kneeR.rotation.x = .4 * rap;
        r.hips.position.y = r.hipsBaseY - .26 * rap - .16 * bk;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'j1': return stepSword(a, dt);
      case 'j2': return stepGavel(a, dt);
      case 'j3': return stepEvidence(a, dt);
      case 'j4': return stepJudge(a, dt);
      case 'jr': return stepRecess(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'higuruma' && poseHiguruma(r, a)) return;
    return _poseAction(r, a);
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'higuruma' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castSword();
    else if (e.code === 'Digit2') castGavel();
    else if (e.code === 'Digit3') castEvidence();
    else if (e.code === 'Digit4') castJudge();
    else if (e.code === 'KeyR') castRecess();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* the court does not sit for the next man */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    HG.props.slice().forEach(drop);
    enemies.forEach(function (e) { if (e) e.__court = 0; });
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     Same routines, no damage and no charge: the seal is what makes his
     next hit worth more, and a seal put up here would be a second one on
     a body that already has the real one.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  HG.remote = {
    j1: function (pos, yaw) {
      var d = dirOf(yaw);
      later(500, function () {
        var at = pos.clone().addScaledVector(d, 5).add(new THREE.Vector3(0, 2.6, 0));
        FX.slash(at.clone(), new THREE.Vector3(0, -1, 0), INK, 18, .3);
        FX.slash(at.clone(), new THREE.Vector3(0, -1, 0), EDGE, 13, .2);
        FX.cutLine(at.clone().add(new THREE.Vector3(0, 5, 0)),
          at.clone().add(new THREE.Vector3(0, -5, 0)), EDGE, 1.1, .34);
      });
    },
    j2: function (pos, yaw) {
      var d = dirOf(yaw), at = pos.clone().addScaledVector(d, GV.out).setY(0);
      FX.ring(new THREE.Vector3(at.x, .1, at.z), BRASS, { maxR: GV.radius, life: .5, ground: true });
      later(390, function () { dropGavel(at.clone(), true); });
    },
    j3: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var from = pos.clone().add(new THREE.Vector3(0, 2.4, 0));
      later(310, function () {
        for (var i = 0; i < EV.sheets; i++) {
          var k = (i / (EV.sheets - 1)) - .5;
          var to = from.clone().addScaledVector(d, EV.reach * (.55 + Math.random() * .6))
            .addScaledVector(side, k * 13 + (Math.random() - .5) * 3);
          to.y = .6 + Math.random() * 3.4;
          sheet(from.clone(), to, .95);
        }
      });
    },
    j4: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x);
      var at = pos.clone().addScaledVector(d, 14).setY(0);
      var behind = at.clone().addScaledVector(d, 11).addScaledVector(side, 8).setY(0);
      FX.cracks(new THREE.Vector3(behind.x, .06, behind.z), 12, 16, OAK_D);
      later(520, function () { callJudge(behind, at, d.clone(), true); });
    },
    jr: function (pos, yaw) {
      var d = dirOf(yaw);
      raiseDock(pos.clone().addScaledVector(d, 4.5).setY(0), d, true);
    }
  };

  /* the pieces the finishers borrow */
  HG.buildDock = raiseDock;
  HG.sheet = sheet;
  HG.gavelDrop = dropGavel;
  HG.INK = INK; HG.EDGE = EDGE; HG.BRASS = BRASS; HG.BRASS_D = BRASS_D;
  HG.OAK = OAK; HG.OAK_D = OAK_D; HG.PAPER = PAPER;
  HG.LAW = LAW; HG.LAW2 = LAW2;
})();
