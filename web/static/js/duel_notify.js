/* DuelNotify — floating challenge notifications, right-middle of screen.
   Appears on every page except /duels (which has its own panel).
   Incoming challenge → chime sound + slide-in card with ACCEPT / DENY / LATER. */
(function () {
  'use strict';
  if (window.location.pathname.indexOf('/duels') !== -1) return;

  var seenKey = 'duelSeen';
  var seen = {};
  try { seen = JSON.parse(localStorage.getItem(seenKey) || '{}'); } catch (e) {}
  var active = 0;

  function trimSeen() {
    var keys = Object.keys(seen);
    if (keys.length > 40) {
      var sorted = keys.sort();
      for (var i = 0; i < keys.length - 30; i++) delete seen[sorted[i]];
    }
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  function makeCard(c) {
    var card = document.createElement('div');
    card.className = 'duel-notif';
    card.innerHTML =
      '<div class="duel-notif-title">⚔️ ARENA CHALLENGE</div>' +
      '<div class="duel-notif-name">' + (c.from_name || c.from_user_id || 'A player') + ' challenges you!</div>' +
      '<div class="duel-notif-btns">' +
      '  <button class="duel-notif-btn acc" data-a="acc">✓ ACCEPT</button>' +
      '  <button class="duel-notif-btn lat" data-a="lat">⏰ LATER</button>' +
      '  <button class="duel-notif-btn dec" data-a="dec">✗ DENY</button>' +
      '</div>';
    card.querySelector('[data-a="acc"]').onclick = function () {
      DuelSFX.play('accept');
      post('/api/duel/accept', { from_user_id: c.from_user_id }).then(function () {
        window.location.href = '/duels';
      });
    };
    card.querySelector('[data-a="lat"]').onclick = function () {
      post('/api/duel/later', { from_user_id: c.from_user_id });
      card.remove();
    };
    card.querySelector('[data-a="dec"]').onclick = function () {
      DuelSFX.play('deny');
      post('/api/duel/decline', { from_user_id: c.from_user_id });
      card.remove();
    };
    return card;
  }

  function check() {
    fetch('/api/duel/pending', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var list = d.challenges || [];
        var fresh = 0;
        list.forEach(function (c) {
          var k = c.from_user_id;
          if (!seen[k]) {
            seen[k] = 1;
            trimSeen();
            localStorage.setItem(seenKey, JSON.stringify(seen));
            fresh++;
          }
        });
        var stack = document.getElementById('duelNotifStack');
        if (!stack) {
          stack = document.createElement('div');
          stack.id = 'duelNotifStack';
          stack.style.cssText = 'position:fixed;right:14px;top:110px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:300px;';
          document.body.appendChild(stack);
        }
        if (fresh > 0) {
          DuelSFX.play('challenge');
          list.forEach(function (c) {
            if (seen[c.from_user_id] === 1) {
              seen[c.from_user_id] = 2;
              localStorage.setItem(seenKey, JSON.stringify(seen));
              stack.appendChild(makeCard(c));
              active++;
              setTimeout(function () {
                if (card && card.parentNode) card.remove();
              }, 15000);
              var card = stack.lastChild;
            }
          });
        }
      }).catch(function () {});
  }

  var style = document.createElement('style');
  style.textContent =
    '.duel-notif{background:#160d0d;border:2px solid #ff4757;box-shadow:inset 0 0 0 1px #000,4px 4px 0 rgba(0,0,0,0.6);padding:10px 12px;font-family:VT323,monospace;animation:duelNotifIn .25s ease-out;}' +
    '.duel-notif-title{font-family:"Press Start 2P",monospace;font-size:8px;color:#ff4757;letter-spacing:1px;margin-bottom:6px;}' +
    '.duel-notif-name{font-size:17px;color:#ffd54a;margin-bottom:8px;}' +
    '.duel-notif-btns{display:flex;gap:6px;}' +
    '.duel-notif-btn{flex:1;padding:5px 4px;font-family:"Press Start 2P",monospace;font-size:6px;cursor:pointer;background:#0d0d15;border:2px solid;}' +
    '.duel-notif-btn.acc{border-color:#4ade80;color:#4ade80;}.duel-notif-btn.acc:hover{background:#4ade80;color:#000;}' +
    '.duel-notif-btn.lat{border-color:#ffd54a;color:#ffd54a;}.duel-notif-btn.lat:hover{background:#ffd54a;color:#000;}' +
    '.duel-notif-btn.dec{border-color:#ff4757;color:#ff4757;}.duel-notif-btn.dec:hover{background:#ff4757;color:#000;}' +
    '@keyframes duelNotifIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(style);

  document.addEventListener('click', function () { DuelSFX.unlock(); }, { once: true });

  check();
  setInterval(check, 12000);
})();
