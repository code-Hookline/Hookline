// landing.js — landing-only, content-free behavior.
//

// Theme switcher in the landing nav. Mirrors the workspace toggle: sets
// data-chrome and the shared localStorage key the static pages read on
// load. The <head> script has already applied the saved theme.
(function () {
  var seg = document.getElementById('lpTheme');
  if (!seg) return;
  var btns = [].slice.call(seg.querySelectorAll('button'));
  function sync() {
    var cur = document.documentElement.getAttribute('data-chrome') || 'brand';
    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.chrome === cur));
    });
  }
  seg.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var id = b.dataset.chrome;
    document.documentElement.setAttribute('data-chrome', id);
    try { localStorage.setItem('hookline-chrome', id); } catch (err) { /* private mode */ }
    sync();
    dispatchEvent(new Event('hookline:theme'));
  });
  sync();
})();

// One purpose: the hero preview card demonstrates the product's core idea
// (a script that times itself live). When the card scrolls into view the
// timeline bar builds left-to-right and the timecode ticks up to its
// target, once, then settles. This is a demonstration of real product
// behavior, not perpetual decoration.
//
// Progressive enhancement: with no JS, or when the user prefers reduced
// motion, the .anim class is never added and the card shows its final
// static state (styled entirely in css/style.css) — nothing here runs.

(function () {
  var card = document.querySelector('.lp-preview');
  if (!card) return;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var readout = card.querySelector('.lp-pv-readout b');

  function fmt(s) {
    s = Math.round(s);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  // Target seconds parsed from the final markup ("0:37"), so the count-up
  // always lands exactly on whatever the copy says.
  var target = 37;
  if (readout) {
    var m = /(\d+):(\d{2})/.exec(readout.textContent);
    if (m) target = (+m[1]) * 60 + (+m[2]);
    readout.textContent = '0:00';
  }

  card.classList.add('anim');

  function countUp() {
    if (!readout) return;
    var dur = 900, start;
    function step(now) {
      if (start == null) start = now;
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
      readout.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else readout.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  function play() {
    requestAnimationFrame(function () {
      card.classList.add('play');
      setTimeout(countUp, 450);                    // sync with bar growth
    });
  }

  if (!('IntersectionObserver' in window)) { play(); return; }

  var io = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      io.disconnect();
      play();
    }
  }, { threshold: 0.4 });
  io.observe(card);
})();


