/* Adapt the saved Main/Menus templates in Jujutsu Shenanigans.rbxl to the
   browser game. Existing controls, cooldowns and multiplayer own their state. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const css = document.createElement('style');
  css.id = 'jjStudioStyle';
  css.textContent = `
    :root{--gold:#d5d5d5;--gold-hi:#55ffff;--paper:#fff;--mute:#bbb;--studio-cyan:#55ffff}
    #menu,#jjLobby,#hud,#jjStudioTopbar{font-family:Arial,'Segoe UI',sans-serif}
    button:focus-visible,[role=button]:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #55ffff!important;outline-offset:3px}
    #jjStudioTopbar{position:fixed;left:12px;top:12px;z-index:26;display:flex;gap:6px;align-items:flex-start}
    #jjStudioTopbar>button,#charList .clHead{height:36px;border:0;border-radius:7px;background:rgba(25,25,25,.88);color:white;font:600 13px Arial;letter-spacing:0;padding:0 12px;cursor:pointer;display:flex;align-items:center;gap:7px;text-shadow:none;min-width:0}
    #jjStudioTopbar>button:hover,#charList .clHead:hover{background:#4b4b4b}
    #jjStudioTopbar svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;flex-shrink:0}
    #charList{position:relative;left:auto;top:auto;gap:0;display:block}
    #charList .clCount,#charList .clHint{display:none}
    #charList #clBody{position:absolute;left:0;top:42px;min-width:232px;max-height:calc(100dvh - 120px);background:rgba(25,25,25,.95);padding:5px;gap:2px;border-radius:6px;scrollbar-color:#888 #333}
    .charItem,.charItem.active{min-width:0;gap:9px;padding:6px;border:0;border-radius:3px;background:transparent;box-shadow:none}
    .charItem.active{background:#555}.charItem:hover{background:#444}
    .charItem img{width:30px;height:30px;border:0;background:transparent}
    .charItem .cname{font:600 13px Arial;letter-spacing:0;color:white;text-shadow:none}.charItem .ctech{font:10px Arial;letter-spacing:0;color:#ccc}
    #charCard{left:auto;right:14px;top:14px;min-width:0;width:190px;padding:9px 11px;background:rgba(31,31,31,.6);border:0;box-shadow:none}
    #charCard .name{font:600 13px Arial;letter-spacing:0;color:white;text-shadow:0 1px 2px #000!important}
    #charCard .sub{font:9px Arial;letter-spacing:0;color:#eee;margin:4px 0 7px}
    #charCard .barWrap{height:8px;border:1px solid #222;background:#3c3c3c}
    #hpFill{background:#9ed8aa;box-shadow:none}
    #moves{bottom:5px;gap:5px;width:300px;height:60px;justify-content:center;align-items:center}
    #moves .move{min-width:0;width:60px;height:60px;flex:0 0 60px;padding:8px 3px;overflow:visible;border:0;border-radius:0;background:rgba(31,31,31,.5);box-shadow:none;justify-content:center;pointer-events:auto;cursor:pointer}
    #moves .move .key{left:0;top:-9px;width:100%;font:600 16px Arial;letter-spacing:0;color:white;text-align:center;text-shadow:-1px -1px #000,1px 1px #000,0 1px #000;z-index:2}
    #moves .move .name{font:13px/1.1 Arial;letter-spacing:0;white-space:normal;color:#fff;text-shadow:0 1px 2px #000;z-index:2;overflow-wrap:anywhere}
    #moves .move .cd{background:rgba(85,255,255,.66);z-index:1;max-height:100%}
    #moves .move.onCd{outline:1px solid rgba(85,255,255,.3)}
    #moves .move.onCd .name{color:#fff}
    #moves .move.jjUtility{display:none}
    #moves .move.jjSpecial{position:absolute;left:calc(100% + 5px);bottom:0;width:50px;min-width:0;height:48px;font-size:11px}
    #moves .move.jjSpecial .name{font-size:11px}
    #moves .move.jjAuxiliary{position:absolute;right:calc(100% + 5px);bottom:0;width:40px;height:48px}#moves .move.jjAuxiliary .name{font-size:10px}
    #jjAwake,#jjTodoHud,#jjMahitoHud{left:50%!important;bottom:90px!important;transform:translateX(-50%)!important;width:300px!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;pointer-events:none;font-family:Arial,sans-serif!important;z-index:9!important;color:#fff!important}
    #jjAwake .row{position:absolute;bottom:25px;left:0;right:0;display:block;text-align:center;margin:0}
    #jjAwake .lbl{font:600 18px Arial;letter-spacing:0;color:white;text-shadow:-1px -1px #000,1px 1px #000}
    #jjAwake .hint{position:absolute;top:29px;left:0;right:0;color:#111;font:600 12px/20px Arial;letter-spacing:0;text-shadow:0 0 2px #fff;animation:none!important;z-index:2}
    #jjAwake .track,#jjTodoHud>div:nth-child(2),#jjMahitoHud>div:nth-child(2){height:20px!important;position:relative;margin:0!important;border:2px solid rgba(0,0,0,.7)!important;border-radius:0!important;background:rgba(255,255,255,.5)!important;box-shadow:none!important;overflow:hidden}
    #jjAwake .fill,#jjTodoHud .td-fill,#jjMahitoHud .mhFill{background:#55ffff!important;animation:none!important;filter:none!important;transition:width .12s linear}
    #jjAwake .pips{display:none}
    #jjTodoHud .td-title,#jjMahitoHud .mhTitle{position:absolute;bottom:25px;left:-70px;right:-70px;text-align:center;font:600 14px Arial;letter-spacing:0;line-height:20px;color:white;text-shadow:-1px -1px #000,1px 1px #000}
    #jjTodoHud .td-hint,#jjMahitoHud .mhHint{position:absolute;bottom:54px;left:-100px;right:-100px;text-align:center;font:11px/15px Arial;color:white;text-shadow:0 1px 3px #000}
    #jjStudioGauges{position:absolute;bottom:78px;left:50%;transform:translateX(-50%);width:300px;display:flex;gap:8px}
    #jjStudioGauges>div{width:146px;height:5px;box-sizing:content-box;border:2px solid rgba(0,0,0,.7);background:rgba(255,255,255,.4);overflow:hidden}
    #jjStudioGauges i{display:block;height:100%;background:#00557f}
    #projWrap{bottom:170px;width:200px}#projWrap .plabel{font:11px Arial;letter-spacing:0;color:#fff}#projBar{border:1px solid #111;background:#ffffff66}#projFill{background:#55ffff}
    #jjMouseControls{right:auto;left:12px;bottom:15px;max-width:280px;text-align:left}
    #jjMouseControls button{border:0;border-radius:5px;padding:8px;background:#191919cc;color:#fff;font:11px Arial}
    #jjMouseHint{font:10px/1.4 Arial;max-width:200px}#jjShiftLock[aria-pressed=true]{color:#55ffff}
    #jjPause{display:none}#crosshair{width:8px;height:8px;margin:-4px;border:1px solid #333;background:#fff;box-shadow:none}
    #menu,#menu.is-pause{padding:65px 12px 18px;overflow:hidden;background:rgba(0,0,0,.28);backdrop-filter:none;justify-content:center}
    #menu .menu-veil,#menu .menu-orn,#menu .menu-kicker,#menu .go,#menu h2{display:none}
    #menu .menu-shell{width:min(740px,100%);max-height:100%;margin:0;padding:0;display:flex;flex-direction:column;background:rgba(225,225,225,.9);border:2px solid #222;box-shadow:0 8px 30px #0005;text-align:left;color:#111}
    #menu .jjPanelHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;background:rgba(255,255,255,.35);flex-shrink:0}
    #menu h1{font:700 23px/1.1 Arial;letter-spacing:0;color:#111;background:none;-webkit-text-fill-color:initial;text-shadow:none;margin:0}
    #jjMenuClose{border:0;background:transparent;color:#111;font:24px Arial;cursor:pointer;padding:0 6px}
    .jjTabs{display:flex;flex-shrink:0;border-bottom:1px solid #666}
    .jjTabs button{flex:1;padding:11px 6px;background:#fff3;border:0;border-bottom:3px solid transparent;color:#111;font:14px Arial;cursor:pointer}
    .jjTabs button[aria-selected=true]{border-bottom-color:#55ffff;background:#fff8;font-weight:700}
    .jjPanelBody{overflow:auto;min-height:0;padding:14px;flex:1;scrollbar-color:#777 #ccc}
    .jjPanel[hidden],.jjSettingGroup[hidden]{display:none!important}
    #menuRoster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0;max-height:none;overflow:visible;padding:0}
    #menu .roster-card{width:auto;min-width:0;display:flex;align-items:center;gap:9px;padding:8px;text-align:left;border:1px solid #777;background:#ffffff66;transform:none;box-shadow:none;border-radius:0}
    #menu .roster-card img{width:36px;height:36px;object-fit:cover;background:#2223;border:0}
    #menu .roster-card .rn{font:600 13px Arial;letter-spacing:0;color:#111;display:block;margin:0;padding:0;border:0;background:transparent;text-shadow:none}
    #menu .roster-card.active{border:2px solid #111;padding:7px;background:#fff9;box-shadow:inset 4px 0 #55ffff}
    #menu .roster-card:hover{background:#fff}
    #menuPick{min-height:0;padding:12px 0 0;margin:0;text-align:center;border:0;background:transparent}
    #menuPick .pn{font:600 15px Arial;color:#111;letter-spacing:0;text-shadow:none}#menuPick .ps{font:11px Arial;color:#444;letter-spacing:0;margin-top:4px}
    #menu .menu-actions{margin:0;padding:12px 14px;border-top:1px solid #888;gap:8px;display:flex;flex-shrink:0}
    #menu #menuFight,#menu #jjOnline{flex:1;width:auto;min-width:0;margin:0;padding:12px;background:#333;border:1px solid #111;color:#fff;font:600 13px Arial;letter-spacing:0;box-shadow:none;transform:none}
    #menu #menuFight:hover,#menu #jjOnline:hover{background:#555}
    #menu .jjSettingGroup>label,#menu #jjPotatoSetting{display:flex!important;align-items:center;justify-content:space-between!important;flex-wrap:wrap;gap:8px!important;margin:12px 0!important;padding:14px!important;border:2px solid #333;background:#ffffff55;color:#111!important;font:600 14px Arial!important;letter-spacing:0!important;border-radius:0}
    #menu #jjPotatoSetting input{order:2;accent-color:#00557f!important;width:20px!important;height:20px!important;cursor:pointer}
    #menu #jjPotatoSetting span{order:1}#menu #jjPotatoSetting small{order:3;text-align:left!important;color:#444!important;font:12px/1.5 Arial!important}
    #menu #jjDestruction{margin:0!important;display:flex!important;gap:10px!important;justify-content:space-between!important;color:#111!important;font:13px Arial!important}
    #jjDestruction label{display:flex;flex:1;min-width:145px;flex-direction:column;gap:7px;padding:10px;background:#fff5;border:2px solid #333}
    #menu select,#menu #jjDestruction button{font:13px Arial!important;padding:8px!important;background:#f4f4f4!important;color:#111!important;border:1px solid #555!important;border-radius:0!important;max-width:100%;cursor:pointer}
    #jjDestruction>span{color:#444;font:12px/1.5 Arial}
    #menu .controls{margin:0;padding:0;border:0;max-width:none;background:transparent;font:13px Arial;color:#111}
    #menu .ctrl-universal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
    #menu .kchip{padding:9px;border:1px solid #888;background:#fff5;color:#111;letter-spacing:0;font:12px Arial;text-align:left}
    #menu .kchip b,#menu .controls b{color:#111;font:700 12px Arial;letter-spacing:0}
    #menu .ctrl-kits{margin:12px 0 0;padding:10px 0;border-top:1px solid #888}
    #menu .kit-row{display:block;padding:6px 0;font:12px/1.7 Arial;color:#333}
    #menu .kit-row .cn{display:block;color:#111;font:700 13px Arial;letter-spacing:0}
    #jjLobby{background:rgba(0,0,0,.4);padding:12px}
    #jjLobby .box{max-height:calc(100dvh - 24px);overflow:auto;background:#ddd;border:2px solid #222;padding:22px;color:#111;box-shadow:0 8px 30px #0005}
    #jjLobby h2{font:700 24px Arial;color:#111;letter-spacing:0}
    #jjLobby .sub,#jjLobby label,#jjStatus,#jjMaps .ms{color:#444;font-family:Arial;letter-spacing:0}
    #jjLobby input,#jjLobby .list{background:#f5f5f5;border:1px solid #555;color:#111}
    #jjLobby button,#jjLobby button.ghost{background:#333;border:1px solid #111;color:#fff;font:600 13px Arial;letter-spacing:0}
    #jjLobby .code,#jjMapNow{color:#111;font-family:Arial}#jjMaps button{background:#fff5;color:#111;border:1px solid #888}#jjMaps button.on{border:2px solid #111;background:#fff9}#jjMaps .mn{color:#111;font:600 14px Arial;letter-spacing:0}
    #jjScore{top:88px;background:#1f1f1f99;border:0;font-family:Arial}#jjScore .hd{font:600 11px Arial;letter-spacing:0;color:#fff}
    #jjFeed div{background:#1f1f1f99;border:0}#jjSwap{bottom:205px}#jjSwap .lbl{font:12px Arial;letter-spacing:0}
    body.jjPanelOpen #jjAwake,body.jjPanelOpen #jjTodoHud,body.jjPanelOpen #jjMahitoHud,body.jjPanelOpen #hud{visibility:hidden}
    body.jjPanelOpen #splash,body.jjPanelOpen #jjNotice{visibility:hidden}
    body:has(#hud[style*="visibility: hidden"]) #jjStudioTopbar{visibility:hidden}
    @media(max-width:700px){#charCard{top:58px;width:160px}#jjMouseHint{display:none}#jjMouseControls{bottom:80px;left:8px}#jjMouseControls button{font-size:9px;padding:6px}#menuRoster{grid-template-columns:repeat(2,minmax(0,1fr))}#jjStudioTopbar{left:8px;top:8px;gap:4px}#jjStudioTopbar>button,#charList .clHead{font-size:11px;padding:0 8px}#jjStudioTopbar svg{width:15px;height:15px}#menu h1{font-size:20px}#jjTodoHud .td-hint,#jjMahitoHud .mhHint{left:-15px;right:-15px}#jjTodoHud .td-title,#jjMahitoHud .mhTitle{left:-15px;right:-15px;font-size:12px}#moves{width:260px;left:calc(50% - 20px)}#moves .move.jjSpecial{left:calc(100% + 3px);width:40px}#jjStudioGauges,#jjAwake,#jjTodoHud,#jjMahitoHud{left:calc(50% - 20px)!important;width:260px!important}#jjStudioGauges>div{width:126px}}
    @media(max-height:540px){#menu{padding-top:52px;padding-bottom:8px}#menu .jjPanelHeader{padding:8px 12px}#menu .menu-actions{padding:8px}#menu .menu-actions button{padding:8px!important}}
  `;
  document.head.appendChild(css);

  const shell = menu.querySelector('.menu-shell');
  const heading = document.createElement('div');
  heading.className = 'jjPanelHeader';
  const title = menu.querySelector('h1');
  title.id = 'jjMenuTitle';
  title.textContent = 'Jujutsu Battleground';
  heading.appendChild(title);
  const close = document.createElement('button');
  close.id = 'jjMenuClose';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Resume game');
  close.addEventListener('click', enterArenaLocal);
  heading.appendChild(close);
  shell.prepend(heading);
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Game menu');
  // Stop background-to-resume clicks from swallowing settings and labels.
  shell.addEventListener('click', (e) => e.stopPropagation());
  const nav = document.createElement('div');
  nav.className = 'jjTabs';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Game menu pages');
  heading.after(nav);
  const body = document.createElement('div');
  body.className = 'jjPanelBody';
  nav.after(body);
  const panels = {};
  let selected = 'characters';
  function selectPanel(id) {
    selected = id;
    for (const [key, panel] of Object.entries(panels)) {
      panel.hidden = key !== id;
      $('jjTab-' + key).setAttribute('aria-selected', String(key === id));
    }
    body.scrollTop = 0;
    if (id === 'controls') syncControls();
  }
  function syncControls() {
    const name = CHARS[player.char].name.toUpperCase();
    panels.controls.querySelectorAll('.kit-row:not(#menuKit)').forEach((row) => {
      const label = row.querySelector('.cn')?.textContent.trim().toUpperCase();
      if (label) row.style.display = label.split(/\s+/).some((word) => name.includes(word)) ? '' : 'none';
    });
  }
  for (const [id, label] of [
    ['characters', 'Characters'],
    ['settings', 'Settings'],
    ['controls', 'Controls']
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'jjTab-' + id;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'jjPanel-' + id);
    button.addEventListener('click', () => selectPanel(id));
    nav.appendChild(button);
    const panel = document.createElement('section');
    panel.id = 'jjPanel-' + id;
    panel.className = 'jjPanel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    body.appendChild(panel);
    panels[id] = panel;
  }
  panels.characters.append($('menuRoster'), $('menuPick'));
  panels.controls.append(menu.querySelector('.controls'));
  const settingsNav = document.createElement('div');
  settingsNav.className = 'jjTabs';
  settingsNav.setAttribute('role', 'tablist');
  settingsNav.setAttribute('aria-label', 'Settings categories');
  panels.settings.appendChild(settingsNav);
  const groups = {};
  function settingsTab(id) {
    for (const [key, group] of Object.entries(groups)) {
      group.hidden = key !== id;
      $('jjSettings-' + key).setAttribute('aria-selected', String(key === id));
    }
  }
  for (const [id, label] of [
    ['general', 'General'],
    ['performance', 'Performance']
  ]) {
    const button = document.createElement('button');
    button.id = 'jjSettings-' + id;
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'jjSettingsGroup-' + id);
    button.addEventListener('click', () => settingsTab(id));
    settingsNav.appendChild(button);
    const group = document.createElement('div');
    group.id = 'jjSettingsGroup-' + id;
    group.className = 'jjSettingGroup';
    group.setAttribute('role', 'tabpanel');
    group.setAttribute('aria-labelledby', button.id);
    groups[id] = group;
    panels.settings.appendChild(group);
  }
  groups.general.append($('jjTrainingMap').parentElement, $('jjDestruction'));
  groups.performance.append($('jjPotatoSetting'));
  shell.appendChild(menu.querySelector('.menu-actions'));
  selectPanel('characters');
  settingsTab('performance');

  const icons = {
    characters:
      '<circle cx="9" cy="7" r="3"/><path d="M3 20v-4a6 6 0 0 1 12 0v4M17 4a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2"/>',
    settings:
      '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    servers:
      '<rect x="3" y="4" width="18" height="7" rx="1"/><rect x="3" y="14" width="18" height="7" rx="1"/><path d="M6 7h2m-2 10h2"/>',
    controls: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 2v1"/>'
  };
  const icon = (id) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[id] + '</svg>';
  const top = document.createElement('nav');
  top.id = 'jjStudioTopbar';
  top.setAttribute('aria-label', 'Game controls');
  document.body.appendChild(top);
  top.appendChild($('charList'));
  clHead.innerHTML =
    icon('characters') + '<span>Characters</span><span class="caret">▸</span><span class="clCount"></span>';
  clHead.setAttribute('role', 'button');
  clHead.setAttribute('tabindex', '0');
  clHead.setAttribute('aria-controls', 'clBody');
  clHead.setAttribute('aria-expanded', 'false');
  clHead.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      clHead.click();
    }
  });
  new MutationObserver(() =>
    clHead.setAttribute('aria-expanded', String(charListEl.classList.contains('open')))
  ).observe(charListEl, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('click', (e) => {
    if (!charListEl.contains(e.target)) charListEl.classList.remove('open');
  });
  function openPanel(id) {
    openGameMenu();
    setMenuMode(started);
    selectPanel(id);
    charListEl.classList.remove('open');
    $('jjTab-' + id).focus();
  }
  for (const [id, label] of [
    ['settings', 'Settings'],
    ['servers', 'Servers'],
    ['controls', 'Controls']
  ]) {
    const button = document.createElement('button');
    button.id = 'jjTop-' + id;
    button.type = 'button';
    button.innerHTML = icon(id) + '<span>' + label + '</span>';
    button.addEventListener('click', () => {
      if (id === 'servers') {
        openGameMenu();
        $('jjOnline').click();
      } else openPanel(id);
    });
    top.appendChild(button);
  }
  // Prevent menu keyboard navigation from also starting an attack or entering
  // training when Space/Enter is used on a focused button.
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button,[role=button]')) {
        e.stopPropagation();
        const custom = e.target.closest('[role=button]');
        if (custom && custom.tagName !== 'BUTTON') {
          e.preventDefault();
          if (!e.repeat) custom.click();
        }
      }
    },
    true
  );
  function syncMenu() {
    const visible = menu.style.display !== 'none';
    const lobby = $('jjLobby').style.display === 'flex';
    document.body.classList.toggle('jjPanelOpen', visible || lobby);
    close.hidden = !started;
    if (!visible) charListEl.classList.remove('open');
  }
  new MutationObserver(syncMenu).observe(menu, { attributes: true, attributeFilter: ['style'] });
  new MutationObserver(syncMenu).observe($('jjLobby'), { attributes: true, attributeFilter: ['style'] });
  syncMenu();

  function decorateMoves() {
    for (const c of cdEls) {
      const key = c.def.key;
      c.box.dataset.key = key;
      c.box.classList.toggle('jjUtility', key === 'LMB' || key === 'Q');
      c.box.classList.toggle('jjSpecial', key === 'R');
      c.box.classList.toggle('jjAuxiliary', key === 'F');
      c.box.setAttribute('role', 'button');
      c.box.tabIndex = key === 'LMB' || key === 'Q' ? -1 : 0;
      c.box.setAttribute('aria-label', key + ': ' + c.def.lbl);
      const activate = () => {
        if (!gameInputActive()) return;
        const code = /^\d$/.test(key) ? 'Digit' + key : 'Key' + key;
        window.dispatchEvent(new KeyboardEvent('keydown', { code, key: key.toLowerCase(), bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code, key: key.toLowerCase(), bubbles: true }));
      };
      c.box.onclick = (e) => {
        e.stopPropagation();
        activate();
        c.box.blur();
      };
      c.box.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          activate();
        }
      };
    }
  }
  const previousBuild = buildMovesBar;
  buildMovesBar = function () {
    previousBuild.apply(this, arguments);
    decorateMoves();
  };
  decorateMoves();
  const gauges = document.createElement('div');
  gauges.id = 'jjStudioGauges';
  gauges.innerHTML =
    '<div title="Q · Dash readiness"><i></i></div><div title="R · Special readiness"><i></i></div>';
  $('hud').appendChild(gauges);
  const previousHUD = updateHUD;
  updateHUD = function (dt) {
    previousHUD(dt);
    ['Q', 'R'].forEach((key, i) => {
      const c = cdEls.find((c) => c.def.key === key);
      const ready = c ? Math.max(0, 100 - (parseFloat(c.el.style.height) || 0)) : 0;
      gauges.children[i].firstElementChild.style.width = ready + '%';
      gauges.children[i].setAttribute(
        'aria-label',
        key + ' ' + (c?.def.lbl || 'unavailable') + ': ' + Math.round(ready) + '% ready'
      );
    });
  };
  window.JJSTUDIOUI = {
    open: openPanel,
    select: selectPanel,
    settings: settingsTab,
    get panel() {
      return selected;
    }
  };
})();
