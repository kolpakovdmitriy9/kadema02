/* Kadema UI — поведение компонентов. Подключается после kadema-ui.css, с defer.
   Разметка управляется data-атрибутами:
   data-k-tabs          — контейнер табов (кнопки role="tab" aria-controls="id панели")
   data-k-accordion     — список .k-row; data-k-accordion="multi" — можно открыть несколько
   data-k-modal         — открыть окно #k-modal (любой ссылке или кнопке)
   data-k-form          — форма: проверка телефона и согласия, показ .k-form__done
   data-header="light"  — секция со светлым фоном: шапка под ней темнеет
   .k-marquee__track    — содержимое дублируется для бесконечной ленты
   Иконки: <svg class="k-icon"><use href="#k-i-arrow"/></svg> — спрайт вставляется сам. */
(function () {
  'use strict';
  var d = document;

  /* ---------- спрайт иконок ---------- */
  var I = {
    arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
    'arrow-r': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
    funnel: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    crm: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 14h4"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>',
    doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14c2.2.4 3.6 2.1 4 4.5"/>',
    ruble: '<path d="M8 20V4h6a4 4 0 0 1 0 8H6M6 16h8"/>',
    mega: '<path d="M4 10v4l3 1 2 5h2l-1-4.5 9 3.5V5L7 9z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="m14 6 3 3"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    phone: '<path d="M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    home: '<path d="M3 11 12 4l9 7M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h12L22 7H6"/>',
    cross: '<path d="M12 4v16M4 12h16"/><rect x="3" y="3" width="18" height="18" rx="5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'
  };
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">';
  for (var k in I) sprite += '<symbol id="k-i-' + k + '" viewBox="0 0 24 24">' + I[k] + '</symbol>';
  d.body.insertAdjacentHTML('afterbegin', sprite + '</svg>');

  /* ---------- шапка: прячется при прокрутке вниз, темнеет над светлыми секциями ---------- */
  var header = d.querySelector('.k-header');
  if (header) {
    var lastY = scrollY, lights = [].slice.call(d.querySelectorAll('[data-header="light"]'));
    var onScroll = function () {
      var y = scrollY;
      header.classList.toggle('is-hidden', y > 200 && y > lastY + 4 && !d.body.classList.contains('k-menu-open'));
      if (y < lastY - 4 || y < 200) header.classList.remove('is-hidden');
      lastY = y;
      var probe = header.getBoundingClientRect().top + 39, light = false;
      lights.forEach(function (s) { var r = s.getBoundingClientRect(); if (r.top <= probe && r.bottom >= probe) light = true; });
      header.classList.toggle('is-light', light);
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    var burger = header.querySelector('.k-burger'), menu = d.getElementById(burger && burger.getAttribute('aria-controls'));
    if (burger && menu) {
      var setMenu = function (open) { menu.hidden = !open; burger.setAttribute('aria-expanded', open); d.body.classList.toggle('k-menu-open', open); d.body.style.overflow = open ? 'hidden' : ''; };
      burger.addEventListener('click', function () { setMenu(menu.hidden); });
      menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    }
  }

  /* ---------- табы ---------- */
  [].forEach.call(d.querySelectorAll('[data-k-tabs]'), function (list) {
    var tabs = [].slice.call(list.querySelectorAll('[role="tab"]'));
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t, p = d.getElementById(x.getAttribute('aria-controls'));
        x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; if (p) p.hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (step) { e.preventDefault(); select(tabs[(i + step + tabs.length) % tabs.length], true); }
      });
    });
  });

  /* ---------- аккордеон ---------- */
  [].forEach.call(d.querySelectorAll('[data-k-accordion]'), function (acc) {
    var multi = acc.getAttribute('data-k-accordion') === 'multi';
    [].forEach.call(acc.querySelectorAll('.k-row'), function (row) {
      var head = row.querySelector('.k-row__head');
      head.setAttribute('aria-expanded', row.classList.contains('is-open'));
      head.addEventListener('click', function () {
        var open = !row.classList.contains('is-open');
        if (!multi) [].forEach.call(acc.querySelectorAll('.k-row.is-open'), function (r) { if (r !== row) { r.classList.remove('is-open'); r.querySelector('.k-row__head').setAttribute('aria-expanded', false); } });
        row.classList.toggle('is-open', open); head.setAttribute('aria-expanded', open);
      });
    });
  });

  /* ---------- бегущие ленты ---------- */
  [].forEach.call(d.querySelectorAll('.k-marquee__track'), function (t) {
    [].slice.call(t.children).forEach(function (c) { var cl = c.cloneNode(true); cl.setAttribute('aria-hidden', 'true'); t.appendChild(cl); });
  });

  /* ---------- окно с формой ---------- */
  var modal = d.getElementById('k-modal');
  if (modal) {
    var lastFocus;
    var close = function () { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); if (lastFocus) lastFocus.focus(); };
    d.addEventListener('click', function (e) {
      var o = e.target.closest('[data-k-modal]');
      if (o) { e.preventDefault(); lastFocus = o; modal.classList.add('is-open'); modal.removeAttribute('aria-hidden'); var f = modal.querySelector('input'); if (f) setTimeout(function () { f.focus(); }, 60); return; }
      if (e.target === modal || e.target.closest('.k-modal__close')) close();
    });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
  }

  /* ---------- формы (прототип: заявка никуда не отправляется) ---------- */
  [].forEach.call(d.querySelectorAll('[data-k-form]'), function (f) {
    f.setAttribute('novalidate', '');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      [].forEach.call(f.querySelectorAll('[required]'), function (el) {
        var good = el.type === 'checkbox' ? el.checked : el.type === 'tel' ? (el.value.match(/\d/g) || []).length >= 10 : el.value.trim() !== '';
        el.classList.toggle('is-error', !good);
        var err = d.getElementById(el.id + '-err'); if (err) err.hidden = good;
        if (!good) ok = false;
      });
      var done = f.querySelector('.k-form__done'); if (done) done.hidden = !ok;
    });
  });

  /* ---------- видео в логотипе: пауза вне экрана ---------- */
  if ('IntersectionObserver' in window) {
    [].forEach.call(d.querySelectorAll('video[data-k-autoplay]'), function (v) {
      new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }); }).observe(v);
    });
  }
})();
