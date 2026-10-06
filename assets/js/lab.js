/* Laboratoř: tlačítko „I want more“ a měření webu (plán HQ-17, F2).
 *
 * Běží jen s endpointem laboratoře v <body data-lab="…"> (build_web.py ho tam
 * dá podle lab_endpoint v data/web_games.json); bez něj nedělá nic a tlačítka
 * zůstanou skrytá. Žádné cookies ani měřicí ID v prohlížeči: v localStorage je
 * jen „už jsem chtěl víc“ u hry, a to až po kliknutí. S Global Privacy Control
 * se události neposílají (hlas ano — je to výslovná akce návštěvníka).
 */
(function () {
  var body = document.body;
  var endpoint = body && body.getAttribute('data-lab');
  if (!endpoint || !window.fetch || !window.JSON) return;
  endpoint = endpoint.replace(/\/+$/, '');

  var pageGame = body.getAttribute('data-game') || null;
  var gpc = navigator.globalPrivacyControl === true;
  var ref = document.referrer || '';
  var utm = {};
  try {
    var params = new URLSearchParams(location.search);
    utm = { source: params.get('utm_source'), medium: params.get('utm_medium'), campaign: params.get('utm_campaign') };
  } catch (e) { /* starý prohlížeč: bez UTM */ }

  function send(name, extra) {
    if (gpc) return;
    var payload = { n: name, path: location.pathname, r: ref, u: utm };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
    var data = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(endpoint + '/v1/e', new Blob([data], { type: 'text/plain' }))) return;
    } catch (e) { /* zkusíme fetch */ }
    fetch(endpoint + '/v1/e', { method: 'POST', body: data, keepalive: true, mode: 'no-cors' }).catch(function () {});
  }

  send('view', { g: pageGame });

  // ------------------------------------------------------------ kliky ven
  var playedGame = null;

  function onClick(ev) {
    if (ev.type === 'auxclick' && ev.button !== 1) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var game = a.getAttribute('data-game') || pageGame;
    var place = a.getAttribute('data-place') || null;
    if (a.protocol === 'mailto:') {
      send('feedback', { g: game, p: place });
      return;
    }
    var host = a.hostname;
    if (a.classList.contains('btn--play')) {
      var dest = a.getAttribute('data-dest') || (host === 'store.steampowered.com' ? 'steam' : 'itch');
      send('play', { g: game, p: place, d: dest });
      playedGame = game;
      return;
    }
    if (host === 'store.steampowered.com') {
      var kind = a.getAttribute('data-kind') || (/wishlist/i.test(a.textContent) ? 'wishlist' : 'view');
      send('steam', { g: game, p: place, d: kind });
      return;
    }
    if (host && host !== location.hostname) send('outbound', { g: game, d: host });
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('auxclick', onClick, true);

  // ------------------------------------------------------------ I want more
  var KEY = 'sfl:want-more:';
  var live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  body.appendChild(live);

  function voted(slug) {
    try { return !!window.localStorage.getItem(KEY + slug); } catch (e) { return false; }
  }
  function remember(slug) {
    try { window.localStorage.setItem(KEY + slug, new Date().toISOString().slice(0, 10)); } catch (e) { /* jen paměť */ }
  }
  function buttons(slug) {
    return Array.prototype.filter.call(document.querySelectorAll('[data-want-more]'), function (b) {
      return b.getAttribute('data-want-more') === slug;
    });
  }
  function setState(slug, state) {
    buttons(slug).forEach(function (b) {
      var label = b.querySelector('.btn__label');
      b.removeAttribute('aria-busy');
      b.classList.remove('is-nudged');
      if (state === 'busy') {
        b.setAttribute('aria-busy', 'true');
      } else if (state === 'done') {
        b.setAttribute('aria-pressed', 'true');
        if (label) label.textContent = '✓ Noted — thanks';
      } else {
        b.setAttribute('aria-pressed', 'false');
        if (label) label.textContent = 'I want more';
      }
    });
  }

  var wants = document.querySelectorAll('[data-want-more]');
  Array.prototype.forEach.call(wants, function (btn) {
    var slug = btn.getAttribute('data-want-more');
    btn.hidden = false;
    if (voted(slug)) setState(slug, 'done');
    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-pressed') === 'true' || btn.getAttribute('aria-busy') === 'true') return;
      setState(slug, 'busy');
      fetch(endpoint + '/v1/want-more', {
        method: 'POST',
        body: JSON.stringify({ g: slug, p: btn.getAttribute('data-place'), r: ref, u: utm }),
        keepalive: true
      }).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        remember(slug);
        setState(slug, 'done');
        live.textContent = 'Noted. Thanks for telling us you want more.';
        var next = document.querySelector('[data-want-next]');
        if (next) next.hidden = false;
        if (pageGame === slug) {
          Array.prototype.forEach.call(document.querySelectorAll('[data-want-note]'), function (n) { n.hidden = true; });
        }
      }).catch(function () {
        setState(slug, 'idle');
        live.textContent = 'That did not go through. Please try again later.';
      });
    });
  });
  if (wants.length) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-want-note]'), function (n) { n.hidden = false; });
  }

  // Návrat z Play (hra se otevřela v nové kartě): drobné „Played it?“ u tlačítka.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !playedGame) return;
    var slug = playedGame;
    playedGame = null;
    var open = buttons(slug).filter(function (b) { return b.getAttribute('aria-pressed') !== 'true'; });
    if (!open.length) return;
    open.forEach(function (b) { b.classList.add('is-nudged'); });
    var note = document.querySelector('[data-want-note]');
    if (note && pageGame === slug) note.textContent = 'Played it? Tell us if you want more.';
  });
})();
