/* =======================================================================
   FINISHERS
   Naoya's awakening ends in a cut that only the two of you see. This is
   that, for everybody, off the ordinary kit.

   When one of your abilities is about to take somebody out, it does not
   take them out. It takes them somewhere: a stage built well above the
   city, out of sight, where the two of you are the only things that
   exist for the next half a minute. The arena is never touched, and
   everybody else carries on watching the pair of you stand still.

     gojo    THROUGHOUT HEAVEN AND EARTH   blue, red, and the purple
     naoya   TWENTY FOUR FRAMES            twenty four passes and a tanto
     yuji    BLACK FLASH                   a hundredth of a second
     hakari  PRIVATE PURE LOVE TRAIN       the reels, and what arrives
     sukuna  DISMANTLE                     the net, and the cubes

   Two rules hold for all five.

   THE HEALTH IS LOCKED. Both fighters are held at a floor of one health
   for the whole cut — JJGORE.hold() — so a finisher thrown at somebody
   on two health does not kill them in the first beat and leave the other
   twenty seconds playing to a corpse. The kill is applied at the end, by
   the victim, once the cut is over.

   AND THEY DO NOT ALL END LIMP. A ragdoll is one ending out of three.
   Gojo's purple leaves a burnt husk where they were standing; Naoya's
   tanto and Hakari's train leave them in pieces; Sukuna's lattice leaves
   them in the cubes it cut them into. What is left stays on the floor
   until they respawn.
   ===================================================================== */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX) return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* far enough above the city that nothing up here is ever in shot from
     down there, and clear of the stage Naoya's cut uses */
  var STAGE = new THREE.Vector3(0, 1500, 0);

  var F = {
    on: false, t: 0, beat: -1, bt: 0, A: null, V: null,
    stage: [], flags: {}, dt: 1 / 60, freeze: 0, cd: 0, cut: null
  };

  var FIN = window.JJFIN = {
    on: function () { return F.on; },
    busy: function () { return F.on; },
    ready: function () { return F.cd <= 0; },
    start: start, remote: remote
  };

  var COOLDOWN = 34;           // one finisher every half minute, at most

  /* =====================================================================
     STAGE PLUMBING
     ================================================================== */
  function sp(x, y, z) { return new THREE.Vector3(STAGE.x + x, STAGE.y + y, STAGE.z + z); }
  function keep(o) { F.stage.push(o); scene.add(o); return o; }
  function clearStage() {
    F.stage.forEach(function (o) {
      scene.remove(o);
      o.traverse && o.traverse(function (c) {
        if (!c.isMesh) return;
        if (c.material) {
          if (c.material.map && c.material.__own) c.material.map.dispose();
          c.material.dispose();
        }
        if (c.geometry && c.geometry.__own) c.geometry.dispose();
      });
    });
    F.stage.length = 0;
  }

  function canvasOf(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function texOf(c) {
    var t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  /* the sky of wherever this beat is happening */
  function backdrop(top, bottom, paint) {
    var c = canvasOf(paint ? 512 : 8, 256), g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, 256);
    if (paint) paint(g, c.width, 256);
    var m = new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16),
      new THREE.MeshBasicMaterial({
        map: texOf(c), side: THREE.BackSide, depthWrite: false, toneMapped: false
      }));
    m.geometry.__own = true;
    m.material.__own = true;
    m.position.copy(STAGE);
    m.renderOrder = -1;
    return keep(m);
  }

  function slab(w, d, color, y) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d),
      new THREE.MeshStandardMaterial({ color: color, roughness: .92 }));
    m.position.copy(sp(0, (y || 0) - .6, 0));
    m.receiveShadow = true;
    m.geometry.__own = true;
    return keep(m);
  }

  function box(w, h, d, color, x, y, z, rot) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: color, roughness: .85 }));
    m.position.copy(sp(x, y, z));
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.castShadow = true;
    m.geometry.__own = true;
    return keep(m);
  }

  /* pillars, rubble, and the other furniture a beat needs to have depth */
  function pillars(n, r, h, color) {
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU + .3;
      box(2.4, h * (.6 + Math.random() * .7), 2.4, color,
        Math.cos(a) * r * (.7 + Math.random() * .6), h / 2,
        Math.sin(a) * r * (.7 + Math.random() * .6), [0, a, (Math.random() - .5) * .1]);
    }
  }
  function rubble(n, r, color) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, d = Math.random() * r;
      var s = .6 + Math.random() * 2.4;
      box(s, s * (.4 + Math.random()), s * (.5 + Math.random()), color,
        Math.cos(a) * d, s * .3, Math.sin(a) * d,
        [Math.random() * .6, Math.random() * TAU, Math.random() * .6]);
    }
  }

  /* =====================================================================
     THE TWO BODIES
     The cut drives them both and never asks which one is ours.
     ================================================================== */
  function selfHandle() {
    return {
      self: true, rig: player.rig, ent: player, char: player.char,
      hold: function () { player.vel.set(0, 0, 0); player.iframes = 9e9; },
      release: function () { player.iframes = 2; }
    };
  }
  function entHandle(e) {
    return {
      self: false, rig: e.rig, ent: e,
      char: e.net ? (fighterChar(e) || 'gojo') : 'dummy',
      hold: function () {
        e.cineHold = true; e.vel.set(0, 0, 0);
        if (e.hpSpr) e.hpSpr.visible = false;
      },
      release: function () {
        e.cineHold = false;
        if (e.hpSpr && !e.dead) e.hpSpr.visible = true;
      }
    };
  }
  function fighterChar(e) {
    var M = window.MPJJ;
    if (!M || !e.net) return null;
    var f = M.fighters[e.net.id];
    return f ? f.char : null;
  }

  function put(h, x, y, z, yaw) {
    h.rig.root.position.set(STAGE.x + x, STAGE.y + y, STAGE.z + z);
    h.rig.root.rotation.set(0, yaw == null ? 0 : yaw, 0);
    h.rig.root.scale.set(1, 1, 1);
  }
  function move(h, x, y, z) { h.rig.root.position.set(STAGE.x + x, STAGE.y + y, STAGE.z + z); }
  function face(h, yaw) { h.rig.root.rotation.y = yaw; }
  function where(h) { return h.rig.root.position.clone(); }

  /* =====================================================================
     THE CAMERA
     ================================================================== */
  function cam(px, py, pz, lx, ly, lz, stiff) {
    if (!AN) {
      camera.position.set(STAGE.x + px, STAGE.y + py, STAGE.z + pz);
      camera.lookAt(STAGE.x + lx, STAGE.y + ly, STAGE.z + lz);
      return;
    }
    AN.camTo(STAGE.x + px, STAGE.y + py, STAGE.z + pz,
      STAGE.x + lx, STAGE.y + ly, STAGE.z + lz, F.dt || 1 / 60, stiff);
  }
  function shot(t, marks) {
    var i = 0;
    while (i < marks.length - 1 && t >= marks[i + 1].t) i++;
    var a = marks[i], b = marks[Math.min(i + 1, marks.length - 1)];
    var k = b === a ? 0 : E.out(Math.min(1, Math.max(0, (t - a.t) / Math.max(.001, b.t - a.t))));
    function mix(j) { return a.p[j] + (b.p[j] - a.p[j]) * k; }
    function look(j) { return a.l[j] + (b.l[j] - a.l[j]) * k; }
    cam(mix(0), mix(1), mix(2), look(0), look(1), look(2), a.k || b.k);
  }
  function shakeCam(m) {
    camera.position.x += (Math.random() - .5) * m;
    camera.position.y += (Math.random() - .5) * m;
    camera.position.z += (Math.random() - .5) * m;
  }
  /* the two or three frames a cut spends on the moment of contact */
  function hold(sec, kick) {
    F.freeze = Math.max(F.freeze, sec);
    if (AN && kick !== false) AN.camKick(1.2);
  }
  function once(name, fn) {
    if (F.flags[name]) return false;
    F.flags[name] = 1;
    if (fn) fn();
    return true;
  }

  /* =====================================================================
     POSES
     One library, used by all five cuts. Everything is written so that k
     runs 0..1 through the movement and the rig is reset first.
     ================================================================== */
  function rp(r) { resetPose(r); if (r.body) r.body.rotation.set(0, 0, 0); }

  function poseStand(r, t, amt) {
    rp(r);
    var b = Math.sin(t * 1.7) * (amt == null ? 1 : amt);
    r.spine.rotation.x = -.04 + b * .035;
    r.neck.rotation.x = .03 - b * .03;
    r.shoulderL.rotation.x = -.1 + b * .04; r.shoulderR.rotation.x = -.1 - b * .04;
    r.shoulderL.rotation.z = .08; r.shoulderR.rotation.z = -.08;
    r.elbowL.rotation.x = -.22; r.elbowR.rotation.x = -.22;
    r.hips.position.y = r.hipsBaseY + b * .04;
  }

  function poseWalk(r, t, amt) {
    rp(r);
    var s = Math.sin(t * 4.4), c = Math.cos(t * 4.4);
    amt = amt == null ? 1 : amt;
    r.hipL.rotation.x = s * .55 * amt; r.hipR.rotation.x = -s * .55 * amt;
    r.kneeL.rotation.x = Math.max(0, -s) * .8 * amt;
    r.kneeR.rotation.x = Math.max(0, s) * .8 * amt;
    r.shoulderL.rotation.x = -s * .42 * amt; r.shoulderR.rotation.x = s * .42 * amt;
    r.elbowL.rotation.x = -.3; r.elbowR.rotation.x = -.3;
    r.spine.rotation.y = -s * .12 * amt;
    r.spine.rotation.x = -.06;
    r.hips.position.y = r.hipsBaseY - Math.abs(c) * .1 * amt;
  }

  function poseGuard(r) {
    rp(r);
    r.shoulderL.rotation.x = -1.2; r.shoulderR.rotation.x = -1.15;
    r.shoulderL.rotation.z = .45; r.shoulderR.rotation.z = -.45;
    r.elbowL.rotation.x = -1.65; r.elbowR.rotation.x = -1.6;
    r.spine.rotation.x = .12;
    r.neck.rotation.x = -.1;
    r.hipL.rotation.x = -.2; r.kneeL.rotation.x = .35; r.kneeR.rotation.x = .3;
    r.hips.position.y = r.hipsBaseY - .24;
  }

  /* a punch that starts in the floor and finishes past them */
  function posePunch(r, k, arm) {
    rp(r);
    var right = arm !== 0;
    var sh = right ? r.shoulderR : r.shoulderL, el = right ? r.elbowR : r.elbowL;
    var osh = right ? r.shoulderL : r.shoulderR, oel = right ? r.elbowL : r.elbowR;
    var s = right ? 1 : -1;
    var wind = E.out(Math.min(1, k / .4));
    var go = E.out(Math.max(0, Math.min(1, (k - .4) / .28)));
    var after = E.out(Math.max(0, (k - .74) / .26));
    sh.rotation.x = -.5 - 1.1 * wind + .05 * go;
    sh.rotation.z = -s * (.5 * wind - .55 * go);
    el.rotation.x = -1.9 * wind + 1.85 * go;
    sh.rotation.x += -1.35 * go;
    osh.rotation.x = -.4 - .5 * wind - .9 * go;
    oel.rotation.x = -1.1 - .5 * go;
    r.spine.rotation.y = s * (.62 * wind - 1.15 * go - .12 * after);
    r.spine.rotation.x = -.1 + .22 * go;
    r.neck.rotation.y = -s * (.3 * wind - .45 * go);
    r.hipL.rotation.x = -.35 * wind + .2 * go;
    r.hipR.rotation.x = .2 * wind - .3 * go;
    r.kneeL.rotation.x = .5 * wind - .2 * go;
    r.kneeR.rotation.x = .25 + .35 * go;
    r.hips.position.y = r.hipsBaseY - .3 * wind - .12 * go;
  }

  /* doubled over what just went into the stomach */
  function poseGut(r, k) {
    rp(r);
    var s = Math.min(1, k * 9), out = Math.max(0, 1 - k * .35);
    r.spine.rotation.x = 1.05 * s * out;
    r.neck.rotation.x = .45 * s * out;
    r.shoulderL.rotation.x = -1.3 * s; r.shoulderR.rotation.x = -1.3 * s;
    r.shoulderL.rotation.z = .38 * s; r.shoulderR.rotation.z = -.38 * s;
    r.elbowL.rotation.x = -1.7 * s; r.elbowR.rotation.x = -1.7 * s;
    r.hipL.rotation.x = -.5 * s; r.hipR.rotation.x = -.42 * s;
    r.kneeL.rotation.x = .95 * s; r.kneeR.rotation.x = .85 * s;
    r.hips.position.y = r.hipsBaseY - .68 * s;
  }

  /* nothing holding it up: hanging from wherever it is being held */
  function poseLimp(r, t) {
    rp(r);
    var sw = Math.sin(t * 1.3), sw2 = Math.cos(t * 1.1);
    r.spine.rotation.x = .55 + sw * .05;
    r.spine.rotation.z = sw2 * .07;
    r.neck.rotation.x = .8 + sw * .07;
    r.neck.rotation.z = sw2 * .12;
    r.shoulderL.rotation.x = .35 + sw * .1; r.shoulderR.rotation.x = .3 + sw2 * .1;
    r.shoulderL.rotation.z = .28; r.shoulderR.rotation.z = -.28;
    r.elbowL.rotation.x = -.35; r.elbowR.rotation.x = -.3;
    r.hipL.rotation.x = .22 + sw * .06; r.hipR.rotation.x = .16 + sw2 * .06;
    r.kneeL.rotation.x = .55; r.kneeR.rotation.x = .48;
    r.hips.position.y = r.hipsBaseY - .1;
  }

  /* flat out, for a body lying on a surface — the root is what tips */
  function poseDown(r) {
    rp(r);
    r.shoulderL.rotation.x = -.55; r.shoulderR.rotation.x = -.45;
    r.shoulderL.rotation.z = .85; r.shoulderR.rotation.z = -.9;
    r.elbowL.rotation.x = -.5; r.elbowR.rotation.x = -.4;
    r.spine.rotation.x = .14;
    r.neck.rotation.x = .3;
    r.hipL.rotation.x = -.16; r.hipR.rotation.x = .12;
    r.kneeL.rotation.x = .3; r.kneeR.rotation.x = .2;
  }

  /* thrown, and finding out about it on the way */
  function poseFly(r, k) {
    rp(r);
    var s = Math.min(1, k * 5);
    r.spine.rotation.x = -.75 * s;
    r.neck.rotation.x = -.55 * s;
    r.shoulderL.rotation.x = -2.3 * s; r.shoulderR.rotation.x = -2.2 * s;
    r.shoulderL.rotation.z = -.5 * s; r.shoulderR.rotation.z = .5 * s;
    r.elbowL.rotation.x = -.3; r.elbowR.rotation.x = -.35;
    r.hipL.rotation.x = -.6 * s; r.hipR.rotation.x = -.35 * s;
    r.kneeL.rotation.x = .85 * s; r.kneeR.rotation.x = .6 * s;
  }

  /* on their knees, which is where most of these start */
  function poseKneel(r, t) {
    rp(r);
    var b = Math.sin(t * 1.6) * .04;
    r.spine.rotation.x = .5 + b;
    r.neck.rotation.x = .35 - b;
    r.shoulderL.rotation.x = .2; r.shoulderR.rotation.x = .18;
    r.shoulderL.rotation.z = .3; r.shoulderR.rotation.z = -.3;
    r.elbowL.rotation.x = -.55; r.elbowR.rotation.x = -.5;
    r.hipL.rotation.x = -1.5; r.kneeL.rotation.x = 2.3;
    r.hipR.rotation.x = -.85; r.kneeR.rotation.x = 1.5;
    r.hips.position.y = r.hipsBaseY - 1.35;
  }

  /* one arm out, holding something up by the throat */
  function poseHold(r, k, arm) {
    rp(r);
    var right = arm !== 0, s = right ? 1 : -1;
    var sh = right ? r.shoulderR : r.shoulderL, el = right ? r.elbowR : r.elbowL;
    var out = E.out(Math.min(1, k));
    sh.rotation.x = -1.6 * out;
    sh.rotation.z = -s * .18 * out;
    el.rotation.x = -.12 * out;
    (right ? r.shoulderL : r.shoulderR).rotation.x = -.2;
    (right ? r.elbowL : r.elbowR).rotation.x = -.3;
    r.spine.rotation.y = -s * .2 * out;
    r.spine.rotation.x = -.08;
    r.neck.rotation.y = -s * .1;
    r.hips.position.y = r.hipsBaseY - .06;
  }

  /* both hands drawing something in that is not there yet */
  function poseCharge(r, k) {
    rp(r);
    var c = E.out(Math.min(1, k));
    r.shoulderL.rotation.x = -1.5 * c; r.shoulderR.rotation.x = -1.5 * c;
    r.shoulderL.rotation.z = .62 * c; r.shoulderR.rotation.z = -.62 * c;
    r.elbowL.rotation.x = -1.5 * c; r.elbowR.rotation.x = -1.5 * c;
    r.spine.rotation.x = -.22 * c;
    r.neck.rotation.x = -.28 * c;
    r.hipL.rotation.x = -.3 * c; r.hipR.rotation.x = -.25 * c;
    r.kneeL.rotation.x = .55 * c; r.kneeR.rotation.x = .5 * c;
    r.hips.position.y = r.hipsBaseY - .4 * c;
  }

  /* one arm straight out along the line of whatever is about to happen */
  function posePoint(r, k, arm) {
    rp(r);
    var right = arm !== 0, s = right ? 1 : -1;
    var sh = right ? r.shoulderR : r.shoulderL, el = right ? r.elbowR : r.elbowL;
    var out = E.out(Math.min(1, k));
    sh.rotation.x = -1.62 * out;
    sh.rotation.z = -s * .1 * out;
    el.rotation.x = -.05;
    (right ? r.shoulderL : r.shoulderR).rotation.x = -.35 - .3 * out;
    (right ? r.shoulderL : r.shoulderR).rotation.z = s * .35;
    (right ? r.elbowL : r.elbowR).rotation.x = -.9;
    r.spine.rotation.y = -s * .3 * out;
    r.spine.rotation.x = -.12 * out;
    r.neck.rotation.y = -s * .18 * out;
    r.hips.position.y = r.hipsBaseY - .1 * out;
  }

  /* a diagonal cut through everything in front of them */
  function poseSlash(r, k, arm) {
    rp(r);
    var right = arm !== 0, s = right ? 1 : -1;
    var sh = right ? r.shoulderR : r.shoulderL, el = right ? r.elbowR : r.elbowL;
    var wind = E.out(Math.min(1, k / .45));
    var go = E.out(Math.max(0, Math.min(1, (k - .45) / .22)));
    sh.rotation.x = -.3 - 2.3 * wind + 3.1 * go;
    sh.rotation.z = -s * (1.15 * wind - 1.5 * go);
    el.rotation.x = -1.1 * wind + 1.05 * go;
    (right ? r.shoulderL : r.shoulderR).rotation.x = -.5 - .5 * wind + .2 * go;
    (right ? r.shoulderL : r.shoulderR).rotation.z = s * (.4 + .3 * go);
    (right ? r.elbowL : r.elbowR).rotation.x = -1.2;
    r.spine.rotation.y = s * (.7 * wind - 1.25 * go);
    r.spine.rotation.x = -.24 * wind + .48 * go;
    r.neck.rotation.y = -s * (.32 * wind - .5 * go);
    r.hips.position.y = r.hipsBaseY - .18 * wind - .22 * go;
    r.kneeL.rotation.x = .3 + .4 * go; r.kneeR.rotation.x = .2 + .3 * go;
  }

  /* up through them */
  function poseUpper(r, k, arm) {
    rp(r);
    var right = arm !== 0, s = right ? 1 : -1;
    var sh = right ? r.shoulderR : r.shoulderL, el = right ? r.elbowR : r.elbowL;
    var dip = E.out(Math.min(1, k / .38));
    var go = E.out(Math.max(0, Math.min(1, (k - .38) / .24)));
    sh.rotation.x = .55 * dip - 3.1 * go;
    sh.rotation.z = -s * .28 * dip;
    el.rotation.x = -.55 * dip - .5 * go;
    (right ? r.shoulderL : r.shoulderR).rotation.x = -.4 - .8 * go;
    (right ? r.elbowL : r.elbowR).rotation.x = -1.35;
    r.spine.rotation.x = .45 * dip - .75 * go;
    r.spine.rotation.y = s * (.3 * dip - .4 * go);
    r.neck.rotation.x = .2 * dip - .6 * go;
    r.hipL.rotation.x = -.5 * dip + .3 * go; r.hipR.rotation.x = -.4 * dip + .25 * go;
    r.kneeL.rotation.x = 1.05 * dip - .85 * go; r.kneeR.rotation.x = .9 * dip - .7 * go;
    r.hips.position.y = r.hipsBaseY - .95 * dip + 1.15 * go;
  }

  /* down through them */
  function poseSmash(r, k) {
    rp(r);
    var up = E.out(Math.min(1, k / .4));
    var down = E.out(Math.max(0, Math.min(1, (k - .4) / .2)));
    r.shoulderL.rotation.x = -3 * up + 3.5 * down;
    r.shoulderR.rotation.x = -3 * up + 3.5 * down;
    r.shoulderL.rotation.z = .3 * up - .2 * down;
    r.shoulderR.rotation.z = -.3 * up + .2 * down;
    r.elbowL.rotation.x = -.35 - .5 * down; r.elbowR.rotation.x = -.35 - .5 * down;
    r.spine.rotation.x = -.55 * up + 1.15 * down;
    r.neck.rotation.x = -.45 * up + .8 * down;
    r.hipL.rotation.x = -.2 + .55 * down; r.hipR.rotation.x = -.15 + .45 * down;
    r.kneeL.rotation.x = .2 + .9 * down; r.kneeR.rotation.x = .15 + .8 * down;
    r.hips.position.y = r.hipsBaseY + .35 * up - .95 * down;
  }

  /* standing over what is left of them */
  function poseOver(r, t) {
    rp(r);
    var b = Math.sin(t * 2.2) * .05;
    r.spine.rotation.x = .18 + b;
    r.neck.rotation.x = .42 - b * .5;
    r.shoulderL.rotation.x = -.28 + b; r.shoulderR.rotation.x = -.3 - b;
    r.shoulderL.rotation.z = .2; r.shoulderR.rotation.z = -.2;
    r.elbowL.rotation.x = -.5; r.elbowR.rotation.x = -.55;
    r.hipL.rotation.x = -.14; r.hipR.rotation.x = .1;
    r.kneeL.rotation.x = .22; r.kneeR.rotation.x = .16;
    r.hips.position.y = r.hipsBaseY - .12;
  }

  /* =====================================================================
     THE SCREEN
     ================================================================== */
  var layer = null;
  function screen() {
    if (layer) return layer;
    var css = document.createElement('style');
    css.textContent = [
      '#jjFin{position:fixed;inset:0;z-index:16;pointer-events:none}',
      '#jjFinWhite{position:absolute;inset:0;background:#fff;opacity:0}',
      '#jjFinPanel{position:absolute;inset:0;opacity:0;background:#0a0a0f}',
      '#jjFinCard{position:fixed;left:0;right:0;top:30%;text-align:center;z-index:17;',
      '  pointer-events:none;font-family:"Finger Paint","Segoe UI",cursive;opacity:0;',
      '  transition:opacity .25s}',
      '#jjFinCard.on{opacity:1}',
      '#jjFinCard .k{font-size:13px;letter-spacing:13px;color:#fff;opacity:.8}',
      '#jjFinCard .n{font-size:48px;letter-spacing:7px;color:#fff;line-height:1.1;',
      '  text-shadow:0 0 26px currentColor,0 3px 0 #0b1020}',
      '#jjFinCard .s{font-size:13px;letter-spacing:9px;color:#dfe6ff;margin-top:6px;',
      '  text-shadow:0 1px 6px #000}',
      '#jjFinCard.slam .n{animation:jjFinSlam .4s cubic-bezier(.15,.9,.2,1)}',
      '@keyframes jjFinSlam{0%{transform:scale(2.6);opacity:0;filter:blur(10px)}',
      '  60%{transform:scale(.95);opacity:1;filter:blur(0)}100%{transform:scale(1)}}'
    ].join('');
    document.head.appendChild(css);
    layer = document.createElement('div');
    layer.id = 'jjFin';
    layer.innerHTML = '<div id="jjFinPanel"></div><div id="jjFinWhite"></div>';
    document.body.appendChild(layer);
    var card = document.createElement('div');
    card.id = 'jjFinCard';
    card.innerHTML = '<div class="k">FINISHER</div><div class="n"></div><div class="s"></div>';
    document.body.appendChild(card);
    return layer;
  }
  function white(v) { screen(); document.getElementById('jjFinWhite').style.opacity = String(v); }
  function panelDark(v) { screen(); document.getElementById('jjFinPanel').style.opacity = String(v); }
  function card(on, name, sub, color) {
    screen();
    var c = document.getElementById('jjFinCard');
    if (on) {
      c.querySelector('.n').textContent = name;
      c.querySelector('.n').style.color = color || '#fff';
      c.querySelector('.s').textContent = sub || '';
      c.classList.remove('slam');
      void c.offsetWidth;
      c.classList.add('on', 'slam');
    } else {
      c.classList.remove('on', 'slam');
    }
  }
  function hudOff(off) {
    if (window.JJSTAGE) window.JJSTAGE.hud(!off);
  }

  /* =====================================================================
     RUNNING ONE
     ================================================================== */
  function otherCine() {
    if (window.JJNAOYA && window.JJNAOYA.busy()) return true;
    if (window.JJAW && window.JJAW.cine) return true;
    if (window.MPJJ && window.MPJJ.cs && window.MPJJ.cs.active) return true;
    if (window.JJVOID && window.JJVOID.on) return true;
    return false;
  }

  function start(V, A, charId) {
    if (F.on || otherCine()) return false;
    var cut = CUTS[charId] || CUTS.gojo;
    F.on = true; F.t = 0; F.beat = -1; F.bt = 0; F.flags = {}; F.freeze = 0;
    F.A = A; F.V = V; F.cut = cut;
    F.cd = COOLDOWN;
    if (AN) {
      F.smA = AN.smoother(A.rig);
      F.smV = AN.smoother(V.rig);
      F.smA.snap(); F.smV.snap();
      F.smearA = {}; F.smearV = {};
      AN.camRelease();
      AN.camHand(1);
    }
    F.homeA = A.rig.root.position.clone();
    F.homeV = V.rig.root.position.clone();
    A.hold(); V.hold();
    /* neither of them can die while this is running */
    if (window.JJGORE) { window.JJGORE.hold(A.ent); window.JJGORE.hold(V.ent); }
    if (A.self) { player.action = null; player.vel.set(0, 0, 0); }
    if (V.self) { player.action = null; player.vel.set(0, 0, 0); player.react = null; }
    hudOff(true);
    FX.letterbox(true);
    white(0);
    panelDark(0);
    card(true, cut.name, cut.sub, cut.color);
    setTimeout(function () { card(false); }, 2400);
    /* the city's fog is set for the city, and the stage is not in it */
    if (scene.fog) {
      F.fog = { near: scene.fog.near, far: scene.fog.far };
      scene.fog.near = 2000; scene.fog.far = 6000;
    }
    return true;
  }

  /* whose cut this is. Yuji with the King of Curses out is not Yuji, and
     what he does to somebody at the end of it is not a punch. */
  function charCut() {
    if (player.char === 'yuji' && window.JJAW && window.JJAW.sukuna) return 'sukuna';
    return player.char;
  }

  /* our ability was about to take somebody out */
  function startFor(e) {
    var V = entHandle(e), A = selfHandle();
    var id = charCut();
    if (!start(V, A, id)) return false;
    if (e.net && window.MPJJ && window.MPJJ.relay) {
      window.MPJJ.relay.pub({ t: 'fcine', id: window.MPJJ.id, to: e.net.id, k: id });
    }
    if (window.JJNOTICE) window.JJNOTICE('FINISHER', CUTS[id] ? CUTS[id].color : '#fff');
    return true;
  }

  /* somebody else's ability was about to take us out */
  function remote(attackerId, charId) {
    var M = window.MPJJ;
    if (!M || F.on) return;
    var f = M.fighters[attackerId];
    if (!f || !f.e) return;
    start(selfHandle(), entHandle(f.e), charId || f.char || 'gojo');
  }

  function endCine() {
    if (!F.on) return;
    var A = F.A, V = F.V, cut = F.cut;
    clearStage();
    white(0);
    panelDark(0);
    card(false);
    FX.letterbox(false);
    FX.tint('#000000', 0);
    hudOff(false);
    A.rig.root.position.copy(F.homeA);
    V.rig.root.position.copy(F.homeV);
    A.rig.root.rotation.set(0, 0, 0);
    V.rig.root.rotation.set(0, 0, 0);
    A.rig.root.visible = true;
    V.rig.root.visible = true;
    if (F.fog && scene.fog) { scene.fog.near = F.fog.near; scene.fog.far = F.fog.far; F.fog = null; }
    A.release(); V.release();
    F.on = false;
    if (window.JJGORE) { window.JJGORE.release(A.ent); window.JJGORE.release(V.ent); }

    /* and now it lands. The victim applies it to themselves, because a hit
       arriving while their own copy of the cut was still running would
       have been thrown away. */
    var away = new THREE.Vector3();
    var style = cut.end || 'ragdoll';
    if (V.self) {
      away.subVectors(player.pos, (A.ent && A.ent.pos) || player.pos);
      if (away.lengthSq() < .01) away.set(0, 0, 1);
      away.y = 0; away.normalize().multiplyScalar(26); away.y = 14;
      if (window.JJGORE && style !== 'ragdoll') window.JJGORE.mark(player, style);
      player.iframes = 0;
      hurtPlayer(999, away);
      player.iframes = 1.4;
    } else if (A.self && V.ent && V.ent.damage && !V.ent.net) {
      /* a remote victim kills themselves at the end of their own copy of
         the cut — sending them one from here would land twice */
      away.subVectors(V.ent.pos, player.pos);
      if (away.lengthSq() < .01) away.set(0, 0, 1);
      away.y = 0; away.normalize().multiplyScalar(26); away.y = 14;
      V.ent.damage(999, away, {
        react: style === 'burn' ? 'burn' : 'dismantle', reactDur: .8,
        spark: 0xffffff, noFrameBonus: true, death: style, fin: false
      });
    }

    /* both of them arriving back where they were standing */
    [F.homeA, F.homeV].forEach(function (h) {
      FX.ring(new THREE.Vector3(h.x, .1, h.z), 0xffffff, { maxR: 9, life: .5 });
      FX.dust(new THREE.Vector3(h.x, 0, h.z), 6, 0xc9bda6, 8, 3);
    });
    FX.flash('#ffffff', .35, .45);
    addShake(.5);
    if (window.JJAW && A.self) window.JJAW.gain(24);
  }

  function stepCine(dt) {
    F.dt = dt;
    if (F.freeze > 0) {                              // a hold stops the clock
      F.freeze -= dt;
      if (AN) AN.camTo(camera.position.x, camera.position.y, camera.position.z,
        F.lastLook ? F.lastLook.x : camera.position.x,
        F.lastLook ? F.lastLook.y : camera.position.y,
        F.lastLook ? F.lastLook.z : camera.position.z - 1, dt, 90);
      return;
    }
    var beats = F.cut.beats;
    F.t += dt;
    F.bt += dt;
    if (F.beat < 0 || F.bt >= beats[F.beat].dur) {
      if (F.beat >= 0 && beats[F.beat].exit) beats[F.beat].exit();
      F.beat++;
      F.bt = 0;
      F.flags = {};
      if (F.beat >= beats.length) { endCine(); return; }
      if (AN) AN.camRelease();
      if (beats[F.beat].enter) beats[F.beat].enter();
    }
    var b = beats[F.beat];
    b.step(F.bt, F.bt / b.dur);

    if (AN && F.smA) {
      var eA = F.smA.step(dt), eV = F.smV.step(dt);
      AN.life(F.A.rig, F.t, .8);
      AN.life(F.V.rig, F.t * 1.13, .55);
      AN.smear(F.A.rig, eA, F.smearA, dt, F.cut.smear || 0xffffff, 30);
      AN.smear(F.V.rig, eV, F.smearV, dt, 0xffb0b8, 34);
    }
    F.lastLook = camera.position.clone().add(
      camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));

    if (F.A.self) { player.iframes = 9e9; player.vel.set(0, 0, 0); }
    if (F.V.self) { player.iframes = 9e9; player.vel.set(0, 0, 0); }
  }

  /* shorthand the beats use constantly */
  function A() { return F.A; }
  function V() { return F.V; }

  /* =====================================================================
     THE CUTS
     ================================================================== */
  var CUTS = {};

  /* ------------------------------------------------------------ GOJO
     Blue takes them off the floor, red puts them through a wall, and
     what the two of them make between his hands does the rest. */
  CUTS.gojo = {
    name: 'THROUGHOUT HEAVEN AND EARTH', sub: 'LAPSE · REVERSAL · HOLLOW',
    color: '#8b5cff', smear: 0x9fd8ff, end: 'burn',
    beats: [

    /* 1 · a white room, and him walking into it */
    { dur: 4.2, enter: function () {
        clearStage();
        backdrop('#ffffff', '#c8d8f0');
        slab(90, 90, 0xe8edf6);
        pillars(9, 26, 22, 0xdfe6f2);
        put(V(), 0, 0, 0, Math.PI);
        put(A(), 0, 0, 24, Math.PI);
        FX.tint('#0a1024', .2, 4);
      },
      step: function (t) {
        poseKneel(V().rig, t);
        var walk = Math.min(1, t / 3.4);
        poseWalk(A().rig, t * .8, .8);
        move(A(), 0, 0, 24 - E.out(walk) * 14);
        if (Math.random() < .2) FX.mote(sp(0, 2, 8), 0x6fb4ff, 7, .5);
        shot(t, [
          { t: 0, p: [7, 1.2, -7], l: [0, 2.6, 6] },
          { t: 2.2, p: [9, 2.4, -2], l: [0, 3, 8] },
          { t: 4.2, p: [8, 3.4, 4], l: [0, 3.2, 10] }
        ]);
        if (t > 3.3) once('stop', function () {
          FX.ring(sp(0, .2, 10), 0x3a7dff, { maxR: 8, life: .6 });
          FX.dust(sp(0, 0, 10), 5, 0xd8e2f4, 6, 2.4);
        });
      } },

    /* 2 · blue: they come off the floor and everything goes with them */
    { dur: 3.6, enter: function () {
        FX.flash('#dfefff', .4, .3);
        try { sfx.raise(); } catch (e) {}
      },
      step: function (t) {
        posePoint(A().rig, Math.min(1, t / .8), 1);
        move(A(), 0, 0, 10);
        var lift = E.out(Math.min(1, Math.max(0, t - .5) / 2));
        poseLimp(V().rig, t);
        move(V(), 0, lift * 7, -lift * 3);
        V().rig.root.rotation.z = lift * .3;
        if (Math.random() < .7) {
          FX.mote(sp(0, 3 + lift * 6, -1), 0x3a7dff, 9, .55);
        }
        if (t > .5 && Math.random() < .25) {
          FX.streaks(sp((Math.random() - .5) * 20, Math.random() * 12, (Math.random() - .5) * 20),
            0x6fb4ff, 1, 16, 1.1);
        }
        shot(t, [
          { t: 0, p: [6, 2.4, 5], l: [0, 3, 0] },
          { t: 1.4, p: [8, 5, 2], l: [0, 6, -1] },
          { t: 3.6, p: [10, 9, -2], l: [0, 9, -3] }
        ]);
        if (t > 1.1) once('pull', function () {
          FX.rings(sp(0, 7, -2), 0x3a7dff, 4, { maxR: 14, life: .7, ground: false, gap: 60 });
          FX.converge(sp(0, 7, -2), 0x9fd8ff, 30, 16, .9);
        });
      } },

    /* 3 · red, and the wall behind them */
    { dur: 3.2, enter: function () {
        box(46, 30, 3, 0xdfe6f2, 0, 15, -26);
        try { sfx.redFire(); } catch (e) {}
      },
      step: function (t) {
        posePoint(A().rig, 1, 0);
        var fly = E.out(Math.min(1, Math.max(0, t - .45) / .8));
        poseFly(V().rig, fly);
        move(V(), 0, 7 - fly * 1.5, -3 - fly * 19);
        shot(t, [
          { t: 0, p: [12, 8, 2], l: [0, 7, -6] },
          { t: .8, p: [14, 9, -6], l: [0, 8, -18] },
          { t: 3.2, p: [11, 7, -12], l: [0, 6, -24] }
        ]);
        if (t > .4) once('fire', function () {
          FX.impact(sp(0, 7, 0), 0xff3b4d, 3);
          FX.cross(sp(0, 7, 0), 0xffd0d4, 8, .3);
          FX.wave(sp(0, 7, -2), new THREE.Vector3(0, 0, -1), 0xff3344,
            { steps: 5, gap: 40, reach: 5, r0: 6, grow: 2.4 });
          addShake(1.2);
        });
        if (t > 1.25) once('wall', function () {
          FX.flash('#ffd9dd', .55, .3);
          FX.impact(sp(0, 8, -24), 0xff3b4d, 5);
          FX.debris(sp(0, 6, -22), 22, 24, 0xbfc8da);
          FX.rings(sp(0, 8, -24), 0xff7788, 4, { maxR: 26, life: .7, ground: false, gap: 44 });
          hold(.2);
          addShake(1.8);
          try { sfx.redBoom(); } catch (e) {}
        });
        if (t > 1.25) shakeCam(.4);
      } },

    /* 4 · one second of the six eyes, and nothing either side of it */
    { dur: 2.2, enter: function () {
        panelDark(.92);
        FX.mangaLines(true, 2);
      },
      step: function (t) {
        cam(3.4, 4.2, 4, 0, 4, 0, 40);
        if (t > .3) once('eyes', function () { try { sfx.frame(); } catch (e) {} });
      },
      exit: function () { panelDark(0); FX.mangaLines(false, 0); } },

    /* 5 · blue in one hand, red in the other */
    { dur: 3.8, enter: function () {
        clearStage();
        backdrop('#f4f8ff', '#93a8cc');
        slab(90, 90, 0xd8e0ee);
        rubble(22, 34, 0xc2cadb);
        put(A(), 0, 0, 6, Math.PI);
        put(V(), 0, 0, -14, .3);
        FX.tint('#050a18', .35, 3.6);
      },
      step: function (t) {
        poseCharge(A().rig, Math.min(1, t / 1.4));
        poseLimp(V().rig, t);
        V().rig.root.rotation.x = -.25;
        move(V(), 0, .4, -14);
        var spin = t * 3;
        var bl = sp(Math.cos(spin) * 1.6 - .9, 3.4, 6 + Math.sin(spin) * .8);
        var rd = sp(-Math.cos(spin) * 1.6 + .9, 3.4, 6 - Math.sin(spin) * .8);
        if (Math.random() < .8) FX.mote(bl, 0x3a7dff, 2.4, .3);
        if (Math.random() < .8) FX.mote(rd, 0xff3344, 2.4, .3);
        shot(t, [
          { t: 0, p: [8, 3, 14], l: [0, 3.4, 4] },
          { t: 2, p: [4.5, 3.6, 11], l: [0, 3.4, 5] },
          { t: 3.8, p: [2.6, 3.4, 9.6], l: [0, 3.4, 5.4] }
        ]);
        if (t > 2.6) shakeCam(.08 + (t - 2.6) * .2);
      } },

    /* 6 · and the two of them put together */
    { dur: 3.0, enter: function () {
        FX.converge(sp(0, 3.6, 4.4), 0x8b5cff, 40, 14, 1);
        try { sfx.raise(); } catch (e) {}
      },
      step: function (t) {
        poseCharge(A().rig, 1);
        poseLimp(V().rig, t);
        move(V(), 0, .4, -14);
        var k = Math.min(1, t / 2.2);
        if (Math.random() < .9) FX.mote(sp(0, 3.6, 4.4), 0x8b5cff, 3 + k * 3, .4);
        if (t > 1 && Math.random() < .4) {
          FX.streaks(sp(0, 3.6, 4.4), 0xc9a8ff, 2, 9, 1.2);
        }
        cam(2.2 - t * .2, 3.8, 9 - t * .8, 0, 3.6, 4.4, 30);
        shakeCam(.1 + k * .5);
        if (t > 2.2) once('formed', function () {
          FX.flash('#e6d8ff', .5, .25);
          FX.impact(sp(0, 3.6, 4.4), 0x8b5cff, 3);
          hold(.24);
        });
      } },

    /* 7 · they look up */
    { dur: 2.4, enter: function () {},
      step: function (t) {
        poseCharge(A().rig, 1);
        rp(V().rig);
        var up = E.out(Math.min(1, t / 1.2));
        poseLimp(V().rig, t);
        V().rig.neck.rotation.x = .8 - 1.5 * up;
        move(V(), 0, .4, -14);
        cam(1.6, 3.2, -9.5, 0, 3.4, -13.4, 26);
        if (Math.random() < .3) FX.mote(sp(0, 3, -13), 0x8b5cff, 5, .5);
        shakeCam(.16);
      } },

    /* 8 · hollow purple, and the room */
    { dur: 4.0, enter: function () {
        FX.flash('#ffffff', .8, .35);
        FX.beam(sp(0, 3.6, 3.4), new THREE.Vector3(0, 0, -1), 90, 0x8b5cff, { radius: 5, life: 2.4 });
        FX.beam(sp(0, 3.6, 3.4), new THREE.Vector3(0, 0, -1), 90, 0xffffff, { radius: 2, life: 2.2 });
        FX.beam(sp(0, 3.6, 3.4), new THREE.Vector3(0, 0, -1), 90, 0x2a0a3a, { radius: 7.4, life: 2.4 });
        addShake(3);
        hold(.26);
        try { sfx.blast(); } catch (e) {}
      },
      step: function (t) {
        posePoint(A().rig, 1, 1);
        A().rig.shoulderL.rotation.x = -1.5;
        move(A(), 0, 0, 6);
        poseFly(V().rig, Math.min(1, t / .6));
        move(V(), 0, .8 + Math.sin(t * 3) * .3, -14 - t * 1.6);
        if (Math.random() < .9) {
          FX.mote(sp((Math.random() - .5) * 6, 3.6, -6 - Math.random() * 30), 0xc9a8ff, 5, .4);
        }
        if (Math.random() < .5) {
          FX.streaks(sp((Math.random() - .5) * 8, 3.6, -10 - Math.random() * 24), 0xffffff, 2, 22, 1.6);
        }
        shot(t, [
          { t: 0, p: [13, 4.4, 6], l: [0, 3.6, -6] },
          { t: 1.6, p: [16, 6, -8], l: [0, 3.6, -18] },
          { t: 4, p: [12, 5, -20], l: [0, 3.4, -28] }
        ]);
        shakeCam(.5);
        if (t > 1.4) once('erase', function () {
          FX.rings(sp(0, 3.6, -20), 0x8b5cff, 5, { maxR: 40, life: .9, ground: false, gap: 50 });
          FX.debris(sp(0, 1, -20), 26, 30, 0xb4bccc);
          addShake(2.4);
        });
      } },

    /* 9 · what is left of them comes out of the other end of it */
    { dur: 3.2, enter: function () {
        clearStage();
        backdrop('#2a1a34', '#0a0610');
        slab(90, 90, 0x3a2e3c);
        rubble(30, 34, 0x2a2028);
        put(A(), 0, 0, 10, Math.PI);
        put(V(), 0, 0, -6, .6);
        FX.scorch(sp(0, 0, -6), 12, 24);
      },
      step: function (t) {
        poseOver(A().rig, t);
        move(A(), 0, 0, 10 - Math.min(1, t / 2) * 4);
        poseDown(V().rig);
        V().rig.root.rotation.set(-Math.PI / 2 + .1, .6, 0);
        move(V(), 0, .5, -6);
        if (Math.random() < .5) {
          FX.flame(sp((Math.random() - .5) * 3, .4 + Math.random() * 2, -6 + (Math.random() - .5) * 3),
            1 + Math.random() * 1.4, .6);
        }
        if (Math.random() < .3) FX.dust(sp(0, 1, -6), 1, 0x2a2028, 3, 2.6);
        shot(t, [
          { t: 0, p: [8, 6, -16], l: [0, 1.4, -6] },
          { t: 3.2, p: [4.4, 2.4, -13], l: [0, 1.2, -6] }
        ]);
      } },

    /* 10 · white */
    { dur: 2.4, enter: function () {},
      step: function (t) {
        white(Math.min(1, t / 1.6));
        cam(4.4, 2.4, -13, 0, 1.2, -6, 20);
      },
      exit: function () { white(0); } }
    ]
  };

  /* ----------------------------------------------------------- NAOYA
     He is never where the swing goes. Twenty four passes, one per frame,
     and then the lines they left open at once. */
  CUTS.naoya = {
    name: 'TWENTY FOUR FRAMES', sub: "NAOYA ZEN'IN · PROJECTION SORCERY",
    color: '#9fd8ff', smear: 0x9fd8ff, end: 'sever',
    beats: [

    /* 1 · a corridor of nothing, and then he is in it */
    { dur: 3.6, enter: function () {
        clearStage();
        backdrop('#dbe8f4', '#5b7590');
        slab(30, 120, 0x9aa8b8);
        for (var i = 0; i < 12; i++) {
          box(2, 16, 2, 0x7c8b9c, (i % 2 ? 1 : -1) * 12, 8, -40 + i * 8);
        }
        put(V(), 0, 0, -6, 0);
        put(A(), 0, 0, -34, 0);
        FX.tint('#08111c', .25, 3.4);
      },
      step: function (t) {
        poseGuard(V().rig);
        V().rig.root.rotation.y = Math.PI + Math.sin(t) * .1;
        poseStand(A().rig, t);
        /* he is not in the corridor, and then he is, and there is no frame
           in between where he was arriving */
        A().rig.root.visible = t >= 1.6;
        if (t >= 1.6) once('arrive', function () {
          put(A(), 3.4, 0, -3.4, -2.3);
          FX.trail(A().rig, 0x9fd8ff, 5, 34, .5);
          FX.speedRing(sp(3.4, 2.6, -3.4), 0xdfefff, 9, .35);
          FX.dust(sp(3.4, 0, -3.4), 5, 0xc9d3e2, 6, 2.2);
          addShake(.5);
          try { sfx.dash(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [7, 2.6, -14], l: [0, 3, -6] },
          { t: 1.55, p: [6, 2.8, -12], l: [0, 3, -6] },
          { t: 1.65, p: [8, 3.4, -10], l: [1.4, 3, -5] },
          { t: 3.6, p: [7, 3.2, -11], l: [1.6, 3, -5] }
        ]);
      } },

    /* 2 · hit from four sides inside a second */
    { dur: 3.0, enter: function () { try { sfx.whoosh(); } catch (e) {} },
      step: function (t) {
        var n = Math.min(3, Math.floor(t / .55));
        var spots = [[3.4, -3.4, -2.3], [-3.6, -3, 2.3], [0, -9.4, 0], [.6, -1.6, 3.1]];
        var s = spots[n];
        put(A(), s[0], 0, s[1], s[2]);
        posePunch(A().rig, ((t / .55) % 1), n % 2);
        poseGut(V().rig, Math.min(1, (t % .55) / .3));
        move(V(), 0, 0, -6);
        V().rig.root.rotation.y = Math.PI + n * .5;
        once('pass' + n, function () {
          FX.trail(A().rig, 0x9fd8ff, 4, 26, .45);
          FX.impact(sp(0, 3, -6), 0x9fd8ff, 1.8);
          FX.speedRing(sp(0, 3, -6), 0xdfefff, 7, .3);
          FX.blood(sp(0, 3, -6), new THREE.Vector3(s[0], .4, s[1]).normalize(), 4, 1);
          addShake(.7);
          hold(.08);
          try { sfx.hit(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [6.4, 3.2, -12], l: [0, 3, -6] },
          { t: 1.1, p: [-6, 3.6, -11], l: [0, 3, -6] },
          { t: 2.2, p: [5, 4.6, -1.4], l: [0, 3, -6] },
          { t: 3, p: [6, 3, -12], l: [0, 3, -6] }
        ]);
        shakeCam(.1);
      } },

    /* 3 · they swing at where he was */
    { dur: 2.8, enter: function () { put(A(), -4.6, 0, -10.4, 2.5); },
      step: function (t) {
        posePunch(V().rig, Math.min(1, t / 1.5), 1);
        move(V(), 0, 0, -6);
        V().rig.root.rotation.y = Math.PI + .4;
        poseStand(A().rig, t, .6);
        A().rig.neck.rotation.y = .35;
        if (t > 1.4) once('miss', function () {
          FX.streaks(sp(0, 3, -8), 0xdfefff, 5, 12, 1.2);
          FX.mangaLines(true, .5);
          try { sfx.whoosh(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [-7, 3.4, -13], l: [-2, 3, -8] },
          { t: 1.4, p: [-5.4, 3, -12], l: [-3.4, 3.2, -10] },
          { t: 2.8, p: [-6.6, 3.2, -13.4], l: [-4.4, 3.3, -10.4] }
        ]);
      } },

    /* 4 · the tanto */
    { dur: 3.4, enter: function () {
        if (A().rig.tanto) A().rig.tanto.visible = true;
        try { sfx.stab(); } catch (e) {}
      },
      step: function (t) {
        var k = Math.min(1, t / 2.4);
        poseSlash(A().rig, k, 1);
        move(A(), -1.4, 0, -8.6);
        face(A(), 1.9);
        if (t < 1.9) { poseGuard(V().rig); V().rig.root.rotation.y = Math.PI + .4; }
        else poseGut(V().rig, (t - 1.9) / 1.5);
        move(V(), 0, 0, -6);
        if (t > 1.55) once('cut', function () {
          FX.cutLine(sp(-2.4, 4.6, -6), sp(2.4, 1.4, -6), 0xffffff, 1, .4);
          FX.blood(sp(0, 3, -5.6), new THREE.Vector3(0, .4, 1), 10, 1.4);
          FX.flash('#ffffff', .4, .18);
          hold(.16);
          addShake(1);
          try { sfx.slash(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [-6, 3.4, -12.6], l: [-1, 3.2, -8] },
          { t: 1.5, p: [-3.4, 3.4, -10.4], l: [0, 3, -6] },
          { t: 1.6, p: [-2.2, 3.2, -9], l: [0, 3, -6] },
          { t: 3.4, p: [-3, 3, -9.6], l: [0, 2.8, -6] }
        ]);
      } },

    /* 5 · the cut opens */
    { dur: 2.2, enter: function () { panelDark(.85); },
      step: function (t) {
        cam(-2, 3.2, -9, 0, 3, -6, 40);
        if (t > .8) once('open', function () {
          FX.blood(sp(0, 3, -5.6), new THREE.Vector3(0, 0, 1), 8, 1.5);
        });
      },
      exit: function () { panelDark(0); } },

    /* 6 · twenty four passes, and a line left by every one of them */
    { dur: 4.6, enter: function () { try { sfx.whoosh(); } catch (e) {} },
      step: function (t) {
        var pass = Math.floor(t / (4.6 / 24));
        poseLimp(V().rig, t);
        move(V(), 0, .3, -6);
        var a = pass * 2.4;
        put(A(), Math.cos(a) * 5.5, 0, -6 + Math.sin(a) * 5.5, -a + Math.PI / 2);
        poseSlash(A().rig, (t / (4.6 / 24)) % 1, pass % 2);
        once('p' + pass, function () {
          var ang = Math.random() * TAU;
          var r = 2.6;
          FX.cutLine(sp(Math.cos(ang) * r, 3 + Math.sin(ang) * r, -6),
            sp(-Math.cos(ang) * r, 3 - Math.sin(ang) * r, -6), 0xffffff, .5, .3);
          FX.blood(sp((Math.random() - .5) * 1.6, 2 + Math.random() * 2.4, -5.8),
            new THREE.Vector3(Math.cos(ang), Math.sin(ang), .5), 3, .9);
          if (pass % 3 === 0) {
            FX.trail(A().rig, 0x9fd8ff, 2, 20, .4);
            FX.speedRing(sp(0, 3, -6), 0xdfefff, 6, .22);
            addShake(.3);
          }
        });
        shot(t, [
          { t: 0, p: [7, 3.4, -11], l: [0, 3, -6] },
          { t: 2.3, p: [-6, 4.4, -1.4], l: [0, 3, -6] },
          { t: 4.6, p: [4.4, 3, -11.4], l: [0, 3, -6] }
        ]);
        shakeCam(.14);
      } },

    /* 7 · held up, and made to look at the lines */
    { dur: 3.0, enter: function () {
        put(A(), 1.8, 0, -8, 2.9);
      },
      step: function (t) {
        poseHold(A().rig, Math.min(1, t / .6), 0);
        poseLimp(V().rig, t);
        move(V(), 0, 1.4 * E.out(Math.min(1, t / .8)), -6);
        V().rig.root.rotation.y = Math.PI + .3;
        if (Math.random() < .25) {
          FX.blood(sp((Math.random() - .5) * 1.4, 2.6 + Math.random() * 2, -5.6),
            new THREE.Vector3(0, -1, .3), 1, .8);
        }
        shot(t, [
          { t: 0, p: [4.4, 4.4, -10.4], l: [.6, 4, -6.6] },
          { t: 3, p: [3, 4.6, -9.4], l: [.6, 4.2, -6.6] }
        ]);
      } },

    /* 8 · the last pass, and he puts it away */
    { dur: 3.2, enter: function () {},
      step: function (t) {
        var k = Math.min(1, t / 1.1);
        poseSlash(A().rig, k, 1);
        move(A(), 1.8 - E.out(k) * 7, 0, -8 + E.out(k) * 2);
        if (t < 1) { poseLimp(V().rig, t); move(V(), 0, 1.4, -6); }
        else {
          poseLimp(V().rig, t);
          move(V(), 0, Math.max(.2, 1.4 - (t - 1) * 2), -6);
        }
        if (t > .8) once('last', function () {
          FX.cutLine(sp(-3.4, 4.4, -6), sp(3.4, 1.6, -6), 0xffffff, 1.4, .45);
          FX.flash('#ffffff', .55, .2);
          FX.mangaLines(true, .4);
          hold(.22);
          addShake(1.4);
          try { sfx.slash(); } catch (e) {}
        });
        if (t > 2.2) once('sheathe', function () {
          if (A().rig.tanto) A().rig.tanto.visible = false;
          try { sfx.tpDone(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [4, 4, -10], l: [0, 3.6, -6] },
          { t: 1, p: [-4.4, 3.4, -8.4], l: [0, 3.2, -6] },
          { t: 3.2, p: [-6.4, 3, -9.4], l: [-2, 3, -6.4] }
        ]);
      } },

    /* 9 · and then all of them open */
    { dur: 2.8, enter: function () {
        FX.flash('#ffffff', .7, .3);
        hold(.2);
      },
      step: function (t) {
        poseStand(A().rig, t, .5);
        A().rig.root.rotation.y = 1.2;
        poseLimp(V().rig, t);
        move(V(), 0, .2, -6);
        if (t > .4 && Math.random() < .5) {
          FX.blood(sp((Math.random() - .5) * 2, 1 + Math.random() * 3, -5.8),
            new THREE.Vector3((Math.random() - .5), .3, 1), 2, 1.1);
        }
        cam(-5.4, 3, -9.4, -1, 2.6, -6.2, 22);
      } },

    /* 10 · white */
    { dur: 2.4, enter: function () {},
      step: function (t) {
        white(Math.min(1, t / 1.6));
        cam(-5.4, 3, -9.4, -1, 2.6, -6.2, 20);
      },
      exit: function () { white(0); } }
    ]
  };

  /* ------------------------------------------------------------ YUJI
     No technique, so all of it goes through the floor, the hips and the
     fist, in that order — and the last one is a hundredth of a second. */
  CUTS.yuji = {
    name: 'BLACK FLASH', sub: '0.000001 SECONDS',
    color: '#ff2a4a', smear: 0xff8a9a, end: 'ragdoll',
    beats: [

    /* 1 · a yard at dusk */
    { dur: 3.6, enter: function () {
        clearStage();
        backdrop('#d8703a', '#2a1830');
        slab(80, 80, 0x4a4038);
        pillars(7, 30, 14, 0x3a332c);
        rubble(16, 26, 0x54493e);
        put(A(), 0, 0, 8, Math.PI);
        put(V(), 0, 0, -2, 0);
        FX.tint('#1a0c10', .3, 3.4);
      },
      step: function (t) {
        poseStand(A().rig, t, 1.4);
        /* he wipes his mouth with the back of his hand */
        var w = Math.max(0, Math.min(1, (t - .8) / .7));
        A().rig.shoulderR.rotation.x = -.1 - 1.9 * Math.sin(w * Math.PI);
        A().rig.elbowR.rotation.x = -.22 - 1.5 * Math.sin(w * Math.PI);
        var up = Math.max(0, Math.min(1, (t - 1.6) / 1.6));
        poseKneel(V().rig, t);
        V().rig.hips.position.y = V().rig.hipsBaseY - 1.35 + E.out(up) * 1.35;
        V().rig.hipL.rotation.x = -1.5 + up * 1.5;
        V().rig.kneeL.rotation.x = 2.3 - up * 2.1;
        V().rig.hipR.rotation.x = -.85 + up * .85;
        V().rig.kneeR.rotation.x = 1.5 - up * 1.35;
        shot(t, [
          { t: 0, p: [6, 1.4, 2], l: [0, 2.4, 0] },
          { t: 1.8, p: [5.4, 3, 4], l: [0, 3, 2] },
          { t: 3.6, p: [6.4, 3.4, 6], l: [0, 3, 1] }
        ]);
      } },

    /* 2 · divergent fist: it lands, and then it lands again */
    { dur: 3.4, enter: function () { try { sfx.punch(); } catch (e) {} },
      step: function (t) {
        var k = Math.min(1, t / 1.5);
        posePunch(A().rig, k, 1);
        move(A(), 0, 0, 8 - E.out(k) * 4.6);
        if (t < 1.05) poseGuard(V().rig);
        else poseGut(V().rig, (t - 1.05) / 2);
        move(V(), 0, 0, -2);
        if (t > 1) once('first', function () {
          FX.impact(sp(0, 3, 0), 0xffd76a, 2.2);
          FX.cross(sp(0, 3, 0), 0xffffff, 4, .2);
          addShake(.8);
          hold(.1);
          try { sfx.punch(); } catch (e) {}
        });
        if (t > 1.55) once('second', function () {           // the divergence
          FX.flash('#ffe6c0', .5, .22);
          FX.impact(sp(0, 3, 0), 0xff5f6d, 3.4);
          FX.rings(sp(0, 3, 0), 0xffd76a, 3, { maxR: 12, life: .5, ground: false, gap: 40 });
          FX.speedRing(sp(0, 3, 0), 0xffffff, 10, .35);
          addShake(1.6);
          hold(.18);
          try { sfx.palm(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [6.4, 3.4, 4], l: [0, 3, 0] },
          { t: 1.5, p: [3.4, 3.2, 2.6], l: [0, 3, -.6] },
          { t: 1.62, p: [2.4, 3, 1.6], l: [0, 3, -1] },
          { t: 3.4, p: [4.4, 3.4, 3.4], l: [0, 2.8, -1] }
        ]);
      } },

    /* 3 · he takes the arm and turns */
    { dur: 2.6, enter: function () {},
      step: function (t) {
        poseHold(A().rig, Math.min(1, t / .8), 1);
        move(A(), 0, 0, 3.4);
        face(A(), Math.PI + Math.min(1, t / 2) * 2.4);
        poseGut(V().rig, .6);
        var sp2 = Math.min(1, t / 2);
        move(V(), Math.sin(sp2 * 2.4) * 2.4, .4, -2 + (1 - Math.cos(sp2 * 2.4)) * 2.4);
        face(V(), sp2 * 3.4);
        if (t > .4 && Math.random() < .5) {
          FX.dust(sp(0, 0, 0), 1, 0xc9bda6, 5, 2.2);
        }
        cam(6, 3.4, 5, 0, 3, .4, 20);
      } },

    /* 4 · the manji kick takes them up with it */
    { dur: 3.2, enter: function () { try { sfx.kick(); } catch (e) {} },
      step: function (t) {
        var k = Math.min(1, t / 1.2);
        /* a turning kick, driven off the hips */
        rp(A().rig);
        var turn = E.out(k);
        A().rig.spine.rotation.y = -2.2 * turn;
        A().rig.hipR.rotation.x = -1.9 * turn;
        A().rig.kneeR.rotation.x = 1.5 * turn - 1.2 * Math.max(0, (k - .5) / .5);
        A().rig.hipL.rotation.x = .35 * turn;
        A().rig.shoulderL.rotation.x = -1.5 * turn;
        A().rig.shoulderR.rotation.x = .8 * turn;
        A().rig.hips.position.y = A().rig.hipsBaseY - .45 * turn;
        move(A(), 0, 0, 3.4);
        face(A(), Math.PI + 2.4 + turn * 1.2);
        var fly = Math.max(0, Math.min(1, (t - .95) / 2));
        poseFly(V().rig, fly);
        move(V(), 2.4, E.out(fly) * 11, .4 + fly * 2);
        V().rig.root.rotation.set(fly * 1.4, 3.4, fly * .8);
        if (t > .9) once('kick', function () {
          FX.impact(sp(2.4, 3, .4), 0xffd76a, 3);
          FX.cross(sp(2.4, 3, .4), 0xffffff, 6, .24);
          FX.speedRing(sp(2.4, 3, .4), 0xffe6c0, 11, .4);
          FX.dust(sp(0, 0, 1), 6, 0xc9bda6, 9, 3);
          addShake(1.6);
          hold(.16);
          try { sfx.kick(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [7, 2.4, 4.4], l: [1, 3, 1] },
          { t: 1.1, p: [8, 5, 3], l: [2, 6, 1] },
          { t: 3.2, p: [9, 10, 2], l: [2.4, 11, 2] }
        ]);
      } },

    /* 5 · and he is already above them */
    { dur: 2.2, enter: function () { FX.trail(A().rig, 0xff8a9a, 4, 30, .5); },
      step: function (t) {
        var k = E.out(Math.min(1, t / 1.2));
        poseSmash(A().rig, Math.min(1, t / 2));
        move(A(), 2.4, 4 + k * 10, 2);
        face(A(), 3.4 + Math.PI);
        poseFly(V().rig, 1);
        move(V(), 2.4, 11.4, 2.4);
        V().rig.root.rotation.set(1.4, 3.4, .8);
        cam(8, 14, 3, 2.4, 12.4, 2.2, 24);
        if (Math.random() < .4) FX.streaks(sp(2.4, 12, 2), 0xffd76a, 1, 10, 1);
      } },

    /* 6 · down, through the floor */
    { dur: 3.4, enter: function () { try { sfx.whoosh(); } catch (e) {} },
      step: function (t) {
        var fall = Math.min(1, t / .55);
        poseSmash(A().rig, .55 + fall * .45);
        move(A(), 2.4, 14 - fall * fall * 12, 2);
        poseFly(V().rig, 1);
        move(V(), 2.4, 11.4 - fall * fall * 11, 2.4);
        V().rig.root.rotation.set(1.4 + fall * .2, 3.4, .8);
        if (t > .55) {
          poseDown(V().rig);
          V().rig.root.rotation.set(-Math.PI / 2, 3.4, 0);
          move(V(), 2.4, .5, 2.4);
          poseOver(A().rig, t);
          move(A(), 2.4, 0, 4.4);
        }
        if (t > .5) once('land', function () {
          FX.flash('#ffffff', .6, .25);
          FX.impact(sp(2.4, 1.4, 2.4), 0xffd76a, 4.5);
          FX.rings(sp(2.4, .4, 2.4), 0xffe6c0, 4, { maxR: 24, life: .8, gap: 46 });
          FX.cracks(sp(2.4, 0, 2.4), 12, 22, 0x1a1410);
          FX.debris(sp(2.4, 0, 2.4), 22, 22, 0x4a4038);
          FX.dust(sp(2.4, 0, 2.4), 12, 0xbfb2a0, 16, 4.4);
          addShake(2.6);
          hold(.24);
          try { sfx.redBoom(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [8, 12, 3.4], l: [2.4, 10, 2.2] },
          { t: .6, p: [8, 3.4, 5], l: [2.4, 1.4, 2.4] },
          { t: 3.4, p: [7, 2.6, 6.4], l: [2.4, 1.2, 2.4] }
        ]);
        if (t > .5 && t < 1.2) shakeCam(.6);
      } },

    /* 7 · the frame goes out */
    { dur: 2.4, enter: function () { panelDark(.96); },
      step: function (t) {
        cam(4.4, 2.4, 6, 2.4, 1.4, 2.4, 34);
        if (t > 1.2) once('charge', function () {
          FX.mangaLines(true, 1);
          try { sfx.raise(); } catch (e) {}
        });
      },
      exit: function () { panelDark(0); FX.mangaLines(false, 0); } },

    /* 8 · black flash */
    { dur: 3.8, enter: function () {
        put(A(), 2.4, 0, 5.4, Math.PI);
        put(V(), 2.4, 0, 1.4, 0);
      },
      step: function (t) {
        var k = Math.min(1, t / 1.1);
        posePunch(A().rig, k, 1);
        move(A(), 2.4, 0, 5.4 - E.out(k) * 2.4);
        if (t < .95) { poseKneel(V().rig, t); move(V(), 2.4, 0, 1.4); }
        else {
          var fly2 = Math.min(1, (t - .95) / 2.2);
          poseFly(V().rig, fly2);
          move(V(), 2.4, 1.4 + Math.sin(fly2 * 2) * 1.4, 1.4 - E.out(fly2) * 26);
          V().rig.root.rotation.set(fly2 * .8, 0, fly2 * 1.2);
        }
        if (t > .9) once('flash', function () {
          FX.flash('#000000', 1, .1);
          setTimeout(function () { try { FX.flash('#ffffff', 1, .3); } catch (e) {} }, 90);
          /* the black line work thrown through the air */
          for (var i = 0; i < 9; i++) {
            var a = i / 9 * TAU;
            FX.cutLine(sp(2.4, 3, 1.4),
              sp(2.4 + Math.cos(a) * 14, 3 + Math.sin(a) * 12, 1.4 - Math.random() * 6),
              0x14060a, 1.4, .5);
          }
          FX.impact(sp(2.4, 3, 1.4), 0xff2a4a, 6);
          FX.rings(sp(2.4, 3, 1.4), 0xff2a4a, 5, { maxR: 34, life: .9, ground: false, gap: 40 });
          FX.cracks(sp(2.4, 0, 1.4), 14, 26, 0x14060a);
          FX.debris(sp(2.4, 0, 1.4), 26, 28, 0x4a4038);
          addShake(3.4);
          hold(.34);
          FX.zoom(16, .6);
          try { sfx.redBoom(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [6.4, 3.4, 4.4], l: [2.4, 3, 2] },
          { t: .95, p: [4.4, 3.2, 3.4], l: [2.4, 3, 1.4] },
          { t: 1.1, p: [10, 4.4, 0], l: [2.4, 3, -4] },
          { t: 3.8, p: [12, 5, -10], l: [2.4, 2.4, -18] }
        ]);
        if (t > .9) shakeCam(.5);
      } },

    /* 9 · and he stands there getting his breath back */
    { dur: 3.0, enter: function () {
        put(V(), 2.4, .5, -24, 0);
        put(A(), 2.4, 0, -18, 0);
      },
      step: function (t) {
        poseOver(A().rig, t * 2.4);
        A().rig.spine.rotation.x = .3 + Math.sin(t * 3.4) * .09;
        poseDown(V().rig);
        V().rig.root.rotation.set(-Math.PI / 2, .6, 0);
        move(A(), 2.4, 0, -18 - Math.min(1, t / 2.4) * 3);
        if (Math.random() < .2) FX.dust(sp(2.4, 0, -24), 1, 0xbfb2a0, 4, 2.4);
        shot(t, [
          { t: 0, p: [8, 4.4, -22], l: [2.4, 1.6, -24] },
          { t: 3, p: [6, 2.6, -20.4], l: [2.4, 1.4, -24] }
        ]);
      } },

    /* 10 · white */
    { dur: 2.4, enter: function () {},
      step: function (t) {
        white(Math.min(1, t / 1.6));
        cam(6, 2.6, -20.4, 2.4, 1.4, -24, 20);
      },
      exit: function () { white(0); } }
    ]
  };

  /* ---------------------------------------------------------- HAKARI
     The reels land, and then the thing the parlour was always going to
     send arrives on time. */
  CUTS.hakari = {
    name: 'PRIVATE PURE LOVE TRAIN', sub: 'IDLE DEATH GAMBLE',
    color: '#ffd84a', smear: 0xffe27a, end: 'sever',
    beats: [

    /* 1 · the parlour floor */
    { dur: 3.4, enter: function () {
        clearStage();
        backdrop('#3a1030', '#0d0510');
        slab(70, 70, 0x241028);
        pillars(8, 26, 18, 0x3a1a3c);
        /* the machine's other half, all over the floor */
        for (var i = 0; i < 60; i++) {
          var a = Math.random() * TAU, d = Math.random() * 26;
          box(.7, .7, .7, 0xf2e2a0, Math.cos(a) * d, .35, Math.sin(a) * d);
        }
        put(A(), 0, 0, 9, Math.PI);
        put(V(), 0, 0, -1, .4);
        FX.tint('#1a0616', .3, 3.2);
      },
      step: function (t) {
        poseStand(A().rig, t, 1.2);
        poseDown(V().rig);
        V().rig.root.rotation.set(-Math.PI / 2, .4, 0);
        move(V(), 0, .5, -1);
        if (Math.random() < .3) FX.mote(sp(0, 3, 4), 0xffd84a, 8, .5);
        shot(t, [
          { t: 0, p: [7.4, 1.2, 3.4], l: [0, 1.4, -1] },
          { t: 3.4, p: [6, 3.4, 5.4], l: [0, 2.2, 1] }
        ]);
      } },

    /* 2 · he offers a hand, and then does not */
    { dur: 3.0, enter: function () {},
      step: function (t) {
        var offer = Math.min(1, t / 1.1);
        poseHold(A().rig, offer, 1);
        A().rig.shoulderR.rotation.x = -1.1 * offer;
        move(A(), 0, 0, 9 - offer * 4.4);
        if (t < 1.9) {
          poseDown(V().rig);
          V().rig.root.rotation.set(-Math.PI / 2, .4, 0);
          move(V(), 0, .5, -1);
        } else {
          var up = Math.min(1, (t - 1.9) / .8);
          poseGut(V().rig, 1 - up * .4);
          V().rig.root.rotation.set(0, Math.PI, 0);
          move(V(), 0, up * .4, -1);
        }
        if (t > 2.3) once('no', function () {
          FX.impact(sp(0, 3.4, 0), 0xffd84a, 2.4);
          FX.cross(sp(0, 3.4, 0), 0xffffff, 4, .2);
          addShake(.9);
          hold(.12);
          try { sfx.punch(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [5.4, 2.4, 4.4], l: [0, 2, 0] },
          { t: 2.2, p: [3.4, 3.4, 3.4], l: [0, 3.2, 0] },
          { t: 3, p: [4.4, 3.6, 4.4], l: [0, 3.2, -.4] }
        ]);
      } },

    /* 3 · and then a great many more of them */
    { dur: 3.2, enter: function () {},
      step: function (t) {
        posePunch(A().rig, (t * 3.4) % 1, Math.floor(t * 3.4) % 2);
        move(A(), 0, 0, 3.4);
        poseGut(V().rig, .8);
        V().rig.spine.rotation.z = Math.sin(t * 26) * .16;
        V().rig.neck.rotation.z = Math.sin(t * 31) * .22;
        move(V(), 0, .4, -1 - t * .3);
        if (Math.random() < .5) {
          FX.impact(sp((Math.random() - .5) * 1.4, 2.4 + Math.random() * 1.6, -.4), 0xffd84a, 1.2);
          FX.blood(sp(0, 3, -.6), new THREE.Vector3((Math.random() - .5), .3, -1), 2, .9);
        }
        if (Math.random() < .3) addShake(.4);
        shot(t, [
          { t: 0, p: [4.4, 3.4, 3.4], l: [0, 3, -.6] },
          { t: 1.6, p: [-4, 3.6, 2.4], l: [0, 3, -1] },
          { t: 3.2, p: [3.4, 4, 3], l: [0, 3, -1.4] }
        ]);
        shakeCam(.12);
      } },

    /* 4 · the shutter comes down, and they go into it */
    { dur: 3.4, enter: function () {
        box(20, 16, 1.4, 0x7c5a2a, 0, 8, -13);
        box(20, 1.4, 1.8, 0xffd84a, 0, 15.4, -13);
        try { sfx.shatter(); } catch (e) {}
      },
      step: function (t) {
        var k = Math.min(1, t / 1.3);
        posePunch(A().rig, k, 1);
        move(A(), 0, 0, 3.4 - E.out(k) * 1.4);
        var fly = Math.max(0, Math.min(1, (t - .85) / 1.1));
        poseFly(V().rig, fly);
        move(V(), 0, .4 + fly * 1.4, -1.4 - E.out(fly) * 10.4);
        if (t > .82) once('throw', function () {
          FX.speedRing(sp(0, 3, -2), 0xffe27a, 10, .35);
          addShake(1);
          hold(.1);
          try { sfx.palm(); } catch (e) {}
        });
        if (t > 1.7) once('into', function () {
          FX.impact(sp(0, 4, -12), 0xffd84a, 4);
          FX.debris(sp(0, 4, -12), 18, 20, 0x7c5a2a);
          FX.rings(sp(0, 4, -12), 0xffe27a, 3, { maxR: 18, life: .6, ground: false, gap: 44 });
          addShake(2);
          hold(.2);
          try { sfx.redBoom(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [6, 3.4, 2], l: [0, 3, -3] },
          { t: 1.7, p: [8, 4.4, -4], l: [0, 4, -11] },
          { t: 3.4, p: [7, 4, -6.4], l: [0, 3.4, -12] }
        ]);
      } },

    /* 5 · and the reels land */
    { dur: 2.8, enter: function () {
        panelDark(.9);
        try { sfx.frame(); } catch (e) {}
      },
      step: function (t) {
        cam(3.4, 4.4, -7.4, 0, 3.4, -12, 34);
        [0, .7, 1.5].forEach(function (at, i) {
          if (t >= at) once('reel' + i, function () {
            FX.flash(i === 2 ? '#ffd84a' : '#ffffff', i === 2 ? .8 : .3, .25);
            if (i === 2) { addShake(1.6); hold(.2); }
            try { sfx.frame(); } catch (e) {}
          });
        });
      },
      exit: function () { panelDark(0); } },

    /* 6 · the jackpot, and everything the parlour has */
    { dur: 3.6, enter: function () {
        FX.flash('#ffd84a', .8, .5);
        FX.mangaLines(true, 1.6);
        try { sfx.raise(); } catch (e) {}
      },
      step: function (t) {
        poseCharge(A().rig, Math.min(1, t / 1.2));
        move(A(), 0, 0, 2);
        poseLimp(V().rig, t);
        move(V(), 0, .3, -11.4);
        V().rig.root.rotation.set(-1.2, .4, .3);
        if (Math.random() < .9) {
          FX.mote(sp((Math.random() - .5) * 10, 1 + Math.random() * 8, -4 - Math.random() * 8),
            0xffd84a, 5, .6);
        }
        if (Math.random() < .5) {
          FX.streaks(sp(0, 3, 2), 0xffe27a, 2, 16, 1.4);
        }
        shot(t, [
          { t: 0, p: [6.4, 3.4, 6], l: [0, 3.4, 0] },
          { t: 1.8, p: [2.6, 4.4, 6.4], l: [0, 3.6, 1] },
          { t: 3.6, p: [4.4, 3.4, 7.4], l: [0, 3.4, 0] }
        ]);
        shakeCam(.2);
      },
      exit: function () { FX.mangaLines(false, 0); } },

    /* 7 · three of his own, and the floor after them */
    { dur: 3.4, enter: function () {},
      step: function (t) {
        var n = Math.floor(t / .9);
        posePunch(A().rig, (t / .9) % 1, n % 2);
        move(A(), 0, 0, -6.4 + Math.max(0, 2 - n) * 1.4);
        poseGut(V().rig, .7);
        move(V(), 0, .6, -11.4);
        V().rig.root.rotation.set(0, Math.PI, 0);
        once('g' + n, function () {
          FX.impact(sp(0, 3, -11), 0xffd84a, 2.6 + n);
          FX.cross(sp(0, 3, -11), 0xffffff, 4 + n, .22);
          FX.blood(sp(0, 3, -11), new THREE.Vector3(0, .3, -1), 4, 1.1);
          addShake(1 + n * .4);
          hold(.12);
          try { sfx.punch(); } catch (e) {}
        });
        if (t > 2.7) once('floor', function () {
          FX.cracks(sp(0, 0, -11), 12, 20, 0x1a0a16);
          FX.debris(sp(0, 0, -11), 20, 22, 0x241028);
          addShake(2.2);
        });
        shot(t, [
          { t: 0, p: [5, 3.4, -6], l: [0, 3, -11] },
          { t: 1.8, p: [-4.4, 3.6, -7], l: [0, 3, -11] },
          { t: 3.4, p: [4, 2.6, -6.4], l: [0, 2.4, -11] }
        ]);
      } },

    /* 8 · and something arrives */
    { dur: 4.0, enter: function () {
        try { sfx.raise(); } catch (e) {}
      },
      step: function (t) {
        poseStand(A().rig, t, .6);
        move(A(), 6.4, 0, -11.4);
        face(A(), -1.4);
        poseDown(V().rig);
        V().rig.root.rotation.set(-Math.PI / 2, .4, 0);
        move(V(), 0, .5, -11.4);
        /* headlights, a long way off, and then not */
        var come = Math.min(1, t / 3.2);
        var z = -70 + E.out(come) * 56;
        if (t > .4 && Math.random() < .6) {
          FX.mote(sp(0, 3, z), 0xfff4c0, 5, .3);
          FX.flame(sp((Math.random() - .5) * 6, Math.random() * 4, z + 4), 2, .4, 0xffd84a, 1);
        }
        if (t > 1.4) shakeCam(.1 + come * .7);
        addShake(come * .8);
        shot(t, [
          { t: 0, p: [9, 3.4, -6.4], l: [0, 2.4, -20] },
          { t: 2.2, p: [11, 4.4, -10], l: [0, 3, -34] },
          { t: 4, p: [10, 3.4, -13], l: [0, 2.4, -12] }
        ]);
        if (t > 3.5) once('horn', function () {
          FX.flash('#fff4c0', .9, .3);
          try { sfx.frame(); } catch (e) {}
        });
      } },

    /* 9 · through */
    { dur: 3.0, enter: function () {
        FX.flash('#ffffff', 1, .3);
        FX.impact(sp(0, 3, -11.4), 0xffd84a, 6);
        FX.rings(sp(0, 3, -11.4), 0xffe27a, 5, { maxR: 34, life: .9, ground: false, gap: 40 });
        FX.debris(sp(0, 1, -11.4), 30, 30, 0x241028);
        FX.cracks(sp(0, 0, -11.4), 16, 30, 0x1a0a16);
        FX.blood(sp(0, 2.4, -11.4), new THREE.Vector3(0, .4, 1), 20, 1.7);
        for (var i = 0; i < 7; i++) {
          FX.cutLine(sp(-9, 1 + i * .9, -11.4), sp(9, 1 + i * .9, -11.4), 0xffffff, .8, .4);
        }
        addShake(3.4);
        hold(.34);
        try { sfx.redBoom(); } catch (e) {}
      },
      step: function (t) {
        poseOver(A().rig, t);
        move(A(), 6.4, 0, -11.4);
        face(A(), -1.4);
        poseDown(V().rig);
        V().rig.root.rotation.set(-Math.PI / 2, .9, .3);
        move(V(), 0, .4, -11.8);
        if (Math.random() < .3) FX.dust(sp(0, 0, -11.4), 2, 0x3a2028, 6, 3);
        shot(t, [
          { t: 0, p: [9, 4, -14], l: [0, 1.6, -11.4] },
          { t: 3, p: [6.4, 2.4, -14.4], l: [0, 1.2, -11.4] }
        ]);
        shakeCam(Math.max(0, .5 - t * .4));
      } },

    /* 10 · white */
    { dur: 2.4, enter: function () {},
      step: function (t) {
        white(Math.min(1, t / 1.6));
        cam(6.4, 2.4, -14.4, 0, 1.2, -11.4, 20);
      },
      exit: function () { white(0); } }
    ]
  };

  /* ---------------------------------------------------------- SUKUNA
     He does not need most of this. He does it anyway, because the point
     of it is not the killing. */
  CUTS.sukuna = {
    name: 'DISMANTLE', sub: '解 · KING OF CURSES',
    color: '#ff2a4a', smear: 0xff2a4a, end: 'dice',
    beats: [

    /* 1 · a shrine yard, and them held up by nothing at all */
    { dur: 3.6, enter: function () {
        clearStage();
        backdrop('#3a0510', '#0a0206');
        slab(70, 70, 0x2a1018);
        pillars(8, 26, 20, 0x6a0c1c);
        rubble(18, 24, 0x1e0c12);
        put(A(), 0, 0, 8, Math.PI);
        put(V(), 0, 3.4, -2, 0);
        FX.tint('#12000a', .35, 3.4);
      },
      step: function (t) {
        poseStand(A().rig, t, .8);
        poseLimp(V().rig, t);
        move(V(), 0, 3.4 + Math.sin(t) * .16, -2);
        V().rig.root.rotation.set(.2, .4 + Math.sin(t * .7) * .2, .1);
        if (Math.random() < .4) FX.mote(sp(0, 4, -2), 0x8b0f2a, 6, .5);
        shot(t, [
          { t: 0, p: [8, 5.4, 2], l: [0, 4.4, -2] },
          { t: 3.6, p: [6.4, 4.4, 4], l: [0, 4.2, -2] }
        ]);
      } },

    /* 2 · one finger */
    { dur: 3.0, enter: function () {},
      step: function (t) {
        posePoint(A().rig, Math.min(1, t / 1.4), 1);
        poseLimp(V().rig, t);
        move(V(), 0, 3.4, -2);
        V().rig.root.rotation.set(.2, .5, .1);
        if (t > 1.2 && Math.random() < .3) {
          FX.streaks(sp(0, 3.4, 4), 0xd4143c, 1, 7, 1);
        }
        shot(t, [
          { t: 0, p: [4.4, 4.4, 6.4], l: [0, 4, 2] },
          { t: 1.6, p: [2.2, 3.8, 5.4], l: [0, 3.8, 3.4] },
          { t: 3, p: [2.6, 4, 6], l: [0, 4, 2.4] }
        ]);
      } },

    /* 3 · one line, and the wall behind them */
    { dur: 2.8, enter: function () {
        box(30, 22, 2, 0x3a1620, 0, 11, -16);
      },
      step: function (t) {
        posePoint(A().rig, 1, 1);
        poseLimp(V().rig, t);
        move(V(), 0, 3.4, -2);
        if (t > .5) once('one', function () {
          FX.cutLine(sp(-16, 8, -2), sp(16, 2, -2), 0xffffff, 1.2, .45);
          FX.blood(sp(0, 4, -2), new THREE.Vector3(1, -.2, 0), 8, 1.3);
          FX.flash('#ffffff', .5, .2);
          hold(.2);
          addShake(1.4);
          try { sfx.slash(); } catch (e) {}
        });
        if (t > .75) once('wall', function () {
          FX.cutLine(sp(-15, 15, -16), sp(15, 5, -16), 0xffffff, 1.6, .5);
          FX.debris(sp(0, 10, -15), 20, 20, 0x3a1620);
          FX.impact(sp(0, 10, -16), 0xd4143c, 3.4);
          addShake(1.6);
        });
        shot(t, [
          { t: 0, p: [7, 4.4, 3.4], l: [0, 4, -2] },
          { t: .55, p: [5.4, 4.2, 2.4], l: [0, 4, -3.4] },
          { t: 2.8, p: [8, 5.4, 1], l: [0, 5, -10] }
        ]);
      } },

    /* 4 · and then the net */
    { dur: 3.6, enter: function () { try { sfx.slash(); } catch (e) {} },
      step: function (t) {
        var k = Math.min(1, t / 1.6);
        poseSlash(A().rig, k, 1);
        move(A(), 0, 0, 8);
        poseLimp(V().rig, t);
        move(V(), 0, 3.4, -2);
        if (t > .9) once('weave', function () {
          FX.lattice(sp(0, 4, -2), new THREE.Vector3(0, 0, -1), 12, 12, 6, 6, 0xffffff,
            { stagger: 40, life: 1.4, width: .34 });
          addShake(.9);
        });
        if (t > 2.4) once('close', function () {
          FX.lattice(sp(0, 4, -2), new THREE.Vector3(1, 0, 0), 10, 12, 5, 5, 0xd4143c,
            { stagger: 26, life: 1.2, width: .34 });
          FX.blood(sp(0, 4, -2), new THREE.Vector3(0, .4, 1), 10, 1.2);
          addShake(1.1);
        });
        shot(t, [
          { t: 0, p: [7, 4.4, 4.4], l: [0, 4, -1] },
          { t: 2, p: [4.4, 4.2, 3.4], l: [0, 4, -2] },
          { t: 3.6, p: [3.4, 4.2, 2.6], l: [0, 4, -2] }
        ]);
      } },

    /* 5 · the lines sit there, and nothing moves */
    { dur: 2.4, enter: function () { panelDark(.9); },
      step: function (t) {
        cam(2.6, 4.2, 2, 0, 4, -2, 40);
        if (t > 1.2) once('wait', function () { try { sfx.frame(); } catch (e) {} });
      },
      exit: function () { panelDark(0); } },

    /* 6 · cleave, in person */
    { dur: 3.4, enter: function () {},
      step: function (t) {
        var k = Math.min(1, t / 1.5);
        poseSlash(A().rig, k, 0);
        move(A(), 0, 0, 8 - E.out(k) * 4.4);
        poseLimp(V().rig, t);
        move(V(), 0, 3.4 - Math.max(0, (t - 1.4)) * .8, -2);
        if (t > 1.35) once('cleave', function () {
          FX.cutLine(sp(-4, 7, -2), sp(4, 0, -2), 0xffffff, 1.6, .4);
          FX.cutLine(sp(4, 7, -2), sp(-4, 0, -2), 0xd4143c, 1.2, .4);
          FX.impact(sp(0, 3.6, -2), 0xd4143c, 3.4);
          FX.blood(sp(0, 3.6, -2), new THREE.Vector3(0, .3, 1), 14, 1.5);
          FX.flash('#ffffff', .55, .2);
          hold(.24);
          addShake(1.8);
          try { sfx.sever(); } catch (e) {}
        });
        shot(t, [
          { t: 0, p: [6, 4.4, 4.4], l: [0, 4, -1] },
          { t: 1.4, p: [3.4, 4, 2.4], l: [0, 3.6, -2] },
          { t: 3.4, p: [4.4, 3.6, 1.4], l: [0, 3, -2.4] }
        ]);
      } },

    /* 7 · and the furnace, behind him */
    { dur: 3.2, enter: function () { try { sfx.fire(); } catch (e) {} },
      step: function (t) {
        poseCharge(A().rig, Math.min(1, t / 1.4));
        move(A(), 0, 0, 3.6);
        poseKneel(V().rig, t);
        move(V(), 0, 0, -2);
        V().rig.root.rotation.set(0, .3, 0);
        if (Math.random() < .9) {
          FX.flame(sp((Math.random() - .5) * 8, Math.random() * 6, 8 + Math.random() * 6),
            2 + Math.random() * 3, .7);
        }
        FX.tint('#2a0800', .4, .2);
        shot(t, [
          { t: 0, p: [7, 4, 0], l: [0, 3.4, 4] },
          { t: 3.2, p: [8.4, 5.4, -3.4], l: [0, 3.6, 4] }
        ]);
        shakeCam(.14);
      } },

    /* 8 · he holds it where they can see it */
    { dur: 2.8, enter: function () {},
      step: function (t) {
        posePoint(A().rig, 1, 1);
        move(A(), 0, 0, 3.6);
        poseKneel(V().rig, t);
        V().rig.neck.rotation.x = -.55;
        move(V(), 0, 0, -2);
        if (Math.random() < .8) {
          FX.flame(sp(0, 3.4, 1.4), 2 + Math.random() * 2, .4);
        }
        cam(2.6, 3.4, -.4, 0, 3.2, 1.4, 30);
        shakeCam(.1);
      } },

    /* 9 · and then does not use it */
    { dur: 3.0, enter: function () {
        FX.tint('#12000a', .35, 3);
      },
      step: function (t) {
        var drop = Math.min(1, t / .8);
        posePoint(A().rig, 1 - drop * .6, 1);
        move(A(), 0, 0, 3.6);
        poseKneel(V().rig, t);
        move(V(), 0, 0, -2);
        if (t < .8 && Math.random() < .5) {
          FX.flame(sp(0, 3.4 - drop * 3, 1.4), 2, .4);
        }
        if (t > .8) once('point', function () {
          FX.streaks(sp(0, 3.4, 1.4), 0xd4143c, 4, 8, 1.1);
        });
        if (t > 1.8) once('say', function () {
          FX.cross(sp(0, 4.4, 1.4), 0xffffff, 4, .22);
          try { sfx.raise(); } catch (e) {}
        });
        cam(2.4 + t * .2, 3.6, -.8, 0, 3.4, .4, 28);
      } },

    /* 10 · 解 */
    { dur: 3.6, enter: function () {
        FX.flash('#ffffff', .8, .3);
        FX.lattice(sp(0, 3, -2), new THREE.Vector3(0, 0, -1), 9, 9, 7, 7, 0xffffff,
          { stagger: 14, life: .8, width: .4 });
        FX.lattice(sp(0, 3, -2), new THREE.Vector3(1, 0, 0), 9, 9, 7, 7, 0xd4143c,
          { stagger: 14, life: .8, width: .4 });
        hold(.3);
        addShake(3);
        try { sfx.sever(); } catch (e) {}
      },
      step: function (t) {
        poseOver(A().rig, t);
        move(A(), 0, 0, 3.6);
        poseKneel(V().rig, t);
        move(V(), 0, 0, -2);
        if (Math.random() < .7) {
          FX.blood(sp((Math.random() - .5) * 2, 1 + Math.random() * 3, -2),
            new THREE.Vector3((Math.random() - .5), .4, (Math.random() - .5)), 3, 1.2);
        }
        if (Math.random() < .4) {
          var a = Math.random() * TAU;
          FX.cutLine(sp(Math.cos(a) * 3, 3 + Math.sin(a) * 3, -2),
            sp(-Math.cos(a) * 3, 3 - Math.sin(a) * 3, -2), 0xffffff, .4, .28);
        }
        shot(t, [
          { t: 0, p: [3.4, 3.6, .4], l: [0, 3, -2] },
          { t: 3.6, p: [5.4, 4.4, 1.4], l: [0, 2.4, -2] }
        ]);
        shakeCam(.2);
      } },

    /* 11 · white */
    { dur: 2.4, enter: function () {},
      step: function (t) {
        white(Math.min(1, t / 1.6));
        cam(5.4, 4.4, 1.4, 0, 2.4, -2, 20);
      },
      exit: function () { white(0); } }
    ]
  };

  CUTS.dummy = CUTS.gojo;

  /* =====================================================================
     WHEN ONE HAPPENS
     A finisher is not a kill: it is what an ability does instead of one.
     ================================================================== */
  function armed(e, amount, opts) {
    if (F.on || F.cd > 0) return false;
    if (!e || e.dead || player.dead) return false;
    if (opts && opts.fin === false) return false;
    if (amount < 12) return false;                    // not a bleed tick
    if (otherCine()) return false;
    if (window.JJGORE && (window.JJGORE.isHeld(e) || window.JJGORE.isHeld(player))) return false;
    if (!CUTS[charCut()]) return false;
    if (e.pos.distanceTo(player.pos) > 34) return false;
    /* it has to be the hit that would have finished them */
    return (e.hp - amount) <= (e.maxHp || 100) * .25;
  }

  /* installed on the first frame rather than at load, so it sits on top of
     mp.js's own damage hook and sees hits on other players too */
  var patched = false;
  addFx({ t: 1e9, update: function (dt) {
    if (!patched) {
      patched = true;
      var _dmg = Enemy.prototype.damage;
      Enemy.prototype.damage = function (amount, knock, opts) {
        if (armed(this, amount, opts)) {
          /* leave them standing — the cut needs somebody to throw it at */
          amount = Math.max(0, this.hp - 1);
          var e = this;
          _dmg.call(this, amount, knock, opts);
          startFor(e);
          return;
        }
        return _dmg.call(this, amount, knock, opts);
      };
      /* a body being posed by a cut is not being driven by anything else —
         mp.js's own update would otherwise drag a remote victim back into
         the arena every packet */
      var _upd = Enemy.prototype.update;
      Enemy.prototype.update = function (d) {
        if (this.cineHold) return;
        return _upd.call(this, d);
      };
    }
    if (F.cd > 0) F.cd = Math.max(0, F.cd - dt);
    return true;
  } });

  /* =====================================================================
     HOOKS
     ================================================================== */
  var _updatePlayer = updatePlayer;
  updatePlayer = function (dt) {
    if (F.on) return;                                 // the cut owns both of us
    _updatePlayer(dt);
  };

  var _updateCamera = updateCamera;
  updateCamera = function (dt) {
    if (F.on) { stepCine(dt); return; }
    return _updateCamera(dt);
  };

  var _hurtPlayer = hurtPlayer;
  hurtPlayer = function (amount, knock) {
    if (F.on) return;                                 // nothing reaches us in here
    return _hurtPlayer(amount, knock);
  };
})();
