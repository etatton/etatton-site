/* etatton.com — progressive enhancement only.
   The page reads and navigates fine with this file blocked; all this does is
   stamp the year and hand the contact form to /api/contact, falling back to a
   prefilled mailto so a typed message is never lost. */
(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());


  /* ── Header hairline ──────────────────────────────────────────────────
     A 1px sentinel at the very top of the document. While it is in view the
     page is unscrolled and the sticky header needs no rule; once it leaves,
     the rule appears. With this file blocked there is simply never a rule. */
  var header   = document.getElementById('site-header');
  var sentinel = document.getElementById('scroll-sentinel');
  if (header && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
    }).observe(sentinel);
  }

  /* ── Section reveal ───────────────────────────────────────────────────
     The CSS only hides a section when html.js is set (done inline in <head>,
     before paint) and the visitor has not asked for reduced motion. Each
     section is revealed once and then stops being watched. */
  document.documentElement.setAttribute('data-revealing', '');
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

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
