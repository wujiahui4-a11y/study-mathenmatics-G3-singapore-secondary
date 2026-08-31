/* Study Portal — DOM glue: lobby, HUD, level-up cards, kill feed. */
(function (SA) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var UI = {
    els: {},
    handlers: {},
    notesOpen: false,
    lastScreen: 'site',
    cardIds: []
  };

  UI.init = function (handlers) {
    UI.handlers = handlers || {};
    var e = UI.els;
    ['siteScreen', 'lobbyScreen', 'gameScreen', 'notesOverlay', 'nameInput', 'colorPicker',
      'botRange', 'botOut', 'botRangeSolo', 'botOutSolo', 'createBtn', 'joinBtn', 'soloBtn',
      'joinCode', 'shareBox', 'shareLink', 'copyBtn', 'netStatus', 'hudLevel', 'hudXpFill',
      'hudXpText', 'hudHpFill', 'hudShieldFill', 'hudHpText', 'hudSkills', 'roomCodeText',
      'roomCopy', 'rcNet', 'scorePanel', 'killFeed', 'abilityBar', 'cardsWrap', 'cards',
      'cardLevel', 'cardTimer', 'deathBox', 'deathBy', 'deathTimer', 'toast', 'soundBtn',
      'notesBtn', 'leaveBtn', 'streakBars', 'minimap'].forEach(function (id) { e[id] = $(id); });

    /* fake activity graph on the landing page */
    var bars = '';
    for (var i = 0; i < 14; i++) {
      var h = 8 + Math.round(Math.abs(Math.sin(i * 1.7)) * 26);
      bars += '<i class="' + (i > 3 ? 'on' : '') + '" style="height:' + h + 'px"></i>';
    }
    e.streakBars.innerHTML = bars;

    document.querySelectorAll('[data-action="open-arena"]').forEach(function (b) {
      b.addEventListener('click', function () { UI.showScreen('lobby'); });
    });
    document.querySelectorAll('[data-action="open-notes"]').forEach(function (b) {
      b.addEventListener('click', function (ev) { ev.preventDefault(); UI.setNotes(true); });
    });
    document.querySelectorAll('[data-action="go-home"]').forEach(function (b) {
      b.addEventListener('click', function () { UI.showScreen('site'); });
    });

    /* colour picker */
    SA.COLORS.forEach(function (c, i) {
      var b = document.createElement('button');
      b.style.background = c;
      b.dataset.idx = i;
      b.addEventListener('click', function () {
        UI.colorIdx = i;
        Array.prototype.forEach.call(e.colorPicker.children, function (n) { n.classList.remove('sel'); });
        b.classList.add('sel');
        try { localStorage.setItem('sp_color', String(i)); } catch (err) {}
      });
      e.colorPicker.appendChild(b);
    });
    var savedColor = 0, savedName = '';
    try {
      savedColor = parseInt(localStorage.getItem('sp_color') || '0', 10) || 0;
      savedName = localStorage.getItem('sp_name') || '';
    } catch (err) {}
    UI.colorIdx = savedColor % SA.COLORS.length;
    e.colorPicker.children[UI.colorIdx].classList.add('sel');
    e.nameInput.value = savedName;
    e.nameInput.addEventListener('input', function () {
      try { localStorage.setItem('sp_name', e.nameInput.value); } catch (err) {}
    });

    /* tabs */
    document.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(function (p) {
          p.classList.toggle('hidden', p.dataset.panel !== t.dataset.tab);
        });
      });
    });

    e.botRange.addEventListener('input', function () { e.botOut.textContent = e.botRange.value + ' bots'; });
    e.botRangeSolo.addEventListener('input', function () { e.botOutSolo.textContent = e.botRangeSolo.value + ' bots'; });

    e.createBtn.addEventListener('click', function () { UI.handlers.create && UI.handlers.create(); });
    e.joinBtn.addEventListener('click', function () { UI.handlers.join && UI.handlers.join(e.joinCode.value.trim().toUpperCase()); });
    e.soloBtn.addEventListener('click', function () { UI.handlers.solo && UI.handlers.solo(); });
    e.joinCode.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') UI.handlers.join && UI.handlers.join(e.joinCode.value.trim().toUpperCase());
    });
    e.copyBtn.addEventListener('click', function () { UI.copy(e.shareLink.value, e.copyBtn); });
    e.roomCopy.addEventListener('click', function () { UI.copy(UI.inviteLink || location.href, e.roomCopy); });
    e.leaveBtn.addEventListener('click', function () { UI.handlers.leave && UI.handlers.leave(); });
    e.notesBtn.addEventListener('click', function () { UI.setNotes(true); });
    e.soundBtn.addEventListener('click', function () {
      SA.Sound.set(!SA.Sound.isOn());
      e.soundBtn.textContent = SA.Sound.isOn() ? '🔊' : '🔇';
    });
  };

  UI.copy = function (text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'copied!';
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { UI.copyFallback(text, done); });
    } else UI.copyFallback(text, done);
  };

  UI.copyFallback = function (text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  };

  UI.showScreen = function (name) {
    UI.lastScreen = name;
    UI.els.siteScreen.classList.toggle('hidden', name !== 'site');
    UI.els.lobbyScreen.classList.toggle('hidden', name !== 'lobby');
    UI.els.gameScreen.classList.toggle('hidden', name !== 'game');
    document.body.style.overflow = name === 'game' ? 'hidden' : '';
    if (name === 'game' && UI.handlers.resize) UI.handlers.resize();
  };

  UI.setNotes = function (on) {
    UI.notesOpen = on;
    UI.els.notesOverlay.classList.toggle('hidden', !on);
    if (on) window.scrollTo(0, 0);
  };

  UI.playerName = function () {
    var v = (UI.els.nameInput.value || '').trim();
    return (v || 'Player' + Math.floor(Math.random() * 900 + 100)).slice(0, 12);
  };

  UI.netStatus = function (text, cls) {
    UI.els.netStatus.textContent = text || '';
    UI.els.netStatus.className = 'net-status' + (cls ? ' ' + cls : '');
  };

  UI.showShare = function (link) {
    UI.inviteLink = link;
    UI.els.shareBox.classList.remove('hidden');
    UI.els.shareLink.value = link;
  };

  UI.setRoom = function (code, link) {
    UI.inviteLink = link;
    UI.els.roomCodeText.textContent = code;
    UI.els.roomCopy.classList.toggle('hidden', !link);
  };

  UI.setPing = function (text, bad) {
    UI.els.rcNet.textContent = text;
    UI.els.rcNet.classList.toggle('bad', !!bad);
  };

  UI.toast = function (text, ms) {
    var t = UI.els.toast;
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(UI._toastT);
    UI._toastT = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  };

  /* ------------------------------------------------------------------ HUD */
  UI.updateHud = function (s) {
    if (!s) return;
    var e = UI.els;
    e.hudLevel.textContent = s.level;
    var frac = s.need ? SA.clamp(s.ktl / s.need, 0, 1) : 1;
    e.hudXpFill.style.width = (frac * 100).toFixed(1) + '%';
    e.hudXpText.textContent = s.level >= SA.CFG.MAX_LEVEL
      ? 'max level · ' + s.kills + ' kills'
      : s.ktl + ' / ' + s.need + ' kills to level ' + (s.level + 1);

    var hpFrac = SA.clamp(s.hp / Math.max(1, s.maxHp), 0, 1);
    e.hudHpFill.style.width = (hpFrac * 100).toFixed(1) + '%';
    e.hudHpText.textContent = Math.max(0, Math.round(s.hp)) + (s.shield > 0 ? ' +' + Math.round(s.shield) : '');
    var shFrac = s.shieldMax ? SA.clamp(s.shield / s.shieldMax, 0, 1) : 0;
    e.hudShieldFill.style.width = (shFrac * 100).toFixed(1) + '%';

    var chips = '';
    for (var id in s.skills) {
      var d = SA.SKILL_BY_ID[id];
      if (!d) continue;
      chips += '<span class="skill-chip" title="' + d.name + ' — ' + d.desc(s.skills[id]).replace(/"/g, '') + '">' +
        d.icon + ' <b>' + s.skills[id] + '</b></span>';
    }
    if (e.hudSkills.innerHTML !== chips) e.hudSkills.innerHTML = chips;

    UI.updateAbilities(s);
  };

  UI.updateAbilities = function (s) {
    var wrap = UI.els.abilityBar;
    var list = [];
    if (s.skills.dash) list.push({ id: 'dash', key: 'Shift' });
    (s.actives || []).forEach(function (id, i) { list.push({ id: id, key: SA.abilityKey(i) }); });

    var sig = list.map(function (l) { return l.id + l.key; }).join('|');
    if (wrap._sig !== sig) {
      wrap._sig = sig;
      wrap.innerHTML = '';
      list.forEach(function (l) {
        var d = SA.SKILL_BY_ID[l.id];
        var el = document.createElement('div');
        el.className = 'ab';
        el.innerHTML = '<span class="ab-key">' + l.key + '</span>' +
          '<span class="ab-icon">' + d.icon + '</span>' +
          '<span class="ab-name">' + d.name.split(' ')[0] + '</span>' +
          '<span class="ab-cd"></span>';
        el.dataset.id = l.id;
        wrap.appendChild(el);
      });
    }
    Array.prototype.forEach.call(wrap.children, function (el) {
      var id = el.dataset.id;
      var cd = (s.cds && s.cds[id]) || 0;
      var max = (s.cdMax && s.cdMax[id]) || 1;
      var frac = SA.clamp(cd / max, 0, 1);
      el.querySelector('.ab-cd').style.height = (frac * 100) + '%';
      el.classList.toggle('ready', frac <= 0);
    });
  };

  UI.setScores = function (rows) {
    var html = '<div class="score-head">Study group</div>';
    rows.slice(0, 8).forEach(function (r) {
      html += '<div class="score-row' + (r.me ? ' me' : '') + '">' +
        '<span class="score-dot" style="background:' + SA.COLORS[r.c % SA.COLORS.length] +
        ';opacity:' + (r.alive ? 1 : 0.35) + '"></span>' +
        '<span class="score-name">' + escapeHtml(r.name) + (r.bot ? ' <small style="opacity:.5">bot</small>' : '') + '</span>' +
        '<span class="score-lvl">L' + r.level + '</span>' +
        '<span class="score-k">' + r.kills + '</span>' +
        '</div>';
    });
    if (UI.els.scorePanel.innerHTML !== html) UI.els.scorePanel.innerHTML = html;
  };

  UI.addKillFeed = function (ev) {
    var el = document.createElement('div');
    el.className = 'kf';
    var col = function (i) { return SA.COLORS[(i || 0) % SA.COLORS.length]; };
    if (ev.a) {
      el.innerHTML = '<b style="color:' + col(ev.ca) + '">' + escapeHtml(ev.a) + '</b> ' +
        '<span style="opacity:.6">defeated</span> <b style="color:' + col(ev.cb) + '">' + escapeHtml(ev.b) + '</b>';
    } else {
      el.innerHTML = '<b style="color:' + col(ev.cb) + '">' + escapeHtml(ev.b) + '</b> <span style="opacity:.6">was eliminated</span>';
    }
    UI.els.killFeed.appendChild(el);
    while (UI.els.killFeed.children.length > 5) UI.els.killFeed.removeChild(UI.els.killFeed.firstChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 7000);
  };

  UI.addFeedText = function (html) {
    var el = document.createElement('div');
    el.className = 'kf';
    el.innerHTML = html;
    UI.els.killFeed.appendChild(el);
    while (UI.els.killFeed.children.length > 5) UI.els.killFeed.removeChild(UI.els.killFeed.firstChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 6000);
  };

  UI.showCards = function (player, ids, level) {
    UI.cardIds = ids.slice();
    UI.els.cardLevel.textContent = level;
    UI.els.cards.innerHTML = '';
    ids.forEach(function (id, i) {
      var info = SA.cardInfo(player, id);
      var b = document.createElement('div');
      b.className = 'card-pick';
      b.innerHTML =
        '<div class="cp-top"><span class="cp-icon">' + info.icon + '</span>' +
        '<div><div class="cp-name">' + info.name + '</div>' +
        '<div class="cp-rank">' + (info.isNew ? (info.active ? 'new ability' : 'new skill') : 'upgrade · rank ' + info.rank + '/' + info.max) + '</div></div>' +
        '<span class="cp-key">' + (i + 1) + '</span></div>' +
        '<div class="cp-desc">' + info.desc + '</div>';
      b.addEventListener('click', function () { UI.handlers.pick && UI.handlers.pick(id); });
      UI.els.cards.appendChild(b);
    });
    UI.els.cardsWrap.classList.remove('hidden');
  };

  UI.setCardTimer = function (secs) {
    UI.els.cardTimer.textContent = Math.max(0, Math.ceil(secs));
  };

  UI.hideCards = function () {
    UI.cardIds = [];
    UI.els.cardsWrap.classList.add('hidden');
  };

  UI.setDeath = function (show, by, secs) {
    UI.els.deathBox.classList.toggle('hidden', !show);
    if (!show) return;
    UI.els.deathBy.textContent = by || 'the arena';
    UI.els.deathTimer.textContent = Math.max(0, Math.ceil(secs));
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  SA.UI = UI;

})(window.SA);
