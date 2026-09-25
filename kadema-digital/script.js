(() => {
  const page = document.getElementById('page');
  const header = document.getElementById('header');
  const how = document.getElementById('how');
  const howStage = document.getElementById('howStage');
  const howCard = document.getElementById('howCard');

  /* ---------- масштаб макета 1440 под ширину окна ---------- */
  let Z = 1;                                   // масштаб страницы (zoom)
  function fit() {
    // ширина окна БЕЗ полосы прокрутки: макет 1440 всегда ровно по ширине видимой
    // области — на узких экранах уменьшается, на широких увеличивается
    const z = Z = document.documentElement.clientWidth / 1440;
    page.style.zoom = z;
    const vh = window.innerHeight / z;
    document.documentElement.style.setProperty('--vh', vh + 'px');
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
    headerTone();
  }
  // Подложка шапки подстраивается под фон под ней: на светлом — заметно темнее,
  // чтобы белое меню читалось. Фон берём у первого непрозрачного слоя под шапкой
  const headerNav = header.querySelector('.header__nav');
  function bgLuma(el) {
    for (; el && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      const m = cs.backgroundColor.match(/[\d.]+/g);
      if (m && (m[3] === undefined || +m[3] > 0.5)) return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
      if (cs.backgroundImage !== 'none' && !el.classList.contains('page')) return 0;   // картинка/градиент — считаем тёмным
    }
    return 1;
  }
  function headerTone() {
    // точка — середина шапки в её видимом положении (даже если сейчас она спрятана)
    const y = (parseFloat(getComputedStyle(header).top) + 39) * Z;
    const r = headerNav.getBoundingClientRect();
    let light = 0, n = 0;
    for (const x of [r.left + 40, r.left + r.width / 2, window.innerWidth - 60]) {
      const under = document.elementsFromPoint(x, y).find((el) => !header.contains(el));
      if (!under) continue;
      light += bgLuma(under) > 0.6 ? 1 : 0; n++;
    }
    if (n) header.classList.toggle('is-light', light / n >= 0.5);
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

  // Три фазы: 1) пока блок заходит в экран, карточка с параллаксом догоняет
  // текст над собой и понемногу расширяется во все стороны (--e, по скроллу);
  // 2) как только встаёт по центру экрана (секция закрепилась), резко
  // раскрывается на весь экран — переход по времени, сильный ease-out;
  // 3) при скролле обратно всё проигрывается в обратную сторону.
  function onHow() {
    const top = how.getBoundingClientRect().top;
    const vh = window.innerHeight;
    const e = Math.min(1, Math.max(0, 1 - top / vh));
    howCard.style.setProperty('--e', e.toFixed(4));
    howCard.classList.toggle('is-open', top <= 1);
    // Быстрый скролл: если секция уехала дальше трети экрана, а раскрытие ещё
    // не доиграло, карточка сразу встаёт во весь экран — тёмный блок не рвётся
    howCard.classList.toggle('is-full', -top > vh * 0.33);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onHeader(); onHow(); onDuo(); onTasks(); onWhite(); onSteps(); onEco(); ticking = false; });
  }

  /* ---------- «Команда + ИИ»: этапы работы ----------
     Блок закрепляется по центру экрана, пункты переключаются скроллом —
     не сразу, а после заметной прокрутки (--duo-step в styles.css):
     - название этапа в скобках меняется мягко (уходит и проявляется), текст команды — сразу;
     - прокрутку блок не держит: ИИ допечатывает, пока страница едет;
     - ИИ сначала «обдумывает» (точки, мигающий маркер), потом печатает текст
       по буквам с живым неровным темпом;
     - прогресс-бар по центру встаёт в одно из 4 положений — видно, сколько осталось. */
  const DUO_STEPS = [
    ['Стратегия и исследования',
     'Определяет стратегию, позиционирование и принимает ключевые решения',
     'Анализирует рынок и тренды, собирает бенчмарки, генерирует гипотезы'],
    ['Айдентика и концепции',
     'Задаёт арт-дирекшн, утверждает стиль и дизайн-систему',
     'Генерирует визуальные концепции, мудборды и варианты структуры'],
    ['Контент и проектирование',
     'Проектирует CJM, проверяет смыслы, факты и финальный оффер',
     'Готовит черновики текстов, сценарии и варианты сеток'],
    ['Разработка и запуск',
     'Проектирует архитектуру, проверяет безопасность и тестирует перед запуском',
     'Ускоряет код, генерирует автотесты и находит ошибки'],
  ];
  const DUO_THINK_MS = 450;         // ИИ «думает»
  const DUO_TYPE_MS = 14;           // средняя задержка между буквами
  const duoTrack = document.getElementById('duoTrack');
  const duoPin = document.getElementById('duoPin');
  const duoStage = document.getElementById('duoStage');
  const duoTeam = document.getElementById('duoTeam');
  const duoAi = document.getElementById('duoAi');
  const duoAiDot = document.getElementById('duoAiDot');
  const duoBar = document.getElementById('duoBar');
  const BAR_H = 133;
  let duoStep = -1, duoTimer = 0, duoRun = 0, duoSeen = false, duoTyping = false, duoStageT = 0;

  function duoShow(i) {
    duoStep = i;
    const run = ++duoRun;                       // отменяет недопечатанный пункт
    clearTimeout(duoTimer);
    const [stage, team, ai] = DUO_STEPS[i];
    duoTyping = true;
    // название этапа в скобках меняется мягко: уходит вниз и проявляется
    if (duoStage.textContent !== stage) {
      duoStage.classList.add('is-out');
      clearTimeout(duoStageT);
      duoStageT = setTimeout(() => { duoStage.textContent = stage; duoStage.classList.remove('is-out'); }, 300);
    }
    duoTeam.textContent = team;                 // человек — сразу
    duoAi.innerHTML = '<span class="duo__thinking"><i></i><i></i><i></i></span>';
    duoAiDot.classList.add('is-thinking');
    duoTimer = setTimeout(() => {               // ИИ обдумал — печатает
      if (run !== duoRun) return;
      duoAiDot.classList.remove('is-thinking');
      duoAi.innerHTML = '<span></span><i class="duo__caret"></i>';
      const out = duoAi.firstChild;
      let k = 0;
      const typeNext = () => {
        if (run !== duoRun) return;
        out.textContent = ai.slice(0, ++k);
        if (k >= ai.length) { duoTyping = false; return; }
        const ch = ai[k - 1];
        // живой темп: чуть дольше после пробела и знаков препинания
        const d = DUO_TYPE_MS * (0.55 + Math.random() * 0.9) + (ch === ' ' ? 18 : 0) + (/[,.]/.test(ch) ? 90 : 0);
        duoTimer = setTimeout(typeNext, d);
      };
      typeNext();
    }, DUO_THINK_MS);
  }

  // Блок закреплён, но прокрутку не держит: этап меняется по положению скролла
  function onDuo() {
    const t = duoTrack.getBoundingClientRect();
    const p = duoPin.getBoundingClientRect();
    const n = DUO_STEPS.length;
    const run = t.height - p.height;                          // путь закреплённого блока (px экрана)
    if (t.bottom < 0 || t.top > window.innerHeight) return;   // блок вне экрана
    const q = Math.min(1, Math.max(0, (p.top - t.top) / run));
    const step = Math.min(n - 1, Math.floor(q * n));
    duoBar.style.height = (BAR_H * (step + 1) / n).toFixed(1) + 'px';   // 4 положения, переезд — CSS-переходом
    if (step !== duoStep || !duoSeen) { duoSeen = true; duoShow(step); }
  }

  /* ---------- «Задачи, которые решает сайт»: сцена с фото ----------
     1) пока блок подъезжает, квадрат с фото по скроллу растёт до своего размера;
     2) блок не останавливается; когда его верх подходит к верху экрана — полуавтоматически
        (по времени, изинг сильный ease-out) всё тёмное полотно — сцена, этапы и
        карточка выше — перекрашивается в #FFF4F8 (текст в чёрный), синхронно внутри фото проступает
        размытая маска — сначала тонкой рамкой по форме квадрата, потом вырез
        уменьшается и скругляется до круга 184px;
     3) дальше по ходу скролла появляется значок «2». */
  const tasks = document.getElementById('tasks');
  const tasksTrack = document.getElementById('tasksTrack');
  const tasksFrame = document.getElementById('tasksFrame');
  const tasksVeil = document.getElementById('tasksVeil');
  const tasksBadge = document.getElementById('tasksBadge');
  const TASKS_FROM = 0.6;                              // стартовый масштаб фото
  const FRAME = 230, FRAME_R = 56;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10));

  /* Скругление «как в iOS» — сглаживание углов 100%, как в Figma (Corner smoothing).
     Контур из кривых Безье вокруг дуги; при радиусе = половине стороны даёт круг. */
  function squircle(x, y, w, h, radius, smoothing = 1) {
    const budget = Math.min(w, h) / 2;
    const R = Math.min(radius, budget);
    if (R <= 0) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    const s = Math.min(smoothing, budget / R - 1);
    const p = Math.min((1 + smoothing) * R, budget);
    const rad = (deg) => deg * Math.PI / 180;
    const arcMeasure = 90 * (1 - s);
    const arc = Math.sin(rad(arcMeasure / 2)) * R * Math.SQRT2;
    const alpha = (90 - arcMeasure) / 2;
    const p34 = R * Math.tan(rad(alpha / 2));
    const beta = 45 * s;
    const c = p34 * Math.cos(rad(beta));
    const d = c * Math.tan(rad(beta));
    const bb = (p - arc - c - d) / 3;
    const aa = 2 * bb;
    const f = (n) => +n.toFixed(3);
    const A = f(aa), B = f(aa + bb), C = f(aa + bb + c), D = f(d), Cc = f(c), BC = f(bb + c), ARC = f(arc), RR = f(R);
    return `M${f(x + w - p)} ${f(y)}` +
      `c${A} 0 ${B} 0 ${C} ${D}a${RR} ${RR} 0 0 1 ${ARC} ${ARC}c${D} ${Cc} ${D} ${BC} ${D} ${C}` +
      `L${f(x + w)} ${f(y + h - p)}` +
      `c0 ${A} 0 ${B} ${-D} ${C}a${RR} ${RR} 0 0 1 ${-ARC} ${ARC}c${-Cc} ${D} ${-BC} ${D} ${-C} ${D}` +
      `L${f(x + p)} ${f(y + h)}` +
      `c${-A} 0 ${-B} 0 ${-C} ${-D}a${RR} ${RR} 0 0 1 ${-ARC} ${-ARC}c${-D} ${-Cc} ${-D} ${-BC} ${-D} ${-C}` +
      `L${f(x)} ${f(y + p)}` +
      `c0 ${-A} 0 ${-B} ${D} ${-C}a${RR} ${RR} 0 0 1 ${ARC} ${-ARC}c${Cc} ${-D} ${BC} ${-D} ${C} ${-D}Z`;
  }
  tasksFrame.style.clipPath = `path("${squircle(0, 0, FRAME, FRAME, FRAME_R)}")`;

  // Разворот подложки и маска — одно общее значение lp (0…1), анимация по времени
  const LIGHT_MS = 900;
  let lp = 0, lpFrom = 0, lpTo = 0, lpT0 = 0, lpRaf = 0;
  function renderLight() {
    // перекрашивается всё тёмное полотно сразу — сцена, этапы и карточка выше:
    // фон #111 → #FFF4F8, текст и линии из белого в чёрный
    const k = (a, b) => Math.round(a + (b - a) * lp);
    const ink = k(255, 0);
    const s = page.style;
    s.setProperty('--canvas', `rgb(${k(17, 255)},${k(17, 244)},${k(17, 248)})`);
    s.setProperty('--canvas-ink', `rgb(${ink},${ink},${ink})`);
    s.setProperty('--canvas-soft', `rgba(${ink},${ink},${ink},.5)`);
    s.setProperty('--canvas-line', `rgba(${ink},${ink},${ink},.2)`);
    s.setProperty('--canvas-pill', `rgba(${ink},${ink},${ink},.1)`);
    s.setProperty('--canvas-dot', `rgba(${ink},${ink},${ink},.4)`);
    // маска: 1) рамка по форме квадрата (вырез 230 → 206), 2) вырез → круг 184
    const a = clamp01(lp / 0.4), b = clamp01((lp - 0.4) / 0.6);
    const size = FRAME - 24 * a - 22 * b;
    const r = mix(FRAME_R, FRAME_R - 4, a) + (92 - (FRAME_R - 4)) * b;
    const o = (FRAME - size) / 2;
    tasksVeil.style.clipPath = lp < 0.002 ? 'inset(50%)'
      : `path(evenodd, "M0 0H${FRAME}V${FRAME}H0Z${squircle(o, o, size, size, r)}")`;
  }
  function lpTick(now) {
    const t = clamp01((now - lpT0) / LIGHT_MS);
    lp = lpFrom + (lpTo - lpFrom) * easeOut(t);
    renderLight();
    lpRaf = t < 1 ? requestAnimationFrame(lpTick) : 0;
  }
  function setLight(target, instant) {
    if (instant) { cancelAnimationFrame(lpRaf); lpRaf = 0; lp = lpTo = target; renderLight(); return; }
    if (target === lpTo) return;
    lpFrom = lp; lpTo = target; lpT0 = performance.now();
    if (!lpRaf) lpRaf = requestAnimationFrame(lpTick);
  }

  // Всё едет вместе со скроллом, без остановок; эффекты срабатывают, когда
  // верх блока проезжает отметки на экране (в px макета от верха окна):
  const T_LIGHT = 140;    // перекраска полотна и маска
  const T_BADGE = -100;   // значок «2» (фото ещё целиком на экране)
  const T_FAST = -200;
  const TASKS_HOLD = 1000;  // мс паузы, когда появляется значок «2»
  let tasksPaused = false, tasksHoldUntil = 0, tasksLastY = window.scrollY;    // дальше — при быстром скролле перекраска сразу в конец
  function onTasks() {
    const r = tasksTrack.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const top = r.top / Z;                               // верх блока, px макета
    // 1) заход: верх блока идёт от низа экрана к верху — фото растёт до 1
    const enter = 1 - Math.pow(1 - clamp01(1 - r.top / vh), 3);
    tasksFrame.style.setProperty('--tasks-scale', (TASKS_FROM + (1 - TASKS_FROM) * enter).toFixed(4));
    // 2) перекраска и маска — по времени; при быстром скролле сразу в конец
    if (top < T_FAST && lp < 1) setLight(1, true);
    else setLight(top <= T_LIGHT ? 1 : 0);
    // 3) значок «2» — появляется с пружинкой; в этот момент короткая пауза,
    //    чтобы анимация успела доиграть даже при быстром скролле
    const badge = top <= T_BADGE;
    if (badge && !tasksBadge.classList.contains('is-on') && !tasksPaused && window.scrollY > tasksLastY) {
      tasksPaused = true;
      tasksHoldUntil = performance.now() + TASKS_HOLD;
    }
    if (top > T_LIGHT) tasksPaused = false;               // вернулись выше — пауза снова сработает
    tasksBadge.classList.toggle('is-on', badge);
    tasksLastY = window.scrollY;
  }
  // во время паузы колесо/свайп вниз не листают страницу (вверх — можно)
  const tasksHeld = () => performance.now() < tasksHoldUntil;
  window.addEventListener('wheel', (e) => { if (e.deltaY > 0 && tasksHeld()) e.preventDefault(); }, { passive: false });
  let tasksTouchY = 0;
  window.addEventListener('touchstart', (e) => { tasksTouchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (e.touches[0].clientY < tasksTouchY && tasksHeld()) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => { if (tasksHeld() && ['ArrowDown', 'PageDown', 'Space', 'End'].includes(e.code)) e.preventDefault(); });

  /* ================= БЕЛАЯ ЧАСТЬ ================= */

  /* ---------- параллакс: белый блок выезжает из-под розового, облака плывут ---------- */
  const white = document.getElementById('white');
  const priceIntro = document.getElementById('priceIntro');
  const clouds = [...document.querySelectorAll('.cloud')];
  // Смещение облака = подъём по скроллу + мягкий сдвиг за курсором.
  // Курсор в блоке задаёт цель (до ±CLOUD_PULL px, облака в разные стороны —
  // как на разной глубине), сдвиг плавно догоняет её
  const CLOUD_PULL = 18;
  let cloudRise = 1, mx = 0, my = 0, tx = 0, ty = 0, cloudRaf = 0;
  function moveClouds() {
    clouds.forEach((c, i) => {
      const k = i ? -0.7 : 1;                           // правое — ближе/дальше, в другую сторону
      const x = mx * CLOUD_PULL * k, y = my * CLOUD_PULL * k + cloudRise * parseFloat(c.dataset.rise);
      c.style.transform = x || y ? `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)` : '';
    });
  }
  function cloudTick() {
    mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;
    if (Math.abs(tx - mx) < 0.001 && Math.abs(ty - my) < 0.001) { mx = tx; my = ty; cloudRaf = 0; }
    else cloudRaf = requestAnimationFrame(cloudTick);
    moveClouds();
  }
  const cloudZone = document.getElementById('price');
  cloudZone.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = cloudZone.querySelector('.price__intro').getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
    ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
    if (!cloudRaf) cloudRaf = requestAnimationFrame(cloudTick);
  });
  cloudZone.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!cloudRaf) cloudRaf = requestAnimationFrame(cloudTick); });
  function onWhite() {
    const r = white.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.top > vh || r.bottom < 0) return;
    // пока верх белого блока идёт от низа экрана к трети — содержимое догоняет (было выше, под розовым)
    const e = clamp01(1 - (r.top - vh * 0.25) / (vh * 0.75));
    priceIntro.style.transform = `translate3d(0, ${(-(1 - e) * 180).toFixed(1)}px, 0)`;
    // облака всплывают снизу (быстрее текста) — всё время, пока блок
    // заезжает в экран, — и встают на место из макета; дальше не двигаются
    const c = clamp01((vh - r.top) / (vh * 0.9));
    cloudRise = Math.pow(1 - c, 1.6);
    moveClouds();
  }

  /* ---------- тарифы: табы по категориям, раскрытие «что входит» ---------- */
  const PRICE = [
    { desc: 'Когда сайт нужен быстро: под акцию, новый продукт или проверку спроса. Запуск — от одной недели.',
      items: [
        ['Промо-сайт, 2–3 экрана', 'от 20 000 ₽', 'Подойдёт для акции, мероприятия, нового продукта или отдельного рекламного предложения.',
          ['Структура и тексты под задачу', 'Дизайн в стиле бренда', 'Адаптация под мобильные', 'Форма заявки', 'Подключение аналитики', 'Публикация на домене']],
        ['Лендинг, от 4 экранов', 'от 30 000 ₽', 'Посадочная страница для презентации услуги, продукта и получения заявок.',
          ['Анализ конкурентов', 'Прототип и сценарий страницы', 'Уникальный дизайн', 'Адаптация под мобильные', 'Формы заявок и квиз', 'Базовое SEO и аналитика']],
      ] },
    { desc: 'Полноценный сайт компании: услуги, кейсы, каталог или магазин — с понятной структурой и формами заявок.',
      items: [
        ['Упрощённый корпоративный сайт', 'от 40 000 ₽', 'Компактный сайт с информацией о компании, услугах, преимуществах и контактах.',
          ['До 5 страниц', 'Дизайн в стиле бренда', 'Адаптация под мобильные', 'Формы связи', 'Базовое SEO', 'Подключение аналитики']],
        ['Стандартный корпоративный сайт', 'от 50 000 ₽', 'Полноценная структура с несколькими услугами, кейсами, информационными разделами и формами.',
          ['Структура под услуги и кейсы', 'Прототипы ключевых страниц', 'Уникальный дизайн', 'Блог или новости', 'SEO и аналитика', 'Обучение работе с сайтом']],
        ['Сайт-каталог без онлайн-оплаты', 'от 80 000 ₽', 'Каталог товаров или услуг с категориями, карточками и формами запроса стоимости.',
          ['Категории и фильтры', 'Карточки товаров', 'Форма запроса цены', 'Импорт каталога', 'Адаптация под мобильные', 'SEO для категорий']],
        ['Интернет-магазин', 'от 140 000 ₽', 'Каталог, карточки товаров, корзина, оформление заказа и необходимые интеграции.',
          ['Каталог и фильтры', 'Корзина и оформление заказа', 'Онлайн-оплата', 'Интеграция с учётной системой', 'Личный кабинет', 'Аналитика продаж']],
      ] },
    { desc: 'Сайты жилых комплексов и девелоперов: планировки, инфраструктура, ход строительства и заявки покупателей.',
      items: [
        ['Лендинг для застройщика', 'от 50 000 ₽', 'Страница жилого комплекса с преимуществами, инфраструктурой, планировками и формами заявки.',
          ['Презентация ЖК', 'Планировки и цены', 'Инфраструктура на карте', 'Ход строительства', 'Формы заявок', 'Аналитика рекламы']],
        ['Корпоративный сайт застройщика', 'от 70 000 ₽', 'Сайт компании с объектами, карточками жилых комплексов, проектами и информацией для покупателей.',
          ['Раздел объектов', 'Карточки ЖК', 'Подбор квартир', 'Новости и акции', 'Ипотека и способы покупки', 'SEO и аналитика']],
      ] },
  ];
  const chevron = '<svg viewBox="0 0 24 24"><path d="M6.4 8.3 12 13.9l5.6-5.6 1.4 1.4-7 7-7-7z"/></svg>';
  const priceDesc = document.getElementById('priceDesc');
  const priceRow = document.getElementById('priceRow');
  const priceList = document.getElementById('priceList');
  const priceItems = document.getElementById('priceItems');
  const tabs = [...document.querySelectorAll('.tab')];
  // Список тарифов показывается целиком: при смене таба ряд плавно
  // растягивается (или сжимается) под новое количество тарифов
  function renderPrice(cat, animate) {
    const c = PRICE[cat];
    const from = priceRow.offsetHeight;
    priceDesc.textContent = c.desc;
    priceItems.innerHTML = c.items.map(([name, price, text, incl], i) => `
      <div class="tariff${i === 0 ? ' is-active is-open' : ''}">
        <div class="tariff__head">
          <div><div class="tariff__name">${name}</div><div class="tariff__price">${price}</div></div>
          <button class="tariff__toggle" aria-label="Что входит">${chevron}</button>
        </div>
        <div class="tariff__more"><div><p>${text}</p><ul>${incl.map((x) => `<li>${x}</li>`).join('')}</ul></div></div>
      </div>`).join('');
    if (!animate) return;
    priceRow.style.height = 'auto';
    const to = priceRow.offsetHeight;
    priceRow.style.height = from + 'px';
    void priceRow.offsetHeight;
    priceRow.style.height = to + 'px';
    const done = (e) => { if (e.target !== priceRow) return; priceRow.style.height = ''; priceRow.removeEventListener('transitionend', done); };
    priceRow.addEventListener('transitionend', done);
    for (const el of [priceList, priceDesc]) { el.classList.remove('is-swap'); void el.offsetWidth; el.classList.add('is-swap'); }
  }
  tabs.forEach((t) => t.addEventListener('click', () => {
    if (t.classList.contains('is-active')) return;
    tabs.forEach((x) => x.classList.toggle('is-active', x === t));
    renderPrice(+t.dataset.cat, true);
  }));
  priceList.addEventListener('click', (e) => {
    const t = e.target.closest('.tariff');
    if (!t) return;
    for (const x of priceItems.children) if (x !== t) x.classList.remove('is-open', 'is-active');
    t.classList.add('is-active');
    t.classList.toggle('is-open');                            // раскрывается «что входит»
  });
  renderPrice(0, false);

  /* ---------- этапы разработки ----------
     Блок закрепляется. Шаг — только после «усилия» (накопленной прокрутки колесом),
     а сама анимация шага доигрывает автоматически и не обрывается на середине:
     фото листается по вертикали, текст проявляется снизу через прозрачность. */
  const STEPS = [
    ['Знакомимся и анализируем', 'Определяем задачи сайта, целевую аудиторию, услуги и необходимый функционал'],
    ['Проектируем', 'Продумываем структуру сайта, собираем прототипы и пользовательские сценарии.'],
    ['Контент и дизайн', 'Готовим офферы и тексты, рисуем интерфейс и адаптируем его под мобильные.'],
    ['Сборка и интеграции', 'Верстаем сайт, подключаем формы связи, настраиваем SEO и аналитику.'],
    ['Тест и запуск', 'Тестируем сайт на разных устройствах и публикуем его на вашем домене.'],
  ];
  const STEP_ICONS = [
    '<path d="M22 11C22 15.97 17.52 20 12 20C10.73 20 9.51 19.78 8.40 19.39L3.61 20.59C2.88 20.77 2.22 20.11 2.40 19.38L3.36 15.54C2.49 14.20 2 12.65 2 11C2 6.020 6.47 2 12 2C17.52 2 22 6.02 22 11Z"/>', // message-circle
    '<path d="M21 5C21 3.89 20.10 3 19 3H5C3.89 3 3 3.89 3 5V9H21V5Z"/><path d="M5 21C3.89 21 3 20.10 3 19V11H9V21H5Z"/><path d="M21 19C21 20.10 20.10 21 19 21H11V11H21V19Z"/>', // layout
    '<path d="M21.92 2.99C22.00 2.44 21.54 1.99 21.00 2.08C17.69 2.66 13.40 5.88 10.68 9.53C12.42 10.25 13.80 11.65 14.50 13.41C18.16 10.76 21.38 6.54 21.92 2.99Z"/><path d="M3.00 16C3.00 13.23 5.23 11 8.00 11C10.76 11 13 13.23 13 16C13 18.76 10.76 21 8.00 21H2.69C2.35 21 2.11 20.66 2.21 20.34L2.69 18.92C2.89 18.31 3.00 17.67 3.00 17.02V16Z"/>', // brush
    '<path d="M13.21 16.32L20.41 10.84C21.46 10.04 21.46 8.45 20.41 7.65L13.21 2.17C12.49 1.62 11.50 1.62 10.78 2.17L3.58 7.65C2.53 8.45 2.53 10.04 3.58 10.84L10.78 16.32C11.50 16.87 12.49 16.87 13.21 16.32Z"/><path d="M19.76 14.33C20.11 14.06 20.61 14.06 20.96 14.33C21.48 14.73 21.48 15.51 20.96 15.91L13.21 21.82C12.49 22.37 11.50 22.37 10.78 21.82L3.03 15.91C2.51 15.51 2.51 14.73 3.03 14.33C3.07 14.30 3.12 14.27 3.17 14.24C3.51 14.06 3.92 14.09 4.23 14.33L11.99 20.25L19.76 14.33Z"/>', // layers
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M3 6.29C3 5.50 3.46 4.79 4.18 4.47L11.18 1.36C11.70 1.13 12.29 1.13 12.81 1.36L19.81 4.47C20.53 4.79 21 5.50 21 6.29V13C21 18.87 14.65 21.93 12.62 22.76C12.22 22.92 11.77 22.92 11.37 22.76C9.34 21.93 3 18.87 3 13V6.29ZM16.5 8.49C16.89 8.89 16.89 9.52 16.5 9.91L11.70 14.70C11.31 15.09 10.68 15.09 10.29 14.70L8 12.41C7.60 12.02 7.60 11.39 8 11C8.39 10.60 9.02 10.60 9.41 11L11 12.58L15.08 8.49C15.47 8.10 16.10 8.10 16.5 8.49Z"/>', // shield-check
  ];
  const STEP_PX = 700;            // = --steps-step в styles.css
  const STEPS_INTRO = 200;        // = --steps-intro: запас прокрутки перед первым шагом (текст выезжает сам)
  const STEP_EFFORT = 220;        // сколько «докрутить» колесом, чтобы перейти на шаг
  const STEP_MS = 900;            // длительность анимации шага
  const stepsTrack = document.getElementById('stepsTrack');
  const stepsStage = document.getElementById('stepsStage');
  const stepsSlides = document.getElementById('stepsSlides');
  const stepsDots = document.getElementById('stepsDots');
  const stepsNum = document.getElementById('stepsNum');
  const stepsIcon = document.getElementById('stepsIcon');
  const stepsTitle = document.getElementById('stepsTitle');
  const stepsText = document.getElementById('stepsText');
  const SLIDE_BG = ['#c9cdd3', '#bfc6cf', '#cfc9c2', '#c3cbc4', '#cbc4cc'];
  stepsSlides.innerHTML = STEPS.map((_, i) =>
    `<div class="steps__slide" style="top:${i * 100}%;background-image:url(images/step-${i + 1}.jpg),linear-gradient(160deg,${SLIDE_BG[i]},#9aa1aa)"></div>`).join('');
  stepsDots.innerHTML = STEPS.map(() => '<i></i>').join('');
  let stepCur = -1, stepBusy = false, stepAcc = 0, stepAccT = 0;

  function setStep(i) {
    if (i === stepCur) return;
    const first = stepCur < 0;
    stepCur = i;
    stepsSlides.style.transform = `translate3d(0, ${-i * 100}%, 0)`;
    [...stepsDots.children].forEach((d, k) => d.classList.toggle('is-on', k === i));
    stepsNum.textContent = String(i + 1).padStart(2, '0');
    stepsIcon.innerHTML = STEP_ICONS[i];
    stepsTitle.textContent = STEPS[i][0];
    stepsText.textContent = STEPS[i][1];
    if (!first && stepsTitle.animate) {
      const from = { opacity: 0, transform: 'translateY(20px)' }, to = { opacity: 1, transform: 'translateY(0)' };
      const opt = { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' };
      stepsNum.animate([from, to], opt);
      stepsIcon.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], opt);
      stepsTitle.animate([from, to], { ...opt, delay: 60 });
      stepsText.animate([from, to], { ...opt, delay: 140 });
    }
  }
  // где начинается закрепление и где конец (в px прокрутки)
  function stepsZone() {
    const t = stepsTrack.getBoundingClientRect();
    const stick = Math.max(0, (window.innerHeight - 800 * Z) / 2);
    const pin = t.top + window.scrollY - stick;               // картинка закрепилась на весь экран по высоте
    const intro = STEPS_INTRO * Z;                            // дальше справа выезжает текст
    const start = pin + intro;
    return { pin, intro, start, end: start + (STEPS.length - 1) * STEP_PX * Z, step: STEP_PX * Z };
  }
  function onSteps() {
    const { pin, intro, start, step } = stepsZone();
    // картинка закрепилась на весь экран — блок с текстом выезжает справа сам,
    // целиком, по времени (CSS-переход); прокрутили выше — уезжает обратно
    stepsStage.classList.toggle('is-in', window.scrollY >= pin - 2);
    if (stepBusy) return;
    const i = Math.min(STEPS.length - 1, Math.max(0, Math.round((window.scrollY - start) / step)));
    setStep(i);
  }
  window.addEventListener('wheel', (e) => {
    const { start, end, step } = stepsZone();
    const y = window.scrollY;
    if (y < start - 2 || y > end + 2) return;                 // не в зоне этапов — обычный скролл
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    if ((dir > 0 && stepCur >= STEPS.length - 1 && y >= end - 2) ||
        (dir < 0 && stepCur <= 0 && y <= start + 2)) return;  // крайний шаг — отпускаем страницу
    e.preventDefault();
    if (stepBusy) return;                                     // анимация доигрывает сама
    clearTimeout(stepAccT);
    stepAccT = setTimeout(() => { stepAcc = 0; }, 260);       // пауза — «усилие» сбрасывается
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    stepAcc += px;
    if (Math.abs(stepAcc) < STEP_EFFORT) return;
    stepAcc = 0;
    const target = Math.min(STEPS.length - 1, Math.max(0, stepCur + dir));
    stepBusy = true;
    setStep(target);
    window.scrollTo(0, start + target * step);
    setTimeout(() => { stepBusy = false; }, STEP_MS);
  }, { passive: false });
  setStep(0);

  /* ---------- экономика проекта: лепестки крутятся ---------- */
  const ECO = [
    'быстрее формируем структуру',
    'оперативнее готовим прототип',
    'создаём больше вариантов подачи',
    'меньше рутинных операций',
    'быстрее вносим правки',
    'специалисты контролируют каждый этап',
    'раньше видим результат',
    'точнее оцениваем бюджет',
  ];
  const ECO_R = 310;
  const ECO_CATCH = 160;          // px (в макете): фото догоняет место уже после закрепления
  const ECO_BUILD = 60;           // px: последние лепестки долетают чуть позже фото
  const ECO_TURN = 520;           // px прокрутки на один шаг поворота (= styles.css)
  const ECO_STEPS = 7;            // 8 лепестков — 7 шагов, с первого до восьмого
  const ECO_EFFORT = 220;         // сколько «докрутить» колесом, чтобы повернуть
  const ECO_MS = 1300;            // длительность поворота (= transition в styles.css)
  const eco = document.getElementById('eco');
  const ecoTrack = eco.querySelector('.eco__track');
  const ecoStage = document.getElementById('ecoStage');
  const ecoRow = ecoStage.querySelector('.eco__row');
  const ecoFlower = document.getElementById('ecoFlower');
  const ecoFlowerBox = ecoFlower.parentElement;
  const ecoPhrase = document.getElementById('ecoPhrase');
  const ecoFlyer = document.getElementById('ecoFlyer');
  const stepsMedia = stepsTrack.querySelector('.steps__media');
  const stepsInfo = stepsTrack.querySelector('.steps__info');
  // Фото верхнего лепестка — последнее фото этапов: оно и перелетает
  const lastSlide = stepsSlides.lastElementChild.style.backgroundImage;
  // Карточка в полёте переворачивается: спереди фото этапов, сзади —
  // картинка верхнего лепестка, она и встаёт на место
  const ecoTop = 'url(images/eco-1.jpg),linear-gradient(160deg,#8d939c,#5d636c)';
  ecoFlyer.innerHTML = '<i class="eco__face"></i><i class="eco__face eco__face--back"></i>';
  ecoFlyer.children[0].style.backgroundImage = lastSlide;      // через style: в url есть кавычки
  ecoFlyer.children[1].style.backgroundImage = ecoTop;
  // Откуда прилетает лепесток — вразнобой со всех сторон:
  // [dx, dy] в px макета, поворот и масштаб в начале полёта, задержка (доля сборки),
  // наклон в объёме на середине пути [rotateX, rotateY], изгиб дуги (доля пути, знак — в какую сторону).
  // Верхние (1 и 7) прилетают сверху первыми и заходят на место по дуге сверху вниз
  const ECO_FROM = [null,
    [760, -980, 34, 1.2, 0.04, [30, -36], -0.35],
    [1250, 160, -22, 0.85, 0.22, [-28, 48], 0.3],
    [1150, 820, 30, 1.15, 0.12, [-52, 18], -0.25],
    [-200, 1100, -40, 0.9, 0.30, [44, 28], 0.3],
    [-1150, 700, 26, 1.25, 0.18, [-34, -42], 0.28],
    [-1300, -120, -30, 0.85, 0.35, [22, 52], -0.3],
    [-1350, -520, 40, 1.1, 0.27, [40, -46], 0.42]];   // широкой дугой слева, садится чуть раньше фото
  ecoFlower.innerHTML = ECO.map((_, i) => {
    const g = 196 - (i % 4) * 6;
    const bg = i === 0 ? '' : `url(images/eco-${i + 1}.jpg),linear-gradient(160deg,rgb(${g},${g},${g}),rgb(${g - 30},${g - 30},${g - 28}))`;
    return `<div class="petal"><i style="background-image:${bg}"></i></div>`;
  }).join('');
  const petals = [...ecoFlower.children];
  petals[0].firstElementChild.style.backgroundImage = ecoTop;


  // Цветок крупный: не мельче 0.88 от макета; если экран низкий — центр
  // опускается так, чтобы верхний лепесток (с фразой) был целиком виден,
  // а нижний может немного уходить за край
  let ecoS = 1, ecoY = 0, ecoH = 0;
  const ecoPull = () => parseFloat(eco.style.getPropertyValue('--eco-pull')) || 0;
  function fitEco() {
    ecoH = window.innerHeight / Z;
    ecoS = Math.min(1, Math.max(0.88, (ecoH - 60) / 846));
    ecoY = Math.max(ecoH / 2, 30 + 423 * ecoS);
    ecoStage.style.setProperty('--eco-s', ecoS.toFixed(3));
    ecoStage.style.setProperty('--eco-y', ecoY.toFixed(1) + 'px');
    // пустота под цветком — текст ниже подтягивается к нему
    eco.style.setProperty('--eco-gap', (ecoH - ecoY - 423 * ecoS).toFixed(1) + 'px');   // < 0 — цветок выходит за низ
    // где низ закреплённого блока этапов (px макета от верха экрана) — на столько подтягиваем экономику
    const sh = stepsStage.offsetHeight;
    eco.style.setProperty('--eco-pull', (Math.max(0, (ecoH - sh) / 2) + sh).toFixed(1) + 'px');
  }
  fitEco();

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  let ecoIdx = 0, ecoPhraseT = 0;
  function setPhrase(i) {
    if (i === ecoIdx) return;
    ecoIdx = i;
    ecoPhrase.classList.add('is-out');
    clearTimeout(ecoPhraseT);
    ecoPhraseT = setTimeout(() => { ecoPhrase.textContent = ECO[ecoIdx]; ecoPhrase.classList.remove('is-out'); }, 300);
  }

  // Поворот — пошаговый, как в этапах: шаг после «усилия» колесом,
  // сам поворот доигрывает по времени и останавливается на лепестке
  let ecoCur = 0, ecoBusy = false, ecoAcc = 0, ecoAccT = 0;
  function setEcoStep(i) {
    if (i === ecoCur) return;
    ecoCur = i;
    ecoFlower.style.transform = i ? `rotate(${i * 45}deg)` : '';
    setPhrase((8 - i) % 8);                                   // по часовой: на 12 часов встаёт лепесток слева
  }
  function ecoZone() {
    // скролл, при котором собран цветок: фото село и прошла досборка
    const s0 = ecoTrack.getBoundingClientRect().top + window.scrollY + (ecoPull() + 48 + ECO_CATCH + ECO_BUILD) * Z;
    return { start: s0, end: s0 + ECO_STEPS * ECO_TURN * Z, step: ECO_TURN * Z };
  }
  window.addEventListener('wheel', (e) => {
    const { start, end, step } = ecoZone();
    const y = window.scrollY;
    if (y < start - 2 || y > end + 2) return;
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    if ((dir > 0 && ecoCur >= ECO_STEPS && y >= end - 2) ||
        (dir < 0 && ecoCur <= 0 && y <= start + 2)) return;   // крайний лепесток — отпускаем страницу
    e.preventDefault();
    if (ecoBusy || flyF < 1) return;                          // пока фото не село на место — не крутим
    clearTimeout(ecoAccT);
    ecoAccT = setTimeout(() => { ecoAcc = 0; }, 260);
    ecoAcc += e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(ecoAcc) < ECO_EFFORT) return;
    ecoAcc = 0;
    const target = Math.min(ECO_STEPS, Math.max(0, ecoCur + dir));
    ecoBusy = true;
    setEcoStep(target);
    window.scrollTo(0, start + target * step);
    setTimeout(() => { ecoBusy = false; }, ECO_MS);
  }, { passive: false });

  let flyF = -1, flyTarget = -1, flyRaf = 0;
  function flyTick() {
    // всегда мягко догоняем, даже при быстром скролле — без перескоков
    flyF = flyTarget < 0 || flyF < 0 ? flyTarget : flyF + (flyTarget - flyF) * 0.16;
    if (Math.abs(flyTarget - flyF) < 0.0005) flyF = flyTarget;
    drawFlyer(flyF);
    flyRaf = flyF === flyTarget ? 0 : requestAnimationFrame(flyTick);
  }
  function drawFlyer(f) {
    const flying = f > 0 && f < 1;
    petals[0].style.visibility = f < 1 ? 'hidden' : '';
    ecoFlyer.style.visibility = flying ? 'visible' : 'hidden';
    if (!flying) return;
    const e = easeInOut(f);
    // старт — где фото стояло закреплённым в этапах, финиш — место верхнего лепестка
    // всё в координатах закреплённой сцены — от прокрутки страницы не зависит
    const o = ecoStage.getBoundingClientRect();
    const m = stepsMedia.getBoundingClientRect();
    const a = { left: m.left, top: o.top + Math.max(0, (window.innerHeight - m.height) / 2), width: m.width, height: m.height };
    const b = petals[0].getBoundingClientRect();
    // одна мягкая дуга: чуть в сторону и вниз от прямой, без лишних поворотов
    const arc = Math.sin(Math.PI * e);
    const cx = lerp(a.left + a.width / 2, b.left + b.width / 2, e) - 90 * Z * arc;
    const cy = lerp(a.top + a.height / 2, b.top + b.height / 2, e) + 70 * Z * arc;
    const w = lerp(a.width, b.width, e), h = lerp(a.height, b.height, e);
    ecoFlyer.style.left = ((cx - w / 2 - o.left) / Z).toFixed(2) + 'px';
    ecoFlyer.style.top = ((cy - h / 2 - o.top) / Z).toFixed(2) + 'px';
    ecoFlyer.style.width = (w / Z).toFixed(2) + 'px';
    ecoFlyer.style.height = (h / Z).toFixed(2) + 'px';
    ecoFlyer.style.borderRadius = (61 * ecoS * easeOutCubic(Math.min(1, f / 0.3))).toFixed(2) + 'px';
    // быстрый переворот на 180° в середине пути — подмена картинки
    const flip = 180 * easeInOut(Math.min(1, Math.max(0, (f - 0.38) / 0.22)));
    ecoFlyer.style.transform = `perspective(1600px) rotateY(${flip.toFixed(2)}deg)`;
  }

  function onEco() {
    const vh = window.innerHeight;
    const top = ecoTrack.getBoundingClientRect().top;
    // 1) фото летит, как только отпускает блок этапов; 2) одновременно подлетают
    //    остальные лепестки; 3) затем пошаговые повороты
    // сцена цветка закрепляется ровно в момент, когда отпускает блок этапов
    // (экономика подтянута под него, --eco-pull), поэтому весь полёт идёт
    // внутри неподвижной сцены
    const u = -top;                                           // px с начала перелёта
    const flyLen = (ecoPull() + 48 + ECO_CATCH) * Z;
    const f = Math.min(1, Math.max(0, u / flyLen));
    ecoFlowerBox.style.visibility = u > 0 ? '' : 'hidden';    // пока этапы на месте — цветка не видно
    // остальные стартуют почти вместе с фото и долетают вместе с ним
    const g0 = flyLen * 0.12, g = Math.min(1, Math.max(0, (u - g0) / (flyLen - g0 + ECO_BUILD * Z)));

    petals.forEach((el, i) => {
      let tr = `rotate(${i * 45}deg) translateY(-${ECO_R}px)`;
      if (i > 0) {
        const [dx, dy, r, sc, d] = ECO_FROM[i];
        const k = easeOutCubic(Math.min(1, Math.max(0, (g - d) / 0.6)));
        const q = 1 - k, arc = Math.sin(Math.PI * k);          // arc: 0 на старте и на месте, 1 — середина пути
        // путь — дуга: сдвиг поперёк направления полёта (в разные стороны у соседей)
        const bend = ECO_FROM[i][6], len = Math.hypot(dx, dy) || 1;
        const bx = -dy / len * bend * len * arc, by = dx / len * bend * len * arc;
        // в полёте лепесток крутится (дополнительные пол-оборота гаснут к месту)
        // и покачивается в объёме
        const spin = r * q + Math.sign(r) * 180 * q * q;
        const tiltX = ECO_FROM[i][5][0] * arc, tiltY = ECO_FROM[i][5][1] * arc;
        tr = `translate(${(dx * q + bx).toFixed(1)}px, ${(dy * q + by).toFixed(1)}px) ${tr} ` +
          `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) ` +
          `rotate(${spin.toFixed(2)}deg) scale(${(1 + (sc - 1) * q).toFixed(3)})`;
      }
      el.style.transform = tr;
    });
    ecoRow.style.opacity = Math.min(1, Math.max(0, (f - 0.7) / 0.3)).toFixed(3);

    // верхний лепесток: фото перелетает к своему месту; прогресс сглажен
    // (догоняет скролл в rAF), поэтому полёт идёт ровно, без подёргиваний
    stepsMedia.classList.toggle('is-gone', u > 0);
    stepsInfo.classList.toggle('is-gone', u > 0);             // текст этапов уходит через прозрачность
    flyTarget = u > 0 ? f : -1;
    if (!flyRaf) flyRaf = requestAnimationFrame(flyTick);

    // шаг поворота по положению скролла (полоса прокрутки, клавиши, свайп)
    const ecoIdx = Math.min(ECO_STEPS, Math.max(0, Math.round((u - flyLen - ECO_BUILD * Z) / (ECO_TURN * Z))));
    if (!ecoBusy && (flyF >= 1 || ecoIdx === 0)) setEcoStep(ecoIdx);   // до посадки фото — только исходное положение
  }
  onEco();

  /* ---------- тёмный блок: услуги, вопросы, логотип с видео, окно с формой ---------- */
  // лента услуг бесконечная: копия набора карточек встык, CSS сдвигает на половину
  const svcTrack = document.getElementById('svcTrack');
  svcTrack.append(...[...svcTrack.children].map((el) => { const c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); return c; }));

  // вопросы: открыт один, как тарифы
  document.getElementById('faqList').addEventListener('click', (e) => {
    const head = e.target.closest('.qa__head');
    if (!head) return;
    const qa = head.parentElement;
    const open = !qa.classList.contains('is-open');
    for (const x of qa.parentElement.children) x.classList.remove('is-open');
    qa.classList.toggle('is-open', open);
  });

  // видео в логотипе крутится без кнопок; вне экрана — на паузе
  const brandVideo = document.querySelector('.brand__logo video');
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) brandVideo.play().catch(() => {});
    else brandVideo.pause();
  }).observe(brandVideo);

  // форм на странице нет — любая кнопка заявки открывает окно поверх
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const MODAL_TITLES = { calc: 'Получить расчёт стоимости', question: 'Задать вопрос' };
  function openModal(kind) {
    modalTitle.textContent = MODAL_TITLES[kind] || 'Оставить заявку';
    modal.classList.remove('is-done');
    modal.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';     // страница под окном не листается
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => modal.querySelector('input').focus({ preventScroll: true }), 150);
  }
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-modal]');
    if (!b) return;
    e.preventDefault();
    openModal(b.dataset.modal);
  });
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('.modal__close')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal(); });
  document.getElementById('modalForm').addEventListener('submit', (e) => {
    e.preventDefault();                                       // прототип: заявка никуда не уходит
    modal.classList.add('is-done');
    e.target.reset();
  });
  // пока окно открыто, колесо не листает страницу (и не крутит цветок/этапы)
  window.addEventListener('wheel', (e) => { if (modal.classList.contains('is-open')) e.stopImmediatePropagation(); }, { capture: true });

  /* ---------- бегущая строка в hero: копия группы для бесшовного цикла ---------- */
  function buildTicker() {
    const track = document.getElementById('heroTags');
    const clone = track.firstElementChild.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  fit();
  onSteps();
  fitEco();                      // масштаб цветка — только после того, как известен Z
  buildTicker();
  onHeader();
  onHow();
  onDuo();
 
  onTasks();
  onWhite();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { fit(); onHow(); onDuo(); onTasks(); onWhite(); onSteps(); fitEco(); onEco(); });
})();
