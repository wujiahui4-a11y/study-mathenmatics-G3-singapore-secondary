/* Deterministic keyframes, two-bone hand contact and secondary cloth motion. */
(function () {
  'use strict';
  var T = JJTODO,
    V = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0),
    clamp = (x) => Math.max(0, Math.min(1, x));
  var S = {
    guard: {
      spine: [0.1, -0.16, 0],
      shoulderL: [-0.65, 0, 0.3],
      shoulderR: [-0.75, 0, -0.35],
      elbowL: [-1.5, 0, 0],
      elbowR: [-1.45, 0, 0],
      hipL: [-0.15, 0, -0.11],
      hipR: [0.1, 0, 0.12],
      kneeL: [0.2, 0, 0],
      height: -0.12
    },
    coil: {
      spine: [0.15, -0.62, -0.07],
      neck: [-0.1, 0.25, 0],
      shoulderR: [-0.3, -0.2, -0.6],
      elbowR: [-1.95, 0, 0],
      shoulderL: [-1, 0, 0.55],
      elbowL: [-1.45, 0, 0],
      hipL: [-0.43, 0, -0.18],
      hipR: [0.1, 0, 0.18],
      kneeL: [0.65, 0, 0],
      height: -0.28
    },
    punch: {
      spine: [0.26, 0.52, 0.1],
      neck: [-0.14, -0.25, 0],
      shoulderR: [-1.5, 0.1, 0.16],
      elbowR: [-0.06, 0, 0],
      shoulderL: [-0.25, 0, 0.5],
      elbowL: [-1.4, 0, 0],
      hipR: [-0.45, 0, 0.15],
      kneeR: [0.65, 0, 0],
      height: -0.18
    },
    left: {
      spine: [0.23, -0.53, -0.12],
      shoulderL: [-1.6, 0, -0.12],
      elbowL: [-0.05, 0, 0],
      shoulderR: [-0.3, 0, -0.5],
      elbowR: [-1.5, 0, 0],
      hipL: [-0.35, 0, -0.15],
      kneeL: [0.45, 0, 0],
      height: -0.16
    },
    kick: {
      spine: [-0.36, -0.4, 0.15],
      neck: [0.2, 0.2, 0],
      shoulderR: [-0.5, 0, -1.2],
      elbowR: [-0.4, 0, 0],
      shoulderL: [-1, 0, 0.8],
      elbowL: [-1, 0, 0],
      hipR: [-1.9, 0, 0.28],
      kneeR: [0.12, 0, 0],
      hipL: [0.2, 0, -0.18],
      kneeL: [0.2, 0, 0],
      height: 0.15
    },
    air: {
      spine: [-0.25, 0, 0],
      shoulderR: [-2.7, 0, -0.6],
      shoulderL: [-2.5, 0, 0.6],
      elbowR: [-0.6, 0, 0],
      elbowL: [-0.6, 0, 0],
      hipR: [-2.3, 0, 0.1],
      kneeR: [0.5, 0, 0],
      hipL: [-0.9, 0, -0.2],
      kneeL: [1.4, 0, 0],
      height: 0.25
    },
    slam: {
      spine: [0.5, 0.1, 0],
      neck: [-0.15, 0, 0],
      shoulderR: [-1.2, 0, 0.2],
      elbowR: [-0.1, 0, 0],
      shoulderL: [-0.6, 0, 0.35],
      elbowL: [-0.8, 0, 0],
      hipR: [-0.75, 0, 0.15],
      kneeR: [1, 0, 0],
      hipL: [-0.65, 0, -0.2],
      kneeL: [1.1, 0, 0],
      height: -0.6
    },
    spread: {
      spine: [-0.12, 0, 0],
      neck: [-0.12, 0, 0],
      shoulderL: [-0.5, 0, -1.32],
      shoulderR: [-0.5, 0, 1.32],
      elbowL: [-0.4, 0, 0],
      elbowR: [-0.4, 0, 0],
      hipL: [-0.15, 0, -0.15],
      hipR: [-0.15, 0, 0.15],
      height: -0.14
    },
    clap: {
      spine: [0.08, 0, 0],
      neck: [0.05, 0, 0],
      hipL: [-0.2, 0, -0.12],
      hipR: [0.1, 0, 0.12],
      kneeL: [0.3, 0, 0],
      height: -0.12,
      clap: 1
    },
    pendant: {
      spine: [0.1, -0.12, 0],
      neck: [0.24, 0.05, 0],
      shoulderR: [-1.05, 0, -0.3],
      elbowR: [-2.35, 0, 0.2],
      shoulderL: [-0.3, 0, 0.25],
      elbowL: [-0.6, 0, 0],
      height: -0.12
    }
  };
  var P = {
    b1: [
      [0, S.guard],
      [0.14, S.spread],
      [0.26, S.clap],
      [0.37, S.coil],
      [0.47, S.punch],
      [0.66, S.punch],
      [1.05, S.guard]
    ],
    td_air: [
      [0, S.air],
      [0.26, S.clap],
      [0.41, S.air],
      [0.57, S.slam],
      [0.85, S.slam],
      [1.15, S.guard]
    ],
    b2: [
      [0, S.guard],
      [0.14, S.coil],
      [0.23, S.punch],
      [0.42, S.punch],
      [0.7, S.guard]
    ],
    td_stone: [
      [0, S.spread],
      [0.24, S.clap],
      [0.34, S.coil],
      [0.47, S.kick],
      [0.64, S.kick],
      [0.95, S.guard]
    ],
    b3: [
      [0, S.guard],
      [0.18, S.coil],
      [0.42, S.coil],
      [0.49, S.punch],
      [0.67, S.punch],
      [1.1, S.guard]
    ],
    br: [
      [0, S.guard],
      [0.1, S.spread],
      [0.18, S.clap],
      [0.38, S.clap],
      [0.85, S.guard]
    ],
    td_awaken: [
      [0, S.guard],
      [0.35, S.pendant],
      [1.3, S.pendant],
      [1.62, S.spread],
      [2.15, S.spread],
      [2.55, S.clap],
      [2.8, S.spread],
      [3.3, S.guard],
      [3.65, S.guard]
    ],
    tda3: [
      [0, S.guard],
      [0.2, S.coil],
      [0.36, S.coil],
      [0.54, S.punch],
      [0.75, S.punch],
      [1.1, S.slam],
      [1.55, S.guard]
    ]
  };
  P.td_black = P.b3;
  function combo(times, sky) {
    var seq = [[0, S.guard]];
    times.forEach((t, i) => {
      seq.push(
        [t - 0.18, S.spread],
        [t - 0.07, S.clap],
        [t, sky ? (i === 1 ? S.air : S.slam) : i % 2 ? S.left : S.punch],
        [t + 0.15, sky ? S.slam : i % 2 ? S.left : S.punch]
      );
    });
    seq.push([times[times.length - 1] + 0.4, S.guard]);
    return seq;
  }
  P.b4 = combo([0.34, 0.77, 1.25, 1.68]);
  P.tda1 = combo([0.3, 0.64, 1.02, 1.43]);
  P.tda2 = combo([0.38, 0.84, 1.65], true);
  P.tda4 = [
    [0, S.guard],
    [0.22, S.coil],
    [0.36, S.clap],
    [0.95, S.guard],
    [1.15, S.punch],
    [1.46, S.clap],
    [1.75, S.left],
    [2.1, S.clap],
    [2.4, S.kick],
    [2.8, S.clap],
    [3.1, S.punch],
    [3.45, S.spread],
    [4.05, S.coil],
    [4.85, S.coil],
    [5.1, S.punch],
    [5.4, S.punch],
    [5.65, S.guard]
  ];
  function hands(r, weight, crossed) {
    ['L', 'R'].forEach((side, i) => {
      var s = i ? 1 : -1,
        sh = r['shoulder' + side],
        el = r['elbow' + side];
      var target = crossed ? V(-s * 0.67, i ? 0.55 : 0.44, 0.72) : V(s * 0.14, 0.72, 1.15),
        delta = target.clone().sub(sh.position),
        distance = delta.length(),
        axis = delta.clone().normalize();
      var l1 = el.position.length(),
        l2 = 1.08,
        pole = V(s * 2, -0.55, 0.65).sub(sh.position);
      pole.addScaledVector(axis, -pole.dot(axis)).normalize();
      var along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance),
        height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      var elbow = sh.position.clone().addScaledVector(axis, along).addScaledVector(pole, height);
      var q = new THREE.Quaternion().setFromUnitVectors(
        V(0, -1, 0),
        elbow.clone().sub(sh.position).normalize()
      );
      var qe = new THREE.Quaternion().setFromUnitVectors(
        V(0, -1, 0),
        target.clone().sub(elbow).normalize().applyQuaternion(q.clone().invert())
      );
      sh.quaternion.slerp(q, weight);
      el.quaternion.slerp(qe, weight);
    });
  }
  function sample(r, seq, t) {
    resetPose(r);
    r.body.rotation.set(0, 0, 0);
    var i = 1;
    while (i < seq.length - 1 && t > seq[i][0]) i++;
    var a = seq[i - 1],
      b = seq[i],
      w = clamp((t - a[0]) / (b[0] - a[0]));
    w = w * w * (3 - 2 * w);
    JOINTS.forEach((j) => {
      var x = a[1][j] || [0, 0, 0],
        y = b[1][j] || [0, 0, 0];
      r[j].rotation.set(...x.map((v, n) => v + (y[n] - v) * w));
    });
    r.hips.position.y = r.hipsBaseY + (a[1].height || 0) * (1 - w) + (b[1].height || 0) * w;
    var contact = (a[1].clap || 0) * (1 - w) + (b[1].clap || 0) * w;
    if (contact) hands(r, contact);
  }
  T.pose = function (r, a) {
    if (!r.td || !a) return false;
    var key = a.type,
      t = a.t;
    if (key === 'td_fin') {
      key = a.fin === 'b2' ? 'td_stone' : a.fin === 'b1' ? 'td_air' : a.fin === 'b4' ? 'b4' : 'td_black';
      t = (a.t / 1.3) * KDuration(key);
    }
    var seq = P[key];
    if (!seq) return false;
    if (key === 'br' && a.counter) {
      seq = [
        [0, S.clap],
        [0.13, S.kick],
        [0.48, S.guard]
      ];
      t = a.t - a.trigger;
    }
    sample(r, seq, t);
    r.td.knot.rotation.x = Math.sin(t * 8) * 0.045;
    r.td.sash.forEach((g, i) => (g.rotation.x = Math.sin(t * 9 + i) * 0.17));
    if (key === 'td_air' && t > 0.3 && t < 0.6)
      r.body.rotation.y = Math.sin(((t - 0.3) / 0.3) * Math.PI) * 0.45;
    return true;
  };
  function KDuration(key) {
    return T.kit[key] ? T.kit[key].dur : 1.1;
  }
  var beforePose = poseAction;
  poseAction = function (r, a) {
    if (T.pose(r, a)) return;
    return beforePose(r, a);
  };
  var beforeLoc = applyLocomotion;
  applyLocomotion = function (r, t, gait, move, run, onGround, vy) {
    beforeLoc(r, t, gait, move, run, onGround, vy);
    if (!r.td) return;
    r.td.knot.rotation.x = Math.sin(gait) * move * 0.07 + Math.sin(t * 2) * 0.025;
    r.td.sash.forEach((g, i) => {
      g.rotation.x = Math.sin(gait + i) * move * 0.22;
      g.rotation.z = Math.sin(t * 2 + i) * 0.035;
    });
    r.td.locket.rotation.x = Math.sin(gait * 1.1) * move * 0.1;
    if (move < 0.1 && onGround) {
      sample(
        r,
        [
          [0, S.guard],
          [1, S.guard]
        ],
        0
      );
      r.spine.rotation.x += Math.sin(t * 2) * 0.015;
      r.neck.rotation.z = -0.04;
      // Relaxed crossed-arm silhouette while idle; combat actions blend to a guard.
      hands(r, 1, true);
    } else if (onGround) {
      r.spine.rotation.x += run * 0.12;
      r.shoulderL.rotation.z = 0.28;
      r.shoulderR.rotation.z = -0.28;
      r.elbowL.rotation.x -= 0.45;
      r.elbowR.rotation.x -= 0.45;
    }
    if (r === player.rig && player.blocking) {
      sample(
        r,
        [
          [0, S.guard],
          [1, S.guard]
        ],
        0
      );
      r.elbowL.rotation.x = r.elbowR.rotation.x = -2;
    }
  };
})();
