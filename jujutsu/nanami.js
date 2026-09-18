/* Nanami model and permanently equipped wrapped blade. Combat and ratio VFX
   are implemented by nanami-rework.js and nanami-vfx.js. */
(function () {
  'use strict';
  if (typeof player === 'undefined' || typeof THREE === 'undefined') return;
  var FX = window.JJFX;
  if (!FX || typeof CHARS === 'undefined') return;
  var AN = window.JJANIM;
  var E = FX.ease;
  var TAU = Math.PI * 2;

  /* the measurement: a cold near-white, because it is a ruler */
  var RAT = 0xd8e4ec, RAT2 = 0xffffff, STEEL = 0x4d84a8;
  /* the man */
  var SHIRT = 0x3f6f96, SHIRT_D = 0x2f5878, BRACE = 0x8a5232, BRACE_D = 0x63381f;
  var TIE = 0xa89a5e, TIE_SPOT = 0x2a2618, SLACK = 0xd8d4c8, SLACK_D = 0xbfbbae;
  var SHOE = 0x7a4a2c, BELT = 0x5c3a22, SKIN = 0xf0c9a0, SKIN_D = 0xd6a878;
  var HAIR = 0xd6c17e, HAIR_D = 0xb59a52;
  var LENS = 0x3d5a4a, FRAME = 0xc9a84e;
  /* the weapon: a black grip, a spotted wrap, and a blunt end */
  var GRIP = 0x14151a, WRAP = 0xf2f0ea, SPOT = 0x191919, BLADE = 0x9aa2ab, BLADE_D = 0x6d747c;

  var NA = window.JJNANAMI = { props: [] };

  var WCD = { w1: 7, w2: 9, w3: 10, w4: 16, wr: 24 };

  var NANAMI_CFG = {
    nanami: true, face: false,
    torso: SHIRT, pants: SLACK, shoes: SHOE, skin: SKIN
  };

  /* ---------------------------------------------------------------- rig
     The three things that have to read at fighting distance: the round
     tinted glasses, the braces over a blue shirt, and the fact that his
     sleeves stop at the elbow. Everything else is trim.
     ================================================================== */
  var _makeAnimeRig = makeAnimeRig;
  makeAnimeRig = function (cfg) {
    var r = _makeAnimeRig(cfg);
    if (!cfg || !cfg.nanami) return r;
    var head = r.head, spine = r.spine, hips = r.hips;

    function box(w, h, d, c, basic) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), basic
        ? new THREE.MeshBasicMaterial({ color: c, toneMapped: false })
        : new THREE.MeshStandardMaterial({ color: c, roughness: .8 }));
      m.castShadow = !basic;
      return m;
    }
    var i, s;

    /* the hair: blonde, short, with a part that is on one side and stays
       there. It is combed rather than styled */
    var top = box(.96, .3, .96, HAIR); top.position.set(0, .98, -.02); head.add(top);
    var swept = box(.9, .22, .8, HAIR_D); swept.position.set(0, 1.16, -.08); swept.rotation.x = .1; head.add(swept);
    var part = box(.07, .22, .84, HAIR_D); part.position.set(-.2, 1.06, -.02); head.add(part);
    /* a short fringe that stops well above the glasses */
    for (i = 0; i < 4; i++) {
      var fr = box(.24, .2, .12, i % 2 ? HAIR : HAIR_D);
      fr.position.set(-.33 + i * .22, .92, .44);
      fr.rotation.z = (i - 1.5) * .08;
      head.add(fr);
    }
    for (s = -1; s <= 1; s += 2) {
      var side = box(.12, .44, .8, HAIR_D); side.position.set(.44 * s, .74, -.04); head.add(side);
    }
    var back = box(.9, .44, .16, HAIR_D); back.position.set(0, .74, -.44); head.add(back);

    /* THE GLASSES. Round, tinted, and with no arms going over his ears —
       they sit on the face and the bridge is the only thing holding them */
    for (s = -1; s <= 1; s += 2) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(.155,.025,6,20),new THREE.MeshStandardMaterial({color:FRAME,metalness:.65,roughness:.3})); ring.position.set(.22 * s, .57, .46); head.add(ring);
      var lens = new THREE.Mesh(new THREE.CircleGeometry(.135,20),new THREE.MeshBasicMaterial({color:LENS})); lens.position.set(.22 * s, .57, .49); head.add(lens);
      var shine = box(.08, .16, .03, 0x9fc4b4, true); shine.position.set(.15 * s, .61, .51); head.add(shine);
    }
    var bridge = box(.16, .05, .05, FRAME); bridge.position.set(0, .58, .48); head.add(bridge);
    var brow = box(.72, .04, .06, HAIR_D); brow.position.set(0, .74, .46); head.add(brow);
    var mouth2 = box(.2, .04, .04, 0xb07a5e); mouth2.position.set(0, .28, .46); head.add(mouth2);
    var jaw2 = box(.8, .2, .28, SKIN_D); jaw2.position.set(0, .14, .3); head.add(jaw2);

    /* the collar, open at the throat, and the tie under it */
    var collarL = box(.3, .26, .12, SHIRT_D); collarL.position.set(-.2, 1.02, .34); collarL.rotation.z = .3; spine.add(collarL);
    var collarR = box(.3, .26, .12, SHIRT_D); collarR.position.set(.2, 1.02, .34); collarR.rotation.z = -.3; spine.add(collarR);
    var knot = box(.16, .16, .1, TIE); knot.position.set(0, .96, .36); spine.add(knot);
    /* the tie: spotted, the same cloth as the wrap on the weapon */
    for (i = 0; i < 6; i++) {
      var seg = box(.13 + i * .01, .16, .07, TIE);
      seg.position.set(0, .82 - i * .155, .36 + i * .002);
      spine.add(seg);
      if (i % 2 === 0) {
        var sp = box(.045, .045, .03, TIE_SPOT); sp.position.set(-.032, .84 - i * .155, .41); spine.add(sp);
      }
      var sp2 = box(.04, .04, .03, TIE_SPOT); sp2.position.set(.036, .78 - i * .155, .41); spine.add(sp2);
    }
    /* the shirt placket and its buttons */
    var placket = box(.1, 1.0, .06, SHIRT_D); placket.position.set(-.14, .56, .34); spine.add(placket);

    /* THE BRACES. Over both shoulders, down the front to the waistband
       and down the back, which is what stops them reading as straps on a
       bag rather than as braces */
    for (s = -1; s <= 1; s += 2) {
      var fB = box(.14, 1.14, .07, BRACE); fB.position.set(.44 * s, .5, .35);
      fB.rotation.z = .13 * s; spine.add(fB);
      var oB = box(.14, .3, .5, BRACE); oB.position.set(.44 * s, 1.0, .06); spine.add(oB);
      var bB = box(.14, 1.04, .07, BRACE_D); bB.position.set(.36 * s, .5, -.32);
      bB.rotation.z = -.05 * s; spine.add(bB);
      var clip = box(.16, .1, .1, 0xb8bcc4); clip.position.set(.44 * s, -.02, .36); spine.add(clip);
    }

    /* the sleeves stop at the elbow: the upper arm is shirt, the forearm
       is him, and a rolled cuff sits at the join */
    var arms = [[r.shoulderL, r.elbowL], [r.shoulderR, r.elbowR]];
    for (i = 0; i < arms.length; i++) {
      var roll = box(.44, .2, .44, SHIRT_D); roll.position.set(0, -.94, 0); arms[i][0].add(roll);
      var fore = box(.34, .94, .34, SKIN); fore.position.set(0, -.46, 0); arms[i][1].add(fore);
    }

    /* the belt over the waistband of the slacks, and a crease down each leg */
    var belt2 = box(1.08, .16, .66, BELT); belt2.position.set(0, .72, 0); hips.add(belt2);
    var buck2 = box(.2, .16, .08, 0xb8bcc4); buck2.position.set(0, .72, .34); hips.add(buck2);
    var legs = [[r.hipL, r.kneeL], [r.hipR, r.kneeR]];
    for (i = 0; i < legs.length; i++) {
      var cr = box(.05, 1.18, .06, SLACK_D); cr.position.set(0, -.59, .25); legs[i][0].add(cr);
      var cr2 = box(.05, 1.14, .06, SLACK_D); cr2.position.set(0, -.57, .22); legs[i][1].add(cr2);
    }

    // Open cream jacket from the pose references, with the blue shirt visible.
    for(const sign of [-1,1]){
      const panel=box(.48,1.3,.16,0xe8e2d5);panel.position.set(sign*.49,.48,.41);spine.add(panel);
      const side=box(.16,1.3,.72,0xd7d1c7);side.position.set(sign*.67,.48,0);spine.add(side);
      const lapel=box(.20,.8,.12,0xf1ece3);lapel.position.set(sign*.29,.78,.51);lapel.rotation.z=sign*.27;spine.add(lapel);
      const tail=box(.51,.66,.14,0xe8e2d5);tail.position.set(sign*.38,.20,.38);hips.add(tail);
      const shoulder=sign<0?r.shoulderL:r.shoulderR,elbow=sign<0?r.elbowL:r.elbowR;
      const sleeve=box(.45,1.0,.46,0xe8e2d5);sleeve.position.y=-.49;shoulder.add(sleeve);
      const lower=box(.38,.90,.38,0xe4ddd0);lower.position.y=-.44;elbow.add(lower);
    }
    const coatBack=box(1.30,1.30,.12,0xe1dbce);coatBack.position.set(0,.48,-.40);spine.add(coatBack);
    const blade = buildCleaver();r.handR.add(blade);r.nanamiBlade=blade;
    blade.rotation.x=1.05;blade.scale.setScalar(.76); // grip at the palm; blade clears the floor at rest
    return r;
  };

  CHARS.nanami = {
    name: 'KENTO NANAMI', sub: 'RATIO TECHNIQUE 十劃呪法',
    cfg: NANAMI_CFG, glow: '#4d84a8',
    moves: [
      { key: 'LMB', lbl: 'Blade Slash', cd: 'm1', max: .3 },
      { key: 'Q', lbl: 'Dash', cd: 'dash', max: 1 },
      { key: '1', lbl: 'Turning Cut', cd: 'w1', max: WCD.w1 },
      { key: '2', lbl: 'Ratio Draw · Hold', cd: 'w2', max: WCD.w2 },
      { key: '3', lbl: 'Threefold', cd: 'w3', max: WCD.w3 },
      { key: '4', lbl: 'Blind Spot', cd: 'w4', max: WCD.w4 },
      { key: 'R', lbl: 'Overtime', cd: 'wr', max: WCD.wr }
    ]
  };
  try { CHARS.nanami.portrait = makePortrait(NANAMI_CFG); } catch (e) {}
  try { buildCharList(); } catch (e) {}

  cds.w1 = 0; cds.w2 = 0; cds.w3 = 0; cds.w4 = 0; cds.wr = 0;

  function buildCleaver() {
    const g=new THREE.Group();g.name='Nanami wrapped blade';
    function mesh(geo,color,x,y,z){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.64,metalness:color===BLADE?.65:.12}));m.position.set(x,y,z);g.add(m);return m;}
    const box=(w,h,d,c,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),c,x,y,z);
    box(.18,.19,.76,GRIP,0,0,0);box(.25,.24,.1,0x525762,0,0,-.41);
    for(let i=0;i<6;i++)box(.195,.205,.035,0x383b43,0,0,-.31+i*.11);
    box(.44,.15,.15,0x626976,0,0,.43);
    const outline=new THREE.Shape();outline.moveTo(-.27,.48);outline.lineTo(.27,.48);outline.lineTo(.34,2.65);outline.lineTo(.18,2.95);outline.lineTo(-.27,2.83);outline.closePath();
    const geo=new THREE.ExtrudeGeometry(outline,{depth:.16,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1});geo.rotateX(Math.PI/2);geo.translate(0,.08,0);
    mesh(geo,BLADE,0,0,0);
    box(.50,.20,2.12,WRAP,0,0,1.56);
    for(let i=0;i<9;i++){const band=box(.515,.025,.035,0xc7c7c1,0,.112,.6+i*.235);band.rotation.y=.2;}
    for(let i=0;i<18;i++){const x=Math.sin(i*2.37)*.18,z=.65+(i%9)*.23;const spot=mesh(new THREE.CircleGeometry(.047+(i%3)*.012,5),SPOT,x,i<9?.119:-.119,z);spot.rotation.x=i<9?-Math.PI/2:Math.PI/2;spot.rotation.z=i*.8;}
    box(.045,.18,2.06,0xe9eef5,.265,0,1.60);
    const tip=new THREE.Object3D();tip.name='Nanami blade tip';tip.position.z=2.96;g.add(tip);g.userData.tip=tip;
    return g;
  }
  NA.buildCleaver=buildCleaver;NA.RAT=RAT;NA.RAT2=RAT2;NA.STEEL=STEEL;
  NA.WRAP=WRAP;NA.SPOT=SPOT;NA.BLADE=BLADE;NA.remote={};
  // The late combat layer fills these delegates after shared melee is loaded.
  (window.JJCHARCAST||={}).nanami={cast:[0,1,2,3,4].map(i=>()=>window.JJNANAMIX?.cast(i)),state:NA};
})();
