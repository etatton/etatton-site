/* etatton.com — progressive enhancement only.
   With this file blocked the page is a plain stacked document that reads and
   navigates on its own. What this adds:
     · the year and the Norwalk clock on the cover
     · the chapter menu
     · on a wide, landscape, mouse-driven screen with motion allowed: the
       horizontal folio (the document still scrolls vertically; a sticky
       viewport turns that distance into a sideways move), the pinned "The
       work" zoom, the cursor-following previews in Chapter II
     · the contact form, posting JSON to /api/contact with a prefilled
       mailto fallback so a typed message is never lost */
(function () {
  'use strict';

  var root = document.documentElement;
  root.setAttribute('data-ready', '');

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ── Clock: Norwalk time, with its own UTC offset ─────────────────────── */
  var clock = document.getElementById('clock');
  if (clock && window.Intl) {
    var fmtTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    var fmtZone;
    try {
      fmtZone = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' });
    } catch (e) { fmtZone = null; }
    var tick = function () {
      var now = new Date();
      var zone = '';
      if (fmtZone) {
        var part = fmtZone.formatToParts(now).filter(function (p) { return p.type === 'timeZoneName'; })[0];
        if (part) zone = '(' + part.value.replace('-', '−') + ') ';
      }
      clock.textContent = zone + fmtTime.format(now);
    };
    tick();
    setInterval(tick, 20000);
  }

  /* ── Menu ─────────────────────────────────────────────────────────────── */
  var menuBtn = document.getElementById('menu-btn');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    if (!menuBtn || !menu) return;
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus();
    }
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
  }

  /* ── The horizontal folio ─────────────────────────────────────────────── */
  var folio = document.getElementById('main');
  var viewport = document.getElementById('viewport');
  var track = document.getElementById('track');
  var spine = document.querySelector('.spine');
  var bar = document.getElementById('progress-bar');
  var work = document.getElementById('work');
  var stage = document.getElementById('work-stage');
  var grid = document.getElementById('work-grid');
  var wordThe = document.querySelector('.work-the');
  var wordWork = document.querySelector('.work-work');
  var coverLines = document.querySelectorAll('.cover-name .line');
  var panels = track ? track.querySelectorAll('.panel') : [];

  var MQ = window.matchMedia(
    '(min-width: 1024px) and (min-height: 600px) and (orientation: landscape) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
  );

  var on = false;
  var maxX = 0, vw = 0, folioTop = 0, workStart = 0, pinLen = 1;
  var target = 0, current = 0, raf = 0;

  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var easeInOut = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  /** x of an element inside the track, however deeply nested. */
  function trackX(el) {
    var x = 0;
    while (el && el !== track) { x += el.offsetLeft; el = el.offsetParent; }
    return x;
  }
  /** The panel that contains an element (or the element itself). */
  function panelOf(el) {
    while (el && el !== track) {
      if (el.classList && (el.classList.contains('panel') || el.classList.contains('col'))) return el;
      el = el.parentNode;
    }
    return null;
  }

  function measure() {
    vw = viewport.clientWidth;
    maxX = Math.max(0, track.scrollWidth - vw);
    folio.style.height = (maxX + window.innerHeight) + 'px';
    folioTop = folio.getBoundingClientRect().top + window.scrollY;
    workStart = trackX(work);
    pinLen = Math.max(1, work.offsetWidth - vw);
    target = clamp(window.scrollY - folioTop, 0, maxX);
    current = target;
    render();
  }

  function render() {
    track.style.transform = 'translate3d(' + (-current).toFixed(2) + 'px,0,0)';

    if (bar) bar.style.transform = 'scaleY(' + (maxX ? current / maxX : 0).toFixed(4) + ')';

    for (var i = 0; i < coverLines.length; i++) {
      coverLines[i].style.transform = 'translate3d(' + (-current * (0.18 + i * 0.12)).toFixed(1) + 'px,0,0)';
    }

    // Pin the stage while the track moves under it; drive the zoom off progress.
    var local = current - workStart;
    stage.style.transform = 'translate3d(' + clamp(local, 0, pinLen).toFixed(2) + 'px,0,0)';
    var p = easeInOut(clamp(local / (pinLen * 0.82), 0, 1));
    grid.style.setProperty('--s', (0.3 + 0.7 * p).toFixed(4));
    grid.style.setProperty('--blur', (p * 7).toFixed(2) + 'px');
    var shift = p * vw * 0.42;
    wordThe.style.transform = 'translate3d(' + (-shift).toFixed(1) + 'px,0,0)';
    wordWork.style.transform = 'translate3d(' + shift.toFixed(1) + 'px,0,0)';
    var fade = String(clamp(1 - p * 1.6, 0, 1));
    wordThe.style.opacity = fade;
    wordWork.style.opacity = fade;

    // The spine takes on the colour of whatever panel is behind it.
    if (spine) {
      var under = null;
      for (var j = 0; j < panels.length; j++) {
        var x = trackX(panels[j]);
        if (x <= current + 2 && x + panels[j].offsetWidth > current + 2) { under = panels[j]; break; }
      }
      spine.classList.toggle('on-light', !!under && !under.classList.contains('theme-dark'));
    }
  }

  function loop() {
    var d = target - current;
    current = Math.abs(d) < 0.25 ? target : current + d * 0.14;
    render();
    raf = current === target ? 0 : requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  function onScroll() {
    target = clamp(window.scrollY - folioTop, 0, maxX);
    kick();
  }

  /* A trackpad's sideways swipe moves the folio too. */
  function onWheel(e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      window.scrollBy(0, e.deltaX);
    }
  }

  /** Scroll the document so that x (track coordinates) is at the left edge. */
  function goToX(x, smooth) {
    window.scrollTo({ top: folioTop + clamp(x, 0, maxX), behavior: smooth ? 'smooth' : 'auto' });
  }

  function onAnchor(e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var el = id && document.getElementById(id);
    if (!el) return;
    if (menu && !menu.hidden) setMenu(false);
    if (!on || !track.contains(el)) return;
    e.preventDefault();
    var x = trackX(el);
    if (el === work) x = workStart + pinLen * 0.55;   // land mid-zoom, not on a postcard
    goToX(x, false);
    if (history.pushState) history.pushState(null, '', '#' + id);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }

  /* Tabbing to something off-screen: bring its panel into view. The browser
     may also have scrolled the clipped viewport itself — undo that. */
  function onFocusIn(e) {
    if (!track.contains(e.target)) return;
    viewport.scrollLeft = 0;
    var el = panelOf(e.target) || e.target;
    var x = trackX(el);
    var w = el.offsetWidth;
    if (x < current || x + Math.min(w, vw) > current + vw) {
      goToX(x, false);
      // Keyboard moves snap rather than glide: the focus ring must already
      // be on screen when it is drawn.
      target = clamp(window.scrollY - folioTop, 0, maxX);
      current = target;
      render();
    }
  }
  function resetViewport() { if (viewport.scrollLeft) viewport.scrollLeft = 0; }

  function enable() {
    if (on || !track || !stage || !grid) return;
    on = true;
    root.classList.add('h');
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('scroll', resetViewport);
    document.addEventListener('focusin', onFocusIn);
    // Arriving on a deep link (/#what): the browser's own jump to the anchor
    // knows nothing about the folio, so land on it ourselves — again once fonts
    // and images have settled the widths, unless the visitor has moved since.
    var pending = !!location.hash;
    var stop = function () { pending = false; };
    ['wheel', 'keydown', 'touchstart', 'mousedown'].forEach(function (t) {
      window.addEventListener(t, stop, { once: true, passive: true });
    });
    var settle = function () {
      measure();
      if (!pending) return;
      viewport.scrollLeft = 0;
      var el = document.getElementById(location.hash.slice(1));
      if (el && track.contains(el)) goToX(el === work ? workStart + pinLen * 0.55 : trackX(el), false);
    };
    settle();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    if (document.readyState === 'complete') setTimeout(settle, 0);
    else window.addEventListener('load', function () { setTimeout(settle, 0); }, { once: true });
  }

  function disable() {
    if (!on) return;
    on = false;
    root.classList.remove('h');
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', measure);
    window.removeEventListener('wheel', onWheel);
    viewport.removeEventListener('scroll', resetViewport);
    document.removeEventListener('focusin', onFocusIn);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    folio.style.height = '';
    [track, stage, wordThe, wordWork].concat([].slice.call(coverLines)).forEach(function (el) {
      if (el) { el.style.transform = ''; el.style.opacity = ''; }
    });
    grid.style.removeProperty('--s');
    grid.style.removeProperty('--blur');
    if (bar) bar.style.transform = '';
    if (spine) spine.classList.remove('on-light');
  }

  document.addEventListener('click', onAnchor);
  if (folio && viewport && track) {
    var apply = function () { if (MQ.matches) enable(); else disable(); };
    apply();
    if (MQ.addEventListener) MQ.addEventListener('change', apply);
    else if (MQ.addListener) MQ.addListener(apply);
  }

  /* ── Chapter II: the picture that follows the cursor ──────────────────── */
  var list = document.getElementById('ix-list');
  var preview = document.getElementById('ix-preview');
  if (list && preview) {
    var index = list.closest('.panel');
    var shots = preview.children;
    var px = 0, py = 0, tx = 0, ty = 0, praf = 0;
    var show = function (i) {
      for (var k = 0; k < shots.length; k++) shots[k].classList.toggle('shown', k === i);
      preview.classList.add('on');
    };
    var hide = function () { preview.classList.remove('on'); };
    var follow = function () {
      px += (tx - px) * 0.18;
      py += (ty - py) * 0.18;
      preview.style.setProperty('--px', px.toFixed(1) + 'px');
      preview.style.setProperty('--py', py.toFixed(1) + 'px');
      praf = Math.abs(tx - px) + Math.abs(ty - py) > 0.5 ? requestAnimationFrame(follow) : 0;
    };
    var aimAt = function (x, y, jump) {
      var r = index.getBoundingClientRect();
      tx = x - r.left + 28;
      ty = y - r.top - preview.offsetHeight / 2;
      if (jump) { px = tx; py = ty; }
      if (!praf) praf = requestAnimationFrame(follow);
    };

    list.addEventListener('mouseover', function (e) {
      var a = e.target.closest('.ix-link');
      if (a && on) show(Number(a.getAttribute('data-i')));
    });
    list.addEventListener('mouseleave', hide);
    index.addEventListener('mousemove', function (e) {
      if (on) aimAt(e.clientX, e.clientY, !preview.classList.contains('on'));
    });
    list.addEventListener('focusin', function (e) {
      var a = e.target.closest('.ix-link');
      if (!a || !on) return;
      var r = a.querySelector('.ix-name').getBoundingClientRect();
      show(Number(a.getAttribute('data-i')));
      aimAt(r.right + 12, r.top + r.height / 2, true);
    });
    list.addEventListener('focusout', hide);
  }

  /* ── Contact form ─────────────────────────────────────────────────────── */
  var form     = document.getElementById('contact-form');
  var btn      = document.getElementById('submit-btn');
  var status   = document.getElementById('form-status');
  var sentCard = document.getElementById('sent-card');
  var sentHead = document.getElementById('sent-h');
  var again    = document.getElementById('send-another');
  if (!form || !btn || !status || !sentCard) return;

  var MAILTO = 'mailto:etatton@gmail.com';

  function clearStatus() {
    status.className = 'status';
    status.textContent = '';
  }

  /* Plain text only. The mailto fallback is appended as a real element so no
     user input is ever written through innerHTML. */
  function showError(text, href, linkText) {
    status.className = 'status err';
    status.textContent = text;
    if (href) {
      status.appendChild(document.createTextNode(' '));
      var a = document.createElement('a');
      a.href = href;
      a.textContent = linkText;
      status.appendChild(a);
    }
  }

  function firstName(name) {
    var parts = String(name || '').trim().split(/\s+/);
    return parts[0] || '';
  }

  function mailtoFallback(data) {
    var subject = encodeURIComponent('Message from ' + (data.name || 'the etatton.com form'));
    var body = encodeURIComponent(
      'Name: ' + (data.name || '') +
      '\nEmail: ' + (data.email || '') +
      '\n\n' + (data.message || '')
    );
    return MAILTO + '?subject=' + subject + '&body=' + body;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearStatus();

    var data = Object.fromEntries(new FormData(form).entries());

    if (!data.name || !data.email || !data.message) {
      showError('Please fill in your name, your email and a message.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showError('That email address doesn’t look right — mind checking it?');
      return;
    }

    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = 'Sending…';

    try {
      var res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) throw new Error('bad status ' + res.status);

      var who = firstName(data.name);
      if (sentHead) sentHead.textContent = who ? 'Thanks, ' + who + '.' : 'Thanks.';
      form.hidden = true;
      sentCard.hidden = false;
      sentCard.setAttribute('tabindex', '-1');
      sentCard.focus();
      form.reset();
    } catch (err) {
      // Never silently lose a message: hand it to the visitor's mail client
      // with everything they typed already in it, and leave the form filled.
      showError(
        'That didn’t send — something went wrong at my end.',
        mailtoFallback(data),
        'Send it by email instead'
      );
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  if (again) {
    again.addEventListener('click', function () {
      sentCard.hidden = true;
      form.hidden = false;
      clearStatus();
      var first = document.getElementById('f-name');
      if (first) first.focus();
    });
  }
})();
