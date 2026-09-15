/* =======================================================================
   ANIMATION LAYER
   The cutscenes were written as a list of poses, one per beat, and a pose
   list played straight is a slideshow: every joint arrives at the same
   instant, nothing leads, nothing trails, and the joins between beats are
   cuts.

   Everything posed by a cutscene now goes through here first:

     · every joint is driven by its own spring, so the hips lead and the
       hands arrive late — overlap and follow through for free, including
       across a beat change, which is what stops the joins reading as cuts
     · a breathing layer on top, so a held pose is never actually still
     · a smear whenever a body moves faster than the eye can follow
     · the camera on a spring of its own, with a hand holding it and a
       kick when something lands
     · a hold: two or three frames of nothing at the moment of impact,
       which is where an anime cut spends its weight

   ===================================================================== */
(function () {
  'use strict';
  if (typeof THREE === 'undefined' || typeof JOINTS === 'undefined') return;

  /* How quickly each joint chases the pose it was given. The core is stiff
     and the extremities are loose, which is what makes a movement travel
     out through the body instead of happening all at once. */
  var K = {
    hips: 34, spine: 19, neck: 10, head: 9,
    shoulderL: 12, shoulderR: 12, elbowL: 7, elbowR: 7,
    hipL: 16, hipR: 16, kneeL: 10, kneeR: 10, ankleL: 6, ankleR: 6
  };
  var AXES = ['x', 'y', 'z'];

  /* overrides let a move keep a stiff joint where it needs to snap — a
     punch that arrives on a loose spring never actually extends */
  function smoother(rig, over) {
    var st = {}, i, n;
    var kk = {};
    for (n in K) kk[n] = K[n];
    if (over) for (n in over) kk[n] = over[n];
    for (i = 0; i < JOINTS.length; i++) {
      n = JOINTS[i];
      if (!rig[n]) continue;
      st[n] = { x: rig[n].rotation.x, y: rig[n].rotation.y, z: rig[n].rotation.z, vx: 0, vy: 0, vz: 0 };
    }
    var hipY = { v: rig.hipsBaseY, vv: 0 };

    return {
      energy: 0,
      /* take the pose that was just written as a target, and write back
         where the body has actually got to */
      step: function (dt) {
        /* springs go unstable on a long frame, so a long frame is several */
        var steps = Math.max(1, Math.min(4, Math.ceil(dt / (1 / 30))));
        var h = dt / steps, e = 0, s, part, k, d, a, tgt, s2;
        var targets = {}, hipTarget = rig.hips ? rig.hips.position.y : 0;
        for (var name in st) {
          part = rig[name];
          targets[name] = [part.rotation.x, part.rotation.y, part.rotation.z];
        }
        for (s2 = 0; s2 < steps; s2++) {
          for (name in st) {
            s = st[name];
            k = kk[name] || 20;
            d = 2 * Math.sqrt(k) * .74;            // under damped, so it overshoots
            for (a = 0; a < 3; a++) {
              tgt = targets[name][a];
              var ax = AXES[a], vk = 'v' + ax;
              s[vk] += ((tgt - s[ax]) * k - s[vk] * d) * h;
              s[ax] += s[vk] * h;
            }
          }
          hipY.vv += ((hipTarget - hipY.v) * 34 - hipY.vv * 2 * Math.sqrt(34) * .9) * h;
          hipY.v += hipY.vv * h;
        }
        for (name in st) {
          s = st[name];
          part = rig[name];
          part.rotation.set(s.x, s.y, s.z);
          e += Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.vz);
        }
        if (rig.hips) rig.hips.position.y = hipY.v;
        this.energy = e;
        return e;
      },
      /* land on the pose immediately — for the first frame of a cut, where
         there is nothing to carry over from */
      snap: function () {
        for (var name in st) {
          var s = st[name], part = rig[name];
          s.x = part.rotation.x; s.y = part.rotation.y; s.z = part.rotation.z;
          s.vx = s.vy = s.vz = 0;
        }
        hipY.v = rig.hips ? rig.hips.position.y : 0;
        hipY.vv = 0;
      }
    };
  }

  /* nobody stands perfectly still; this is what stops a held pose looking
     like a mannequin */
  function life(rig, t, amt) {
    if (amt === 0 || !rig.spine) return;
    amt = amt == null ? 1 : amt;
    var b = Math.sin(t * 1.7), b2 = Math.sin(t * 1.7 + .7), sway = Math.sin(t * 1.1);
    rig.spine.rotation.x += b * .05 * amt;
    rig.spine.rotation.z += sway * .04 * amt;
    rig.spine.rotation.y += Math.sin(t * .8) * .05 * amt;
    if (rig.neck) {
      rig.neck.rotation.x += b2 * .045 * amt;
      rig.neck.rotation.y += Math.sin(t * .8 + 1.2) * .06 * amt;   // the head drifts
    }
    if (rig.shoulderL) rig.shoulderL.rotation.z += b2 * .07 * amt;
    if (rig.shoulderR) rig.shoulderR.rotation.z -= b2 * .07 * amt;
    if (rig.elbowL) rig.elbowL.rotation.x += b2 * .05 * amt;
    if (rig.elbowR) rig.elbowR.rotation.x += Math.sin(t * 1.7 + 1.3) * .05 * amt;
    if (rig.hips) rig.hips.position.y += b * .07 * amt;
  }

  /* Weight on one leg. Shift runs -1 (left) to 1 (right); this is the
     difference between a figure standing and a figure standing on
     something. */
  function weight(rig, shift, amt) {
    amt = amt == null ? 1 : amt;
    if (!rig.hips) return;
    rig.hips.position.x = (rig.hips.position.x || 0) + shift * .42 * amt;
    rig.hips.rotation.z = (rig.hips.rotation.z || 0) - shift * .17 * amt;
    var loaded = shift > 0 ? 'R' : 'L', free = shift > 0 ? 'L' : 'R';
    var m = Math.abs(shift) * amt;
    if (rig['knee' + loaded]) rig['knee' + loaded].rotation.x -= .2 * m;
    if (rig['knee' + free]) rig['knee' + free].rotation.x += .55 * m;
    if (rig['hip' + free]) rig['hip' + free].rotation.z += shift * .3 * m;
    if (rig['hip' + free]) rig['hip' + free].rotation.x -= .18 * m;
    if (rig.spine) rig.spine.rotation.z -= shift * .13 * amt;
    if (rig.neck) rig.neck.rotation.z += shift * .08 * amt;
  }

  /* a body moving faster than the eye follows leaves one behind */
  function smear(rig, energy, state, dt, color, threshold) {
    var th = threshold || 3;
    state.acc = (state.acc || 0) + dt;
    if (energy < th || state.acc < .045) return;
    state.acc = 0;
    /* the harder it is moving, the more of it is left behind */
    var a = Math.min(.45, .12 + (energy - th) * .02);
    try { ghostAfterimage(rig, color == null ? 0xbfd8ff : color, a); } catch (e) {}
  }

  /* =====================================================================
     CAMERA
     A spring, a hand and a kick. Marks are still marks; this is what
     stops them being a slide projector.
     ================================================================== */
  var CAM = {
    pos: new THREE.Vector3(), look: new THREE.Vector3(),
    vp: new THREE.Vector3(), vl: new THREE.Vector3(),
    kickV: new THREE.Vector3(), kick: new THREE.Vector3(),
    t: 0, hand: 1, live: false
  };

  function camTo(px, py, pz, lx, ly, lz, dt, stiff) {
    var tp = new THREE.Vector3(px, py, pz), tl = new THREE.Vector3(lx, ly, lz);
    if (!CAM.live) { camSnap(px, py, pz, lx, ly, lz); }
    CAM.t += dt;
    var k = stiff || 46, d = 2 * Math.sqrt(k) * .95;
    var steps = Math.max(1, Math.min(4, Math.ceil(dt / (1 / 30)))), h = dt / steps, i;
    for (i = 0; i < steps; i++) {
      CAM.vp.addScaledVector(tp.clone().sub(CAM.pos).multiplyScalar(k).addScaledVector(CAM.vp, -d), h);
      CAM.pos.addScaledVector(CAM.vp, h);
      CAM.vl.addScaledVector(tl.clone().sub(CAM.look).multiplyScalar(k).addScaledVector(CAM.vl, -d), h);
      CAM.look.addScaledVector(CAM.vl, h);
      CAM.kickV.multiplyScalar(Math.pow(.0009, h));
      CAM.kick.addScaledVector(CAM.kickV, h);
      CAM.kick.multiplyScalar(Math.pow(.002, h));
    }
    /* the hand holding it: slow drift, not a rattle */
    var t = CAM.t, hand = CAM.hand;
    var hx = (Math.sin(t * 1.3) + Math.sin(t * 2.7) * .5) * .16 * hand;
    var hy = (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * .5) * .13 * hand;
    var hz = Math.sin(t * .9 + 2) * .14 * hand;

    camera.position.copy(CAM.pos).add(CAM.kick).add(new THREE.Vector3(hx, hy, hz));
    camera.lookAt(CAM.look.x + hx * .5, CAM.look.y + hy * .5, CAM.look.z);
    /* a shot is never perfectly level either */
    camera.rotateZ(Math.sin(t * .7) * .008 * hand + CAM.kick.x * .012);
  }

  function camSnap(px, py, pz, lx, ly, lz) {
    CAM.pos.set(px, py, pz);
    CAM.look.set(lx, ly, lz);
    CAM.vp.set(0, 0, 0); CAM.vl.set(0, 0, 0);
    CAM.kick.set(0, 0, 0); CAM.kickV.set(0, 0, 0);
    CAM.live = true;
  }
  function camRelease() { CAM.live = false; }
  function camKick(mag, dir) {
    var d = dir ? dir.clone().normalize() : new THREE.Vector3(
      Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
    CAM.kickV.addScaledVector(d, mag * 26);
  }
  function camHand(v) { CAM.hand = v; }

  window.JJANIM = {
    smoother: smoother,
    life: life,
    weight: weight,
    smear: smear,
    camTo: camTo,
    camSnap: camSnap,
    camRelease: camRelease,
    camKick: camKick,
    camHand: camHand
  };
})();
