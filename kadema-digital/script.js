(() => {
  const page = document.getElementById('page');
  const header = document.getElementById('header');
  const how = document.getElementById('how');
  const howStage = document.getElementById('howStage');
  const howCard = document.getElementById('howCard');

  /* ---------- масштаб макета 1440 под ширину окна ---------- */
  let Z = 1;                                   // масштаб страницы (zoom)
  function fit() {
    const z = Z = Math.min(1, window.innerWidth / 1440);
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
    requestAnimationFrame(() => { onHeader(); onHow(); onDuo(); onTasks(); ticking = false; });
  }

  /* ---------- «Команда + ИИ»: этапы работы ----------
     Блок закрепляется по центру экрана, пункты переключаются скроллом —
     не сразу, а после заметной прокрутки (--duo-step в styles.css):
     - название этапа в скобках и текст команды меняются сразу;
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
  let duoStep = -1, duoTimer = 0, duoRun = 0, duoSeen = false, duoTyping = false;

  function duoShow(i) {
    duoStep = i;
    const run = ++duoRun;                       // отменяет недопечатанный пункт
    clearTimeout(duoTimer);
    const [stage, team, ai] = DUO_STEPS[i];
    duoTyping = true;                           // пока ИИ не допишет — дальше не пускаем
    duoStage.textContent = stage;
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

  // Граница прокрутки: пока ИИ печатает, дальше конца текущего этапа не пускаем
  let duoMaxY = Infinity;
  function onDuo() {
    const t = duoTrack.getBoundingClientRect();
    const p = duoPin.getBoundingClientRect();
    const n = DUO_STEPS.length;
    const run = t.height - p.height;                          // путь закреплённого блока (px экрана)
    const pinTop = window.innerHeight / 2 - 141 * Z;          // где блок закрепляется
    const trackY = t.top + window.scrollY;
    duoMaxY = duoStep >= 0 && duoTyping
      ? trackY - pinTop + run * (duoStep + 1) / n - 2
      : Infinity;
    // возвращаем только небольшой перескок (колесо, тачпад, клавиши);
    // дальний прыжок — ползунок, якорь, загрузка страницы ниже — не держим
    if (window.scrollY > duoMaxY && window.scrollY - duoMaxY < 600) { window.scrollTo(0, duoMaxY); return; }
    if (t.bottom < 0 || t.top > window.innerHeight) return;   // блок вне экрана
    const q = Math.min(1, Math.max(0, (p.top - t.top) / run));
    const step = Math.min(n - 1, Math.floor(q * n));
    duoBar.style.height = (BAR_H * (step + 1) / n).toFixed(1) + 'px';   // 4 положения, переезд — CSS-переходом
    if (step !== duoStep || !duoSeen) { duoSeen = true; duoShow(step); }
  }
  // Колесо и тачпад: пока ИИ печатает, прокрутку вниз сами доводим ровно
  // до границы этапа и дальше не пускаем — без перескока и отката назад
  window.addEventListener('wheel', (e) => {
    if (!duoTyping || e.deltaY <= 0 || duoMaxY === Infinity) return;
    const px = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    if (window.scrollY + px <= duoMaxY) return;               // до границы ещё далеко — обычный скролл
    e.preventDefault();
    if (window.scrollY < duoMaxY) window.scrollTo(0, duoMaxY);
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (duoTyping && window.scrollY >= duoMaxY - 4) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (duoTyping && window.scrollY >= duoMaxY - 4 && ['ArrowDown', 'PageDown', 'Space', 'End'].includes(e.code)) e.preventDefault();
  });

  /* ---------- «Задачи, которые решает сайт»: сцена с фото ----------
     1) пока блок подъезжает, квадрат с фото по скроллу растёт до своего размера;
     2) верх блока закрепляется — и дальше, как с тёмной карточкой, полуавтоматически
        (по времени, изинг сильный ease-out): из-за фото вырастает светлая подложка
        #FFF4F8 и разворачивается на весь экран, синхронно внутри фото проступает
        размытая маска — сначала тонкой рамкой по форме квадрата, потом вырез
        уменьшается и скругляется до круга 184px;
     3) по скроллу: появляется значок «1», затем «1» уезжает вверх, «2» встаёт снизу. */
  const tasks = document.getElementById('tasks');
  const tasksTrack = document.getElementById('tasksTrack');
  const tasksStage = document.getElementById('tasksStage');
  const tasksLight = document.getElementById('tasksLight');
  const tasksFrame = document.getElementById('tasksFrame');
  const tasksVeil = document.getElementById('tasksVeil');
  const tasksBadge = document.getElementById('tasksBadge');
  const tasksNums = tasksBadge.querySelectorAll('.tasks__num');
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
    const st = tasksStage.getBoundingClientRect();
    const W = st.width / Z, H = st.height / Z;
    const x0 = W / 2 - FRAME / 2, y0 = 218;
    const L = tasksLight.style;
    L.opacity = lp > 0.001 ? '1' : '0';
    L.left = mix(x0, 0, lp).toFixed(1) + 'px';
    L.top = mix(y0, 0, lp).toFixed(1) + 'px';
    L.width = mix(FRAME, W, lp).toFixed(1) + 'px';
    L.height = mix(FRAME, H, lp).toFixed(1) + 'px';
    L.borderRadius = mix(FRAME_R, 0, lp).toFixed(1) + 'px';
    // заголовок и подпись: белые на тёмном → чёрные на светлом
    const ink = Math.round(255 * (1 - lp));
    tasks.style.setProperty('--tasks-ink', `rgb(${ink},${ink},${ink})`);
    tasks.style.setProperty('--tasks-ink-soft', `rgba(${ink},${ink},${ink},.5)`);
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

  // Значок: «1» уезжает вверх, «2» встаёт снизу (и обратно при скролле назад)
  let badgeNum = 1;
  function setBadgeNum(n) {
    if (n === badgeNum) return;
    const [one, two] = tasksNums;
    const from = n === 2 ? one : two, to = n === 2 ? two : one;
    // новая цифра заходит с той стороны, куда движемся: вперёд — снизу, назад — сверху
    to.style.transition = 'none';
    to.classList.remove('is-cur', 'is-up');
    if (n === 1) to.classList.add('is-up');
    void to.offsetWidth;
    to.style.transition = '';
    from.classList.remove('is-cur');
    from.classList.toggle('is-up', n === 2);
    to.classList.remove('is-up');
    to.classList.add('is-cur');
    badgeNum = n;
  }

  function onTasks() {
    const r = tasksTrack.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    // 1) заход: верх блока идёт от низа экрана к верху — фото растёт до 1
    const enter = 1 - Math.pow(1 - clamp01(1 - r.top / vh), 3);
    tasksFrame.style.setProperty('--tasks-scale', (TASKS_FROM + (1 - TASKS_FROM) * enter).toFixed(4));
    // 2) сцена на закреплённом блоке
    const q = clamp01(-r.top / (r.height - tasksStage.getBoundingClientRect().height));
    // подложка и маска: запускаются, как только блок закрепился; при быстром
    // скролле (ушли дальше середины сцены) — сразу в конечное состояние
    if (q > 0.5 && lp < 1) setLight(1, true);
    else setLight(-r.top > 1 ? 1 : 0);
    tasksBadge.classList.toggle('is-on', q >= 0.3);
    setBadgeNum(q >= 0.62 ? 2 : 1);
  }

  /* ---------- бегущая строка в hero: копия группы для бесшовного цикла ---------- */
  function buildTicker() {
    const track = document.getElementById('heroTags');
    const clone = track.firstElementChild.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  fit();
  buildTicker();
  onHeader();
  onHow();
  onDuo();
 
  onTasks();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { fit(); onHow(); onDuo(); onTasks(); });
})();
