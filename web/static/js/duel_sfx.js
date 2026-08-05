/* DuelSFX — retro WebAudio sound library for DTEmpire Adventure
   Synthesized (no assets). Usage: DuelSFX.play('win'|'lose'|'challenge'|'hit'|'crit'|'heal'|'lock'|'select'|'click'|'deny'|'accept'|'turn'|'clash'|'draw') */
(function () {
  'use strict';
  var muted = localStorage.getItem('duelMuted') === '1';
  var ctx = null;

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, delay, lp) {
    var c = ac(); if (!c) return;
    var t = c.currentTime + (delay || 0);
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var g = c.createGain(); g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t);
  }

  var FX = {
    click:     function () { tone(520, 0.05, 'square', 0.08); },
    select:    function () { tone(700, 0.07, 'triangle', 0.1, 0, 950); },
    turn:      function () { tone(440, 0.08, 'sine', 0.1); tone(660, 0.08, 'sine', 0.08, 0.09); },
    lock:      function () { tone(520, 0.08, 'square', 0.1); tone(780, 0.12, 'square', 0.1, 0.1); },
    challenge: function () { tone(1318, 0.12, 'triangle', 0.12); tone(1318, 0.12, 'triangle', 0.12, 0.16); tone(1760, 0.2, 'triangle', 0.1, 0.32); },
    accept:    function () { tone(660, 0.1, 'sine', 0.12, 0, 880); tone(990, 0.18, 'sine', 0.12, 0.11); },
    deny:      function () { tone(220, 0.16, 'square', 0.12); tone(160, 0.22, 'square', 0.12, 0.16); },
    clash:     function () { noise(0.18, 0.25, 0, 900); tone(150, 0.15, 'square', 0.12, 0, 80); },
    hit:       function () { tone(180, 0.12, 'sawtooth', 0.14, 0, 90); noise(0.1, 0.12, 0, 1400); },
    crit:      function () { tone(900, 0.22, 'sawtooth', 0.16, 0, 250); noise(0.2, 0.22, 0, 2400); tone(1400, 0.14, 'square', 0.1, 0.02, 700); },
    heal:      function () { tone(520, 0.12, 'sine', 0.12, 0, 780); tone(780, 0.14, 'sine', 0.1, 0.13, 1040); },
    win:       function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.14, 'square', 0.12, i * 0.13); }); tone(1046, 0.4, 'square', 0.12, 0.52); },
    lose:      function () { [330, 262, 220].forEach(function (f, i) { tone(f, 0.2, 'sawtooth', 0.12, i * 0.2); }); },
    draw:      function () { tone(392, 0.16, 'triangle', 0.12); tone(392, 0.16, 'triangle', 0.12, 0.18); },
    victory:   function () { tone(880, 0.1, 'square', 0.1); tone(1108, 0.1, 'square', 0.1, 0.1); tone(1318, 0.3, 'square', 0.12, 0.2); }
  };

  window.DuelSFX = {
    play: function (name) { if (muted) return; try { (FX[name] || FX.click)(); } catch (e) {} },
    muted: function () { return muted; },
    toggleMute: function () { muted = !muted; localStorage.setItem('duelMuted', muted ? '1' : '0'); return muted; },
    unlock: function () { ac(); }
  };
})();
