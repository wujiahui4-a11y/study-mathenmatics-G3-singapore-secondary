/* =======================================================================
   HIROMI HIGURUMA
   Deadly Sentencing 誅伏賜死. He was a defence lawyer and he still works
   like one: nothing he does is an attack until it has been ESTABLISHED.
   Every move either puts a charge on somebody or carries one out.

   THE REWRITE. He used to carry four different props — a sword, a gavel,
   paper, a dock — and the gavel was the only one anybody remembers. So
   now there is ONE prop and he never puts it down. It is in his hand for
   the ordinary combo as well, which is the point: his punch IS the
   gavel.

   The handle is elastic. It is not one box, it is a chain of segments
   laid along a curve every frame, so it can stretch to any length and
   bow at any angle without a second model — which is what lets the same
   hammer be a gavel, a maul, a spear, a pile driver and a whip.

     1  CONTEMPT          侮辱 — thrown straight. On a hit they are held,
                          and pressing it again closes the distance and
                          takes them across the ribs with it full size
     2  CROSS EXAMINATION 尋問 — the butt of the handle, over and over,
                          and then they ride the head to wherever he is
                          going
     3  BENCH WARRANT     勾引状 — a knee, and then he runs them down,
                          hitting the floor wherever he happens to be
     4  HANDING DOWN      宣告 — the handle goes out as far as it has to.
                          Press it again and it stays out, and the floor
                          gets whipped
     R  CONTEMPT OF COURT 法廷侮辱 — one after another after another,
                          wherever he points

   Two rules for the look:

     · A CHARGE, AND THEN A SENTENCE. Anything he lands leaves a small
       brass seal turning over the body it landed on. While that seal is
       up, everything of his hits harder — so his damage is not in any
       one move, it is in the order he does them in.
     · HIS COLOURS ARE A COURTROOM AND NOT A FIGHT. Oak, brass, paper and
       a cold blue-white. The one hot colour is the yellow that comes off
       a hit hard enough to be a verdict.
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
  /* out of the reference: a plain black two piece, worn closed, over a
     white shirt and a dark green tie */
  var SUIT = 0x1b1b20, SUIT_D = 0x101014, SHIRT = 0xf0f0f4, TIE = 0x27543f;
  /* the one hot colour, and it only ever means "that landed" */
  var GOLD = 0xffc83c, GOLD_L = 0xfff0b4;

  var HG = window.JJHIGURUMA = { props: [], hammer: null };

  var JCD = { j1: 7, j2: 9, j3: 10, j4: 14, jr: 18 };

  var HIG_CFG = {
    higuruma: true, face: false,
    torso: SUIT, pants: SUIT, shoes: 0x0c0c10, skin: 0xd8b89a
  };

  /* ---------------------------------------------------------------- rig
     The reference is a tidy man, not a wreck: the jacket is buttoned, the
     tie is up, the hair is heavy and dark but it is off his face. He only
     looks tired, which is a different thing from looking beaten.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.higuruma) return r;
    var head = r.head, spine = r.spine;
    var hair = 0x1d1a18, hairD = 0x100d0c;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .82 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the hair: thick, dark and swept back off the forehead, with the
       volume at the crown and a few pieces that got away at the front */
    var cap = box(1.06, .42, 1.08, hair); cap.position.set(0, .98, -.02); head.add(cap);
    var back = box(1.02, .66, .4, hairD); back.position.set(0, .66, -.52); head.add(back);
    for (s = -1; s <= 1; s += 2) {
      var sd = box(.18, .78, .92, s < 0 ? hair : hairD);
      sd.position.set(.49 * s, .66, -.06);
      head.add(sd);
    }
    /* swept back: each piece sits a little higher and further back than
       the one in front of it, which is what makes it read as combed
       rather than as a helmet */
    var SW = [[-.4, 1.14, .2], [-.22, 1.2, .1], [-.04, 1.22, .04],
              [.16, 1.2, .1], [.36, 1.14, .2]];
    for (i = 0; i < SW.length; i++) {
      var sw = box(.2, .3, .6, i % 2 ? hair : hairD);
      sw.position.set(SW[i][0], SW[i][1], SW[i][2] - .2);
      sw.rotation.x = -.34;
      sw.rotation.z = SW[i][0] * .4;
      head.add(sw);
    }
    /* the two at the front that did not stay put */
    for (i = 0; i < 2; i++) {
      var lo = box(.15, .46, .17, hairD);
      lo.position.set(-.3 + i * .5, 1.0, .34);
      lo.rotation.z = (i ? -.5 : .5);
      lo.rotation.x = -.2;
      head.add(lo);
    }
    /* sideburns, because the reference has them and they age him */
    for (s = -1; s <= 1; s += 2) {
      var sb = box(.11, .34, .2, hairD);
      sb.position.set(.46 * s, .5, .22);
      head.add(sb);
    }

    /* the eyes, open and level, with the shadows that are the only thing
       left of the old face */
    var eL = box(.17, .11, .05, 0xdfe4ea, true); eL.position.set(-.2, .56, .46); head.add(eL);
    var eR = box(.17, .11, .05, 0xdfe4ea, true); eR.position.set(.2, .56, .46); head.add(eR);
    var iL = box(.08, .09, .06, 0x2e2119, true); iL.position.set(-.2, .56, .48); head.add(iL);
    var iR = box(.08, .09, .06, 0x2e2119, true); iR.position.set(.2, .56, .48); head.add(iR);
    for (s = -1; s <= 1; s += 2) {
      var bag = box(.21, .06, .05, 0x9a7d68);
      bag.position.set(.2 * s, .46, .47);
      head.add(bag);
    }
    var brL = box(.22, .05, .05, hairD); brL.position.set(-.2, .7, .47); brL.rotation.z = .12; head.add(brL);
    var brR = box(.22, .05, .05, hairD); brR.position.set(.2, .7, .47); brR.rotation.z = -.12; head.add(brR);
    /* stubble along the jaw, and a flat mouth */
    var jaw = box(.68, .22, .7, 0xa88b72); jaw.position.set(0, .19, .04); head.add(jaw);
    var mouth = box(.26, .04, .05, 0x8a6a58); mouth.position.set(0, .3, .46); head.add(mouth);

    /* the suit, closed. A white shirt showing in a narrow V, a dark green
       tie down the middle of it, and both front panels buttoned across. */
    var shirt = box(.5, .95, .5, SHIRT); shirt.position.set(0, .74, .32); spine.add(shirt);
    var tie = box(.15, .72, .09, TIE); tie.position.set(.02, .56, .6); tie.rotation.z = .04; spine.add(tie);
    var knot = box(.18, .16, .13, 0x1c3d2d); knot.position.set(.03, .98, .6); spine.add(knot);
    for (s = -1; s <= 1; s += 2) {
      var col = box(.2, .26, .16, SHIRT);
      col.position.set(.2 * s, 1.04, .4);
      col.rotation.z = .26 * s;
      spine.add(col);
      /* the jacket front, closed over the shirt rather than hanging open */
      var frnt = box(.46, 1.36, .2, SUIT);
      frnt.position.set(.38 * s, .6, .34);
      frnt.rotation.z = -.05 * s;
      spine.add(frnt);
      /* and the lapel folded back off it */
      var rev = box(.19, .56, .21, SUIT_D);
      rev.position.set(.29 * s, .94, .36);
      rev.rotation.z = -.3 * s;
      spine.add(rev);
    }
    /* the single button that is done up */
    var btn = box(.08, .08, .06, 0x33333a); btn.position.set(.04, .36, .45); spine.add(btn);
    /* the pin on his lapel */
    var pin = box(.09, .09, .07, BRASS); pin.position.set(-.3, 1.0, .47); spine.add(pin);
    var backp = box(1.2, 1.36, .22, SUIT); backp.position.set(0, .62, -.34); spine.add(backp);
    var coll2 = box(.8, .3, .68, SUIT_D); coll2.position.set(0, 1.16, -.04); spine.add(coll2);
    var tail = box(1.1, .46, .52, SUIT); tail.position.set(0, -.1, -.06); spine.add(tail);
    return r;
  };

  CHARS.higuruma = {
    name: 'HIROMI HIGURUMA', sub: 'DEADLY SENTENCING',
    cfg: HIG_CFG, glow: '#d8a441',
    moves: [
      { key: 'LMB', lbl: 'Gavel Combo', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Contempt', cd: 'j1', max: JCD.j1 },
      { key: '2', lbl: 'Cross Examination', cd: 'j2', max: JCD.j2 },
      { key: '3', lbl: 'Bench Warrant', cd: 'j3', max: JCD.j3 },
      { key: '4', lbl: 'Handing Down', cd: 'j4', max: JCD.j4 },
      { key: 'R', lbl: 'Contempt of Court', cd: 'jr', max: JCD.jr }
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
     THE HAMMER
     One prop, and he never puts it down. The handle is not a box: it is a
     chain of short segments laid along a quadratic curve every frame, so
     it can be any length and can bow in any direction, which is what lets
     the same object be a gavel, a maul, a spear, a pile driver and a
     whip without a second model anywhere in the file.

       __len    how far the head is from his hand, in units
       __bend   how far the middle of the handle is pushed off the
                straight line between the two, as a vector
       __size   the head's scale: 1 is the gavel he carries, 3 is the one
                that puts somebody through a wall
     ================================================================== */
  var SEGS = 12;
  var UPV = new THREE.Vector3(0, 1, 0);

  function buildHammer() {
    var g = new THREE.Group();
    /* the head, as its own group so it can be scaled on its own */
    var head = new THREE.Group();
    part(head, 1.7, .76, .76, 0, 0, 0, OAK);
    part(head, 1.78, .16, .82, 0, .38, 0, OAK_D);
    part(head, 1.78, .16, .82, 0, -.38, 0, OAK_D);
    for (var i = -1; i <= 1; i += 2) {
      part(head, .17, .84, .84, .82 * i, 0, 0, BRASS);
      part(head, .07, .9, .9, .9 * i, 0, 0, BRASS_D);
    }
    g.add(head);
    g.__head = head;
    /* the handle */
    g.__seg = [];
    for (i = 0; i < SEGS; i++) {
      g.__seg.push(part(g, .19, 1, .19, 0, 0, 0, i % 2 ? OAK_D : 0x5c3d24));
    }
    g.__grip = part(g, .27, .34, .27, 0, .1, 0, BRASS_D);
    g.__len = 2.3;
    g.__size = 1;
    g.__bend = new THREE.Vector3();
    layHammer(g);
    return g;
  }
  HG.buildHammer = buildHammer;

  /* Lay the segments along the curve from the hand at the origin to the
     head at __len, bowed through __bend. Called every frame that anything
     about the hammer is moving. */
  var _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3();
  var _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _d = new THREE.Vector3();
  var _q = new THREE.Quaternion();
  function curveAt(out, u, len, bend) {
    var iu = 1 - u, w = 2 * iu * u;
    /* quadratic bezier: hand, the bowed middle, the head */
    out.set(w * (bend.x), iu * iu * 0 + w * (len * .5 + bend.y) + u * u * len, w * (bend.z));
    return out;
  }
  function layHammer(g) {
    var len = g.__len, bend = g.__bend, n = g.__seg.length;
    curveAt(_p0, 0, len, bend);
    for (var i = 0; i < n; i++) {
      curveAt(_p1, (i + 1) / n, len, bend);
      var seg = g.__seg[i];
      _d.copy(_p1).sub(_p0);
      var d = _d.length() || .001;
      seg.position.copy(_p0).addScaledVector(_d, .5);
      seg.scale.set(1, d * 1.06, 1);
      _q.setFromUnitVectors(UPV, _d.divideScalar(d));
      seg.quaternion.copy(_q);
      _p0.copy(_p1);
    }
    /* the head rides the end of it, pointing along the last segment */
    g.__head.position.copy(_p1);
    g.__head.quaternion.copy(_q);
    g.__head.scale.setScalar(g.__size);
    g.__grip.scale.setScalar(Math.min(1.4, .8 + g.__size * .2));
  }
  HG.layHammer = layHammer;

  /* where the head has got to, in the world */
  function headAt(g) {
    if (!g) return player.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
    g.updateWorldMatrix(true, true);
    return g.__head.getWorldPosition(new THREE.Vector3());
  }
  HG.headAt = headAt;

  /* He carries it. It is on the hand for the ordinary combo as much as
     for any technique, which is the whole idea — his punch IS the gavel,
     so M1 to M4 need no special case anywhere. */
  function carried() {
    if (player.char !== 'higuruma') return null;
    var r = player.rig;
    if (!r || !r.handR) return null;
    var h = HG.hammer;
    if (h && h.parent === r.handR) return h;
    if (h) drop(h);
    h = HG.hammer = keep(buildHammer());
    h.rotation.set(Math.PI, 0, 0);     // hangs down out of the fist
    h.position.set(0, -.1, 0);
    r.handR.add(h);
    return h;
  }
  HG.carried = carried;

  /* reset it to the gavel he walks around with */
  function stow(h, secs) {
    if (!h) return;
    var t = 0, l0 = h.__len, s0 = h.__size, b0 = h.__bend.clone();
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !h.parent) return false;
      var k = Math.min(1, t / (secs || .3)), e2 = E.out(k);
      h.__len = l0 + (2.3 - l0) * e2;
      h.__size = s0 + (1 - s0) * e2;
      h.__bend.lerpVectors(b0, new THREE.Vector3(), e2);
      h.rotation.x = Math.PI;
      layHammer(h);
      return k < 1;
    } });
  }

  /* the impact a wooden head makes: splinters, brass, and the one yellow */
  function knock(at, dir, power) {
    power = power || 1;
    FX.impact(at.clone(), GOLD_L, 1.4 * power);
    FX.ring(at.clone(), GOLD, { maxR: 3.4 * power, life: .24, ground: false, axis: dir });
    FX.cross(at.clone(), GOLD_L, 2.2 * power, .18);
    FX.debris(new THREE.Vector3(at.x, Math.max(.1, at.y - 1.6), at.z), Math.round(4 * power), 9 * power, OAK_D);
    try { sfx.punch(); } catch (e) {}
  }
  HG.knock = knock;

  /* the wind off a swing that big: flat streaks thrown along the arc */
  function wind(at, dir, n, span) {
    var side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (var i = 0; i < (n || 7); i++) {
      var k = i / ((n || 7) - 1) - .5;
      var from = at.clone().addScaledVector(side, k * (span || 9)).add(
        new THREE.Vector3(0, (Math.random() - .5) * 2.4, 0));
      var to = from.clone().addScaledVector(dir, 5 + Math.random() * 7);
      FX.cutLine(from, to, i % 2 ? GOLD : GOLD_L, .28 + Math.random() * .3, .2 + Math.random() * .16);
    }
    FX.speedRing(at.clone(), GOLD, 11, .22);
  }
  HG.wind = wind;

  /* a drag mark left on the floor by something heavy going across it */
  function trace(from, to) {
    FX.cutLine(new THREE.Vector3(from.x, .08, from.z), new THREE.Vector3(to.x, .08, to.z),
      OAK_D, 1.1, 1.6);
    FX.cracks(new THREE.Vector3(to.x, .05, to.z), 6, 9, 0x4a4238);
    FX.dust(new THREE.Vector3((from.x + to.x) / 2, 0, (from.z + to.z) / 2), 5, 0xcdc4b2, 8, 3);
  }
  HG.trace = trace;

  /* =====================================================================
     SHARED PIECES
     ================================================================== */

  /* the seal a head leaves on the floor where it landed */
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

  /* the nearest body in front of him */
  function front(range, cone) {
    var d = aim(), best = null, near = range || 20;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead) continue;
      var to = e.pos.clone().sub(player.pos); to.y = 0;
      var dist = to.length();
      if (dist < .3 || dist > near) continue;
      if (to.normalize().dot(d) < (cone == null ? .1 : cone)) continue;
      near = dist; best = e;
    }
    return best;
  }

  /* Hold a body somewhere for a moment — used by everything that picks
     somebody up rather than knocking them away. */
  function pin(e, at, face) {
    if (!e || e.dead) return;
    e.lockT = .15;
    e.stunT = Math.max(e.stunT || 0, .3);
    e.pos.copy(at);
    e.vel.set(0, 0, 0);
    if (face) e.facing = Math.atan2(-face.x, -face.z);
  }

  /* The pose a body makes when something that size goes through it: both
     arms thrown up, the head back, the whole thing folding away from the
     hit. It is held for a beat and then the ragdoll takes over. */
  function struck(e, dir, secs) {
    if (!e || !e.rig) return;
    var t = 0, life = secs || .42;
    var side = dir.x < 0 ? -1 : 1;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !e || e.dead || !e.rig) return false;
      if (e.rag) return false;                       // the ragdoll has it now
      var k = Math.min(1, t / .08), out = 1 - Math.max(0, (t - life * .6) / (life * .4));
      var f = k * Math.max(0, out);
      var r = e.rig;
      r.shoulderL.rotation.set(-2.5 * f, 0, 1.0 * f);
      r.shoulderR.rotation.set(-2.5 * f, 0, -1.0 * f);
      r.elbowL.rotation.x = -.7 * f;
      r.elbowR.rotation.x = -.7 * f;
      r.spine.rotation.set(-.6 * f, 0, .5 * side * f);
      r.neck.rotation.x = -.7 * f;
      r.hipL.rotation.x = .5 * f; r.kneeL.rotation.x = -.7 * f;
      r.hipR.rotation.x = .2 * f; r.kneeR.rotation.x = -.4 * f;
      r.hips.position.y = r.hipsBaseY - .3 * f;
      return t < life;
    } });
  }
  HG.struck = struck;

  /* Sent along the floor rather than through the air: they keep the
     ground, turning over as they go, and throw up dust the whole way. */
  function roll(e, dir, dist, spin) {
    if (!e || e.dead) return;
    var t = 0, life = .85, from = e.pos.clone();
    var to = from.clone().addScaledVector(dir, dist);
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined' || !e || e.dead) return false;
      var k = Math.min(1, t / life), e2 = E.out(k);
      e.pos.lerpVectors(from, to, e2);
      e.pos.y = Math.abs(Math.sin(k * 9)) * .5;
      collideWorld(e.pos, .9);
      e.vel.set(0, 0, 0);
      e.lockT = .1;
      if (e.rig) {
        e.rig.root.position.copy(e.pos);
        e.rig.body.rotation.x = t * (spin == null ? 15 : spin);
      }
      if (Math.random() < dt * 40) {
        FX.dust(new THREE.Vector3(e.pos.x, 0, e.pos.z), 2, 0xcdc4b2, 4, 2);
      }
      if (k >= 1) { if (e.rig) e.rig.body.rotation.x = 0; return false; }
      return true;
    } });
  }
  HG.roll = roll;

  /* =====================================================================
     1 · CONTEMPT  侮辱
     Thrown straight, and it holds whoever it reaches. Press it again
     while that hold is up and he closes the distance himself, brings the
     head up to full size, and takes them across the ribs with it.
     ================================================================== */
  var C1 = { throwDmg: 7, swingDmg: 5, speed: 52, reach: 34, hold: 3.2, radius: 2.6 };

  function held() {
    var best = null, near = 1e9;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || !(e.__contempt > 0)) continue;
      var d = e.pos.distanceTo(player.pos);
      if (d < near) { near = d; best = e; }
    }
    return best;
  }

  /* a loose hammer in the air, on its way somewhere */
  function flying(from, dir, opt) {
    opt = opt || {};
    var g = keep(buildHammer());
    g.__size = opt.size || .8;
    g.__len = opt.len || 1.8;
    layHammer(g);
    g.position.copy(from);
    scene.add(g);
    var t = 0, done = false, spin = opt.spin == null ? 22 : opt.spin;
    var speed = opt.speed || C1.speed, reach = opt.reach || C1.reach;
    addFx({ t: 1e9, update: function (dt) {
      t += dt;
      if (typeof scene === 'undefined') return false;
      g.position.addScaledVector(dir, speed * dt);
      g.rotation.x += dt * spin;
      g.rotation.y = Math.atan2(dir.x, dir.z);
      if (Math.random() < dt * 18) FX.mote(g.position.clone(), BRASS, .8, .16);
      var hitE = opt.ghost ? null : enemiesNear(g.position.clone(), opt.radius || C1.radius)[0];
      if (!done && (hitE || t * speed > reach)) {
        done = true;
        if (hitE && opt.onHit) opt.onHit(hitE, g.position.clone());
        else knock(g.position.clone(), dir, .7);
        drop(g);
        return false;
      }
      return true;
    } });
    return g;
  }

  function castContempt() {
    /* the follow-up is free: it is the same press, and it is only there
       while somebody is still holding the hold */
    var mark = held();
    if (mark && !busy() && player.char === 'higuruma' && !player.dead && !player.react) {
      var a2 = player.action = { type: 'j1b', t: 0, dur: 1.05, stage: 0, tgt: mark, dir: aim() };
      mark.__contempt = 0;
      player.iframes = Math.max(player.iframes, .6);
      try { sfx.whoosh(); } catch (e) {}
      return a2;
    }
    if (!ready('j1')) return;
    var a = start('j1', .72, 'j1', 'CONTEMPT', '侮辱');
    a.dir = aim();
    try { sfx.whoosh(); } catch (e) {}
  }

  function stepContempt(a, dt) {
    var p = player, d = a.dir;
    p.vel.x *= .8; p.vel.z *= .8;
    var h = carried();
    if (a.stage < 1 && a.t > .26) {
      a.stage = 1;
      if (h) h.visible = false;                       // it leaves his hand
      /* from his shoulder, not from the head: the gavel hangs BELOW the
         fist, so throwing from where it hangs sent it along the floor
         under everybody */
      var from = p.pos.clone().addScaledVector(d, 1.6).add(new THREE.Vector3(0, 2.8, 0));
      FX.speedRing(from.clone(), BRASS, 7, .2);
      try { sfx.punch(); } catch (e) {}
      flying(from, d.clone(), {
        onHit: function (e, at) {
          knock(at, d, 1);
          /* held, not hurt: this is the charge, and the sentence is the
             second press */
          rule(e, C1.throwDmg, d.clone().multiplyScalar(4).setY(3),
            { react: 'gut', reactDur: .5, stun: 1.1, spark: GOLD });
          e.__contempt = C1.hold;
          e.stunT = Math.max(e.stunT || 0, 1.1);
          FX.rings(e.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), GOLD, 2,
            { maxR: 6, life: .4, ground: false, gap: 34 });
          stamp(e.pos.clone(), 4);
        }
      });
    }
    if (a.stage < 2 && a.t > a.dur - .18) {
      a.stage = 2;
      if (h) { h.visible = true; stow(h, .2); }       // and comes back
    }
  }

  /* the second press: he goes to them */
  function stepContemptSwing(a, dt) {
    var p = player, e = a.tgt;
    var h = carried();
    if (!e || e.dead) { p.vel.x *= .8; p.vel.z *= .8; if (h) stow(h, .2); return; }
    var to = e.pos.clone().sub(p.pos); to.y = 0;
    a.dir.copy(to.lengthSq() > .01 ? to.clone().normalize() : a.dir);
    if (a.stage < 1) {
      a.stage = 1;
      FX.mangaLines(.5, .3);
    }
    /* close the gap in the first third, and arrive facing them */
    if (a.t < .3) {
      var want = e.pos.clone().addScaledVector(a.dir, -3.2);
      p.pos.lerp(want, Math.min(1, dt * 14));
      collideWorld(p.pos, .95);
      p.facing = Math.atan2(a.dir.x, a.dir.z);
      p.vel.set(0, 0, 0);
      if (Math.random() < dt * 40) ghostAfterimage(p.rig, BRASS, .18);
      e.lockT = .1;
      /* and it grows on the way in */
      if (h) {
        h.__size = 1 + 2 * E.out(a.t / .3);
        h.__len = 2.3 + 1.5 * E.out(a.t / .3);
        layHammer(h);
      }
      return;
    }
    p.vel.x *= .7; p.vel.z *= .7;
    if (a.stage < 2 && a.t > .48) {
      a.stage = 2;
      var side = new THREE.Vector3(-a.dir.z, 0, a.dir.x).normalize();
      var at = e.pos.clone().add(new THREE.Vector3(0, 2.6, 0));
      /* the swing: wind along the arc, and the one yellow at the end */
      wind(at.clone(), side.clone().negate(), 9, 11);
      FX.flash('#ffe7a0', .45, .22);
      knock(at, side, 2.2);
      FX.rings(at.clone(), GOLD, 3, { maxR: 11, life: .5, ground: false, axis: side, gap: 32 });
      FX.cross(at.clone(), GOLD_L, 5, .24);
      FX.mangaLines(.9, .3);
      addShake(3.2);
      if (typeof hitstop === 'function') hitstop(.16);
      try { sfx.redBoom(); } catch (er) {}
      /* everything the head went through, not only the one he came for */
      var kb = side.clone().negate().multiplyScalar(10); kb.y = 4;
      enemiesNear(at.clone(), 6.5).forEach(function (o) {
        if (!o || o.dead) return;
        rule(o, C1.swingDmg, kb.clone(), { react: 'blow', reactDur: .7, stun: .7, spark: GOLD });
        struck(o, side.clone().negate(), .45);
        roll(o, side.clone().negate(), 15, 16);
        FX.blood(o.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), side.clone().negate(), 10, 1.8);
      });
      stamp(e.pos.clone(), 7);
    }
    if (a.stage < 3 && a.t > a.dur - .3) {
      a.stage = 3;
      if (h) stow(h, .28);                            // and it is a gavel again
    }
  }

  /* =====================================================================
     2 · CROSS EXAMINATION  尋問
     The butt of the handle, over and over, faster than it can be
     answered — and then the head comes round, they go up onto it, and he
     carries them to wherever he was going before putting them down hard.
     ================================================================== */
  var C2 = { stab: 1.2, stabs: 6, smash: 5, reach: 5.2 };

  function castCross() {
    if (!ready('j2')) return;
    var a = start('j2', 2.35, 'j2', 'CROSS EXAMINATION', '尋問');
    a.dir = aim();
    a.n = 0;
    a.tgt = front(C2.reach + 2, .1);
    player.iframes = Math.max(player.iframes, .8);
    try { sfx.whoosh(); } catch (e) {}
  }

  function stepCross(a, dt) {
    var p = player, d = a.dir;
    var h = carried();
    /* ---- the stabs: the handle goes out and comes back, six times ---- */
    if (a.t < .95) {
      p.vel.x *= .82; p.vel.z *= .82;
      if (a.stage < 1) { a.stage = 1; if (h) { h.rotation.x = 0; h.__size = .8; } }
      var beat = .95 / C2.stabs;
      if (a.n < C2.stabs && a.t > .1 + a.n * beat) {
        a.n++;
        ghostAfterimage(p.rig, PAPER, .2);
        if (h) {
          /* the handle punches out on each one and springs back */
          h.__len = 5.6;
          h.__bend.set((Math.random() - .5) * .5, 0, 0);
          layHammer(h);
          later(60, function () { if (h.parent) { h.__len = 2.6; h.__bend.set(0, 0, 0); layHammer(h); } });
        }
        var at = p.pos.clone().addScaledVector(d, 4).add(
          new THREE.Vector3(0, 2.4 + (a.n % 2) * .5, 0));
        FX.cutLine(p.pos.clone().add(new THREE.Vector3(0, 2.6, 0)), at.clone(), PAPER, .5, .12);
        FX.impact(at.clone(), GOLD_L, 1.1);
        try { sfx.punch(); } catch (e) {}
        addShake(.3);
        enemiesNear(at.clone(), 3).forEach(function (e) {
          rule(e, C2.stab, d.clone().multiplyScalar(2).setY(1),
            { react: 'gut', reactDur: .22, stun: .3, spark: PAPER, mark: a.n >= C2.stabs });
          a.tgt = a.tgt || e;
        });
      }
      return;
    }
    /* ---- the turn: the head comes round and they go up onto it ---- */
    if (a.stage < 2) {
      a.stage = 2;
      if (h) { h.__size = 2.4; h.__len = 4.6; layHammer(h); }
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var at2 = p.pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.6, 0));
      wind(at2.clone(), d.clone(), 7, 8);
      knock(at2, d, 1.6);
      addShake(2);
      if (typeof hitstop === 'function') hitstop(.1);
      try { sfx.redBoom(); } catch (e) {}
      var got = enemiesNear(at2.clone(), 5.5);
      if (got.length) a.ride = got;
      got.forEach(function (e) {
        rule(e, C2.stab, null, { react: 'blow', reactDur: .5, stun: 1.4, spark: GOLD });
        struck(e, d, .5);
      });
    }
    /* ---- the carry: they stay on the head while he walks it forward -- */
    if (a.t < 2.0) {
      p.vel.x = d.x * 9; p.vel.z = d.z * 9;
      if (h) {
        h.rotation.x = -1.2 + Math.sin(a.t * 9) * .3;
        h.rotation.z = (a.t - .95) * 5;
        layHammer(h);
      }
      var hp = headAt(h);
      if (a.ride) a.ride.forEach(function (e) {
        if (!e || e.dead) return;
        pin(e, hp.clone().add(new THREE.Vector3(0, 1.4, 0)), d);
        if (Math.random() < dt * 24) FX.mote(hp.clone(), GOLD, 1.1, .16);
      });
      if (Math.random() < dt * 26) FX.dust(new THREE.Vector3(p.pos.x, 0, p.pos.z), 2, 0xcdc4b2, 5, 2);
      return;
    }
    /* ---- and down ---- */
    p.vel.x *= .6; p.vel.z *= .6;
    if (a.stage < 3) {
      a.stage = 3;
      if (h) { h.rotation.x = 1.4; h.rotation.z = 0; layHammer(h); }
      var floor = p.pos.clone().addScaledVector(d, 4.4);
      FX.flash('#ffe7a0', .5, .24);
      knock(floor.clone().add(new THREE.Vector3(0, .6, 0)), d, 2.6);
      FX.rings(new THREE.Vector3(floor.x, .12, floor.z), GOLD, 4, { maxR: 13, life: .6, gap: 32 });
      FX.cracks(new THREE.Vector3(floor.x, .05, floor.z), 16, 20, 0x4a4238);
      FX.dust(new THREE.Vector3(floor.x, 0, floor.z), 12, 0xcdc4b2, 15, 5);
      stamp(floor, 8);
      addShake(4);
      if (typeof hitstop === 'function') hitstop(.2);
      try { sfx.redBoom(); } catch (e) {}
      if (a.ride) a.ride.forEach(function (e) {
        if (!e || e.dead) return;
        e.lockT = 0;
        e.pos.copy(floor); e.pos.y = 0;
        rule(e, C2.smash, new THREE.Vector3(0, -20, 0),
          { react: 'blow', reactDur: .9, stun: 1, spark: GOLD, death: 'flat' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), d, 14, 2.2);
      });
      a.ride = null;
    }
    if (a.stage < 4 && a.t > a.dur - .22) { a.stage = 4; if (h) stow(h, .24); }
  }

  /* =====================================================================
     3 · BENCH WARRANT  勾引状
     A knee to bring them in, and then he does not stop: three on the
     floor wherever he happens to be standing, and then the long one.

     If the shared fourth hit already put them on the floor, this is a
     different move — he does not need to bring them in, so he takes
     their feet instead and they go a very long way.
     ================================================================== */
  /* The floor hits are worth more than they look because the knee seals
     them first — and the chain only pays at all if the knee connects. */
  var C3 = { knee: 4, floor: 3, last: 5, sweep: 14, run: 15 };

  function downed() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e || e.dead || !e.bcFall) continue;
      if (e.bcFall.variant !== 'down') continue;
      if (e.pos.distanceTo(player.pos) > 12) continue;
      return e;
    }
    return null;
  }

  function castWarrant() {
    if (!ready('j3')) return;
    /* the variant, off the downslam */
    var flat = downed();
    if (flat) {
      var av = start('j3sweep', 1.1, 'j3', 'BENCH WARRANT', '勾引状');
      av.dir = aim();
      av.tgt = flat;
      player.iframes = Math.max(player.iframes, .5);
      try { sfx.whoosh(); } catch (e) {}
      return;
    }
    var a = start('j3', 2.5, 'j3', 'BENCH WARRANT', '勾引状');
    a.dir = aim();
    a.n = 0;
    player.iframes = Math.max(player.iframes, .7);
    try { sfx.whoosh(); } catch (e) {}
  }

  /* turn the run toward whoever he knocked over, and stop short of
     running through them */
  function chase(a, dt) {
    var e = a.tgt;
    if (!e || e.dead) return 1;
    var to = e.pos.clone().sub(player.pos); to.y = 0;
    var far = to.length();
    if (far < .5) return 0;
    a.dir.lerp(to.normalize(), Math.min(1, dt * 7)).normalize();
    player.facing = Math.atan2(a.dir.x, a.dir.z);
    /* It returns a speed rather than damping the velocity itself: the
       caller sets the run speed on the line after this one, so anything
       done to p.vel in here is overwritten before it is ever applied. */
    return far < 4 ? Math.max(0, (far - 1.6) / 2.4) : 1;
  }

  function stepWarrant(a, dt) {
    var p = player, d = a.dir;
    var h = carried();
    /* ---- the hop, and the knee ---- */
    if (a.t < .38) {
      p.vel.x = d.x * 26; p.vel.z = d.z * 26;
      if (a.t < .18) p.vel.y = Math.max(p.vel.y, 7);
      if (a.stage < 1 && a.t > .14) {
        a.stage = 1;
        var at = p.pos.clone().addScaledVector(d, 2.4).add(new THREE.Vector3(0, 2.2, 0));
        FX.speedRing(at.clone(), GOLD, 8, .2);
        enemiesNear(at.clone(), 4).forEach(function (e) {
          knock(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d, 1.2);
          /* a short shove, not a launch: the rest of the move is him
             running them down, and they cannot be run down from orbit */
          rule(e, C3.knee, d.clone().multiplyScalar(3).setY(4),
            { react: 'gut', reactDur: .6, stun: 1.6, spark: GOLD });
          a.got = true;
          a.tgt = a.tgt || e;
        });
        if (a.got) { addShake(1.4); if (typeof hitstop === 'function') hitstop(.08); }
      }
      return;
    }
    /* ---- the run, and three on the floor wherever he is ---- */
    if (a.t < 1.72) {
      /* he is running them DOWN, so the run steers: without this he
         sprints forty units in a straight line past a body that has not
         moved, and the three on the floor land on nothing */
      var sp = chase(a, dt);
      d = a.dir;
      p.vel.x = d.x * C3.run * sp; p.vel.z = d.z * C3.run * sp;
      if (Math.random() < dt * 30) ghostAfterimage(p.rig, BRASS, .16);
      var beat = [.62, 1.0, 1.38];
      if (a.n < 3 && a.t > beat[a.n]) {
        a.n++;
        if (h) { h.rotation.x = 1.5; h.__size = 1.8; h.__len = 3.4; layHammer(h); }
        /* wherever he happens to be — but if he is chasing somebody, the
             hammer goes where they are rather than where he is pointing */
        var floor = (a.tgt && !a.tgt.dead && a.tgt.pos.distanceTo(p.pos) < 11)
          ? a.tgt.pos.clone() : p.pos.clone().addScaledVector(d, 2.6);
        floor.y = 0;
        knock(floor.clone().add(new THREE.Vector3(0, .5, 0)), d, 1.4);
        FX.rings(new THREE.Vector3(floor.x, .12, floor.z), GOLD, 2, { maxR: 8, life: .45, gap: 30 });
        FX.cracks(new THREE.Vector3(floor.x, .05, floor.z), 9, 12, 0x4a4238);
        FX.dust(new THREE.Vector3(floor.x, 0, floor.z), 6, 0xcdc4b2, 9, 3);
        stamp(floor, 5);
        addShake(1.6);
        try { sfx.redBoom(); } catch (e) {}
        enemiesNear(floor.clone().add(new THREE.Vector3(0, 1.6, 0)), 6).forEach(function (e) {
          rule(e, C3.floor, d.clone().multiplyScalar(5).setY(8),
            { react: 'stagger', reactDur: .5, stun: .5, spark: GOLD });
        });
        later(90, function () { if (h && h.parent) { h.rotation.x = Math.PI; layHammer(h); } });
      }
      return;
    }
    /* ---- the long one: he leaves the ground turning over sideways ---- */
    if (a.t < 2.24) {
      if (a.stage < 2) {
        a.stage = 2;
        p.vel.y = 15;
        FX.mangaLines(.8, .4);
        if (h) { h.__size = 2.6; h.__len = 4.2; layHammer(h); }
      }
      var lsp = chase(a, dt);
      d = a.dir;
      p.vel.x = d.x * 30 * lsp; p.vel.z = d.z * 30 * lsp;
      /* the body itself turns over flat, which is the shape of the shot */
      var k = (a.t - 1.72) / .52;
      p.visYaw = k * TAU;
      if (p.rig) p.rig.body.rotation.z = Math.sin(k * Math.PI) * 1.5;
      if (Math.random() < dt * 50) ghostAfterimage(p.rig, GOLD, .2);
      return;
    }
    p.vel.x *= .5; p.vel.z *= .5;
    if (p.rig) p.rig.body.rotation.z = 0;
    p.visYaw = 0;
    if (a.stage < 3) {
      a.stage = 3;
      if (h) { h.rotation.x = 1.5; layHammer(h); }
      var land = (a.tgt && !a.tgt.dead && a.tgt.pos.distanceTo(p.pos) < 13)
        ? a.tgt.pos.clone() : p.pos.clone().addScaledVector(d, 2.2);
      land.y = 0;
      FX.flash('#ffe7a0', .6, .28);
      knock(land.clone().add(new THREE.Vector3(0, .6, 0)), d, 3);
      FX.rings(new THREE.Vector3(land.x, .12, land.z), GOLD, 5, { maxR: 20, life: .8, gap: 30 });
      FX.cracks(new THREE.Vector3(land.x, .05, land.z), 24, 30, 0x4a4238);
      FX.debris(new THREE.Vector3(land.x, .1, land.z), 16, 18, OAK_D);
      FX.dust(new THREE.Vector3(land.x, 0, land.z), 16, 0xcdc4b2, 20, 6);
      FX.mangaLines(1, .34);
      stamp(land, 11);
      addShake(5);
      if (typeof hitstop === 'function') hitstop(.24);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(land.clone().add(new THREE.Vector3(0, 1.8, 0)), 10).forEach(function (e) {
        var kb = e.pos.clone().sub(land).setY(0);
        if (kb.lengthSq() < .01) kb.copy(d);
        kb.normalize().multiplyScalar(22); kb.y = 15;
        rule(e, C3.last, kb, { react: 'blow', reactDur: .9, stun: .9, spark: GOLD });
      });
    }
    if (a.stage < 4 && a.t > a.dur - .2) { a.stage = 4; if (h) stow(h, .24); }
  }

  /* the variant: they are already on the floor, so he takes their feet */
  function stepSweep(a, dt) {
    var p = player, d = a.dir, e = a.tgt;
    var h = carried();
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1 && a.t > .26) {
      a.stage = 1;
      if (h) { h.rotation.x = -1.57; h.__size = 2; h.__len = 5.4; layHammer(h); }
      var side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var low = p.pos.clone().addScaledVector(d, 3.4); low.y = .5;
      /* along the floor rather than down onto it */
      wind(low.clone(), side.clone().negate(), 7, 10);
      FX.cutLine(low.clone().addScaledVector(side, 5), low.clone().addScaledVector(side, -5),
        GOLD_L, 1.2, .3);
      knock(low, side, 1.8);
      FX.dust(new THREE.Vector3(low.x, 0, low.z), 10, 0xcdc4b2, 14, 4);
      addShake(2.4);
      if (typeof hitstop === 'function') hitstop(.14);
      try { sfx.redBoom(); } catch (er) {}
      var list = enemiesNear(low.clone(), 7.5);
      if (e && list.indexOf(e) < 0 && !e.dead) list.push(e);
      list.forEach(function (o) {
        if (!o || o.dead) return;
        rule(o, C3.sweep, null, { react: 'blow', reactDur: .8, stun: 1.1, spark: GOLD, death: 'flat' });
        /* and they keep the floor for a very long way */
        roll(o, d.clone(), 34, 9);
        var from = o.pos.clone();
        later(120, function () { trace(from, o.pos.clone()); });
      });
    }
    if (a.stage < 2 && a.t > a.dur - .22) { a.stage = 2; if (h) stow(h, .22); }
  }

  /* =====================================================================
     4 · HANDING DOWN  宣告
     The handle goes out as far as it needs to and the head comes down on
     top of them. Press it again and it does NOT come back: he takes it
     in both hands and the floor gets whipped with it, and where a whip
     that size lands is not somewhere anybody chose.
     ================================================================== */
  var C4 = { drop: 14, whip: 3, whips: 5, maxLen: 26, window: 2.6 };

  function castHanding() {
    /* the follow-up, while the handle is still out */
    if (HG.longT > 0 && !busy() && player.char === 'higuruma' && !player.dead && !player.react) {
      HG.longT = 0;
      var a2 = player.action = { type: 'j4whip', t: 0, dur: 1.7, stage: 0, n: 0, dir: aim() };
      player.iframes = Math.max(player.iframes, .4);
      try { sfx.whoosh(); } catch (e) {}
      return a2;
    }
    if (!ready('j4')) return;
    var a = start('j4', 1.15, 'j4', 'HANDING DOWN', '宣告');
    a.dir = aim();
    var t = front(C4.maxLen, .05);
    a.at = t ? t.pos.clone() : player.pos.clone().addScaledVector(a.dir, 9);
    a.tgt = t;
    player.iframes = Math.max(player.iframes, .6);
    try { sfx.raise(); } catch (e) {}
  }

  function stepHanding(a, dt) {
    var p = player, d = a.dir;
    var h = carried();
    p.vel.x *= .78; p.vel.z *= .78;
    /* it keeps following them while it is still going up */
    if (a.tgt && !a.tgt.dead && a.t < .45) a.at.copy(a.tgt.pos);
    var reach = Math.min(C4.maxLen, Math.max(6, a.at.distanceTo(p.pos) + 3));
    if (a.stage < 1) {
      a.stage = 1;
      if (h) h.rotation.x = 0;                        // straight up over his head
      FX.mangaLines(.4, .3);
    }
    /* ---- it grows ---- */
    if (a.t < .5) {
      if (h) {
        var k = E.out(a.t / .5);
        h.__len = 2.3 + (reach - 2.3) * k;
        h.__size = 1 + 1.8 * k;
        /* a long handle does not stay straight while it is being raised */
        h.__bend.set(Math.sin(a.t * 14) * .9 * k, 0, Math.cos(a.t * 11) * .6 * k);
        layHammer(h);
        if (Math.random() < dt * 30) FX.mote(headAt(h), BRASS, 1.4, .2);
      }
      return;
    }
    /* ---- and comes down ---- */
    if (a.stage < 2 && a.t > .62) {
      a.stage = 2;
      if (h) {
        /* the head is thrown over onto the target: the handle bows the
           other way as it goes, which is the whole read on an elastic one */
        h.rotation.x = 1.9;
        h.__bend.set(0, 0, -2.2);
        layHammer(h);
      }
      var at = a.at.clone(); at.y = 0;
      FX.flash('#ffe7a0', .6, .28);
      knock(at.clone().add(new THREE.Vector3(0, 1.4, 0)), d, 3);
      FX.rings(new THREE.Vector3(at.x, .12, at.z), GOLD, 5, { maxR: 17, life: .75, gap: 30 });
      FX.cracks(new THREE.Vector3(at.x, .05, at.z), 22, 26, 0x4a4238);
      FX.debris(new THREE.Vector3(at.x, .1, at.z), 14, 16, OAK_D);
      FX.dust(new THREE.Vector3(at.x, 0, at.z), 14, 0xcdc4b2, 18, 5);
      FX.mangaLines(.9, .32);
      stamp(at, 10);
      addShake(4.4);
      if (typeof hitstop === 'function') hitstop(.22);
      try { sfx.redBoom(); } catch (e) {}
      enemiesNear(at.clone().add(new THREE.Vector3(0, 2, 0)), 8).forEach(function (e) {
        rule(e, C4.drop, new THREE.Vector3(0, -18, 0),
          { react: 'blow', reactDur: .9, stun: 1, spark: GOLD, death: 'flat' });
        FX.blood(e.pos.clone().add(new THREE.Vector3(0, 2.4, 0)), d, 12, 2);
      });
    }
    /* ---- and it stays out, for as long as he is quick about it ---- */
    if (a.stage < 3 && a.t > a.dur - .2) {
      a.stage = 3;
      HG.longT = C4.window;
      if (window.JJNOTICE) window.JJNOTICE('4 AGAIN — IT IS STILL OUT', '#ffc83c');
    }
  }

  function stepWhip(a, dt) {
    var p = player, h = carried();
    p.vel.x *= .8; p.vel.z *= .8;
    if (a.stage < 1) {
      a.stage = 1;
      if (h) { h.__len = 17; h.__size = 2; h.rotation.x = 1.3; layHammer(h); }
      FX.mangaLines(.6, .5);
    }
    /* Five of them, and the direction of each is genuinely random —
       nobody, including him, knows where a whip that long is going. */
    var beat = 1.5 / C4.whips;
    if (a.n < C4.whips && a.t > .12 + a.n * beat) {
      a.n++;
      var ang = Math.random() * TAU;
      var dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
      var far = 10 + Math.random() * 11;
      var from = p.pos.clone().addScaledVector(dir, 3);
      var to = p.pos.clone().addScaledVector(dir, far);
      p.facing = ang;
      if (h) {
        h.rotation.x = 1.45;
        h.__len = far;
        /* it lashes, so it is bowed hard to one side and then the other */
        h.__bend.set((Math.random() - .5) * 9, 0, (Math.random() - .5) * 6);
        layHammer(h);
      }
      trace(from, to);
      wind(to.clone().add(new THREE.Vector3(0, 1, 0)), dir, 6, 8);
      knock(to.clone().add(new THREE.Vector3(0, .8, 0)), dir, 1.6);
      FX.rings(new THREE.Vector3(to.x, .12, to.z), GOLD, 2, { maxR: 9, life: .5, gap: 30 });
      FX.debris(new THREE.Vector3(to.x, .1, to.z), 8, 12, OAK_D);
      addShake(2);
      try { sfx.redBoom(); } catch (e) {}
      /* everything along the line it dragged through, not only the end */
      for (var q = 3; q < far; q += 4) {
        enemiesNear(p.pos.clone().addScaledVector(dir, q).add(new THREE.Vector3(0, 1.4, 0)), 4.6)
          .forEach(function (e) {
            if (!e || e.dead || (a.hit = a.hit || []).indexOf(e) >= 0) return;
            a.hit.push(e);
            var kb = dir.clone().multiplyScalar(20); kb.y = 9;
            rule(e, C4.whip, kb, { react: 'blow', reactDur: .7, stun: .7, spark: GOLD });
            roll(e, dir.clone(), 12, 12);
          });
      }
    }
    if (a.stage < 2 && a.t > a.dur - .28) { a.stage = 2; if (h) stow(h, .32); }
  }

  /* =====================================================================
     R · CONTEMPT OF COURT  法廷侮辱
     One after another after another, as fast as he can get rid of them,
     and he can be pointing anywhere while he does it.
     ================================================================== */
  var CR = { each: 2, n: 13, gap: .125, speed: 64 };

  function castCourt() {
    if (!ready('jr')) return;
    var a = start('jr', 2.4, 'jr', 'CONTEMPT OF COURT', '法廷侮辱');
    a.n = 0;
    a.dir = aim();
    player.iframes = Math.max(player.iframes, .9);
    try { sfx.raise(); } catch (e) {}
  }

  function stepCourt(a, dt) {
    var p = player, h = carried();
    p.vel.x *= .86; p.vel.z *= .86;
    /* he can keep turning the whole time: this reads the camera every
       frame rather than the direction he started in */
    var d = camForward(); d.y = 0;
    if (d.lengthSq() < .01) d.copy(a.dir); else d.normalize();
    a.dir.copy(d);
    p.facing = Math.atan2(d.x, d.z);
    if (a.stage < 1) {
      a.stage = 1;
      if (h) { h.visible = false; }
      FX.mangaLines(.5, .6);
    }
    if (a.n < CR.n && a.t > .18 + a.n * CR.gap) {
      a.n++;
      var muzzle = p.pos.clone().addScaledVector(d, 2.2).add(
        new THREE.Vector3(0, 2.7 + Math.sin(a.n) * .3, 0));
      /* the smoke it goes out through */
      FX.dust(muzzle.clone(), 4, 0xd6cfc0, 3.4, 2.2);
      FX.mote(muzzle.clone(), BRASS, 1.2, .16);
      FX.speedRing(muzzle.clone(), GOLD, 6, .16);
      addShake(.5);
      try { sfx.punch(); } catch (e) {}
      var spread = new THREE.Vector3((Math.random() - .5) * .1, (Math.random() - .5) * .06,
        (Math.random() - .5) * .1);
      flying(muzzle, d.clone().add(spread).normalize(), {
        speed: CR.speed, reach: 40, size: .7, len: 1.5, spin: 34, radius: 2.8,
        onHit: function (e, at) {
          knock(at, d, .9);
          rule(e, CR.each, d.clone().multiplyScalar(5).setY(4),
            { react: a.n % 3 ? null : 'stagger', reactDur: .3, stun: .2, spark: GOLD,
              mark: false });
          if (a.n >= CR.n) sealOver(e);
          FX.blood(at.clone(), d, 4, 1);
        }
      });
    }
    if (a.stage < 2 && a.t > a.dur - .3) {
      a.stage = 2;
      if (h) { h.visible = true; stow(h, .26); }
    }
  }

  /* =====================================================================
     POSES
     He is holding something heavy in one hand at all times, so every one
     of these starts from the same place: weight on the back foot, the
     head low, and the hammer doing the travelling rather than him.
     ================================================================== */
  function poseHiguruma(r, a) {
    var t = a.t, out = E.out;
    switch (a.type) {
      case 'j1': {                     // over the shoulder, and away
        rp(r);
        var w = out(Math.min(1, t / .24));
        var go = t > .26 ? out(Math.min(1, (t - .26) / .12)) : 0;
        r.shoulderR.rotation.x = -.6 - 1.5 * w + 2.5 * go;
        r.shoulderR.rotation.z = -.5 * w + .5 * go;
        r.elbowR.rotation.x = -1.9 * w + 1.85 * go;
        r.shoulderL.rotation.x = -.3 * w + .6 * go;
        r.shoulderL.rotation.z = .4 * w - .5 * go;
        r.elbowL.rotation.x = -1.1 * w;
        r.spine.rotation.y = .6 * w - 1.0 * go;
        r.spine.rotation.x = -.14 * w + .28 * go;
        r.neck.rotation.y = -.3 * w + .5 * go;
        r.hipL.rotation.x = -.34 * w + .2 * go; r.kneeL.rotation.x = .62 * w;
        r.hipR.rotation.x = .24 * w - .3 * go; r.kneeR.rotation.x = .46 * w;
        r.hips.rotation.y = .28 * w - .44 * go;
        r.hips.position.y = r.hipsBaseY - .3 * w;
        return true;
      }
      case 'j1b': {                    // in, and across the ribs
        rp(r);
        var run = Math.min(1, t / .3);
        var load = t > .26 ? out(Math.min(1, (t - .26) / .2)) : 0;
        var sw = t > .48 ? out(Math.min(1, (t - .48) / .12)) : 0;
        /* leaning into the approach, then everything comes round at once */
        r.spine.rotation.y = -.2 * run + 1.25 * load - 2.3 * sw;
        r.spine.rotation.x = .22 * run - .2 * load + .34 * sw;
        r.hips.rotation.y = .7 * load - 1.5 * sw;
        r.shoulderR.rotation.x = -.8 - .7 * load + .5 * sw;
        r.shoulderR.rotation.z = -1.5 * load + 2.4 * sw;
        r.elbowR.rotation.x = -1.3 * load + 1.1 * sw;
        r.shoulderL.rotation.x = -.5 - .5 * load + .4 * sw;
        r.shoulderL.rotation.z = 1.2 * load - 1.6 * sw;
        r.elbowL.rotation.x = -1.5 * load + 1.2 * sw;
        r.neck.rotation.y = -.5 * load + .9 * sw;
        r.hipL.rotation.x = -.8 * run + .3 * sw; r.kneeL.rotation.x = 1.0 * run;
        r.hipR.rotation.x = .5 * run - .6 * sw; r.kneeR.rotation.x = .6 * run;
        r.hips.position.y = r.hipsBaseY - .5 * load + .2 * sw;
        return true;
      }
      case 'j2': {                     // the stabs, the turn, the carry
        rp(r);
        var stab = Math.max(0, Math.min(1, t / .95));
        var jab = t < .95 ? Math.abs(Math.sin(t * 20)) : 0;
        var turn = t > .95 ? Math.min(1, (t - .95) / .2) : 0;
        var carry = t > 1.15 ? Math.min(1, (t - 1.15) / .2) : 0;
        var down = t > 2.0 ? out(Math.min(1, (t - 2.0) / .16)) : 0;
        r.shoulderR.rotation.x = -1.25 - .45 * jab * (1 - turn) - .9 * carry + 2.2 * down;
        r.shoulderR.rotation.z = -.2 - .5 * turn + .3 * carry;
        r.elbowR.rotation.x = -.5 + .45 * jab * (1 - turn) - .3 * carry - .2 * down;
        r.shoulderL.rotation.x = -1.0 - .8 * carry + 1.6 * down;
        r.shoulderL.rotation.z = .55 + .3 * carry;
        r.elbowL.rotation.x = -1.1 - .2 * carry;
        r.spine.rotation.y = .18 * jab * (1 - turn) - .5 * turn + .25 * carry;
        r.spine.rotation.x = -.1 - .16 * jab + .3 * carry + .42 * down;
        r.neck.rotation.x = -.1 + .3 * down;
        r.hipL.rotation.x = -.46 * stab - .3 * carry + .3 * down; r.kneeL.rotation.x = .7 * stab;
        r.hipR.rotation.x = .3 * stab + .2 * carry; r.kneeR.rotation.x = .5 * stab;
        r.hips.position.y = r.hipsBaseY - .3 * stab - .12 * carry - .2 * down;
        return true;
      }
      case 'j3': {                     // knee, run, floor, and the long one
        rp(r);
        if (t < .38) {                                // the knee
          var k = out(t / .38);
          r.hipR.rotation.x = -2.1 * k; r.kneeR.rotation.x = 2.3 * k;
          r.hipL.rotation.x = .5 * k; r.kneeL.rotation.x = .3 * k;
          r.spine.rotation.x = -.35 * k;
          r.shoulderR.rotation.x = -.8 - .5 * k;
          r.shoulderL.rotation.x = -.3 + .8 * k;
          r.shoulderL.rotation.z = .5 * k;
          r.elbowR.rotation.x = -1.2;
          r.hips.position.y = r.hipsBaseY + .3 * k;
          return true;
        }
        if (t < 1.72) {                               // the run and the three
          var gait = Math.sin(t * 17);
          var hit = Math.max(0, Math.sin((t - .5) * 8.2));
          r.hipL.rotation.x = -gait * .9; r.kneeL.rotation.x = Math.max(0, gait) * 1.1;
          r.hipR.rotation.x = gait * .9; r.kneeR.rotation.x = Math.max(0, -gait) * 1.1;
          r.shoulderR.rotation.x = -2.2 + 2.2 * hit;
          r.shoulderR.rotation.z = -.2;
          r.elbowR.rotation.x = -.5 + .3 * hit;
          r.shoulderL.rotation.x = -.5 - gait * .5;
          r.spine.rotation.x = .2 + .3 * hit;
          r.spine.rotation.y = -gait * .18;
          r.neck.rotation.x = .1 + .2 * hit;
          r.hips.position.y = r.hipsBaseY - .2 - .12 * hit;
          return true;
        }
        if (t < 2.24) {                               // over sideways, flat
          var f = (t - 1.72) / .52;
          r.spine.rotation.x = -1.0;
          r.spine.rotation.z = Math.sin(f * Math.PI) * .5;
          r.shoulderR.rotation.set(-2.7, 0, -.4);
          r.shoulderL.rotation.set(-1.4, 0, 1.3);
          r.elbowR.rotation.x = -.2; r.elbowL.rotation.x = -1.0;
          r.hipL.rotation.x = -1.3; r.kneeL.rotation.x = 1.7;
          r.hipR.rotation.x = -.5; r.kneeR.rotation.x = .5;
          r.neck.rotation.x = -.4;
          r.hips.position.y = r.hipsBaseY - .1;
          return true;
        }
        var land = out(Math.min(1, (t - 2.24) / .18));  // and down
        r.shoulderR.rotation.x = -2.4 + 2.8 * land;
        r.shoulderL.rotation.x = -1.8 + 2.0 * land;
        r.shoulderL.rotation.z = .5 - .2 * land;
        r.elbowR.rotation.x = -.3; r.elbowL.rotation.x = -.6;
        r.spine.rotation.x = -.3 + .8 * land;
        r.neck.rotation.x = .4 * land;
        r.hipL.rotation.x = -1.0 + .3 * land; r.kneeL.rotation.x = 1.5 - .4 * land;
        r.hipR.rotation.x = .4; r.kneeR.rotation.x = .8;
        r.hips.position.y = r.hipsBaseY - .7 * land;
        return true;
      }
      case 'j3sweep': {                // low, and along the floor
        rp(r);
        var set = out(Math.min(1, t / .26));
        var go2 = t > .26 ? out(Math.min(1, (t - .26) / .14)) : 0;
        r.spine.rotation.y = .9 * set - 1.8 * go2;
        r.spine.rotation.x = .5 * set + .1 * go2;
        r.hips.rotation.y = .5 * set - 1.1 * go2;
        r.shoulderR.rotation.x = -.5 - .3 * set;
        r.shoulderR.rotation.z = -1.1 * set + 1.9 * go2;
        r.elbowR.rotation.x = -.9 * set + .8 * go2;
        r.shoulderL.rotation.x = -.6 * set;
        r.shoulderL.rotation.z = .9 * set - 1.2 * go2;
        r.elbowL.rotation.x = -1.2 * set;
        r.neck.rotation.y = -.4 * set + .7 * go2;
        /* right down on one knee: the head has to travel at ankle height */
        r.hipL.rotation.x = -1.5 * set; r.kneeL.rotation.x = 1.9 * set;
        r.hipR.rotation.x = .7 * set; r.kneeR.rotation.x = .4 * set;
        r.hips.position.y = r.hipsBaseY - 1.15 * set;
        return true;
      }
      case 'j4': {                     // straight up, and straight down
        rp(r);
        var raise = out(Math.min(1, t / .5));
        var fall = t > .62 ? out(Math.min(1, (t - .62) / .16)) : 0;
        r.shoulderR.rotation.x = -.5 - 2.4 * raise + 3.2 * fall;
        r.shoulderR.rotation.z = -.15 * raise;
        r.elbowR.rotation.x = -.8 + .7 * raise - .5 * fall;
        r.shoulderL.rotation.x = -.4 - 1.9 * raise + 2.4 * fall;
        r.shoulderL.rotation.z = .3 + .2 * raise;
        r.elbowL.rotation.x = -1.0 + .5 * raise;
        r.spine.rotation.x = -.42 * raise + .8 * fall;
        r.neck.rotation.x = -.5 * raise + .7 * fall;
        r.hipL.rotation.x = -.3 * raise + .3 * fall; r.kneeL.rotation.x = .5 * raise;
        r.hipR.rotation.x = -.25 * raise + .2 * fall; r.kneeR.rotation.x = .45 * raise;
        r.hips.position.y = r.hipsBaseY + .2 * raise - .5 * fall;
        return true;
      }
      case 'j4whip': {                 // both hands on it, and let it go
        rp(r);
        var grab = out(Math.min(1, t / .16));
        var lash = Math.sin(t * 13);
        /* both hands on the shaft, and the whole body turning with it */
        r.shoulderR.rotation.set(-1.5 - lash * .5, 0, -.3 + lash * .4);
        r.shoulderL.rotation.set(-1.4 - lash * .5, 0, .35 - lash * .4);
        r.elbowR.rotation.x = -.5 - lash * .3;
        r.elbowL.rotation.x = -.7 - lash * .3;
        r.spine.rotation.y = lash * .8 * grab;
        r.spine.rotation.x = .25 * grab + Math.abs(lash) * .2;
        r.neck.rotation.y = -lash * .5;
        r.hipL.rotation.x = -.5 * grab; r.kneeL.rotation.x = .8 * grab;
        r.hipR.rotation.x = -.4 * grab; r.kneeR.rotation.x = .7 * grab;
        r.hips.rotation.y = lash * .5 * grab;
        r.hips.position.y = r.hipsBaseY - .45 * grab;
        return true;
      }
      case 'jr': {                     // one after another, arm doing it all
        rp(r);
        var brace = out(Math.min(1, t / .2));
        var cyc = Math.abs(Math.sin(t * 12.6));
        r.shoulderR.rotation.x = -1.7 * brace - .55 * cyc;
        r.shoulderR.rotation.z = -.3 * brace + .2 * cyc;
        r.elbowR.rotation.x = -1.5 * brace + 1.35 * cyc;
        r.shoulderL.rotation.x = -1.2 * brace;
        r.shoulderL.rotation.z = .7 * brace;
        r.elbowL.rotation.x = -1.6 * brace;
        r.spine.rotation.y = -.3 * brace + .2 * cyc;
        r.spine.rotation.x = -.1 - .1 * cyc;
        r.neck.rotation.y = .2 * brace;
        r.hipL.rotation.x = -.5 * brace; r.kneeL.rotation.x = .8 * brace;
        r.hipR.rotation.x = .3 * brace; r.kneeR.rotation.x = .5 * brace;
        r.hips.position.y = r.hipsBaseY - .42 * brace - .06 * cyc;
        return true;
      }
    }
    return false;
  }

  /* --------------------------------------------------------------- wiring */
  var _stepAction = stepAction;
  stepAction = function (a, dt) {
    switch (a.type) {
      case 'j1': return stepContempt(a, dt);
      case 'j1b': return stepContemptSwing(a, dt);
      case 'j2': return stepCross(a, dt);
      case 'j3': return stepWarrant(a, dt);
      case 'j3sweep': return stepSweep(a, dt);
      case 'j4': return stepHanding(a, dt);
      case 'j4whip': return stepWhip(a, dt);
      case 'jr': return stepCourt(a, dt);
    }
    return _stepAction(a, dt);
  };

  var _poseAction = poseAction;
  poseAction = function (r, a) {
    if (a && (r.__char || player.char) === 'higuruma' && poseHiguruma(r, a)) return;
    return _poseAction(r, a);
  };

  /* He carries it, so it has to be there on every frame he exists — the
     ordinary combo swings it as much as any technique does. The follow-up
     windows tick down here too. */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    var out = _updatePlayer(dt);
    if (player.char === 'higuruma' && !player.dead) {
      carried();
      HG.longT = Math.max(0, (HG.longT || 0) - dt);
      for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (e && e.__contempt > 0) e.__contempt -= dt;
      }
    } else if (HG.hammer) {
      drop(HG.hammer);
      HG.hammer = null;
    }
    return out;
  };

  window.addEventListener('keydown', function (e) {
    if (!started || player.char !== 'higuruma' || e.repeat) return;
    if (player.react || (player.action && (player.action.type === 'kb' ||
        player.action.type === 'void'))) {
      if (window.JJNOTICE && Math.random() < .5) window.JJNOTICE('NO TECHNIQUE WHILE HIT', '#ff8b98');
      return;
    }
    var hit = true;
    if (e.code === 'Digit1') castContempt();
    else if (e.code === 'Digit2') castCross();
    else if (e.code === 'Digit3') castWarrant();
    else if (e.code === 'Digit4') castHanding();
    else if (e.code === 'KeyR') castCourt();
    else hit = false;
    if (hit) e.stopImmediatePropagation();
  }, true);

  /* the court does not sit for the next man */
  var _switchChar = switchChar;
  switchChar = function (id, quiet) {
    HG.props.slice().forEach(drop);
    HG.hammer = null;
    HG.longT = 0;
    enemies.forEach(function (e) { if (e) { e.__court = 0; e.__contempt = 0; } });
    return _switchChar(id, quiet);
  };

  /* =====================================================================
     WHAT EVERYBODY ELSE SEES
     Same hammer, on the arm of whoever is casting, and no damage or
     charge of its own: the seal is what makes his next hit worth more,
     and one put up here would be a second on a body that has the real
     one already.
     ================================================================== */
  function dirOf(yaw) { return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); }

  /* a hammer on somebody else's arm, or standing in the world if that
     body has not arrived on this screen yet */
  function remoteHammer(f, pos, yaw, size, len) {
    var g = buildHammer();
    g.__size = size || 1; g.__len = len || 2.3;
    layHammer(g);
    var r = f && f.e && f.e.rig;
    if (r && r.handR) {
      g.rotation.set(Math.PI, 0, 0);
      g.position.set(0, -.1, 0);
      r.handR.add(g);
    } else {
      g.position.copy(pos).add(new THREE.Vector3(0, 2.6, 0));
      g.rotation.y = yaw;
      scene.add(g);
    }
    return g;
  }
  function remoteDrop(g, ms) {
    later(ms, function () {
      if (!g) return;
      if (g.parent) g.parent.remove(g);
      g.traverse(function (c) {
        if (c.isMesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
      });
    });
  }

  HG.remote = {
    j1: function (pos, yaw) {
      var d = dirOf(yaw);
      later(260, function () {
        var from = pos.clone().addScaledVector(d, 1.6).add(new THREE.Vector3(0, 2.8, 0));
        FX.speedRing(from.clone(), BRASS, 7, .2);
        flying(from, d.clone(), { ghost: true });
      });
    },
    j1b: function (pos, yaw) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      later(480, function () {
        var at = pos.clone().addScaledVector(d, 3.4).add(new THREE.Vector3(0, 2.6, 0));
        wind(at.clone(), side.clone().negate(), 9, 11);
        knock(at, side, 2.2);
        FX.rings(at.clone(), GOLD, 3, { maxR: 11, life: .5, ground: false, axis: side, gap: 32 });
        FX.cross(at.clone(), GOLD_L, 5, .24);
      });
    },
    j2: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteHammer(f, pos, yaw, .8, 2.6);
      for (var i = 0; i < 6; i++) {
        (function (i) {
          later(100 + i * 158, function () {
            if (!g.parent) return;
            g.__len = 5.6; layHammer(g);
            later(60, function () { if (g.parent) { g.__len = 2.6; layHammer(g); } });
            var at = pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.4 + (i % 2) * .5, 0));
            FX.cutLine(pos.clone().add(new THREE.Vector3(0, 2.6, 0)), at, PAPER, .5, .12);
            FX.impact(at, GOLD_L, 1.1);
          });
        })(i);
      }
      later(950, function () {
        if (!g.parent) return;
        g.__size = 2.4; g.__len = 4.6; layHammer(g);
        var at2 = pos.clone().addScaledVector(d, 4).add(new THREE.Vector3(0, 2.6, 0));
        wind(at2, d.clone(), 7, 8);
        knock(at2, d, 1.6);
      });
      later(2020, function () {
        var floor = pos.clone().addScaledVector(d, 6);
        knock(floor.clone().add(new THREE.Vector3(0, .6, 0)), d, 2.6);
        FX.rings(new THREE.Vector3(floor.x, .12, floor.z), GOLD, 4, { maxR: 13, life: .6, gap: 32 });
        FX.cracks(new THREE.Vector3(floor.x, .05, floor.z), 16, 20, 0x4a4238);
        stamp(floor, 8);
      });
      remoteDrop(g, 2340);
    },
    j3: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteHammer(f, pos, yaw, 1.8, 3.4);
      [620, 1000, 1380].forEach(function (ms, i) {
        later(ms, function () {
          var floor = pos.clone().addScaledVector(d, 4 + i * 7);
          knock(floor.clone().add(new THREE.Vector3(0, .5, 0)), d, 1.4);
          FX.cracks(new THREE.Vector3(floor.x, .05, floor.z), 9, 12, 0x4a4238);
          stamp(floor, 5);
        });
      });
      later(2260, function () {
        var land = pos.clone().addScaledVector(d, 30);
        FX.rings(new THREE.Vector3(land.x, .12, land.z), GOLD, 5, { maxR: 20, life: .8, gap: 30 });
        FX.cracks(new THREE.Vector3(land.x, .05, land.z), 24, 30, 0x4a4238);
        FX.debris(new THREE.Vector3(land.x, .1, land.z), 16, 18, OAK_D);
        knock(land.clone().add(new THREE.Vector3(0, .6, 0)), d, 3);
        stamp(land, 11);
      });
      remoteDrop(g, 2500);
    },
    j3sweep: function (pos, yaw, f) {
      var d = dirOf(yaw), side = new THREE.Vector3(-d.z, 0, d.x).normalize();
      var g = remoteHammer(f, pos, yaw, 2, 5.4);
      if (g.parent) { g.rotation.x = -1.57; layHammer(g); }
      later(260, function () {
        var low = pos.clone().addScaledVector(d, 3.4).setY(.5);
        wind(low, side.clone().negate(), 7, 10);
        FX.cutLine(low.clone().addScaledVector(side, 5), low.clone().addScaledVector(side, -5),
          GOLD_L, 1.2, .3);
        knock(low, side, 1.8);
        FX.dust(new THREE.Vector3(low.x, 0, low.z), 10, 0xcdc4b2, 14, 4);
      });
      remoteDrop(g, 1100);
    },
    j4: function (pos, yaw, f) {
      var d = dirOf(yaw);
      var g = remoteHammer(f, pos, yaw, 1, 2.3);
      if (g.parent) g.rotation.x = 0;
      var t = 0;
      addFx({ t: 1e9, update: function (dt) {
        t += dt;
        if (typeof scene === 'undefined' || !g.parent) return false;
        if (t < .5) {
          var k = E.out(t / .5);
          g.__len = 2.3 + 13 * k;
          g.__size = 1 + 1.8 * k;
          g.__bend.set(Math.sin(t * 14) * .9 * k, 0, Math.cos(t * 11) * .6 * k);
          layHammer(g);
        } else if (t < .66) {
          g.rotation.x = 1.9; g.__bend.set(0, 0, -2.2); layHammer(g);
        }
        return t < 1.2;
      } });
      later(640, function () {
        var at = pos.clone().addScaledVector(d, 9).setY(0);
        knock(at.clone().add(new THREE.Vector3(0, 1.4, 0)), d, 3);
        FX.rings(new THREE.Vector3(at.x, .12, at.z), GOLD, 5, { maxR: 17, life: .75, gap: 30 });
        FX.cracks(new THREE.Vector3(at.x, .05, at.z), 22, 26, 0x4a4238);
        FX.debris(new THREE.Vector3(at.x, .1, at.z), 14, 16, OAK_D);
        stamp(at, 10);
      });
      remoteDrop(g, 1250);
    },
    j4whip: function (pos, yaw, f) {
      var g = remoteHammer(f, pos, yaw, 2, 17);
      if (g.parent) { g.rotation.x = 1.3; layHammer(g); }
      for (var i = 0; i < 5; i++) {
        (function (i) {
          later(120 + i * 300, function () {
            var ang = Math.random() * TAU;
            var dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
            var far = 10 + Math.random() * 11;
            if (g.parent) {
              g.__len = far;
              g.__bend.set((Math.random() - .5) * 9, 0, (Math.random() - .5) * 6);
              layHammer(g);
            }
            var to = pos.clone().addScaledVector(dir, far);
            trace(pos.clone().addScaledVector(dir, 3), to);
            wind(to.clone().add(new THREE.Vector3(0, 1, 0)), dir, 6, 8);
            knock(to.clone().add(new THREE.Vector3(0, .8, 0)), dir, 1.6);
            FX.debris(new THREE.Vector3(to.x, .1, to.z), 8, 12, OAK_D);
          });
        })(i);
      }
      remoteDrop(g, 1740);
    },
    jr: function (pos, yaw) {
      var d = dirOf(yaw);
      for (var i = 0; i < CR.n; i++) {
        (function (i) {
          later(180 + i * CR.gap * 1000, function () {
            var muzzle = pos.clone().addScaledVector(d, 2.2).add(
              new THREE.Vector3(0, 2.7 + Math.sin(i) * .3, 0));
            FX.dust(muzzle.clone(), 4, 0xd6cfc0, 3.4, 2.2);
            FX.speedRing(muzzle.clone(), GOLD, 6, .16);
            flying(muzzle, d.clone(), {
              ghost: true, speed: CR.speed, reach: 40, size: .7, len: 1.5, spin: 34
            });
          });
        })(i);
      }
    }
  };

  /* the pieces the finishers borrow */
  HG.INK = INK; HG.EDGE = EDGE; HG.BRASS = BRASS; HG.BRASS_D = BRASS_D;
  HG.OAK = OAK; HG.OAK_D = OAK_D; HG.PAPER = PAPER;
  HG.LAW = LAW; HG.LAW2 = LAW2; HG.GOLD = GOLD; HG.GOLD_L = GOLD_L;
  // The AI invokes these same casts and the shared action/pose dispatchers.
  (window.JJCHARCAST ||= {}).higuruma = {
    cast: [castContempt, castCross, castWarrant, castHanding, castCourt], state: HG
  };
})();