/* DTEmpire Adventure — per-page retro music + music box
 * Synthesized WebAudio themes: town, dungeon, tower, boss, battle, duel,
 * shop, temple, guild. Bottom-left music box: play/pause + track name.
 * State persisted; track follows the route (fighting areas get distinct
 * battle tracks, market pages share the shop jingle). */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, musicGain = null, sfxGain = null;
  var timer = null, step = 0, current = null, playing = false, unlocked = false;

  /* ── persisted state: {on: bool, muted: bool, track: string} ── */
  var SAVED = null;
  try { SAVED = JSON.parse(localStorage.getItem('retro_music') || 'null'); } catch (e) {}
  var wantPlay = !SAVED || SAVED.on !== false;

  function persist() {
    try {
      localStorage.setItem('retro_music', JSON.stringify({
        on: playing, muted: false, track: current ? current.key : null
      }));
    } catch (e) {}
  }

  function ensureCtx() {
    if (ctx) return true;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  /* ── note helpers ── */
  var SEMI = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
  function freq(name, oct) { return 440 * Math.pow(2, (SEMI[name] + (oct - 4) * 12 - 9) / 12); }
  function note(n) { if (!n) return 0; return freq(n[0], n[1]); }

  /* ── TRACKS: 16-step patterns. melody/bass entries: [note, octave] or 0 = rest.
   *    hat: play hi-hat every N steps (0 = off). step: seconds per step. ── */
  var TRACKS = {
    town: {
      key: 'town', name: 'Town Theme', step: 0.30, hat: 8,
      bass: [['A',2],0,['A',2],0,['F',2],0,['F',2],0,['G',2],0,['G',2],0,['E',2],0,['E',2],0],
      melody: [['A',4],0,['C',5],0,['E',5],0,['D',5],0,['C',5],0,['A',4],0,['G',4],0,['E',4],0]
    },
    dungeon: {
      key: 'dungeon', name: 'Dungeon Depths', step: 0.26, hat: 4,
      bass: [['A',2],0,0,0,['F',2],0,0,0,['G',2],0,0,0,['E',2],0,0,0],
      melody: [['A',3],0,['C',4],0,['D',4],0,['E',4],0,['A',3],0,['C',4],0,['B',3],0,['G',3],0]
    },
    tower: {
      key: 'tower', name: 'Tower Summit', step: 0.24, hat: 2,
      bass: [['D',3],0,['A',3],0,['C',3],0,['G',3],0,['D',3],0,['A',3],0,['C',3],0,['G',3],0],
      melody: [['D',5],0,['F',5],0,['A',5],0,['F',5],0,['E',5],0,['G',5],0,['B',5],0,['G',5],0]
    },
    boss: {
      key: 'boss', name: 'Boss Rush', step: 0.19, hat: 2,
      bass: [['A',2],['A',2],['A',2],['A',2],['F',2],['F',2],['F',2],['F',2],['G',2],['G',2],['G',2],['G',2],['E',2],['E',2],['E',2],['E',2]],
      melody: [['A',5],['A',5],['C',6],['C',6],['A',5],['A',5],['G',5],['G',5],['F',5],['F',5],['E',5],['E',5],['G',5],['G',5],['A',5],['A',5]]
    },
    battle: {
      key: 'battle', name: 'Battle Theme', step: 0.22, hat: 2,
      bass: [['E',2],0,['E',2],0,['G',2],0,['A',2],0,['E',2],0,['E',2],0,['G',2],0,['B',2],0],
      melody: [['E',5],0,['G',5],0,['A',5],0,['G',5],0,['F',5],0,['E',5],0,['D',5],0,['E',5],0]
    },
    duel: {
      key: 'duel', name: 'Duel Arena', step: 0.24, hat: 2,
      bass: [['C',3],0,['G',3],0,['A',3],0,['G',3],0,['F',3],0,['C',3],0,['G',3],0,['E',3],0],
      melody: [['A',4],0,['C',5],0,['D',5],0,['E',5],0,['F',5],0,['A',4],0,['G',4],0,['E',4],0]
    },
    shop: {
      key: 'shop', name: 'Market Jingle', step: 0.28, hat: 0,
      bass: [['C',3],0,['F',2],0,['G',2],0,['C',3],0,['C',3],0,['F',2],0,['G',2],0,['C',3],0],
      melody: [['C',5],0,['E',5],0,['G',5],0,['C',6],0,['D',5],0,['F',5],0,['A',5],0,['G',5],0]
    },
    temple: {
      key: 'temple', name: 'Temple Chant', step: 0.32, hat: 0,
      bass: [['E',3],0,0,0,['C',3],0,0,0,['D',3],0,0,0,['B',2],0,0,0],
      melody: [['E',5],0,['G',5],0,['B',5],0,['A',5],0,['C',5],0,['E',5],0,['D',5],0,['B',4],0]
    },
    guild: {
      key: 'guild', name: 'Tavern Tune', step: 0.30, hat: 8,
      bass: [['G',2],0,['G',2],0,['C',3],0,['C',3],0,['D',3],0,['D',3],0,['G',2],0,['G',2],0],
      melody: [['G',4],0,['B',4],0,['D',5],0,['G',5],0,['A',4],0,['C',5],0,['E',5],0,['D',5],0]
    }
  };

  /* ── page → track ── */
  function trackForPath(p) {
    if (p.indexOf('/dungeon') === 0) return 'dungeon';
    if (p.indexOf('/tower') === 0) return 'tower';
    if (p.indexOf('/duels') === 0) return 'duel';
    if (p.indexOf('/temple') === 0) return 'temple';
    if (p.indexOf('/guild') === 0) return 'guild';
    if (p.indexOf('/shop') === 0 || p.indexOf('/blacksmith') === 0 || p.indexOf('/auction') === 0 ||
        p.indexOf('/inventory') === 0 || p.indexOf('/jobs') === 0 || p.indexOf('/lucky-roll') === 0) return 'shop';
    if (p.indexOf('/adventure') === 0) return 'battle';
    return 'town';
  }

  /* ── voices ── */
  function tone(f, t0, dur, type, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function hat(t0) {
    var len = Math.floor(ctx.sampleRate * 0.05), buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    var g = ctx.createGain(); g.gain.value = 0.25;
    src.connect(hp); hp.connect(g); g.connect(musicGain);
    src.start(t0);
  }

  function tick() {
    if (!ctx || !current || !playing) return;
    var t = ctx.currentTime + 0.02;
    var tr = current, m = tr.melody[step % tr.melody.length], b = tr.bass[step % tr.bass.length];
    var dur = tr.step * 0.9;
    var f = note(m);
    if (f) tone(f, t, dur * 0.7, 'square', 0.16, musicGain);
    var bf = note(b);
    if (bf) tone(bf, t, dur * 0.95, 'triangle', 0.30, musicGain);
    if (tr.hat && step % tr.hat === 0) hat(t);
    step++;
  }

  function startLoop() {
    if (timer) return;
    timer = setInterval(function () { try { tick(); } catch (e) {} }, (current ? current.step : 0.3) * 1000);
  }
  function stopLoop() { if (timer) { clearInterval(timer); timer = null; } }

  /* ── public control ── */
  function play(key) {
    var tr = TRACKS[key] || TRACKS.town;
    current = tr;
    step = 0;
    if (playing && ctx) startLoop();
    render();
    persist();
  }
  function start() {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
    playing = true;
    var want = TRACKS[trackForPath(window.location.pathname)] || TRACKS.town;
    if (!current || current !== want) {
      current = want;
      step = 0;
    }
    startLoop();
    render();
    persist();
  }
  function stop() {
    playing = false;
    stopLoop();
    render();
    persist();
  }
  function toggle() { if (playing) stop(); else start(); }

  /* ── music box DOM ── */
  var box, btn, nameEl, barsEl;
  function buildBox() {
    if (document.getElementById('musicBox')) return;
    box = document.createElement('div');
    box.id = 'musicBox';
    box.innerHTML =
      '<button id="musicBtn" title="Music on/off">▶</button>' +
      '<div class="mbInfo">' +
        '<div class="mbTitle">♪ MUSIC</div>' +
        '<div class="mbBars"><i></i><i></i><i></i></div>' +
        '<div class="mbName">Town Theme</div>' +
      '</div>';
    document.body.appendChild(box);

    var css = document.createElement('style');
    css.textContent =
      '#musicBox{position:fixed;left:12px;bottom:12px;z-index:9999;display:flex;align-items:center;gap:10px;' +
      'background:#0a0a0a;border:2px solid #ffd54a;box-shadow:3px 3px 0 #000,0 0 14px rgba(255,213,74,0.25);' +
      'padding:7px 12px 7px 7px;cursor:pointer;user-select:none}' +
      '#musicBox:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000}' +
      '#musicBtn{width:36px;height:36px;font-family:\'Press Start 2P\',monospace;font-size:12px;color:#000;' +
      'background:linear-gradient(180deg,#ffd54a,#c99a1a);border:2px solid #000;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,0.35)}' +
      '#musicBtn:hover{background:linear-gradient(180deg,#fff,#ffd54a)}' +
      '.mbInfo{display:flex;flex-direction:column;line-height:1.15;min-width:120px}' +
      '.mbTitle{font-family:\'Press Start 2P\',monospace;font-size:8px;color:#ffd54a;letter-spacing:1px;text-shadow:1px 1px 0 #000}' +
      '.mbName{font-family:\'VT323\',monospace;font-size:15px;color:#e8e8e8;letter-spacing:0.5px}' +
      '.mbBars{display:flex;gap:2px;height:8px;margin:3px 0 2px;align-items:flex-end}' +
      '.mbBars i{width:3px;height:100%;background:#ffd54a;box-shadow:0 0 4px #ffd54a;display:none}' +
      '.mbBars.play i{display:block}' +
      '.mbBars.play i:nth-child(1){animation:mbBar .5s ease-in-out infinite alternate}' +
      '.mbBars.play i:nth-child(2){animation:mbBar .7s ease-in-out .1s infinite alternate}' +
      '.mbBars.play i:nth-child(3){animation:mbBar .6s ease-in-out .2s infinite alternate}' +
      '@keyframes mbBar{0%{height:20%}100%{height:100%}}' +
      '#musicBox.paused .mbTitle,#musicBox.paused .mbName{opacity:0.55}';
    document.head.appendChild(css);

    btn = document.getElementById('musicBtn');
    nameEl = box.querySelector('.mbName');
    barsEl = box.querySelector('.mbBars');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });
    box.addEventListener('click', function () { toggle(); });
  }

  function render() {
    if (!box) return;
    btn.textContent = playing ? '⏸' : '▶';
    nameEl.textContent = current ? current.name : '—';
    box.classList.toggle('paused', !playing);
    barsEl.classList.toggle('play', playing);
  }

  /* ── UI blips on clicks (small, polite) ── */
  document.addEventListener('click', function () {
    if (!unlocked || !playing || !ctx) return;
    var t = ctx.currentTime;
    tone(880 + Math.random() * 220, t, 0.06, 'square', 0.05, sfxGain);
  }, true);

  /* ── unlock on first gesture (autoplay policy) ── */
  function unlock() {
    if (!wantPlay || unlocked || playing) return;
    start();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, unlock, { once: true, passive: true });
  });

  /* ── init ── */
  function init() {
    buildBox();
    current = TRACKS[trackForPath(window.location.pathname)] || TRACKS.town;
    if (SAVED && SAVED.track && TRACKS[SAVED.track]) current = TRACKS[SAVED.track];
    render();
    /* attempt direct start; browsers may block until gesture — unlock() retries */
    if (wantPlay && ensureCtx()) {
      try {
        start();
      } catch (e) {
        unlocked = false; playing = false; render();
      }
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.RetroAudio = {
    play: play,
    toggleMusic: toggle,
    toggle: toggle,
    start: start,
    stop: stop,
    isPlaying: function () { return playing; },
    getTrackName: function () { return current ? current.name : ''; },
    getTrackKey: function () { return current ? current.key : ''; }
  };
})();
