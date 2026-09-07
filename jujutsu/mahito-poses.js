/* Named keyframes are deterministic on the local fighter and every peer. */
(function () {
  'use strict';
  var M = JJMAHITO,
    VOX = JJMAHITOVOX;
  var S = {
    coil: {
      spine: [0.22, -0.5, 0],
      neck: [-0.12, 0.2, 0],
      shoulderR: [-0.55, 0, -0.65],
      elbowR: [-1.85, 0, 0],
      shoulderL: [-1, 0, 0.5],
      elbowL: [-1.25, 0, 0],
      hipL: [-0.45, 0, -0.2],
      hipR: [0.2, 0, 0.2],
      kneeL: [0.7, 0, 0],
      height: -0.27
    },
    hit: {
      spine: [0.24, 0.6, 0.08],
      neck: [-0.18, -0.2, 0],
      shoulderR: [-1.57, 0, 0.12],
      elbowR: [-0.03, 0, 0],
      shoulderL: [0.3, 0, 0.4],
      elbowL: [-0.6, 0, 0],
      hipR: [-0.6, 0, 0.16],
      kneeR: [0.8, 0, 0],
      height: -0.12
    },
    sign: {
      spine: [0.15, 0, 0],
      neck: [0.28, 0, 0],
      shoulderR: [-1.4, 0, -0.4],
      shoulderL: [-1.4, 0, 0.4],
      elbowR: [-1.8, 0, 0],
      elbowL: [-1.8, 0, 0],
      height: -0.25
    },
    open: {
      spine: [-0.3, 0, 0],
      neck: [-0.35, 0, 0],
      shoulderR: [-1, 0, -1.45],
      shoulderL: [-1, 0, 1.45],
      elbowR: [-0.1, 0, 0],
      elbowL: [-0.1, 0, 0],
      height: 0.12
    },
    smash: {
      spine: [0.6, 0.1, 0],
      neck: [0.1, 0, 0],
      shoulderR: [-0.8, 0, 0.08],
      shoulderL: [-0.7, 0, -0.08],
      elbowR: [-0.04, 0, 0],
      elbowL: [-0.05, 0, 0],
      hipL: [-0.75, 0, -0.22],
      hipR: [-0.75, 0, 0.22],
      kneeL: [1.35, 0, 0],
      kneeR: [1.35, 0, 0],
      height: -0.7
    }
  };
  var P = {
    mh_stock: [
      [0, {}],
      [
        0.2,
        {
          spine: [-0.15, -0.7, 0],
          shoulderL: [-2.5, 0, 0.4],
          elbowL: [-0.6, 0, 0],
          shoulderR: [-0.4, 0, -1],
          elbowR: [-0.8, 0, 0],
          height: -0.2
        }
      ],
      [
        0.36,
        {
          spine: [0.4, 0.5, 0],
          shoulderL: [-0.5, 0, -0.7],
          elbowL: [-0.04, 0, 0],
          shoulderR: [-2.7, 0, -0.3],
          elbowR: [-0.7, 0, 0],
          height: -0.35
        }
      ],
      [
        0.7,
        {
          spine: [0.55, -0.4, 0],
          shoulderR: [-0.7, 0, 0.5],
          elbowR: [-0.05, 0, 0],
          shoulderL: [-0.8, 0, 0.7],
          height: -0.45
        }
      ],
      [1.05, {}]
    ],
    mh_air: [
      [0, {}],
      [
        0.23,
        {
          spine: [-0.3, 0, 0],
          shoulderR: [-2.95, 0, -0.2],
          elbowR: [-0.8, 0, 0],
          hipL: [-1, 0, -0.2],
          kneeL: [1.5, 0, 0],
          hipR: [-0.6, 0, 0.2],
          kneeR: [1.2, 0, 0],
          height: 0.2
        }
      ],
      [0.53, S.smash],
      [0.9, S.smash],
      [1.3, {}]
    ],
    mh_fire: [
      [0, {}],
      [
        0.24,
        {
          spine: [0.08, -0.3, 0],
          shoulderR: [-1.55, 0, -0.1],
          elbowR: [-0.04, 0, 0],
          shoulderL: [-0.7, 0, 0.4],
          elbowL: [-1.4, 0, 0]
        }
      ],
      [0.7, { spine: [-0.12, -0.3, 0], shoulderR: [-1.7, 0, -0.12], elbowR: [-0.15, 0, 0], height: -0.1 }],
      [1.5, {}]
    ],
    mh_focus: [
      [0, {}],
      [0.2, S.coil],
      [0.38, S.coil],
      [0.48, S.hit],
      [0.74, S.hit],
      [1.15, {}]
    ],
    mh_black: [
      [0, {}],
      [0.2, S.coil],
      [0.38, S.coil],
      [0.46, Object.assign({}, S.hit, { spine: [0.4, 0.8, 0], height: -0.25 })],
      [0.75, S.hit],
      [1.15, {}]
    ],
    mh_chain: [
      [0, {}],
      [0.24, { spine: [0.1, -0.6, 0], shoulderR: [0.6, 0, -0.7], elbowR: [-0.6, 0, 0], height: -0.3 }],
      [
        0.48,
        {
          spine: [-0.15, 0.6, 0],
          shoulderR: [-2.65, 0, 0.25],
          elbowR: [-0.08, 0, 0],
          shoulderL: [0.4, 0, 0.6]
        }
      ],
      [0.82, S.coil],
      [1.3, {}]
    ],
    mh_home: [
      [0, {}],
      [
        0.4,
        {
          spine: [0.45, -0.7, -0.3],
          shoulderR: [0.6, 0, -1.3],
          elbowR: [-0.6, 0, 0],
          shoulderL: [-0.7, 0, 0.5],
          hipL: [-0.5, 0, -0.3],
          kneeL: [1, 0, 0],
          height: -0.6
        }
      ],
      [
        0.66,
        {
          spine: [-0.35, 0.9, 0.2],
          shoulderR: [-2.85, 0, 0.7],
          elbowR: [-0.03, 0, 0],
          shoulderL: [0.4, 0, 0.8],
          height: 0.15
        }
      ],
      [1, S.hit],
      [1.4, {}]
    ],
    mh_repel: [
      [0, {}],
      [0.35, S.sign],
      [0.6, S.sign],
      [0.72, S.open],
      [0.95, {}]
    ],
    mh_ride: [
      [0, {}],
      [0.35, S.sign],
      [0.6, S.sign],
      [
        0.7,
        {
          spine: [0.75, 0, 0],
          shoulderL: [-0.5, 0, 0.2],
          shoulderR: [-0.5, 0, -0.2],
          hipL: [-1, 0, 0],
          hipR: [-1, 0, 0],
          kneeL: [1.7, 0, 0],
          kneeR: [1.7, 0, 0],
          height: -1.2
        }
      ],
      [2.6, { spine: [0.5, 0, 0], height: -0.8 }],
      [2.95, {}]
    ],
    mh_blade_dash: [
      [0, {}],
      [
        0.16,
        {
          spine: [0.65, -0.4, 0],
          shoulderL: [0.7, 0, 0.8],
          shoulderR: [0.7, 0, -0.8],
          hipL: [-0.7, 0, 0],
          kneeL: [1.3, 0, 0],
          height: -0.7
        }
      ],
      [
        0.28,
        {
          spine: [0.25, 0.9, 0],
          shoulderL: [-1.6, 0, 0.9],
          shoulderR: [-1.6, 0, -0.9],
          elbowL: [-0.05, 0, 0],
          elbowR: [-0.05, 0, 0],
          height: -0.2
        }
      ],
      [0.7, {}]
    ],
    mh_club_dash: [
      [0, {}],
      [0.2, { spine: [0.2, 0, 0], shoulderL: [0, 0, 1.5], shoulderR: [0, 0, -1.5], height: -0.2 }],
      [0.52, { spine: [0.25, 0, 0], shoulderL: [-0.2, 0, 1.6], shoulderR: [-0.2, 0, -1.6] }],
      [0.75, {}]
    ],
    mh_awaken: [
      [0, {}],
      [
        0.45,
        {
          spine: [0.7, 0, 0],
          neck: [0.5, 0, 0],
          shoulderL: [-1.6, 0, 0.1],
          shoulderR: [-1.6, 0, -0.1],
          elbowL: [-1.9, 0, 0],
          elbowR: [-1.9, 0, 0],
          height: -0.5
        }
      ],
      [0.88, S.open],
      [1.12, S.smash],
      [1.65, S.open],
      [2.2, {}]
    ],
    mh_awblack: [
      [0, {}],
      [0.2, S.coil],
      [1.35, S.coil],
      [1.52, S.hit],
      [1.8, {}]
    ],
    mh_idle: [
      [0, {}],
      [0.3, S.sign],
      [
        0.5,
        {
          spine: [0.35, 0, 0],
          neck: [-0.1, 0, 0],
          shoulderR: [-1.4, 0, -0.1],
          elbowR: [-0.15, 0, 0],
          shoulderL: [0.6, 0, 0.4],
          height: -0.2
        }
      ],
      [2.1, {}]
    ],
    mh_drill: [
      [0, {}],
      [
        0.25,
        {
          spine: [-0.5, 0, 0],
          hipL: [-1.6, 0, -0.1],
          hipR: [-1.6, 0, 0.1],
          kneeL: [0.05, 0, 0],
          kneeR: [0.05, 0, 0],
          shoulderL: [0.4, 0, 1],
          shoulderR: [0.4, 0, -1],
          height: 0.8
        }
      ],
      [0.48, S.coil],
      [0.9, S.hit],
      [1.35, S.hit],
      [2, {}]
    ],
    mh_heart: [
      [0, {}],
      [
        0.45,
        {
          spine: [-0.25, 0, 0],
          shoulderL: [0.3, 0, 1.1],
          shoulderR: [0.3, 0, -1.1],
          hipL: [0.4, 0, -0.4],
          hipR: [0.4, 0, 0.4],
          kneeL: [1.2, 0, 0],
          kneeR: [1.2, 0, 0],
          height: 2.3
        }
      ],
      [4.15, { spine: [0.1, 0, 0], shoulderL: [-0.3, 0, 1.2], shoulderR: [-0.3, 0, -1.2], height: 2.3 }],
      [4.7, {}]
    ],
    mh_grab: [
      [0, {}],
      [0.18, S.coil],
      [0.32, S.hit],
      [5.7, S.hit],
      [6, {}]
    ],
    mh_spike: [
      [0, {}],
      [
        0.65,
        {
          spine: [0.6, 0, 0],
          neck: [-0.2, 0, 0],
          shoulderL: [-0.8, 0, -0.5],
          shoulderR: [-0.8, 0, 0.5],
          elbowL: [-2, 0, 0],
          elbowR: [-2, 0, 0],
          hipL: [-1.1, 0, -0.5],
          hipR: [-1.1, 0, 0.5],
          kneeL: [1.8, 0, 0],
          kneeR: [1.8, 0, 0],
          height: -1.2
        }
      ],
      [2.8, S.open],
      [3.05, S.smash],
      [3.8, {}]
    ],
    mh_domain: [
      [0, {}],
      [0.6, S.sign],
      [1.8, S.sign],
      [2.25, S.open],
      [2.5, {}]
    ]
  };
  function pose(r, a) {
    if (!r.mh || !a) return false;
    var key = a.type,
      t = a.t;
    if (key === 'mh_fin') {
      key =
        a.fin === 'mh_air'
          ? 'mh_air'
          : a.fin === 'mh_home'
            ? 'mh_home'
            : a.fin === 'mh_blade_dash'
              ? 'mh_blade_dash'
              : a.fin === 'mh_black'
                ? 'mh_black'
                : 'mh_focus';
      t = (a.t / (a.dur || 1.35)) * P[key][P[key].length - 1][0];
    }
    var seq = P[key];
    if (!seq) return false;
    if (key === 'mh_awblack' && (a.strike || a.stage === 1)) t = 1.52;
    resetPose(r);
    r.body.rotation.set(0, 0, 0);
    var idx = 1;
    while (idx < seq.length - 1 && t > seq[idx][0]) idx++;
    var left = seq[idx - 1],
      right = seq[idx],
      w = Math.max(0, Math.min(1, (t - left[0]) / (right[0] - left[0])));
    w = w * w * (3 - 2 * w);
    JOINTS.forEach((j) => {
      var l = left[1][j] || [0, 0, 0],
        q = right[1][j] || [0, 0, 0];
      r[j].rotation.set(l[0] + (q[0] - l[0]) * w, l[1] + (q[1] - l[1]) * w, l[2] + (q[2] - l[2]) * w);
    });
    r.hips.position.y = r.hipsBaseY + (left[1].height || 0) * (1 - w) + (right[1].height || 0) * w;
    VOX.mode(r, r.mh.mode, key);
    if (key === 'mh_club_dash') r.body.rotation.y = Math.min(1, t / 0.6) * Math.PI * 2;
    if (key === 'mh_home') r.mh.club[1].scale.setScalar(1 + Math.sin(Math.min(1, t / 1.4) * Math.PI) * 1.2);
    else r.mh.club[1].scale.setScalar(1);
    if (key === 'mh_drill') r.mh.drill.rotation.y = t * 20;
    if (key === 'mh_fire') {
      r.shoulderR.rotation.x += Math.sin(t * 33) * 0.06;
      r.spine.rotation.x += Math.sin(t * 33) * 0.02;
    }
    if (key === 'mh_spike') {
      r.body.visible = t < 0.65 || t > 3.2;
    }
    return true;
  }
  M.pose = pose;
  var previousPose = poseAction;
  poseAction = function (r, a) {
    if (pose(r, a)) return;
    return previousPose(r, a);
  };
  var previousLocomotion = applyLocomotion;
  applyLocomotion = function (r, t, gait, move, run, onGround, vy) {
    previousLocomotion(r, t, gait, move, run, onGround, vy);
    if (r.mh) {
      r.body.visible = true;
      r.body.scale.set(1.04, 1.04, 1.02);
      r.mh.club[1].scale.setScalar(1);
      VOX.mode(r, r.mh.mode);
      r.mh.braids.forEach((g, i) => {
        g.rotation.x = Math.sin(gait + i) * move * 0.13 + Math.sin(t * 1.7 + i) * 0.035;
        g.rotation.z = Math.sin(t * 2 + i) * 0.04;
      });
      r.mh.coat.forEach((g, i) => (g.rotation.x = Math.sin(gait + i * Math.PI) * move * 0.13));
      if (move < 0.1 && onGround) {
        r.spine.rotation.z = -0.04;
        r.neck.rotation.z = 0.065;
        r.shoulderL.rotation.z = 0.13;
        r.shoulderR.rotation.z = -0.16;
        r.elbowL.rotation.x = -0.3;
        r.elbowR.rotation.x = -0.5;
        r.hipL.rotation.z = -0.1;
      }
      if (run > 0.5) {
        r.spine.rotation.x = 0.4;
        r.shoulderL.rotation.x = 0.65;
        r.shoulderR.rotation.x = 0.65;
        r.elbowL.rotation.x = -0.12;
        r.elbowR.rotation.x = -0.12;
      }
    }
    if (r.mhBlocking || (r === player.rig && player.blocking)) {
      r.shoulderL.rotation.x = r.shoulderR.rotation.x = -1.1;
      r.shoulderL.rotation.z = 0.3;
      r.shoulderR.rotation.z = -0.3;
      r.elbowL.rotation.x = r.elbowR.rotation.x = -1.7;
    }
  };
})();
