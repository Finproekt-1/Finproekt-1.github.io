(function () {
  'use strict';
  var FP = window.FP || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var goal = function (g) { try { if (window.ym) window.ym(107596992, 'reachGoal', g); } catch (e) {} };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- toast ---------- */
  var toastT;
  function toast(msg, isErr) {
    var t = $('[data-toast]'); if (!t) return;
    t.textContent = msg; t.classList.remove('hidden');
    t.style.borderColor = isErr ? 'hsl(var(--destructive))' : '';
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 4500);
  }

  /* ---------- header ---------- */
  var header = $('[data-header]');
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      var solid = ['bg-background/95', 'backdrop-blur-md', 'shadow-sm'];
      if (y > 20) { header.classList.remove('bg-transparent'); solid.forEach(function (c) { header.classList.add(c); }); }
      else { header.classList.add('bg-transparent'); solid.forEach(function (c) { header.classList.remove(c); }); }
    }
    var top = $('[data-to-top]'); if (top) top.classList.toggle('hidden', y < 400);
  }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var tt = $('[data-to-top]'); if (tt) tt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  $$('[data-dropdown]').forEach(function (dd) {
    var btn = $('[data-dropdown-toggle]', dd), menu = $('[data-dropdown-menu]', dd);
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('hidden'); });
    document.addEventListener('click', function () { menu.classList.add('hidden'); });
  });
  var mt = $('[data-mobile-toggle]'), mm = $('[data-mobile-menu]');
  if (mt && mm) {
    mt.addEventListener('click', function () { mm.classList.toggle('hidden'); if (header) header.classList.add('bg-background/95', 'backdrop-blur-md'); });
    $$('a', mm).forEach(function (a) { a.addEventListener('click', function () { mm.classList.add('hidden'); }); });
  }

  /* ---------- accordion ---------- */
  $$('[data-acc]').forEach(function (b) {
    b.addEventListener('click', function () {
      var panel = document.getElementById(b.getAttribute('aria-controls'));
      var open = b.getAttribute('aria-expanded') === 'true';
      var group = b.closest('[data-orientation="vertical"].space-y-2') || document;
      $$('[data-acc]', group).forEach(function (o) {
        o.setAttribute('aria-expanded', 'false'); o.setAttribute('data-state', 'closed');
        var p = document.getElementById(o.getAttribute('aria-controls')); if (p) { p.hidden = true; p.setAttribute('data-state', 'closed'); }
        var item = o.closest('[data-state]').parentElement.closest('[data-state]'); if (item) item.setAttribute('data-state', 'closed');
        var ch = o.querySelector('svg'); if (ch) ch.style.transform = '';
      });
      if (!open && panel) {
        b.setAttribute('aria-expanded', 'true'); b.setAttribute('data-state', 'open'); panel.hidden = false; panel.setAttribute('data-state', 'open');
        var it = b.closest('h3').parentElement; if (it) it.setAttribute('data-state', 'open');
        var c = b.querySelector('svg'); if (c) c.style.transform = 'rotate(180deg)';
      }
    });
  });

  /* ---------- carousel (reviews) ---------- */
  $$('[data-car-track]').forEach(function (track) {
    var wrap = track.parentElement.parentElement, i = 0;
    var prev = $('[data-car-prev]', wrap), next = $('[data-car-next]', wrap);
    function perView() { return window.innerWidth >= 1024 ? 3 : 1; }
    function go(d) {
      var n = track.children.length, max = Math.max(0, n - perView());
      i = Math.min(max, Math.max(0, i + d));
      if (d > 0 && i === max && track.dataset.at === String(max)) i = 0;
      track.dataset.at = String(i);
      track.style.transform = 'translate3d(' + (-i * 100 / perView()) + '%,0,0)';
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    var sx = null;
    track.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); sx = null; });
  });

  /* ---------- dialogs ---------- */
  var overlay = $('[data-overlay]'), openDlg = null;
  function openDialog(name) {
    closeDialog();
    var d = $('[data-dialog="' + name + '"]'); if (!d) return;
    overlay.classList.remove('hidden'); d.classList.remove('hidden'); openDlg = d;
    document.body.style.overflow = 'hidden';
    var f = $('input:not([type=hidden]),button', d); if (f && name !== 'quiz') setTimeout(function () { f.focus(); }, 50);
  }
  function closeDialog() {
    if (!openDlg) return;
    openDlg.classList.add('hidden'); overlay.classList.add('hidden'); openDlg = null; document.body.style.overflow = '';
  }
  if (overlay) overlay.addEventListener('click', closeDialog);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDialog(); });
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeDialog); });
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); var n = o.getAttribute('data-open'); if (n === 'quiz') quizReset(); openDialog(n); goal('open_' + n); return; }
    var s = e.target.closest('[data-service]');
    if (s) { e.preventDefault(); var name = s.getAttribute('data-service'); $('[data-service-name]').textContent = name; $('[data-dialog="service"] input[name=tariff]').value = name; openDialog('service'); goal('open_service'); }
  });

  /* ---------- leads ---------- */
  function normPhone(v) {
    var t = v.replace(/[^\d+]/g, '');
    if (t.charAt(0) === '8' && t.length <= 11) t = '+7' + t.slice(1);
    else if (t.charAt(0) === '7') t = '+' + t;
    else if (t.indexOf('+') !== 0) t = '+7' + t;
    if (t.indexOf('+7') === 0) t = '+7' + t.slice(2).replace(/\D/g, '').slice(0, 10);
    return t;
  }
  function validPhone(v) { return /^\+7\d{10}$/.test(v.replace(/[\s\-()]/g, '')); }
  $$('input[type=tel]').forEach(function (i) { i.addEventListener('input', function () { if (i.value.length > 1) i.value = normPhone(i.value); }); });

  function sendLead(data) {
    var h = { apikey: FP.key, Authorization: 'Bearer ' + FP.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    var row = { name: data.name, phone: data.phone, email: data.email || null, source: data.source, tariff: data.tariff || null, niche: data.niche || null, team_size: data.team_size || null, tasks: data.tasks || null };
    var p1 = fetch(FP.supabase + '/rest/v1/leads', { method: 'POST', headers: h, body: JSON.stringify(row) });
    var p2 = fetch(FP.supabase + '/functions/v1/telegram-notify', { method: 'POST', headers: h, body: JSON.stringify(data) }).catch(function () {});
    return p1.then(function (r) { if (!r.ok) throw new Error('lead ' + r.status); return p2; });
  }
  $$('[data-lead-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = f.name.value.trim(), phone = normPhone(f.phone.value);
      if (!name || !validPhone(phone)) { toast('Заполните имя и корректный телефон (+7XXXXXXXXXX)', true); return; }
      var btn = $('[type=submit]', f); if (btn) btn.disabled = true;
      var data = { name: name, phone: phone, source: f.getAttribute('data-lead-form') };
      if (f.tariff) data.tariff = f.tariff.value;
      if (f.turnover && f.turnover.value) data.team_size = f.turnover.value;
      if (f.topic && f.topic.value.trim()) data.tasks = [f.topic.value.trim()];
      var ref = (location.search.match(/[?&](?:from|utm_source)=([^&]+)/) || [])[1];
      if (ref) data.tasks = (data.tasks || []).concat(['Ссылка: ' + decodeURIComponent(ref)]);
      sendLead(data).then(function () {
        f.reset(); goal('lead'); goal('lead_' + data.source);
        var inl = f.getAttribute('data-booking-inline') && $(f.getAttribute('data-booking-inline'));
        if (inl) { f.style.display = 'none'; inl.innerHTML = ''; bookingFlow(inl, data); inl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        else if (FP.booking) { openDialog('booking'); bookingFlow($('[data-booking-body]'), data); }
        else { toast('Заявка отправлена! Мы свяжемся с вами, чтобы уточнить задачу и договориться о консультации.'); closeDialog(); }
      }).catch(function () { toast('Не удалось отправить. Позвоните нам: +7 (927) 424-78-78', true); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });
  var rf = $('[data-review-form]');
  if (rf) rf.addEventListener('submit', function (e) {
    e.preventDefault();
    var h = { apikey: FP.key, Authorization: 'Bearer ' + FP.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
    var row = { name: rf.name.value.trim(), role: rf.role.value.trim() || null, niche: rf.niche.value.trim() || null, text: rf.text.value.trim(), rating: 5, approved: false };
    fetch(FP.supabase + '/rest/v1/reviews', { method: 'POST', headers: h, body: JSON.stringify(row) })
      .then(function (r) { if (!r.ok) throw 0; toast('Спасибо! Отзыв появится после проверки.'); rf.reset(); closeDialog(); })
      .catch(function () { toast('Не удалось отправить отзыв. Напишите нам в Telegram.', true); });
  });


  /* ---------- booking: выбор времени консультации по календарю ---------- */
  var btnP = 'inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4';
  function doneHtml() { return '<div class="flex flex-col items-center py-8 gap-4"><p class="text-lg font-bold text-foreground text-center">Спасибо! Заявка принята.</p><p class="text-sm text-muted-foreground text-center">Мы свяжемся с вами, уточним задачу и договоримся о видеозвонке с финансовым специалистом.</p><button data-close-q class="mt-4 ' + btnP + '">Закрыть</button></div>'; }
  function bindClose(body) {
    var c = $('[data-close-q]', body); if (!c) return;
    c.addEventListener('click', function () {
      if (body.closest('[data-dialog]')) { closeDialog(); return; }
      body.innerHTML = '<div class="flex flex-col items-center py-8 gap-3 text-center"><p class="text-lg font-bold text-foreground">Спасибо!</p><p class="text-sm text-muted-foreground">Заявка у нас. Мы свяжемся с вами и подберём удобное время.</p><a href="/" class="mt-2 text-primary hover:underline text-sm">На главную</a></div>';
    });
  }
  function fetchT(url, opt, ms) {
    return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error('timeout')); }, ms); fetch(url, opt).then(function (r) { clearTimeout(t); res(r); }, function (e) { clearTimeout(t); rej(e); }); });
  }
  function bookingFlow(body, lead) {
    if (!FP.booking) { body.innerHTML = doneHtml(); bindClose(body); return; }
    body.innerHTML = '<div class="flex flex-col items-center py-10 gap-3"><div class="fp-spin"></div><p class="text-sm text-muted-foreground">Заявка принята. Подбираем свободное время…</p></div>';
    fetchT(FP.booking + '?action=slots', {}, 12000).then(function (r) { return r.json(); })
      .then(function (d) { if (!d.ok || !d.days || !d.days.length) throw 0; renderSlots(body, lead, d.days, ''); goal('book_slots_shown'); })
      .catch(function () { body.innerHTML = doneHtml(); bindClose(body); });
  }
  function renderSlots(body, lead, days, note) {
    var h = '<div class="space-y-4"><div class="rounded-lg bg-primary/10 p-3 text-sm"><b class="text-foreground">Заявка принята!</b> <span class="text-muted-foreground">Выберите удобное время для бесплатной консультации — видеовстреча в Zoom, 30 минут.</span></div>' +
      (note ? '<p class="text-sm text-destructive">' + esc(note) + '</p>' : '');
    days.forEach(function (d) {
      h += '<div><p class="text-sm font-semibold text-foreground mb-2 first-letter:uppercase">' + esc(d.label) + '</p><div class="grid grid-cols-2 gap-2">' +
        d.slots.map(function (s) { return '<button type="button" data-slot="' + esc(s.start) + '" data-label="' + esc(d.label + ', ' + s.time) + '" class="' + optCls + off + ' text-center font-medium">' + esc(s.time) + ' <span class="text-xs">МСК</span></button>'; }).join('') + '</div></div>';
    });
    h += '<input data-bk-email type="email" value="' + esc(lead._email || '') + '" placeholder="E-mail для приглашения (необязательно)" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm h-11 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">' +
      '<p class="text-xs text-muted-foreground text-center">Время указано московское. Не подходит? <button type="button" data-close-q class="text-primary hover:underline">Мы позвоним и подберём другое</button></p></div>';
    body.innerHTML = h; bindClose(body);
    $$('[data-slot]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('[data-slot]', body).forEach(function (x) { x.disabled = true; });
        b.textContent = 'Записываем…';
        var em = lead._email = (($('[data-bk-email]', body) || {}).value || '').trim();
        var payload = { action: 'book', start: b.getAttribute('data-slot'), name: lead.name, phone: lead.phone, email: em.trim(), source: lead.source, niche: lead.niche || '', turnover: lead.team_size || '', tasks: lead.tasks || lead.tariff || '' };
        fetchT(FP.booking, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }, 20000)
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.ok) {
              goal('book_confirmed');
              body.innerHTML = '<div class="flex flex-col items-center py-8 gap-4 text-center"><p class="text-lg font-bold text-foreground">Встреча назначена!</p><p class="text-base text-foreground">' + esc(b.getAttribute('data-label')) + ' МСК · Zoom · 30 минут</p><p class="text-sm text-muted-foreground">' + (payload.email ? 'Приглашение придёт на ' + esc(payload.email) + '. ' : '') + 'Ссылку на Zoom мы также пришлём в мессенджер или по SMS. Если планы изменятся — просто напишите нам.</p><button data-close-q class="mt-2 ' + btnP + '">Готово</button></div>';
              bindClose(body);
            } else if (d.error === 'busy' && d.days && d.days.length) renderSlots(body, lead, d.days, 'Это время только что заняли — выберите другое.');
            else throw 0;
          })
          .catch(function () { body.innerHTML = doneHtml(); bindClose(body); });
      });
    });
  }

  /* ---------- quiz ---------- */
  var Q = FP.quiz || {}, qs, qStep;
  var steps = ['Ниша', 'Оборот', 'Задачи', 'Контакты'];
  var optCls = 'text-left text-sm px-3 py-2.5 rounded-lg border transition-all ';
  var on = 'border-primary bg-primary/10 text-foreground font-medium', off = 'border-border bg-background text-muted-foreground hover:border-primary/30';
  function quizReset() { qs = { niche: '', turnover: '', tasks: [], name: '', phone: '' }; qStep = 0; renderQuiz(); }
  function canNext() { return qStep === 0 ? !!qs.niche : qStep === 1 ? !!qs.turnover : qStep === 2 ? qs.tasks.length > 0 : (!!qs.name.trim() && validPhone(qs.phone)); }
  function renderQuiz(done) {
    var body = $('[data-quiz-body]'); if (!body) return;
    if (done) { bookingFlow(body, done); return; }
    var h = '<div class="flex gap-1 mb-4">' + steps.map(function (s, i) { return '<div class="flex-1 flex flex-col items-center gap-1"><div class="h-1.5 w-full rounded-full ' + (i <= qStep ? 'bg-primary' : 'bg-muted') + '"></div><span class="text-[10px] ' + (i <= qStep ? 'text-primary font-semibold' : 'text-muted-foreground') + '">' + s + '</span></div>'; }).join('') + '</div>';
    if (qStep === 0) h += '<p class="text-sm text-muted-foreground mb-3">В какой нише ваш бизнес?</p><div class="grid grid-cols-2 gap-2">' + Q.niches.map(function (n) { return '<button type="button" data-q="niche" data-v="' + esc(n) + '" class="' + optCls + (qs.niche === n ? on : off) + '">' + esc(n) + '</button>'; }).join('') + '</div>';
    if (qStep === 1) h += '<p class="text-sm text-muted-foreground mb-3">Какой оборот вашего бизнеса?</p><div class="space-y-2">' + Q.turnover.map(function (t) { return '<button type="button" data-q="turnover" data-v="' + esc(t[1]) + '" class="w-full px-4 py-3 ' + optCls + (qs.turnover === t[1] ? on : off) + '">' + esc(t[0]) + '</button>'; }).join('') + '</div>';
    if (qStep === 2) h += '<p class="text-sm text-muted-foreground mb-3">Какие задачи нужно решить? (можно выбрать несколько)</p><div class="space-y-2">' + Q.tasks.map(function (t) { var s = qs.tasks.indexOf(t) >= 0; return '<button type="button" data-q="tasks" data-v="' + esc(t) + '" class="w-full px-4 py-3 ' + optCls + (s ? on : off) + '">' + (s ? '✓ ' : '') + esc(t) + '</button>'; }).join('') + '</div>';
    if (qStep === 3) h += '<div class="space-y-4"><p class="text-sm text-muted-foreground mb-1">Оставьте контакты — мы проведём бесплатную консультацию</p><ol class="fp-next fp-next-sm"><li><b>1</b><span>Свяжемся и уточним задачу</span></li><li><b>2</b><span>Видеозвонок с финансовым специалистом</span></li><li><b>3</b><span>Предложим формат работы и стоимость</span></li></ol><input data-qf="name" value="' + esc(qs.name) + '" placeholder="Ваше имя" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm h-12 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><input data-qf="phone" type="tel" value="' + esc(qs.phone) + '" placeholder="+7XXXXXXXXXX" class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm h-12 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><p class="text-xs text-muted-foreground">Нажимая кнопку, вы соглашаетесь с <a href="/privacy" class="text-primary hover:underline">политикой обработки персональных данных</a></p></div>';
    h += '<div class="flex gap-3 mt-4">' + (qStep > 0 ? '<button type="button" data-q-back class="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4">← Назад</button>' : '') +
      '<button type="button" data-q-next ' + (canNext() ? '' : 'disabled') + ' class="flex-1 inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-primary/25">' + (qStep < 3 ? 'Далее →' : 'Получить консультацию') + '</button></div>';
    body.innerHTML = h;
    $$('[data-q]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-q'), v = b.getAttribute('data-v');
        if (k === 'tasks') { var ix = qs.tasks.indexOf(v); if (ix >= 0) qs.tasks.splice(ix, 1); else qs.tasks.push(v); } else qs[k] = v;
        renderQuiz();
      });
    });
    $$('[data-qf]', body).forEach(function (i) {
      i.addEventListener('input', function () {
        var k = i.getAttribute('data-qf'); if (k === 'phone' && i.value.length > 1) i.value = normPhone(i.value);
        qs[k] = i.value; $('[data-q-next]', body).disabled = !canNext();
      });
    });
    var back = $('[data-q-back]', body); if (back) back.addEventListener('click', function () { qStep--; renderQuiz(); });
    $('[data-q-next]', body).addEventListener('click', function () {
      if (!canNext()) return;
      if (qStep < 3) { qStep++; goal('quiz_step_' + (qStep + 1)); renderQuiz(); return; }
      var btn = this; btn.disabled = true; btn.textContent = 'Отправка...';
      var ql = { name: qs.name.trim(), phone: normPhone(qs.phone), source: 'quiz', niche: qs.niche, team_size: qs.turnover, tasks: qs.tasks };
      sendLead(ql)
        .then(function () { goal('lead'); goal('lead_quiz'); renderQuiz(ql); })
        .catch(function () { toast('Не удалось отправить. Позвоните нам: +7 (927) 424-78-78', true); btn.disabled = false; btn.textContent = 'Получить консультацию'; });
    });
  }

  /* ---------- blog search / cases filter / share ---------- */
  var bs = $('[data-blog-search]');
  if (bs) bs.addEventListener('input', function () { var q = bs.value.toLowerCase().trim(); $$('[data-post-card]').forEach(function (c) { c.classList.toggle('hidden', q && c.getAttribute('data-search').indexOf(q) < 0); }); });
  var fb = $$('[data-filter]');
  fb.forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.getAttribute('data-filter');
      fb.forEach(function (x) { var a = x === b; ['bg-primary', 'text-primary-foreground', 'shadow-md', 'shadow-primary/20'].forEach(function (c) { x.classList.toggle(c, a); }); ['bg-secondary', 'text-muted-foreground'].forEach(function (c) { x.classList.toggle(c, !a); }); });
      $$('[data-case-card]').forEach(function (c) { c.classList.toggle('hidden', !!n && c.getAttribute('data-niche') !== n); });
    });
  });
  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (navigator.share) navigator.share({ title: document.title, url: location.href }).catch(function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { toast('Ссылка скопирована'); });
    });
  });

  /* ---------- AI chat ---------- */
  var chat = $('[data-chat]'), log = $('[data-chat-log]'), input = $('[data-chat-input]'), cform = $('[data-chat-form]');
  var GREETING = 'Здравствуйте! 👋 Я ИИ-консультант **ФинПроект-1**. Наведём порядок в финансах и освободим до 54% вашего рабочего времени.\n\nЧем могу помочь?\n\n:::buttons\nКакие услуги?|Покажите кейсы|Как работаете?|Сколько стоит?\n:::';
  var msgs = [], busy = false, convId = null;
  function sid() { try { var s = sessionStorage.getItem('chat_session_id'); if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()); sessionStorage.setItem('chat_session_id', s); } return s; } catch (e) { return 'anon'; } }
  function md(t) {
    var s = esc(t);
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\((https?:[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>');
    var lines = s.split('\n'), out = [], ul = false;
    lines.forEach(function (l) {
      var m = l.match(/^\s*[-*•]\s+(.*)/) || l.match(/^\s*\d+[.)]\s+(.*)/);
      if (m) { if (!ul) { out.push('<ul class="list-disc pl-4 my-1">'); ul = true; } out.push('<li>' + m[1] + '</li>'); }
      else { if (ul) { out.push('</ul>'); ul = false; } if (l.trim()) out.push('<p>' + l + '</p>'); }
    });
    if (ul) out.push('</ul>');
    return out.join('');
  }
  function kv(s) { var o = {}; s.split('\n').forEach(function (l) { var i = l.indexOf(':'); if (i > 0) { var k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim(); if (k && v) o[k] = v; } }); return o; }
  function parse(t) {
    var re = /:::(card|case|buttons)\n([\s\S]*?):::/g, parts = [], n = 0, m;
    while ((m = re.exec(t))) {
      var pre = t.slice(n, m.index); if (pre.trim()) parts.push({ type: 'text', content: pre });
      if (m[1] === 'buttons') { var it = m[2].trim().split('|').map(function (x) { return x.trim(); }).filter(Boolean); if (it.length) parts.push({ type: 'buttons', items: it }); }
      else { var o = kv(m[2]); o.type = m[1]; if (o.title) parts.push(o); }
      n = m.index + m[0].length;
    }
    var rest = t.slice(n).replace(/:::(card|case|buttons)[\s\S]*$/, ''); if (rest.trim()) parts.push({ type: 'text', content: rest });
    return parts;
  }
  function render() {
    var lastA = -1; msgs.forEach(function (m, i) { if (m.role === 'assistant') lastA = i; });
    log.innerHTML = msgs.map(function (m, i) {
      if (m.role === 'user') return '<div class="flex justify-end"><div class="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">' + esc(m.content) + '</div></div>';
      var h = parse(m.content).map(function (p) {
        if (p.type === 'text') return '<div class="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground chat-md">' + md(p.content) + '</div>';
        if (p.type === 'card') return '<div class="my-2 rounded-xl border border-primary/20 bg-primary/5 p-3"><div class="flex items-start justify-between gap-2"><h4 class="text-sm font-semibold text-foreground leading-tight">' + esc(p.title) + '</h4>' + (p.tag ? '<span class="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">' + esc(p.tag) + '</span>' : '') + '</div>' + (p.price ? '<p class="mt-1 text-sm font-bold text-primary">' + esc(p.price) + '</p>' : '') + (p.desc ? '<p class="mt-1 text-xs text-muted-foreground leading-relaxed">' + esc(p.desc) + '</p>' : '') + '<button data-chat-say="Расскажи подробнее о &quot;' + esc(p.title) + '&quot;" class="mt-2 text-xs font-medium text-primary hover:underline">Подробнее →</button></div>';
        if (p.type === 'case') return '<div class="my-2 rounded-xl border border-border bg-muted/50 p-3"><h4 class="text-sm font-semibold text-foreground leading-tight">' + esc(p.title) + '</h4><div class="mt-1.5 flex flex-wrap gap-1.5">' + (p.niche ? '<span class="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">' + esc(p.niche) + '</span>' : '') + (p.duration ? '<span class="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">⏱ ' + esc(p.duration) + '</span>' : '') + '</div>' + (p.result ? '<p class="mt-1.5 text-xs font-medium text-primary leading-relaxed">📈 ' + esc(p.result) + '</p>' : '') + '</div>';
        if (p.type === 'buttons' && (!busy || i !== lastA)) return '<div class="my-2 flex flex-wrap gap-1.5">' + p.items.map(function (b) { var lead = b.indexOf('Оставить заявку') >= 0; return '<button ' + (lead ? 'data-chat-lead' : 'data-chat-say="' + esc(b) + '"') + ' class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ' + (lead ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10') + '">' + esc(b) + '</button>'; }).join('') + '</div>';
        return '';
      }).join('');
      return '<div class="flex justify-start"><div class="max-w-[85%] space-y-0">' + h + '</div></div>';
    }).join('') + (busy && msgs[msgs.length - 1].role === 'user' ? '<div class="flex justify-start"><div class="rounded-2xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">Печатает…</div></div>' : '');
    log.scrollTop = log.scrollHeight;
  }
  function say(text) {
    text = (text || '').trim(); if (!text || busy) return;
    if (msgs.length >= 40) { msgs.push({ role: 'user', content: text }, { role: 'assistant', content: 'Мы уже долго общаемся! 😊 Для более детальной консультации позвоните нам по телефону **+7-927-424-78-78** или напишите в [Telegram](https://t.me/OlgaOFinansah).\n\n:::buttons\n📝 Оставить заявку\n:::' }); render(); return; }
    msgs.push({ role: 'user', content: text }); busy = true; render(); goal('chat_message');
    var payload = msgs.slice(1).map(function (m) { return { role: m.role, content: m.content }; });
    var acc = '', added = false;
    function upd(d) { acc += d; if (!added) { msgs.push({ role: 'assistant', content: acc }); added = true; } else msgs[msgs.length - 1].content = acc; render(); }
    fetch(FP.chat, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + FP.key }, body: JSON.stringify({ messages: payload, conversation_id: convId, session_id: sid() }) })
      .then(function (r) {
        var c = r.headers.get('X-Conversation-Id'); if (c && !convId) convId = c;
        if (!r.ok || !r.body) return r.json().catch(function () { return {}; }).then(function (j) { upd(j.error || 'Произошла ошибка. Попробуйте позже.'); });
        var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return rd.read().then(function (x) {
            if (x.done) return;
            buf += dec.decode(x.value, { stream: true }); var k;
            while ((k = buf.indexOf('\n')) !== -1) {
              var line = buf.slice(0, k).replace(/\r$/, ''); buf = buf.slice(k + 1);
              if (line.indexOf('data: ') !== 0) continue; var dt = line.slice(6).trim(); if (dt === '[DONE]') return;
              try { var dd = JSON.parse(dt).choices[0].delta.content; if (dd) upd(dd); } catch (e) {}
            }
            return pump();
          });
        }
        return pump();
      })
      .catch(function () { upd('Извините, произошла ошибка. Попробуйте позже или позвоните нам: **+7-927-424-78-78**'); })
      .then(function () { busy = false; render(); });
  }
  if (chat) {
    msgs = [{ role: 'assistant', content: GREETING }];
    $('[data-chat-open]').addEventListener('click', function () { chat.classList.remove('hidden'); this.classList.add('hidden'); render(); setTimeout(function () { input.focus(); }, 50); goal('chat_open'); });
    $('[data-chat-close]').addEventListener('click', function () { chat.classList.add('hidden'); $('[data-chat-open]').classList.remove('hidden'); });
    cform.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; say(v); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var v = input.value; input.value = ''; say(v); } });
    log.addEventListener('click', function (e) {
      var b = e.target.closest('[data-chat-say]'); if (b) { say(b.getAttribute('data-chat-say')); return; }
      if (e.target.closest('[data-chat-lead]')) { chat.classList.add('hidden'); $('[data-chat-open]').classList.remove('hidden'); quizReset(); openDialog('quiz'); }
    });
  }
})();

/* ---------- CRO: клики по контактам и мобильная панель ---------- */
(function () {
  var g = function (x) { try { if (window.ym) window.ym(107596992, 'reachGoal', x); } catch (e) {} };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('t.me/') >= 0) g('click_telegram');
    else if (h.indexOf('wa.me/') >= 0) g('click_whatsapp');
    else if (h.indexOf('tel:') === 0) g('click_phone');
  }, true);
  var bar = document.querySelector('[data-mbar]'); if (!bar) return;
  var onScroll = function () { var show = window.scrollY > 560; bar.classList.toggle('fp-mbar-on', show); document.body.classList.toggle('fp-mbar-shown', show); };
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();
