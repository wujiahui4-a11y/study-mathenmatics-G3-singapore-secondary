/* Study Portal — skill tree.
   Every player starts with the plain bullet. Each level grants one pick.
   Passives change the stat block, actives add a button ability. */
(function (SA) {
  'use strict';

  var CFG = SA.CFG;

  SA.baseStats = function () {
    return {
      maxHp: CFG.BASE_HP,
      speed: CFG.BASE_SPEED,
      dmg: CFG.BASE_DMG,
      fireDelay: CFG.BASE_FIRE_DELAY,
      bulletSpeed: CFG.BULLET_SPEED,
      bulletR: CFG.BULLET_R,
      bulletLife: CFG.BULLET_LIFE,
      extraShots: 0,
      spread: 0.07,
      pierce: 0,
      bounce: 0,
      homing: 0,
      lifesteal: 0,
      thorns: 0,
      regen: 0,
      shieldMax: 0,
      shieldRegen: 0,
      slowHit: 0,
      poison: 0,
      knock: 60
    };
  };

  /* ---------------------------------------------------------------- passives */
  var SKILLS = [
    {
      id: 'rapid', name: 'Rapid Fire', icon: '⚡', max: 4,
      desc: function (r) { return 'Shoot ' + Math.round((1 - Math.pow(0.82, r)) * 100) + '% faster.'; },
      stat: function (s, r) { s.fireDelay *= Math.pow(0.82, r); }
    },
    {
      id: 'multi', name: 'Twin Barrels', icon: '🔱', max: 3,
      desc: function (r) { return 'Fire ' + (1 + r) + ' bullets in a spread.'; },
      stat: function (s, r) { s.extraShots += r; s.dmg *= (1 - 0.09 * r); s.spread = 0.1 + 0.03 * r; }
    },
    {
      id: 'pierce', name: 'Piercing Rounds', icon: '🎯', max: 3,
      desc: function (r) { return 'Bullets pass through ' + r + ' extra enem' + (r === 1 ? 'y' : 'ies') + '.'; },
      stat: function (s, r) { s.pierce += r; }
    },
    {
      id: 'heavy', name: 'Heavy Rounds', icon: '💥', max: 3,
      desc: function (r) { return '+' + (7 * r) + ' damage, bigger but slower bullets.'; },
      stat: function (s, r) { s.dmg += 7 * r; s.bulletR += 1.8 * r; s.bulletSpeed *= Math.pow(0.93, r); s.knock += 25 * r; }
    },
    {
      id: 'ricochet', name: 'Ricochet', icon: '📐', max: 3,
      desc: function (r) { return 'Bullets bounce off walls ' + r + ' time' + (r === 1 ? '' : 's') + '.'; },
      stat: function (s, r) { s.bounce += r; s.bulletLife += 0.25 * r; }
    },
    {
      id: 'homing', name: 'Guided Rounds', icon: '🧲', max: 3,
      desc: function (r) { return 'Bullets curve towards nearby enemies (level ' + r + ').'; },
      stat: function (s, r) { s.homing += r; }
    },
    {
      id: 'swift', name: 'Fleet Foot', icon: '👟', max: 3,
      desc: function (r) { return 'Move ' + (13 * r) + '% faster.'; },
      stat: function (s, r) { s.speed *= (1 + 0.13 * r); }
    },
    {
      id: 'vitality', name: 'Vitality', icon: '❤️', max: 3,
      desc: function (r) { return '+' + (30 * r) + ' maximum health.'; },
      stat: function (s, r) { s.maxHp += 30 * r; }
    },
    {
      id: 'regen', name: 'Regeneration', icon: '🌿', max: 3,
      desc: function (r) { return 'Heal ' + (2 * r) + ' health per second.'; },
      stat: function (s, r) { s.regen += 2 * r; }
    },
    {
      id: 'shield', name: 'Energy Shield', icon: '🛡️', max: 3,
      desc: function (r) { return (28 * r) + ' shield that recharges out of combat.'; },
      stat: function (s, r) { s.shieldMax += 28 * r; s.shieldRegen += 7 + 2 * r; }
    },
    {
      id: 'lifesteal', name: 'Lifesteal', icon: '🩸', max: 3,
      desc: function (r) { return 'Heal for ' + (12 * r) + '% of the damage you deal.'; },
      stat: function (s, r) { s.lifesteal += 0.12 * r; }
    },
    {
      id: 'thorns', name: 'Thorns', icon: '🌵', max: 3,
      desc: function (r) { return 'Reflect ' + (20 * r) + '% of damage taken.'; },
      stat: function (s, r) { s.thorns += 0.2 * r; }
    },
    {
      id: 'frost', name: 'Frost Rounds', icon: '❄️', max: 2,
      desc: function (r) { return 'Hits slow the target by ' + (25 + 15 * r) + '% for a moment.'; },
      stat: function (s, r) { s.slowHit = Math.max(s.slowHit, 0.25 + 0.15 * r); }
    },
    {
      id: 'venom', name: 'Venom Rounds', icon: '🧪', max: 3,
      desc: function (r) { return 'Hits poison for ' + (4 * r) + ' damage per second.'; },
      stat: function (s, r) { s.poison += 4 * r; }
    },
    {
      id: 'longshot', name: 'Long Barrel', icon: '🔭', max: 2,
      desc: function (r) { return 'Bullets travel ' + (30 * r) + '% further and faster.'; },
      stat: function (s, r) { s.bulletLife *= (1 + 0.3 * r); s.bulletSpeed *= (1 + 0.12 * r); }
    },

    /* --------------------------------------------------------------- actives */
    {
      id: 'dash', name: 'Dash', icon: '💨', max: 3, active: true, hotkey: 'Shift',
      desc: function (r) { return 'Dash forward. Cooldown ' + (4.2 - 0.8 * r).toFixed(1) + 's.'; },
      cd: function (r) { return 4.2 - 0.8 * r; },
      use: function (sim, p, r) {
        p.dashT = 0.17;
        p.dashVx = Math.cos(p.angle) * (760 + 60 * r);
        p.dashVy = Math.sin(p.angle) * (760 + 60 * r);
        p.iFrames = Math.max(p.iFrames, 0.2);
        sim.event({ t: 'sfx', s: 'dash', x: p.x, y: p.y });
      }
    },
    {
      id: 'scatter', name: 'Scatter Blast', icon: '🔫', max: 3, active: true,
      desc: function (r) { return 'Fire ' + (6 + 2 * r) + ' pellets in a cone. Cooldown ' + (3.4 - 0.5 * r).toFixed(1) + 's.'; },
      cd: function (r) { return 3.4 - 0.5 * r; },
      use: function (sim, p, r) {
        var n = 6 + 2 * r;
        for (var i = 0; i < n; i++) {
          var a = p.angle + (i / (n - 1) - 0.5) * 0.72;
          sim.spawnBullet(p, a, {
            dmg: p.st.dmg * 0.6, speed: p.st.bulletSpeed * (0.85 + Math.random() * 0.3),
            life: 0.42, radius: p.st.bulletR * 0.85, kind: 1
          });
        }
        sim.event({ t: 'sfx', s: 'shoot', x: p.x, y: p.y });
      }
    },
    {
      id: 'grenade', name: 'Frag Grenade', icon: '💣', max: 3, active: true,
      desc: function (r) { return 'Lob a grenade: ' + (46 + 16 * r) + ' damage in a blast. Cooldown ' + (6.5 - 0.8 * r).toFixed(1) + 's.'; },
      cd: function (r) { return 6.5 - 0.8 * r; },
      use: function (sim, p, r) {
        sim.spawnBullet(p, p.angle, {
          dmg: 0, speed: 430, life: 0.85, radius: 8, kind: 2,
          fuse: true, blastDmg: 46 + 16 * r, blastR: 95 + 18 * r, bounce: 3
        });
      }
    },
    {
      id: 'mine', name: 'Proximity Mine', icon: '🧨', max: 3, active: true,
      desc: function (r) { return 'Drop a mine: ' + (55 + 18 * r) + ' damage when an enemy steps close. Cooldown ' + (7.5 - 1 * r).toFixed(1) + 's.'; },
      cd: function (r) { return 7.5 - 1 * r; },
      use: function (sim, p, r) {
        sim.spawnMine(p, 55 + 18 * r, 82 + 10 * r);
      }
    },
    {
      id: 'turret', name: 'Auto Turret', icon: '🤖', max: 3, active: true,
      desc: function (r) { return 'Deploy a turret that shoots for ' + (9 + 3 * r) + 's. Cooldown ' + (17 - 2 * r) + 's.'; },
      cd: function (r) { return 17 - 2 * r; },
      use: function (sim, p, r) {
        sim.spawnTurret(p, 9 + 3 * r, 8 + 3 * r);
      }
    },
    {
      id: 'cloak', name: 'Cloak', icon: '👻', max: 3, active: true,
      desc: function (r) { return 'Turn nearly invisible for ' + (2.5 + r) + 's. Cooldown ' + (14 - 2 * r) + 's.'; },
      cd: function (r) { return 14 - 2 * r; },
      use: function (sim, p, r) {
        p.cloakT = 2.5 + r;
        sim.event({ t: 'sfx', s: 'dash', x: p.x, y: p.y });
      }
    },
    {
      id: 'beam', name: 'Focus Beam', icon: '🔆', max: 3, active: true,
      desc: function (r) { return 'Instant beam through everything for ' + (38 + 14 * r) + ' damage. Cooldown ' + (7 - 0.8 * r).toFixed(1) + 's.'; },
      cd: function (r) { return 7 - 0.8 * r; },
      use: function (sim, p, r) { sim.fireBeam(p, 38 + 14 * r); }
    },
    {
      id: 'nova', name: 'Shock Nova', icon: '🌀', max: 3, active: true,
      desc: function (r) { return 'Blast everyone around you for ' + (30 + 12 * r) + ' damage and knock them back. Cooldown ' + (9 - 1 * r) + 's.'; },
      cd: function (r) { return 9 - 1 * r; },
      use: function (sim, p, r) {
        sim.explode(p.x, p.y, 165 + 15 * r, 30 + 12 * r, p, 320);
      }
    },
    {
      id: 'medkit', name: 'Field Kit', icon: '⛑️', max: 3, active: true,
      desc: function (r) { return 'Instantly heal ' + (35 + 15 * r) + ' health. Cooldown ' + (16 - 2 * r) + 's.'; },
      cd: function (r) { return 16 - 2 * r; },
      use: function (sim, p, r) {
        sim.heal(p, 35 + 15 * r);
        sim.event({ t: 'sfx', s: 'pickup', x: p.x, y: p.y });
      }
    }
  ];

  SA.SKILLS = SKILLS;
  SA.SKILL_BY_ID = {};
  SKILLS.forEach(function (s) { SA.SKILL_BY_ID[s.id] = s; });

  /* kills required to go from `level` to `level + 1`: 1, 2, 4, 8, 16 ... */
  SA.killsForLevel = function (level) { return Math.pow(2, level - 1); };

  SA.recomputeStats = function (p) {
    var s = SA.baseStats();
    for (var id in p.skills) {
      var def = SA.SKILL_BY_ID[id];
      if (def && def.stat) def.stat(s, p.skills[id]);
    }
    /* a little extra toughness per level so late fights are not one-shot */
    s.maxHp += (p.level - 1) * 8;
    p.st = s;
    if (p.hp > s.maxHp) p.hp = s.maxHp;
    if (p.shield > s.shieldMax) p.shield = s.shieldMax;

    p.actives = [];
    for (var i = 0; i < SKILLS.length; i++) {
      var d = SKILLS[i];
      if (d.active && d.id !== 'dash' && p.skills[d.id]) p.actives.push(d.id);
    }
    p.actives.sort(function (a, b) { return (p.order[a] || 0) - (p.order[b] || 0); });
  };

  var ABILITY_KEYS = ['Q', 'E', 'R', 'F'];
  SA.abilityKey = function (i) { return ABILITY_KEYS[i] || '-'; };

  /* Offer three cards: keep one upgrade of something owned when possible so
     builds can go deep, fill the rest with new skills. */
  SA.rollCards = function (p, rnd) {
    rnd = rnd || Math.random;
    var owned = [], fresh = [];
    SKILLS.forEach(function (d) {
      var rank = p.skills[d.id] || 0;
      if (rank >= d.max) return;
      if (p.actives && p.actives.length >= 4 && d.active && d.id !== 'dash' && !rank) return;
      (rank > 0 ? owned : fresh).push(d.id);
    });
    var out = [];
    function take(pool) {
      if (!pool.length) return;
      var i = Math.floor(rnd() * pool.length);
      var id = pool.splice(i, 1)[0];
      if (out.indexOf(id) < 0) out.push(id);
    }
    if (owned.length && rnd() < 0.72) take(owned);
    while (out.length < 3 && (fresh.length || owned.length)) {
      take(fresh.length && (rnd() < 0.72 || !owned.length) ? fresh : owned);
    }
    return out;
  };

  SA.cardInfo = function (p, id) {
    var d = SA.SKILL_BY_ID[id];
    var rank = (p.skills[id] || 0) + 1;
    return {
      id: id, name: d.name, icon: d.icon, rank: rank, max: d.max,
      desc: d.desc(rank), isNew: rank === 1, active: !!d.active
    };
  };

})(window.SA);
