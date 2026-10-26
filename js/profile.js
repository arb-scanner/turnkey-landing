/* Блок 5 — профиль агента в стиле копи-трейдинга; блок 6 — сравнительная статистика агентов */
(() => {
  const $ = id => document.getElementById(id);
  const F = AS.fmt;
  const CAPITAL = 10000;
  const SVG = 'http://www.w3.org/2000/svg';

  /* ================= Блок 5 ================= */
  const tabsEl = $('agentTabs');
  if (tabsEl) {
    let agent = AS.agents[2], period = 30, mode = 'roi';

    tabsEl.innerHTML = AS.agents.map(a =>
      `<button class="agent-tab${a === agent ? ' is-on' : ''}" type="button" role="tab" aria-selected="${a === agent}" data-id="${a.id}"><img src="img/agents/${a.id}-sm.webp" alt="">${a.name}</button>`).join('');
    tabsEl.addEventListener('click', e => {
      const b = e.target.closest('.agent-tab'); if (!b) return;
      agent = AS.agents.find(a => a.id === b.dataset.id);
      [...tabsEl.children].forEach(x => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
      renderAll();
    });
    segment($('pfPeriod'), 'p', v => { period = Number(v); renderAll(); });
    segment($('pfMode'), 'm', v => { mode = v; renderChart(); });

    function renderAll() {
      const p = agent.perf[period];
      const dd = AS.maxDD(AS.curve(agent.id, period, p.roi, p.dd));
      const pnl = CAPITAL * p.roi / 100;
      $('pfAva').src = `img/agents/${agent.id}-sm.webp`;
      $('pfAva').alt = 'ИИ-агент ' + agent.name;
      $('pfName').textContent = agent.name;
      $('pfSub').textContent = 'ИИ-агент · ' + agent.sub;
      $('pfTags').innerHTML = agent.tags.map(([t, c]) => `<span class="tag ${c}">${t}</span>`).join('');
      $('pfRoiLabel').textContent = `ROI за ${period} ${days(period)}`;
      $('pfRoi').textContent = F.pct(p.roi);
      $('pfMeta').innerHTML = `<span>В работе <b>${agent.days} ${days(agent.days)}</b></span><span>Капитал агента <b>${F.usd(CAPITAL, 0)}</b></span><span>Бирж <b>${agent.exchanges.length}</b></span><span>Стратегий <b>${agent.strategies.length}</b></span>`;

      const fees = pnl * agent.fees / (1 - agent.fees);
      const fund = pnl * agent.funding;
      const kpis = [
        ['ROI', F.pct(p.roi), 'pos'],
        ['P&L', F.signUsd(pnl), 'pos'],
        ['Прибыльных сделок', p.win + '%', ''],
        ['Макс. просадка', '−' + dd.toFixed(2) + '%', 'neg'],
        ['Сделок за период', F.int(p.trades), ''],
        ['Среднее время в сделке', agent.hold, ''],
        ['Комиссии бирж', '−' + F.usd(fees), ''],
        ['Фандинг получен', fund ? F.signUsd(fund) : '$0.00', fund ? 'pos' : '']
      ];
      $('pfKpis').innerHTML = kpis.map(([k, v, c]) => `<div class="kpi"><small>${k}</small><b class="${c}">${v}</b></div>`).join('');

      // стратегии — пончик
      const total = agent.strategies.reduce((s, x) => s + x[1], 0);
      let acc = 0;
      const R = 46, C = 2 * Math.PI * R;
      const arcs = agent.strategies.map(([n, v]) => {
        const len = v / total * C;
        const gap = agent.strategies.length > 1 ? 2 : 0;
        const seg = `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${AS.stratColors[n]}" stroke-width="16" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-acc}" transform="rotate(-90 60 60)"/>`;
        acc += len; return seg;
      }).join('');
      $('pfStrat').innerHTML = `<svg viewBox="0 0 120 120" role="img" aria-label="Доля прибыли по стратегиям">${arcs}<text x="60" y="57" text-anchor="middle" font-size="11" fill="#6b7682">стратегий</text><text x="60" y="76" text-anchor="middle" font-size="20" font-weight="600" fill="#1f2a35">${agent.strategies.length}</text></svg>` +
        `<div class="legend">${agent.strategies.map(([n, v]) => `<div><i style="background:${AS.stratColors[n]}"></i><span>${n}</span><b>${v}%</b></div>`).join('')}</div>`;

      // токены
      const tmax = Math.max(...agent.tokens.map(t => t[1]));
      $('pfTokens').innerHTML = agent.tokens.map(([n, v], i) =>
        `<div class="bar-row"><span>${n}</span><span>${v}%</span><i><u style="width:${v / tmax * 100}%;background:${i === agent.tokens.length - 1 ? '#c3cad2' : 'linear-gradient(90deg,#2d6bf6,#6b9bff)'}"></u></i></div>`).join('');

      $('pfEx').innerHTML = agent.exchanges.map(x => `<span>${x}</span>`).join('');

      renderChart();
      renderTrades(p);
    }

    /* график доходности с подсказкой при наведении */
    const wrap = $('pfChart'), tip = $('pfTip');
    let chartState = null;
    function renderChart() {
      const p = agent.perf[period];
      const roiPts = AS.curve(agent.id, period, p.roi, p.dd);
      const vals = mode === 'roi' ? roiPts : roiPts.map(v => v / 100 * CAPITAL);
      const W = wrap.clientWidth || 600, H = wrap.clientHeight || 260;
      const padL = 52, padR = 12, padT = 12, padB = 26;
      let lo = Math.min(0, ...vals), hi = Math.max(...vals);
      const span = hi - lo || 1; lo -= span * 0.08; hi += span * 0.1;
      const x = i => padL + i / (vals.length - 1) * (W - padL - padR);
      const y = v => padT + (hi - v) / (hi - lo) * (H - padT - padB);
      const end = new Date();
      const date = i => { const d = new Date(end.getTime() - (1 - i / (vals.length - 1)) * period * 864e5); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }); };
      const fmtV = v => mode === 'roi' ? F.pct(v) : F.signUsd(v, 0);

      let g = '';
      for (let k = 0; k <= 4; k++) {
        const v = lo + (hi - lo) * k / 4, yy = y(v).toFixed(1);
        g += `<line x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke="#eef1f5"/><text x="${padL - 8}" y="${yy}" dy="4" text-anchor="end" font-size="11" fill="#97a1ab">${mode === 'roi' ? v.toFixed(1) + '%' : '$' + Math.round(v)}</text>`;
      }
      const zero = y(0).toFixed(1);
      g += `<line x1="${padL}" x2="${W - padR}" y1="${zero}" y2="${zero}" stroke="#c9d2de" stroke-dasharray="3 4"/>`;
      for (let k = 0; k < 5; k++) {
        const i = Math.round(k / 4 * (vals.length - 1));
        g += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}" font-size="11" fill="#97a1ab">${date(i)}</text>`;
      }
      const line = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('');
      const area = line + `L${x(vals.length - 1).toFixed(1)} ${zero}L${x(0).toFixed(1)} ${zero}Z`;
      wrap.querySelector('svg')?.remove();
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', `График доходности агента ${agent.name} за ${period} ${days(period)}`);
      svg.innerHTML = `<defs><linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#1f9d63" stop-opacity=".22"/><stop offset="1" stop-color="#1f9d63" stop-opacity="0"/></linearGradient></defs>${g}<path d="${area}" fill="url(#pfFill)"/><path d="${line}" fill="none" stroke="#1f9d63" stroke-width="2.2" stroke-linejoin="round"/><line id="pfCross" y1="${padT}" y2="${H - padB}" stroke="#97a1ab" stroke-dasharray="3 3" opacity="0"/><circle id="pfDot" r="5" fill="#1f9d63" stroke="#fff" stroke-width="2" opacity="0"/><rect x="${padL}" y="0" width="${W - padL - padR}" height="${H}" fill="transparent"/>`;
      wrap.insertBefore(svg, tip);
      chartState = { vals, x, y, date, fmtV, W };
    }
    function hover(clientX) {
      if (!chartState) return;
      const r = wrap.getBoundingClientRect();
      const { vals, x, y, date, fmtV } = chartState;
      const rel = clientX - r.left;
      let best = 0, bd = Infinity;
      vals.forEach((v, i) => { const d = Math.abs(x(i) - rel); if (d < bd) { bd = d; best = i; } });
      const cx = x(best), cy = y(vals[best]);
      const cross = wrap.querySelector('#pfCross'), dot = wrap.querySelector('#pfDot');
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', 1);
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('opacity', 1);
      tip.innerHTML = `${date(best)}<b>${fmtV(vals[best])}</b>`;
      tip.style.left = Math.max(60, Math.min(r.width - 60, cx)) + 'px';
      tip.style.top = cy + 'px';
      tip.style.opacity = 1;
    }
    function leave() {
      tip.style.opacity = 0;
      wrap.querySelector('#pfCross')?.setAttribute('opacity', 0);
      wrap.querySelector('#pfDot')?.setAttribute('opacity', 0);
    }
    wrap.addEventListener('pointermove', e => hover(e.clientX));
    wrap.addEventListener('pointerleave', leave);
    wrap.addEventListener('pointerdown', e => hover(e.clientX));
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderChart, 120); });

    /* последние сделки */
    function renderTrades(p) {
      const rand = AS.rng(agent.id + ':trades');
      const pick = arr => { const tot = arr.reduce((s, x) => s + x[1], 0); let r = rand() * tot; for (const x of arr) { r -= x[1]; if (r <= 0) return x[0]; } return arr[0][0]; };
      const tokens = agent.tokens.filter(t => t[0] !== 'Другие');
      const scale = { scout: 0.7, vector: 1, nexus: 1.3, atlas: 1.7 }[agent.id];
      const now = new Date();
      let ago = 6 + rand() * 20;
      const rows = [];
      for (let i = 0; i < 8; i++) {
        const strat = pick(agent.strategies);
        const tok = pick(tokens);
        const ex = agent.exchanges.slice();
        const e1 = ex.splice(Math.floor(rand() * ex.length), 1)[0];
        const e2 = ex[Math.floor(rand() * ex.length)] || e1;
        const vol = Math.round((1500 + rand() * 4500) * scale / 10) * 10;
        let spread = 0.4 + rand() * 1.8, minutes, funding = 0, route;
        if (strat === 'Фандинг') {
          spread = 0.05 + rand() * 0.2;
          minutes = 24 * 60 * (1 + rand() * 2);
          funding = vol * 0.00045 * (3 + Math.floor(rand() * 6));
          route = `<b>${e1}</b> спот + <b>${e1}</b> шорт`;
        } else if (strat === 'Треугольный') {
          spread = 0.25 + rand() * 0.5; minutes = 1 + rand() * 4;
          route = `<b>${e1}</b> · ${tok}/USDT → ${tok}/BTC → BTC/USDT`;
        } else if (strat === 'Спот + спот') {
          minutes = 15 + rand() * 120; route = `<b>${e1}</b> покупка → <b>${e2}</b> продажа`;
        } else if (strat === 'Спот + фьючерс') {
          minutes = 20 + rand() * 200; funding = (rand() - 0.3) * 3;
          route = `<b>${e1}</b> спот → <b>${e2}</b> фьюч. шорт`;
        } else {
          minutes = 10 + rand() * 180; funding = (rand() - 0.4) * 4;
          route = `<b>${e1}</b> лонг → <b>${e2}</b> шорт`;
        }
        const fee = vol * 0.0018;
        const lose = i === (agent.id === 'scout' ? 4 : 6);
        const gross = lose ? -vol * (0.001 + rand() * 0.002) : vol * spread / 100 * (0.55 + rand() * 0.35);
        const net = gross - fee + funding;
        rows.push({ when: new Date(now - ago * 60000), tok, strat, route, spread, vol, fee, funding, minutes, net });
        ago += 40 + rand() * 260;
      }
      $('pfTrades').innerHTML = rows.map(r => `<tr>
        <td class="mono">${when(r.when)}<small class="dur">в сделке ${dur(r.minutes)}</small></td>
        <td><b class="pair">${r.tok}-USDT</b><span class="strat">${r.strat}</span></td>
        <td class="route-s">${r.route}</td>
        <td class="r mono">${r.spread.toFixed(2)}%</td>
        <td class="r mono">${F.usd(r.vol, 0)}</td>
        <td class="r mono">−${F.usd(r.fee)}</td>
        <td class="r mono ${r.funding > 0.005 ? 'pos' : r.funding < -0.005 ? 'neg' : ''}">${Math.abs(r.funding) < 0.005 ? '$0.00' : F.signUsd(r.funding)}</td>
        <td class="r mono"><b class="${r.net >= 0 ? 'pos' : 'neg'}">${F.signUsd(r.net)}</b></td></tr>`).join('');
      $('pfTradesNote').textContent = `Пример: 8 из ${F.int(p.trades)} сделок за ${period} ${days(period)}`;
    }

    renderAll();
  }

  function when(d) {
    const now = new Date();
    const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const dayDiff = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
    if (dayDiff === 0) return 'сегодня, ' + hm;
    if (dayDiff === 1) return 'вчера, ' + hm;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ', ' + hm;
  }
  function dur(m) {
    if (m < 60) return Math.max(1, Math.round(m)) + ' мин';
    if (m < 24 * 60) return Math.floor(m / 60) + ' ч ' + String(Math.round(m % 60)).padStart(2, '0') + ' мин';
    return Math.floor(m / 1440) + ' д ' + Math.round((m % 1440) / 60) + ' ч';
  }
  function days(n) {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return 'день';
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
    return 'дней';
  }
  function segment(el, key, cb) {
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      [...el.children].forEach(x => x.classList.toggle('is-on', x === b));
      cb(b.dataset[key]);
    });
  }

  /* ================= Блок 6 ================= */
  const body = $('stBody');
  if (body) {
    let period = 90, cap = 10000;
    const input = $('stCap');
    segment($('stPeriod'), 'p', v => { period = Number(v); renderStats(); });
    input.addEventListener('input', () => {
      const digits = input.value.replace(/\D/g, '').slice(0, 9);
      cap = Number(digits) || 0;
      const pos = input.selectionStart, before = input.value.length;
      input.value = digits ? Number(digits).toLocaleString('ru-RU') : '';
      const delta = input.value.length - before;
      try { input.setSelectionRange(pos + delta, pos + delta); } catch (e) {}
      renderStats();
    });
    function renderStats() {
      $('stPeriodLabel').textContent = `Условные сценарии за ${period} ${days(period)}`;
      body.innerHTML = AS.agents.map(a => {
        const p = a.perf[period];
        const pts = AS.curve(a.id, period, p.roi, p.dd);
        const dd = AS.maxDD(pts);
        const lo = Math.min(...pts), hi = Math.max(...pts);
        const sx = i => (i / (pts.length - 1) * 166 + 2).toFixed(1);
        const sy = v => (40 - (v - lo) / (hi - lo || 1) * 34).toFixed(1);
        const d = pts.map((v, i) => (i ? 'L' : 'M') + sx(i) + ' ' + sy(v)).join('');
        return `<tr>
          <td><div class="st-agent"><img src="img/agents/${a.id}-sm.webp" alt=""><div><b>${a.name}</b><small>${a.conn}</small></div></div></td>
          <td class="st-pnl" data-l="Торговый P&amp;L">${F.signUsd(cap * p.roi / 100)}</td>
          <td data-l="Доходность"><span class="st-ret"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M9 7h8v8" stroke-linecap="round" stroke-linejoin="round"/></svg>${F.pct(p.roi)}</span></td>
          <td class="st-dd" data-l="Макс. просадка">−${dd.toFixed(2)}%</td>
          <td data-l="График"><svg class="st-spark" viewBox="0 0 170 46" aria-hidden="true"><path d="M2 42H168" stroke="rgba(255,255,255,.18)"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><circle cx="${sx(pts.length - 1)}" cy="${sy(pts[pts.length - 1])}" r="3.5" fill="#fff"/></svg></td>
        </tr>`;
      }).join('');
    }
    renderStats();
  }
})();
