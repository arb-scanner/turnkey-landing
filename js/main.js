/* Общая логика страницы: меню, якоря, появление блоков, подсказки, модалки, сравнение, стратегии, форма */
(() => {
  const $ = id => document.getElementById(id);
  const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];

  /* Мобильное меню */
  const burger = $('asBurger');
  const setNav = open => { document.body.classList.toggle('nav-open', open); burger.setAttribute('aria-expanded', open); };
  burger.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  $('asScrim').addEventListener('click', () => setNav(false));
  $$('#asSidebar a[href^="#"]').forEach(a => a.addEventListener('click', () => setNav(false)));

  /* Подсветка текущего раздела в топбаре */
  const anchors = $$('.as-anchors a');
  const sections = anchors.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      anchors.forEach(a => a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));

  /* Появление при скролле */
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); reveal.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 60 + 'ms'; reveal.observe(el); });

  /* Подсказка у заголовка тарифов: наведение на десктопе, тап на телефоне */
  $$('.hint').forEach(h => {
    const pop = h.querySelector('.hint-pop');
    const place = () => requestAnimationFrame(() => {
      pop.style.left = '0px'; pop.style.removeProperty('--arrow');
      const r = pop.getBoundingClientRect();
      if (!r.width) return;
      let shift = Math.min(0, window.innerWidth - 16 - r.right); // уводим влево, если вылезает справа
      if (r.left + shift < 16) shift = 16 - r.left;
      pop.style.left = shift + 'px';
      pop.style.setProperty('--arrow', Math.min(r.width - 30, Math.max(14, 22 - shift)) + 'px');
    });
    h.addEventListener('mouseenter', place);
    h.addEventListener('focus', place);
    h.addEventListener('click', e => { e.stopPropagation(); h.classList.toggle('is-open'); place(); });
  });
  document.addEventListener('click', () => $$('.hint.is-open').forEach(h => h.classList.remove('is-open')));

  /* Модалки */
  let lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.classList.add('is-open'); m.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    m.querySelector('.modal-close').focus();
  }
  function closeModal(m) {
    m.classList.remove('is-open'); m.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(m); }));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    $$('.modal.is-open').forEach(closeModal);
    $$('.hint.is-open').forEach(h => h.classList.remove('is-open'));
    setNav(false);
  });

  /* Подробнее о тарифе */
  const pm = $('planModal');
  $$('.plan').forEach(card => {
    const open = () => {
      $('mpImg').src = card.querySelector('.plan-img img').src;
      $('mpImg').alt = card.querySelector('.plan-img img').alt;
      $('mpNo').textContent = card.querySelector('.plan-no').textContent;
      $('mpName').textContent = card.querySelector('.plan-name').textContent;
      $('mpPrice').textContent = card.querySelector('.plan-price b').textContent;
      $('mpDesc').textContent = card.querySelector('.plan-desc').textContent;
      $('mpFit').textContent = card.querySelector('.plan-fit').textContent.replace(/^Кому подходит:\s*/, '');
      $('mpFeats').innerHTML = card.querySelector('.plan-feats').innerHTML;
      openModal(pm);
    };
    card.querySelector('.plan-more').addEventListener('click', open);
    card.querySelector('.plan-desc').addEventListener('click', open);
    card.querySelector('.plan-desc').style.cursor = 'pointer';
  });

  /* Лайтбокс скриншотов кейсов */
  const lb = $('lightbox');
  $$('.shot').forEach(b => b.addEventListener('click', () => {
    $('lbImg').src = b.dataset.full;
    $('lbImg').alt = b.querySelector('img').alt;
    $('lbCap').textContent = b.dataset.cap || '';
    openModal(lb);
  }));

  /* Сравнение тарифов */
  const table = $('cmpTable');
  if (table) {
    const check = '<span class="ck-y" aria-label="есть"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg></span>';
    const dash = '<span class="ck-n" aria-label="нет">—</span>';
    const cell = v => v === true ? check : v === false ? dash : v === 'VIP' ? '<span class="vip">VIP</span>' : v;
    const feat = i => AS.plans[i].feat ? ' class="is-feat"' : '';
    let html = '<thead><tr><th>Тариф</th>' + AS.plans.map((p, i) =>
      `<th${feat(i)}><div class="cmp-plan">${p.feat ? '<span class="pop">Популярный</span>' : ''}<b>${p.name}</b><span>${p.price}</span><a class="btn btn-sm ${p.feat ? 'btn-primary' : 'btn-ghost'}" href="${AS.BOT}" target="_blank" rel="noopener">Выбрать</a></div></th>`).join('') + '</tr></thead><tbody>';
    AS.compare.forEach(r => {
      const more = r.more ? ' more' : '';
      if (r.group) { html += `<tr class="grp${more}"><td colspan="6">${r.group}</td></tr>`; return; }
      html += `<tr class="${more.trim()}"><td><b>${r.t}</b><span>${r.d}</span></td>` + r.v.map((v, i) => `<td${feat(i)}>${cell(v)}</td>`).join('') + '</tr>';
    });
    table.innerHTML = html + '</tbody>';
    const box = $('compare-box'), tgl = $('cmpToggle');
    tgl.addEventListener('click', () => {
      const collapsed = box.classList.toggle('is-collapsed');
      tgl.setAttribute('aria-expanded', !collapsed);
      tgl.querySelector('span').textContent = collapsed ? 'Показать полное сравнение' : 'Свернуть сравнение';
      if (collapsed) box.scrollIntoView({ block: 'start' });
    });
  }

  /* Вкладки стратегий */
  const tabs = $$('.strat-tab'), panels = $$('.strat-panel');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => { x.classList.toggle('is-on', x === t); x.setAttribute('aria-selected', x === t); });
    panels.forEach(p => { p.hidden = p.dataset.s !== t.dataset.s; });
    if (matchMedia('(max-width:1180px)').matches) panels.find(p => !p.hidden).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  /* Форма: собираем сообщение, копируем, открываем саппорт-бота */
  const form = $('leadForm');
  const status = $('formStatus'), preview = $('formPreview'), msg = $('formMsg');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const name = (d.get('name') || '').trim();
    if (!name) { status.textContent = 'Укажите, как к вам обращаться.'; status.className = 'form-status err'; form.name.focus(); return; }
    if (!form.agree.checked) { status.textContent = 'Отметьте согласие, чтобы подготовить сообщение.'; status.className = 'form-status err'; return; }
    const country = (d.get('country') || '').trim(), details = (d.get('details') || '').trim();
    const lines = ['Здравствуйте! Хочу обсудить арбитраж под ключ (ИИ-агенты).', '', 'Имя: ' + name, 'Агент: ' + d.get('agent')];
    if (country) lines.push('Страна / регион: ' + country);
    if (details) lines.push('Биржи и требования: ' + details);
    lines.push('', 'Хочу уточнить стратегию, запуск и полную стоимость под мой капитал.');
    msg.value = lines.join('\n');
    preview.classList.add('is-on');
    status.textContent = 'Сообщение готово. Проверьте текст ниже — по кнопке он скопируется и откроется чат с поддержкой.';
    status.className = 'form-status';
    msg.focus();
  });
  $('formOpen').addEventListener('click', () => {
    const text = msg.value;
    const done = () => toast('Текст скопирован — вставьте его в чат с поддержкой');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() { msg.select(); try { document.execCommand('copy'); done(); } catch (err) { toast('Скопируйте текст вручную и вставьте в чат'); } }
  });

  let tt;
  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.classList.add('is-on');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('is-on'), 3200);
  }
})();
