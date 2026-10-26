/* Hero: анимированный P&L агента Nexus за 30 дней */
(() => {
  const $ = id => document.getElementById(id);
  const line = $('heroLine');
  if (!line) return;
  const vals = [0, 14, 6, 47, 33, 91, 70, 124, 97, 161, 139, 183, 157, 224, 202, 268, 239, 285, 261, 321, 296, 341, 318, 369, 346, 379, 362, 386, 371, 418, 402, 460];
  const max = 490, duration = 22000, hold = 4500;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let elapsed = reduced ? duration : 0, last = performance.now(), paused = reduced, visible = true;
  const btn = $('heroPause');

  function draw() {
    const progress = Math.min(1, elapsed / duration);
    const pos = progress * (vals.length - 1), i = Math.floor(pos), f = pos - i;
    const value = vals[i] + ((vals[i + 1] ?? vals[i]) - vals[i]) * f;
    const pts = vals.slice(0, i + 1).map((v, k) => [8 + k / (vals.length - 1) * 724, 150 - v / max * 136]);
    if (f > 0) pts.push([8 + pos / (vals.length - 1) * 724, 150 - value / max * 136]);
    const d = pts.map(([x, y], k) => (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join('');
    const [x, y] = pts[pts.length - 1];
    line.setAttribute('d', d);
    $('heroArea').setAttribute('d', d + `L${x} 160L8 160Z`);
    for (const id of ['heroDot', 'heroHalo']) { $(id).setAttribute('cx', x); $(id).setAttribute('cy', y); }
    $('heroPnl').textContent = '+' + AS.fmt.usd(value);
    $('heroReturn').textContent = '+' + (value / 100).toFixed(2) + '%';
    const day = 1 + Math.round(progress * 29);
    $('heroDay').textContent = 'ДЕНЬ ' + String(day).padStart(2, '0') + ' / 30';
    $('heroTrades').textContent = 'СДЕЛОК: ' + Math.round(progress * 352);
  }
  function label() { btn.textContent = paused ? 'Пуск' : 'Пауза'; }
  btn.addEventListener('click', () => { paused = !paused; label(); });
  new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(line.closest('svg'));
  function frame(now) {
    const dt = Math.min(250, now - last); last = now;
    if (!paused && visible && !document.hidden) {
      elapsed += dt;
      if (elapsed > duration + hold) elapsed = 0;
      draw();
    }
    requestAnimationFrame(frame);
  }
  label(); draw(); requestAnimationFrame(frame);
})();
