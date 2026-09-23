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
    // коллаж рассчитан на карточку высотой 992px — ужимаем на низких экранах
    document.getElementById('stack').style.setProperty('--k', Math.min(1, (vh - 80) / 992).toFixed(3));
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
     2) стопка картинок «перелистывается» скроллом: карточки из хвоста сверху
        съезжают вниз, растут и накрывают главную; при обратном скролле улетают вверх. */
  const stack = document.getElementById('stack');
  // заглушки: [ширина, высота, фон, цвет текста, подпись, поворот в хвосте, сдвиг по x]
  const CARDS = [
    [250, 310, 'linear-gradient(160deg,#ff5a1f,#f50f72)', '#111', 'ИИ<br>+ команда', -9, -20],
    [260, 300, 'linear-gradient(170deg,#f2f2f2,#bdbdbd 55%,#3d3d3d)', '#111', '', 7, 25],
    [240, 300, 'repeating-linear-gradient(135deg,#d6361a 0 22px,#5a0c05 22px 34px)', '#fff', '', -12, -10],
    [250, 250, 'radial-gradient(60% 60% at 45% 55%,#ff8a2c,#f6b4a0 55%,#b9d3ec)', '#111', '', 10, 30],
    [240, 300, 'linear-gradient(180deg,#8ec5ff,#2a6fb8)', '#fff', '', -6, -30],
    [230, 290, 'linear-gradient(180deg,#e9d6bf,#c8a27a)', '#111', 'Быстрый<br>запуск<small>1 неделя</small>', 14, 15],
    [260, 290, 'linear-gradient(200deg,#1d3b5c,#0b1520)', '#fff', '', -10, -15],
    [240, 300, 'radial-gradient(70% 60% at 30% 20%,#ff66c4,#ff3b1f 55%,#fff 56%)', '#111', 'Адаптив<small>под любой экран</small>', 8, 20],
    [250, 260, 'repeating-linear-gradient(160deg,#6fb3d9 0 6px,#a9d8f0 6px 12px)', '#111', '', -14, -25],
    [240, 300, 'linear-gradient(170deg,#c25a2c,#7a3016)', '#fff', '', 6, 10],
    [230, 280, 'linear-gradient(180deg,#b7d2ea,#e6eef6 50%,#8a8f96)', '#111', '', -8, -20],
    [250, 310, '#ff4f1a', '#111', 'Сайт<br>от 20 000 ₽<small>под ваш бизнес</small>', 12, 0],
  ];
  const cards = CARDS.map(([w, h, bg, color, label, rot, dx], i) => {
    const el = document.createElement('div');
    el.className = 'stack__card';
    el.style.cssText = `width:${w}px;height:${h}px;margin:${-h / 2}px 0 0 ${-w / 2}px;color:${color};` +
      `background-image:url(images/stack-${i + 1}.jpg),${bg.startsWith('#') ? `linear-gradient(${bg},${bg})` : bg};`;
    if (label) el.innerHTML = `<span>${label}</span>`;
    stack.appendChild(el);
    return { el, rot, dx };
  });
  const TAIL = 4;                        // сколько карточек видно в хвосте
  const T_START = -TAIL, T_END = cards.length - 3;

  function placeCards(t) {
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], s = i - t;     // 0 — главная, >0 — в хвосте, <0 — ушла под новую
      const el = c.el.style;
      if (s < -1 || s > TAIL + 0.5) { el.opacity = 0; el.visibility = 'hidden'; continue; }
      el.visibility = 'visible';
      if (s < 0) {                       // прежняя главная: остаётся под новой и гаснет
        el.transform = `scale(${1 + s * 0.06})`;
        el.opacity = Math.max(0, 1 + s * 1.6);
        el.zIndex = 0;
        continue;
      }
      const m = Math.min(1, s);
      const y = -330 * (1 - 1 / (1 + 0.9 * s));
      const sc = 1 / (1 + 1.35 * s);
      el.transform = `translate(${c.dx * m}px, ${y}px) rotate(${c.rot * m}deg) scale(${sc})`;
      el.opacity = Math.max(0, Math.min(1, (TAIL + 0.5 - s) / 1.2));
      el.zIndex = Math.round(100 - s * 10);
    }
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function onHow() {
    const r = how.getBoundingClientRect();
    const vh = window.innerHeight;
    const entered = vh - r.top;                        // сколько блок уже проехал от низа экрана
    const p = easeOut(clamp01(entered / (vh * 1.1)));  // раскрытие: старт при заходе, финиш чуть после закрепления
    howCard.style.setProperty('--p', p.toFixed(4));
    const total = r.height;                            // весь путь: от захода до открепления
    const q = clamp01(entered / (total * 0.92));       // хвост 8% — пауза на последней карточке
    placeCards(T_START + (T_END - T_START) * q);
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
