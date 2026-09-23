(() => {
  const page = document.getElementById('page');
  const header = document.getElementById('header');
  const how = document.getElementById('how');
  const howStage = document.getElementById('howStage');
  const howCard = document.getElementById('howCard');

  /* ---------- масштаб макета 1440 под ширину окна ---------- */
  function fit() {
    const z = Math.min(1, window.innerWidth / 1440);
    page.style.zoom = z;
    const vh = window.innerHeight / z;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }

  /* ---------- заглушка фона hero: светящиеся «плитки» ---------- */
  function buildSlabs() {
    const bg = document.getElementById('heroBg');
    const n = 16;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const s = document.createElement('div');
      s.className = 'slab';
      // от оранжево-розового слева к фиолетовому справа
      const hue1 = 350 + t * 0 - (1 - t) * 18;
      const hue2 = 300 - t * 20;
      s.style.left = (760 + i * 44) + 'px';
      s.style.top = (470 - Math.sin(t * Math.PI * 1.3) * 140 - t * 60) + 'px';
      s.style.height = (240 + Math.sin(t * 9) * 40 + t * 80) + 'px';
      s.style.background =
        `linear-gradient(180deg, hsl(${hue1} 100% 88%) 0%, hsl(${hue1} 95% 62%) 35%, hsl(${hue2} 95% 45%) 100%)`;
      s.style.opacity = 0.55 + t * 0.45;
      s.style.zIndex = n - Math.abs(i - n * 0.6) | 0;
      bg.appendChild(s);
    }
  }

  /* ---------- шапка: при загрузке видно всё (включая калькулятор),
     скролл вниз — прячется, скролл вверх — появляется без калькулятора;
     калькулятор раскрывается по наведению на правую часть ---------- */
  let lastY = window.scrollY;
  function onHeader() {
    const y = window.scrollY;
    const atTop = y < 10;
    header.classList.toggle('is-top', atTop);
    if (atTop) header.classList.remove('is-hidden');
    else if (y > lastY + 2) header.classList.add('is-hidden');
    else if (y < lastY - 2) header.classList.remove('is-hidden');
    lastY = y;
  }

  /* ---------- «Как это работает» ----------
     1) карточка начинает расти, как только блок заходит в экран, и раскрывается
        на весь экран примерно к моменту, когда блок закрепился;
     2) внутри — бесконечная «куча» картинок: новая карточка шлёпается сверху
        (крупнее ×1.07 и с доворотом 2° → оседает за 140 мс), нижние заранее
        незаметно уменьшаются и уходят под кучу, колода идёт по кругу. */
  const stack = document.getElementById('stack');
  // заглушки: [ширина, высота, фон, цвет текста, подпись]
  const CARDS = [
    [250, 310, 'linear-gradient(160deg,#ff5a1f,#f50f72)', '#111', 'ИИ<br>+ команда'],
    [260, 300, 'linear-gradient(170deg,#f2f2f2,#bdbdbd 55%,#3d3d3d)', '#111', ''],
    [240, 300, 'repeating-linear-gradient(135deg,#d6361a 0 22px,#5a0c05 22px 34px)', '#fff', ''],
    [250, 250, 'radial-gradient(60% 60% at 45% 55%,#ff8a2c,#f6b4a0 55%,#b9d3ec)', '#111', ''],
    [240, 300, 'linear-gradient(180deg,#8ec5ff,#2a6fb8)', '#fff', ''],
    [230, 290, 'linear-gradient(180deg,#e9d6bf,#c8a27a)', '#111', 'Быстрый<br>запуск<small>1 неделя</small>'],
    [260, 290, 'linear-gradient(200deg,#1d3b5c,#0b1520)', '#fff', ''],
    [240, 300, 'radial-gradient(70% 60% at 30% 20%,#ff66c4,#ff3b1f 55%,#fff 56%)', '#111', 'Адаптив<small>под любой экран</small>'],
    [250, 260, 'repeating-linear-gradient(160deg,#6fb3d9 0 6px,#a9d8f0 6px 12px)', '#111', ''],
    [240, 300, 'linear-gradient(170deg,#c25a2c,#7a3016)', '#fff', ''],
    [230, 280, 'linear-gradient(180deg,#b7d2ea,#e6eef6 50%,#8a8f96)', '#111', ''],
    [250, 310, '#ff4f1a', '#111', 'Сайт<br>от 20 000 ₽<small>под ваш бизнес</small>'],
  ];

  const PILE_MAX = 12;           // сколько карточек лежит в куче одновременно
  const SINK_FROM = 6;           // с какой карточки сверху начинается уход под кучу
  const SINK_SCALE = 0.55;       // масштаб самой нижней
  const SINK_OMEGA = 5;          // 1/с — жёсткость пружины ухода (без рывков)
  const SPREAD_X = 120, SPREAD_Y = 48;   // разброс центров, px макета
  const MIN_STEP = 66;           // новая не ложится ровно на предыдущую, px
  const ROT_MIN = 2, ROT_MAX = 7;
  const DROP_SCALE = 1.07, DROP_ROT = 2, DROP_LIFT = 5, DROP_MS = 140;
  const DROP_EASE = 'cubic-bezier(0.22, 0.8, 0.3, 1)';
  const RHYTHM_FRAMES = [5, 3, 6, 4, 7, 3, 5, 8, 4, 6, 3, 5]; // интервалы, кадры 30 fps
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rand = (a, b) => a + Math.random() * (b - a);
  let seq = 0, beat = 0, pileTimer = 0, pileOn = false;
  let last = { x: 0, y: 0, r: 0 };

  function placement() {
    let x, y, tries = 0;
    do {
      x = rand(-SPREAD_X, SPREAD_X);
      y = rand(-SPREAD_Y, SPREAD_Y);
    } while (Math.hypot(x - last.x, (y - last.y) * 1.5) < MIN_STEP && ++tries < 24);
    // чаще наклон в сторону, противоположную предыдущей карточке
    const flip = Math.random() < 0.75 ? -Math.sign(last.r || 1) : Math.sign(last.r || 1);
    last = { x, y, r: flip * rand(ROT_MIN, ROT_MAX) };
    return last;
  }

  const pileTransform = (x, y, r, s) =>
    `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg) scale(${s})`;

  // рисует карточку по плавной глубине _dv (0 — верхняя)
  function applyDepth(el) {
    const k = el._dv || 0;
    const t = Math.min(Math.max((k - SINK_FROM) / (PILE_MAX - SINK_FROM), 0), 1);
    const e = t * t * (3 - 2 * t);
    const p = el._pos;
    el.style.transform = pileTransform(p.x * (1 - e), p.y * (1 - e), p.r * (1 - 0.5 * e),
      (1 - (1 - SINK_SCALE) * e).toFixed(4));
    const o = Math.min(Math.max(PILE_MAX - k, 0), 1);
    el.style.opacity = o < 1 ? o.toFixed(3) : '';
  }

  function drop() {
    const i = seq++ % CARDS.length;
    const [w, h, bg, color, label] = CARDS[i];
    const el = document.createElement('div');
    el.className = 'stack__card';
    el.style.cssText = `width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;color:${color};` +
      `background-image:url(images/stack-${i + 1}.jpg),${bg.startsWith('#') ? `linear-gradient(${bg},${bg})` : bg};`;
    if (label) el.innerHTML = `<span>${label}</span>`;
    el._pos = placement();
    applyDepth(el);
    stack.appendChild(el);
    if (!reduceMotion && el.animate) {
      const p = el._pos;
      el.animate(
        [{ transform: pileTransform(p.x, p.y - DROP_LIFT, p.r + DROP_ROT, DROP_SCALE) },
         { transform: pileTransform(p.x, p.y, p.r, 1) }],
        { duration: DROP_MS, easing: DROP_EASE }
      );
    }
    // все, кто ниже, опускаются на ступень — дальше их ведёт пружина в pileFrame()
    const kids = stack.children;
    for (let n = kids.length - 2, k = 1; n >= 0; n--, k++) kids[n]._depth = Math.min(k, PILE_MAX + 1);
  }

  let lastFrame = 0;
  function pileFrame(now) {
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05);
    lastFrame = now;
    const w = SINK_OMEGA;
    for (const el of [...stack.children]) {
      const target = el._depth || 0;
      let x = el._dv || 0, v = el._vv || 0;
      if (Math.abs(target - x) < 1e-3 && Math.abs(v) < 1e-3) continue;
      v += (w * w * (target - x) - 2 * w * v) * dt;   // пружина с критическим затуханием
      x += v * dt;
      el._dv = x; el._vv = v;
      if (x >= PILE_MAX) { el.remove(); continue; }  // уже полностью под кучей
      applyDepth(el);
    }
    if (pileOn) requestAnimationFrame(pileFrame);
  }

  function schedule() {
    const frames = RHYTHM_FRAMES[beat++ % RHYTHM_FRAMES.length];
    pileTimer = setTimeout(() => { drop(); schedule(); }, reduceMotion ? 700 : frames * (1000 / 30));
  }

  // куча живёт, только пока блок на экране и вкладка активна
  let howVisible = false;
  function setPile(on) {
    if (on === pileOn) return;
    pileOn = on;
    clearTimeout(pileTimer);
    if (on) {
      if (!stack.children.length) drop();
      lastFrame = 0;
      requestAnimationFrame(pileFrame);
      schedule();
    }
  }
  new IntersectionObserver(([e]) => {
    howVisible = e.isIntersecting;
    setPile(howVisible && !document.hidden);
  }).observe(how);
  document.addEventListener('visibilitychange', () => setPile(howVisible && !document.hidden));

  // Куча вписывается в свободное место между плашкой и текстом, поэтому
  // картинки никогда не заходят на текст — ни в карточке, ни на весь экран.
  const PILE_W = 620, PILE_H = 470;      // габарит кучи с разбросом и наклонами, px макета
  const howMedia = document.getElementById('howMedia');
  new ResizeObserver(([e]) => {
    const { width, height } = e.contentRect;
    stack.style.setProperty('--k', Math.max(0, Math.min(1.1, width / PILE_W, height / PILE_H)).toFixed(3));
  }).observe(howMedia);

  // Пока блок едет по странице, карточка не меняет размер. Как только она
  // встаёт по центру экрана (секция закрепилась), карточка резко раскрывается
  // на весь экран — переход по времени, изинг как в референсе (сильный
  // ease-out). При скролле обратно так же сворачивается.
  function onHow() {
    const pinned = how.getBoundingClientRect().top <= 1;
    howCard.classList.toggle('is-open', pinned);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onHeader(); onHow(); ticking = false; });
  }

  /* ---------- бегущая строка в hero: копия группы для бесшовного цикла ---------- */
  function buildTicker() {
    const track = document.getElementById('heroTags');
    const clone = track.firstElementChild.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  fit();
  buildSlabs();
  buildTicker();
  onHeader();
  onHow();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { fit(); onHow(); });
})();
