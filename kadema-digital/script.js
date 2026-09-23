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
    document.getElementById('collage').style.setProperty('--k', Math.min(1, (vh - 80) / 992).toFixed(3));
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

  /* ---------- «Как это работает»: карточка раскрывается на весь экран ---------- */
  const ease = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function onHow() {
    const r = how.getBoundingClientRect();
    const range = r.height - howStage.getBoundingClientRect().height;
    const raw = Math.min(1, Math.max(0, -r.top / (range * 0.75))); // последние 25% — пауза в раскрытом виде
    howCard.style.setProperty('--p', ease(raw).toFixed(4));
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onHeader(); onHow(); ticking = false; });
  }

  fit();
  buildSlabs();
  onHeader();
  onHow();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { fit(); onHow(); });
})();