// Wash parallax — the big watercolor blooms are the most visible background.
// Tried it as a CSS custom property on .lp::after and Safari refused to
// repaint the pseudo-element when the variable changed (known issue with
// var()-driven transforms on pseudo-elements). The robust fix: render the
// wash as a real <div> and set element.style.transform directly. No
// indirection, no surprises. Reduced motion keeps the wash but does not
// move it. The CSS .lp.has-wash::after { display:none } hides the pseudo
// fallback once this runs so they never both render.
(function () {
  var host = document.querySelector('.lp');
  if (!host) return;
  var wash = document.createElement('div');
  wash.className = 'lp-wash';
  wash.setAttribute('aria-hidden', 'true');
  host.insertBefore(wash, host.firstChild);
  host.classList.add('has-wash');

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var FACTOR = 0.3, raf = 0, latest = 0;
  function tick() {
    raf = 0;
    wash.style.transform = 'translate3d(0,' + (-latest * FACTOR) + 'px,0)';
  }
  addEventListener('scroll', function () {
    latest = window.scrollY || window.pageYOffset || 0;
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
})();


// Dot field — the background speckle, drawn on canvas so individual dots
// can light up. Base grid keeps the edge-bright / center-faint falloff of
// the CSS fallback; on top, 2-3 dots at a time glow in random site-palette
// colors and fade out, spawned at varying intervals. No JS / reduced
// motion = the CSS .lp::before dots, untouched (this never runs).

(function () {
  var canvas = document.getElementById('dotfield');
  if (!canvas || !canvas.getContext) return;

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var GAP = 26, w = 0, h = 0, cols = 0, rows = 0, tileH = 0;
  // Parallax depth: background moves at this fraction of scroll speed. 0 =
  // static (old behavior), 1 = locked to content. ~0.3 is the classic
  // "background drifts behind you" feel without becoming distracting.
  var PARALLAX = 0.3, scrollY = 0;
  var base = document.createElement('canvas');
  var bctx = base.getContext('2d');

  var cs = getComputedStyle(document.body);

  function hexToRgb(hx) {
    hx = (hx || '').replace('#', '');
    if (hx.length === 3) hx = hx[0] + hx[0] + hx[1] + hx[1] + hx[2] + hx[2];
    var n = parseInt(hx || '000000', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  var rgb = function (a) { return 'rgb(' + a[0] + ',' + a[1] + ',' + a[2] + ')'; };

  // Re-read the active theme. Print gets a special two-tone dot field;
  // every other theme uses the single --speckle-ink token.
  var isPrint, speckle, red, black, palette;
  function readTheme() {
    isPrint = (document.documentElement.getAttribute('data-chrome')
      || 'brand') === 'print';
    speckle = cs.getPropertyValue('--speckle-ink').trim()
      || 'rgba(255,255,255,0.10)';
    red = hexToRgb(cs.getPropertyValue('--tt-pink').trim() || '#d23a26');
    black = hexToRgb(cs.getPropertyValue('--tt-cyan').trim() || '#1b1511');
    palette = isPrint
      ? [rgb(red), rgb(black)]
      : ['--b-hook', '--b-bridge', '--b-demo', '--b-proof',
         '--b-objection', '--b-cta', '--tt-cyan', '--tt-pink']
        .map(function (n) { return cs.getPropertyValue(n).trim(); })
        .filter(Boolean);
  }
  readTheme();

  // Bright at the left/right edges, fading to a faint center.
  function falloff(nx) {
    if (nx <= 0.42) return 1 - (nx / 0.42) * 0.72;
    if (nx >= 0.58) return 0.28 + ((nx - 0.58) / 0.42) * 0.72;
    return 0.28;
  }

  function buildBase() {
    // base.width / base.height are set in resize() to (w, tileH) so the
    // parallax wrap is seamless. Don't reset them here.
    bctx.clearRect(0, 0, w, tileH);
    for (var c = 0; c <= cols; c++) {
      var x = c * GAP * dpr;
      var nx = cols ? c / cols : 0;
      if (isPrint) {
        // Pure red at the left, pure black at the right; toward the
        // center the two chaotically mix per dot. Kept readable so the
        // mixing is visible (not faded out like the other themes).
        var chaos = 1 - Math.abs(nx - 0.5) * 2;        // 0 edges → 1 center
        bctx.globalAlpha = 0.14 + 0.34 * falloff(nx);
        for (var r = 0; r <= rows; r++) {
          var t = nx + (Math.random() - 0.5) * 1.5 * chaos;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          bctx.fillStyle = 'rgb('
            + Math.round(red[0] + (black[0] - red[0]) * t) + ','
            + Math.round(red[1] + (black[1] - red[1]) * t) + ','
            + Math.round(red[2] + (black[2] - red[2]) * t) + ')';
          bctx.beginPath();
          bctx.arc(x, r * GAP * dpr, 1.1 * dpr, 0, 6.2832);
          bctx.fill();
        }
      } else {
        bctx.globalAlpha = falloff(nx);
        bctx.fillStyle = speckle;
        for (var r2 = 0; r2 <= rows; r2++) {
          bctx.beginPath();
          bctx.arc(x, r2 * GAP * dpr, 1 * dpr, 0, 6.2832);
          bctx.fill();
        }
      }
    }
    bctx.globalAlpha = 1;
  }

  function resize() {
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    cols = Math.ceil(innerWidth / GAP);
    rows = Math.ceil(innerHeight / GAP);
    // Snap the base tile to an exact whole-row height so parallax wrap is
    // seamless — otherwise dots would jump at every cycle by the leftover
    // fraction of a GAP.
    tileH = rows * GAP * dpr;
    base.width = w; base.height = tileH;
    buildBase();
  }

  var twinkles = [];
  function spawn() {
    if (twinkles.length >= 3) return;
    var c = Math.round(Math.random() * cols);
    var r = Math.round(Math.random() * rows);
    twinkles.push({
      x: c * GAP * dpr, y: r * GAP * dpr,
      color: palette[(Math.random() * palette.length) | 0],
      born: performance.now(),
      life: 1600 + Math.random() * 1400
    });
  }
  function schedule() {
    // Varying gaps; sometimes add a second so 2-3 overlap.
    spawn();
    if (Math.random() < 0.45) spawn();
    setTimeout(schedule, 500 + Math.random() * 1100);
  }

  function frame(now) {
    ctx.clearRect(0, 0, w, h);
    // Parallax: shift the whole grid by a fraction of scrollY and tile the
    // pre-rendered base vertically so the field appears to drift past the
    // content at a slower speed. Two draws cover any wrap seam.
    var sy = -(scrollY * dpr * PARALLAX);
    var off = ((sy % tileH) + tileH) % tileH;
    var drawY = off - tileH;                       // in [-tileH, 0)
    ctx.drawImage(base, 0, drawY);
    ctx.drawImage(base, 0, drawY + tileH);
    for (var i = twinkles.length - 1; i >= 0; i--) {
      var t = twinkles[i];
      var p = (now - t.born) / t.life;
      if (p >= 1) { twinkles.splice(i, 1); continue; }
      var a = Math.sin(p * Math.PI) * 0.85;        // fade in then out
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 6 * dpr;
      // Pin the twinkle to its dot on the parallaxed grid; draw both wrap
      // copies so it doesn't pop when the tile boundary crosses it.
      ctx.beginPath(); ctx.arc(t.x, t.y + drawY, 1.7 * dpr, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(t.x, t.y + drawY + tileH, 1.7 * dpr, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    requestAnimationFrame(frame);
  }

  document.querySelector('.lp').classList.add('has-dots');
  addEventListener('resize', resize, { passive: true });
  addEventListener('scroll', function () {
    scrollY = window.scrollY || window.pageYOffset || 0;
  }, { passive: true });
  addEventListener('hookline:theme', function () { readTheme(); buildBase(); });
  resize();
  schedule();
  requestAnimationFrame(frame);
})();
