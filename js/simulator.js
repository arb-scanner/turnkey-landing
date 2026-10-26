/* Симуляция межбиржевой сделки TRC-USDT: лонг Binance + шорт Bybit.
   Математика сценария: 2 000 TRC в каждой ноге.
   Лонг  Binance 9.8990 → 10.2990 = +$800
   Шорт  Bybit  10.0940 → 10.2990 = −$410
   Комиссии 4 × $2.50 = −$10, фандинг $0, итог +$380. */
(() => {
  const $ = id => document.getElementById(id);
  const root = $('sim');
  if (!root) return;

  const Q = 2000, IN_A = 9.899, IN_B = 10.094, OUT = 10.299, FEE = 2.5;
  const T_OPEN = 7, T_CONV = 9, T_CLOSE = 31, T_END = 40, HIST = 44, VIEW = 58;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const env = t => Math.min(1, Math.abs(t - T_OPEN) / 0.7) * Math.min(1, Math.abs(t - T_CLOSE) / 0.7);
  const noise = (t, k) => (Math.sin(t * 2.3 + k) * 0.6 + Math.sin(t * 5.7 + k * 2) * 0.4);

  /* Цены на обеих биржах в момент t (секунды симуляции; 1 с = 1 минутная свеча) */
  function prices(t) {
    if (t < 0) {
      const base = 10 + Math.sin(t * 0.21) * 0.0035 + Math.sin(t * 0.83) * 0.0018;
      return [base, base + 0.0005 + Math.sin(t * 1.3) * 0.0004];
    }
    let a, b;
    if (t < 2.5) {
      a = 10 + noise(t, 1) * 0.0018;
      b = 10.0005 + noise(t, 1.4) * 0.0018;
    } else if (t < T_OPEN) {
      const q = ease((t - 2.5) / (T_OPEN - 2.5));
      a = 10 - 0.101 * q + noise(t, 2) * 0.006 * env(t);
      b = 10.0005 + 0.0935 * q + noise(t, 3) * 0.006 * env(t);
    } else if (t < T_CONV) {
      a = IN_A + noise(t, 4) * 0.004 * env(t);
      b = IN_B + noise(t, 5) * 0.004 * env(t);
    } else if (t < T_CLOSE) {
      const p = (t - T_CONV) / (T_CLOSE - T_CONV);
      const base = 9.9965 + 0.3025 * ease(p) + Math.sin(p * Math.PI * 5) * 0.035 * Math.sin(p * Math.PI);
      let s = 0.195 * (1 - ease(Math.pow(p, 0.85))) + Math.sin(p * Math.PI * 3) * 0.022 * Math.sin(p * Math.PI);
      s = Math.max(0, s);
      a = base - s / 2 + noise(t, 6) * 0.007 * env(t) * Math.sin(p * Math.PI);
      b = base + s / 2 + noise(t, 7) * 0.007 * env(t) * Math.sin(p * Math.PI);
    } else {
      const k = Math.min(1, (t - T_CLOSE) / 1.2);
      const drift = Math.sin((t - T_CLOSE) * 0.9) * 0.006 * k;
      a = OUT + drift + noise(t, 8) * 0.002 * k;
      b = OUT + drift + 0.0006 * k + noise(t, 8.3) * 0.002 * k;
    }
    return [a, b];
  }

  function candle(i, venue, now) {
    const t0 = i, t1 = Math.min(i + 1, now);
    const pts = [];
    for (let j = 0; j <= 6; j++) pts.push(prices(t0 + (t1 - t0) * j / 6)[venue]);
    const open = pts[0], close = pts[pts.length - 1];
    const w = 0.0012 + hash(i * 3 + venue) * 0.0035;
    return { open, close, high: Math.max(...pts) + w * hash(i + venue * 7), low: Math.min(...pts) - w * hash(i * 5 + venue) };
  }

  /* ---------- Канвас со свечами ---------- */
  const canvases = [$('chartA'), $('chartB')];
  function drawChart(venue, now) {
    const cv = canvases[venue];
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const last = Math.floor(now);
    const from = last - VIEW + 1;
    const list = [];
    for (let i = from; i <= last; i++) list.push(candle(i, venue, now));
    let lo = Infinity, hi = -Infinity;
    list.forEach(c => { lo = Math.min(lo, c.low); hi = Math.max(hi, c.high); });
    const opened = now >= T_OPEN;
    const entry = venue ? IN_B : IN_A;
    if (opened) { lo = Math.min(lo, entry); hi = Math.max(hi, entry); }
    const pad = Math.max(0.004, (hi - lo) * 0.14);
    lo -= pad; hi += pad;

    const axisW = 58, top = 10, bottom = h - 22, plotW = w - axisW - 6;
    const y = v => top + (hi - v) / (hi - lo) * (bottom - top);

    // сетка и подписи
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    const step = niceStep((hi - lo) / 5);
    ctx.strokeStyle = '#eef1f5'; ctx.lineWidth = 1; ctx.fillStyle = '#97a1ab';
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
      const yy = Math.round(y(v)) + .5;
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(plotW, yy); ctx.stroke();
      ctx.fillText(v.toFixed(4), plotW + 8, yy);
    }
    // время внизу
    ctx.textBaseline = 'alphabetic';
    const slot = plotW / VIEW;
    for (let k = 0; k < VIEW; k += 14) {
      const idx = from + k;
      const x = k * slot + slot / 2;
      ctx.fillText(clock(idx), x - 14, h - 6);
    }
    // свечи
    const cw = Math.max(2, slot * 0.62);
    list.forEach((c, k) => {
      const x = k * slot + slot / 2;
      const up = c.close >= c.open;
      ctx.strokeStyle = ctx.fillStyle = up ? '#22b06c' : '#ec5b6c';
      ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, y(c.high)); ctx.lineTo(Math.round(x) + .5, y(c.low)); ctx.stroke();
      const yo = y(c.open), yc = y(c.close);
      ctx.fillRect(x - cw / 2, Math.min(yo, yc), cw, Math.max(1, Math.abs(yo - yc)));
    });
    // линия входа
    if (opened) {
      const ye = Math.round(y(entry)) + .5;
      const col = venue ? '#ec5b6c' : '#22b06c';
      ctx.setLineDash([4, 4]); ctx.strokeStyle = col;
      ctx.beginPath(); ctx.moveTo(0, ye); ctx.lineTo(plotW, ye); ctx.stroke(); ctx.setLineDash([]);
      const txt = (venue ? 'ШОРТ ' : 'ЛОНГ ') + entry.toFixed(4);
      ctx.font = '600 10px ui-monospace, Menlo, monospace';
      const tw = ctx.measureText(txt).width + 10;
      ctx.fillStyle = col; roundRect(ctx, 6, ye - 9, tw, 17, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 11, ye + .5);
    }
    // метка текущей цены
    const cur = prices(now)[venue];
    const yc = Math.round(y(cur)) + .5;
    const lastUp = list[list.length - 1].close >= list[list.length - 1].open;
    const col = lastUp ? '#22b06c' : '#ec5b6c';
    ctx.strokeStyle = col; ctx.setLineDash([1, 3]);
    ctx.beginPath(); ctx.moveTo(0, yc); ctx.lineTo(plotW, yc); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = col; roundRect(ctx, plotW + 2, yc - 9, axisW - 2, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle';
    ctx.fillText(cur.toFixed(4), plotW + 7, yc + .5);
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function clock(minIdx) {
    const m = 14 * 60 + 2 + minIdx;
    const hh = Math.floor(((m % 1440) + 1440) % 1440 / 60), mm = ((m % 60) + 60) % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  /* ---------- Стаканы ---------- */
  const books = [$('bookA'), $('bookB')];
  const bookRows = books.map(el => {
    el.innerHTML = '<div class="book-h"><span>Цена</span><span>Объём</span><span>Сумма</span></div>' +
      '<div class="asks">' + '<div class="book-r ask"><span></span><span></span><span></span><i></i></div>'.repeat(5) + '</div>' +
      '<div class="book-mid"><span></span><small>спред $0.0010</small></div>' +
      '<div class="bids">' + '<div class="book-r bid"><span></span><span></span><span></span><i></i></div>'.repeat(5) + '</div>';
    return { asks: [...el.querySelectorAll('.ask')], bids: [...el.querySelectorAll('.bid')], mid: el.querySelector('.book-mid span') };
  });
  function drawBook(venue, now) {
    const p = prices(now)[venue];
    const tick = Math.floor(now * 2.5);
    const best = Math.round(p * 10000) / 10000;
    const rows = bookRows[venue];
    const sizes = [];
    for (let i = 0; i < 10; i++) sizes.push(180 + hash(tick * 13 + i * 7 + venue * 101) * 2200 + (i % 5) * 160);
    const mx = Math.max(...sizes);
    rows.asks.forEach((r, k) => {
      const lvl = 4 - k; // сверху дальние уровни
      const price = best + 0.0005 + lvl * 0.001;
      setRow(r, price, sizes[lvl], mx);
    });
    rows.bids.forEach((r, k) => {
      const price = best - 0.0005 - k * 0.001;
      setRow(r, price, sizes[5 + k], mx);
    });
    rows.mid.textContent = '$' + best.toFixed(4);
  }
  function setRow(r, price, size, mx) {
    const s = r.children;
    s[0].textContent = price.toFixed(4);
    s[1].textContent = AS.fmt.int(size);
    s[2].textContent = '$' + AS.fmt.int(size * price);
    s[3].style.width = (size / mx * 100).toFixed(1) + '%';
  }
  function flash(venue, side) {
    const r = bookRows[venue][side][side === 'asks' ? 4 : 0];
    r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
  }

  /* ---------- Лог ---------- */
  const logEl = $('simLog');
  const events = [
    [0, () => 'Сканирую 10 бирж по 312 парам. TRC-USDT: цены на Binance и Bybit синхронны.'],
    [3, () => 'Расхождение по TRC-USDT: Binance дешевеет, Bybit растёт.'],
    [5.3, t => { const s = state(t); return 'Спред +' + (s.spread / s.a * 100).toFixed(2) + '% — ниже порога входа 1.5%. Жду.'; }],
    [T_OPEN, () => 'Связка +1.97%. <b>Покупка</b> 2 000 TRC на Binance по $9.8990 · <b>шорт</b> 2 000 TRC на Bybit по $10.0940. Комиссии входа $5.00.'],
    [T_CONV, () => 'Обе ноги открыты, позиция дельта-нейтральна. Жду схождения цен.'],
    [16, t => { const s = state(t); return 'Рынок растёт: лонг ' + AS.fmt.signUsd(s.longPnl) + ', шорт ' + AS.fmt.signUsd(s.shortPnl) + ' — нетто ' + AS.fmt.signUsd(s.longPnl + s.shortPnl - 5) + '.'; }],
    [24, t => { const s = state(t); return 'Спред сузился до ' + (s.spread / s.a * 100).toFixed(2) + '%. Держу позиции до полного схождения.'; }],
    [T_CLOSE, () => 'Цены сошлись на $10.2990. Закрываю лонг (<b>+$800.00</b>) и шорт (<b>−$410.00</b>). Комиссии выхода $5.00.'],
    [T_CLOSE + 1.5, () => 'Сделка закрыта: <b>+$380.00</b> чистыми. Возвращаюсь к сканированию.']
  ];
  let fired = 0;
  function pushLog(t, html) {
    const div = document.createElement('div');
    div.innerHTML = '<em>' + clock(Math.floor(t)) + '</em>[NEXUS] ' + html;
    logEl.appendChild(div);
    while (logEl.children.length > 5) logEl.firstChild.remove();
  }

  /* ---------- Состояние и отрисовка ---------- */
  function state(t) {
    const [a, b] = prices(t);
    const opened = t >= T_OPEN, closed = t >= T_CLOSE;
    const longPnl = opened ? (closed ? 800 : Q * (a - IN_A)) : 0;
    const shortPnl = opened ? (closed ? -410 : Q * (IN_B - b)) : 0;
    const phase = t < T_OPEN ? 0 : t < T_CONV ? 1 : t < T_CLOSE ? 2 : 3;
    return { a, b, opened, closed, longPnl, shortPnl, phase, spread: b - a };
  }

  const PH = ['Поиск спреда', 'Открытие парных позиций', 'Ожидание схождения', 'Обе позиции закрыты'];
  const phaseEls = [...$('simPhases').children];
  let lastPhase = -1, resultShown = false;

  function setText(id, v) { const el = $(id); if (el.textContent !== v) el.textContent = v; }
  function setCls(id, cls) { const el = $(id); if (el.className !== cls) el.className = cls; }
  const money = v => (v >= 0 ? '+' : '−') + '$' + Math.abs(v).toFixed(2);

  function render(t) {
    const s = state(t);
    setText('priceA', '$' + s.a.toFixed(4));
    setText('priceB', '$' + s.b.toFixed(4));
    const ca = (s.a / 10 - 1) * 100, cb = (s.b / 10.0005 - 1) * 100;
    setText('chgA', AS.fmt.pct(ca)); setCls('chgA', ca >= 0 ? 'pos' : 'neg');
    setText('chgB', AS.fmt.pct(cb)); setCls('chgB', cb >= 0 ? 'pos' : 'neg');

    // строка сигнала
    const pr = s.spread / s.a * 100;
    setText('sigBuy', '$' + s.a.toFixed(4));
    setText('sigSell', '$' + s.b.toFixed(4));
    setText('sigProfit', AS.fmt.pct(s.opened && !s.closed ? 1.97 : pr));
    setCls('sigProfit', 'pill ' + (pr > 0.5 || (s.opened && !s.closed) ? 'pos' : 'muted'));
    setText('sigState', s.closed ? 'Сделка закрыта' : s.opened ? 'Позиция открыта' : pr > 0.5 ? 'Спред растёт…' : 'Поиск связки…');
    setText('sigIn', s.opened ? '+1.97%' : '—');
    setText('sigOut', s.closed ? '0.00%' : '—');
    $('sigRow').classList.toggle('is-found', s.opened || pr > 1);

    // ноги
    setText('sideA', s.closed ? 'ЛОНГ ЗАКРЫТ' : s.opened ? '↑ ЛОНГ · ПОКУПКА' : 'СКАНИРОВАНИЕ');
    setText('sideB', s.closed ? 'ШОРТ ЗАКРЫТ' : s.opened ? '↓ ШОРТ · ПРОДАЖА' : 'СКАНИРОВАНИЕ');
    setCls('sideA', 'side' + (s.closed ? ' closed' : s.opened ? ' long' : ''));
    setCls('sideB', 'side' + (s.closed ? ' closed' : s.opened ? ' short' : ''));
    setText('entryA', s.opened ? '$' + IN_A.toFixed(4) : '—');
    setText('entryB', s.opened ? '$' + IN_B.toFixed(4) : '—');
    setText('pnlA', money(s.longPnl)); setCls('pnlA', s.longPnl > 0.004 ? 'pos' : s.longPnl < -0.004 ? 'neg' : '');
    setText('pnlB', money(s.shortPnl)); setCls('pnlB', s.shortPnl > 0.004 ? 'pos' : s.shortPnl < -0.004 ? 'neg' : '');

    // статус
    setText('stPhase', PH[s.phase]);
    setText('stSpread', '$' + Math.abs(s.closed ? 0 : s.spread).toFixed(4));
    const net = s.closed ? 380 : s.opened ? s.longPnl + s.shortPnl - 2 * FEE : 0;
    setText('stPnlLabel', s.closed ? 'Реализованный чистый P&L' : 'Нереализованный P&L − комиссии входа');
    setText('stPnl', money(net)); setCls('stPnl', net > 0.004 ? 'pos' : net < -0.004 ? 'neg' : '');
    $('simProgress').style.width = Math.min(100, t / T_END * 100).toFixed(2) + '%';

    if (s.phase !== lastPhase) {
      phaseEls.forEach((el, i) => { el.classList.toggle('is-on', i === s.phase && s.phase < 3); el.classList.toggle('is-done', i < s.phase || s.phase === 3); });
      if (s.phase === 1 && lastPhase === 0) { flash(0, 'asks'); flash(1, 'bids'); }
      if (s.phase === 3 && lastPhase === 2) { flash(0, 'bids'); flash(1, 'asks'); }
      lastPhase = s.phase;
    }
    while (fired < events.length && t >= events[fired][0]) { pushLog(events[fired][0], events[fired][1](events[fired][0])); fired++; }

    // итог
    if (s.closed && !resultShown) showResult(true);
    if (!s.closed && resultShown) showResult(false);

    drawChart(0, t); drawChart(1, t);
    drawBook(0, t); drawBook(1, t);
  }

  const resRows = [['rLong', '+$800.00', 'pos'], ['rShort', '−$410.00', 'neg'], ['rFee', '−$10.00', 'neg'], ['rFund', '$0.00', ''], ['rTotal', '+$380.00', 'pos']];
  let resTimers = [];
  function showResult(on) {
    resultShown = on;
    resTimers.forEach(clearTimeout); resTimers = [];
    setText('resState', on ? 'закрыта' : 'в процессе');
    $('resState').classList.toggle('done', on);
    $('conclusion').classList.toggle('is-on', on);
    resRows.forEach(([id, v, c], i) => {
      if (!on) { setText(id, '—'); setCls(id, ''); return; }
      const apply = () => { setText(id, v); setCls(id, c); };
      if (reduced) apply(); else resTimers.push(setTimeout(apply, 140 * i));
    });
  }

  /* ---------- Управление ---------- */
  let t = 0, speed = 1, playing = !reduced, visible = false, last = performance.now(), hold = 0;
  const playBtn = $('simPlay'), live = $('simLive');
  function syncPlay() {
    playBtn.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    playBtn.querySelector('span').textContent = playing ? 'Пауза' : 'Пуск';
    live.classList.toggle('is-paused', !playing);
    live.querySelector('span').textContent = playing ? 'LIVE' : 'ПАУЗА';
  }
  function restart() {
    t = 0; hold = 0; fired = 0; lastPhase = -1; logEl.innerHTML = '';
    showResult(false); render(t);
  }
  playBtn.addEventListener('click', () => {
    if (t >= T_END) { restart(); playing = true; } else playing = !playing;
    last = performance.now(); syncPlay();
  });
  $('simReplay').addEventListener('click', () => { restart(); playing = true; last = performance.now(); syncPlay(); });
  $('simSpeed').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    speed = Number(b.dataset.speed);
    [...$('simSpeed').children].forEach(x => x.classList.toggle('is-on', x === b));
  });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0.05 }).observe(root);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => render(t), 80); });

  let paintAt = 0;
  function frame(now) {
    const dt = Math.min(200, now - last); last = now;
    if (playing && visible && !document.hidden) {
      if (t < T_END) t = Math.min(T_END, t + dt / 1000 * speed);
      else { hold += dt; if (hold > 2500) restart(); }
      if (now - paintAt > 60) { render(t); paintAt = now; }
    }
    requestAnimationFrame(frame);
  }

  if (reduced) { t = T_CLOSE + 2; }
  syncPlay();
  render(t);
  requestAnimationFrame(frame);
})();
