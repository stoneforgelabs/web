/* Přehrávač: HTML5 build hry přímo na stoneforgelabs.games/play/<hra>.
 *
 * Co se nahrává, říká <builds>/<slug>/build.json (zapíše ho deploy_web.py z releasu hry):
 * sdílený engine Godotu <builds>/_engine/<id>/godot.{js,wasm,…} a data hry <verze>/game.pck.
 * Engine běží přímo v téhle stránce (ne v iframu), takže víme, kdy hra opravdu
 * naběhla, a location.hostname je pro hru i telemetrii vždycky náš web.
 * <builds> je data-builds na [data-player] (build_web.py z builds_base v data/web_games.json),
 * takže přesun buildů jinam (R2) je jen jiná adresa.
 *
 * Měření (lab.js, endpoint laboratoře): game_load = začalo stahování,
 * game_start = engine Godotu opravdu nastartoval hru, game_error = nespustila se (d = důvod).
 * Klik na Play se měří zvlášť (lab.js, play/web) — klik není spuštění.
 */
(function () {
  var root = document.querySelector('[data-player]');
  if (!root) return;
  var game = document.body.getAttribute('data-game');
  var base = (root.getAttribute('data-builds') || '/builds/').replace(/\/?$/, '/');
  var stage = root.querySelector('[data-stage]');
  var canvas = document.getElementById('canvas');
  var overlay = root.querySelector('[data-overlay]');
  var fill = root.querySelector('[data-progress]');
  var fsButton = root.querySelector('[data-fullscreen]');
  var running = false;
  var loading = false;
  var tracked = {};

  function track(name, extra) {
    var lab = window.sflLab;
    if (!lab || !lab.send) return;
    var payload = { g: game, p: 'player' };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k];
    lab.send(name, payload);
  }
  function trackOnce(name, extra) {
    if (tracked[name]) return;
    tracked[name] = true;
    track(name, extra);
  }

  function show(state) {
    overlay.hidden = state === null;
    Array.prototype.forEach.call(root.querySelectorAll('[data-state]'), function (el) {
      el.hidden = el.getAttribute('data-state') !== state;
    });
  }

  function text(sel, value) {
    var el = root.querySelector(sel);
    if (el) el.textContent = value;
  }

  function mb(bytes) {
    return Math.max(1, Math.round(bytes / 1048576)) + ' MB';
  }

  // Kolik se opravdu stáhne: wasm jde gzipem (~ čtvrtina), pck skoro nekomprimovaný.
  function downloadSize(m) {
    var s = m.sizes || {};
    return (s.wasm || 0) * 0.26 + (s.pck || 0) * 0.85;
  }

  function progress(current, total) {
    if (!fill) return;
    if (!total || total <= 0) {
      fill.classList.add('is-indeterminate');
      return;
    }
    fill.classList.remove('is-indeterminate');
    fill.style.width = Math.min(100, Math.round((current / total) * 100)) + '%';
  }

  var ERRORS = {
    missing: ['This game isn’t on the web yet.', 'Try it on itch.io for now.'],
    network: ['The download didn’t finish.', 'Check your connection and try again.'],
    browser: ['Your browser can’t run this game.',
      'It needs WebGL 2: an up-to-date Chrome, Firefox, Edge or Safari with hardware acceleration on.'],
    engine: ['The game didn’t start.', 'Try again, or play it on itch.io.']
  };

  function fail(code, detail) {
    loading = false;
    var e = ERRORS[code] || ERRORS.engine;
    text('[data-error-msg]', e[0]);
    text('[data-error-detail]', detail || e[1]);
    show('error');
    track('game_error', { d: code });
  }

  function err(code, detail) {
    var e = new Error(code);
    e.code = code;
    e.detail = detail;
    return e;
  }

  // Plátno sleduje velikost plochy (canvasResizePolicy 0: engine převezme rozměr plátna),
  // ve fullscreenu i po otočení telefonu.
  function fit() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.max(1, Math.round(stage.clientWidth * dpr));
    var h = Math.max(1, Math.round(stage.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  else window.addEventListener('resize', fit);
  fit();

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(err('network')); };
      document.head.appendChild(s);
    });
  }

  var manifest = fetch(base + game + '/build.json', { cache: 'no-cache' }).then(function (res) {
    if (res.status === 404) throw err('missing');
    if (!res.ok) throw err('network');
    return res.json();
  }, function () { throw err('network'); });

  // Pozadí načítání: obrázek hry z webu, jinak splash z buildu (u šablony logo Godotu).
  function backdrop(url) {
    overlay.style.backgroundImage = 'linear-gradient(rgba(8,12,24,.72), rgba(8,12,24,.9)), url("' + url + '")';
  }
  var art = root.getAttribute('data-art');
  if (art) backdrop(art);
  manifest.then(function (m) {
    if (!art && m.splash) backdrop(base + game + '/' + m.splash);
    text('[data-size]', mb(downloadSize(m)));
  }, function () { /* chybu ukáže start() */ });

  function start() {
    if (loading || running) return;
    loading = true;
    show('loading');
    progress(0, 0);
    trackOnce('game_load');
    manifest.then(function (m) {
      var engineBase = base + '_engine/' + m.engine + '/';
      return loadScript(engineBase + 'godot.js').then(function () {
        if (typeof window.Engine !== 'function') throw err('engine');
        var missing = window.Engine.getMissingFeatures({ threads: false });
        if (missing.length) throw err('browser');
        var exe = engineBase + 'godot';
        var pack = base + game + '/' + m.pck;
        var sizes = {};
        sizes[exe + '.wasm'] = (m.sizes || {}).wasm || 0;
        sizes[pack] = (m.sizes || {}).pck || 0;
        var cfg = m.config || {};
        var engine = new window.Engine({
          canvas: canvas,
          executable: exe,
          fileSizes: sizes,
          canvasResizePolicy: 0,
          focusCanvas: true,
          experimentalVK: !!cfg.experimentalVK,
          emscriptenPoolSize: cfg.emscriptenPoolSize || 8,
          godotPoolSize: cfg.godotPoolSize || 4,
          onProgress: progress,
          onExit: function () {
            running = false;
            show('ended');
            if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
          }
        });
        // Jako startGame(), jen pck jde do souborového systému pod krátkým jménem,
        // ať funguje i z jiné domény (R2). Hra dostane --sfl-channel=web (OS.get_cmdline_user_args()).
        return Promise.all([engine.init(exe), engine.preloadFile(pack, 'game.pck')]).then(function () {
          return engine.start({ args: ['--main-pack', 'game.pck'].concat(cfg.args || [], ['--', '--sfl-channel=web']) });
        }, function (e) {
          throw e && e.code ? e : err('network', '');
        });
      });
    }).then(function () {
      loading = false;
      running = true;
      show(null);
      if (fsButton && fullscreenSupported()) fsButton.hidden = false;
      canvas.focus();
      trackOnce('game_start');
    }).catch(function (e) {
      fail(e && e.code ? e.code : 'engine', e && e.detail);
    });
  }

  // ------------------------------------------------------------ fullscreen
  function fullscreenSupported() {
    return !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
  }
  if (fsButton) {
    fsButton.addEventListener('click', function () {
      var req = stage.requestFullscreen || stage.webkitRequestFullscreen;
      if (req) {
        var p = req.call(stage);
        if (p && p.catch) p.catch(function () {});
      }
      canvas.focus();
    });
  }

  // Klik do hry vrátí klávesnici hře (po kliknutí na lištu).
  stage.addEventListener('pointerdown', function () { if (running) canvas.focus(); });

  Array.prototype.forEach.call(root.querySelectorAll('[data-retry]'), function (b) {
    b.addEventListener('click', function () { location.reload(); });
  });
  var startButton = root.querySelector('[data-start]');
  if (startButton) startButton.addEventListener('click', start);

  // Telefon bez myši a hra jen pro klávesnici: nestahuj desítky MB bez zeptání.
  var touchOnly = window.matchMedia && matchMedia('(pointer: coarse)').matches &&
    !matchMedia('(any-pointer: fine)').matches;
  if (touchOnly && root.getAttribute('data-touch') !== '1') {
    show('touch');
  } else {
    start();
  }
})();
