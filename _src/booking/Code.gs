/**
 * ФинПроект-1 — запись на консультацию по Google Календарю.
 * Веб-приложение Google Apps Script (выполняется от имени владельца календаря).
 *
 * GET  ?action=slots            → свободные окна: 2 в ближайший рабочий день и 2 в следующий
 * POST {action:'book', ...}     → создаёт встречу в календаре (тело запроса — JSON как text/plain)
 *
 * Настройки ниже. После изменения: Развернуть → Управление развертываниями → новая версия.
 */
var CFG = {
  OWNER_TZ: 'Asia/Shanghai',        // часовой пояс владельца календаря (Гуанчжоу, UTC+8)
  CLIENT_TZ: 'Europe/Moscow',       // в каком времени показываем окна клиенту
  WORK_FROM: 10, WORK_TO: 18,       // окно записи по МОСКВЕ (часы): 10:00–18:00 МСК = 15:00–23:00 в Китае
  WORK_DAYS: [1, 2, 3, 4, 5],       // пн–пт (по Москве)
  // Постоянно занятые интервалы по времени ВЛАДЕЛЬЦА (Китай): день недели 0=вс…6=сб, часы с–по
  BLOCKED: [{ dow: 3, from: 16, to: 20 }, { dow: 5, from: 16, to: 20 }],  // ср и пт 16–20 — секция сына
  DURATION_MIN: 30,                 // длительность встречи
  BUFFER_MIN: 15,                   // зазор до и после других событий
  LEAD_TIME_MIN: 90,                // не раньше чем через 1,5 часа от текущего момента
  SLOTS_PER_DAY: 2, DAYS: 2,        // 2 окна в первый день и 2 во второй
  MIN_GAP_MIN: 120,                 // второе окно дня — минимум через 2 часа после первого (если возможно)
  ZOOM_LINK: '',                    // постоянная ссылка Zoom (если пусто — ссылку пришлём отдельно)
  EXTRA_CALENDARS: ['olga.glavnoe@gmail.com'],  // доп. календари, занятость в которых тоже учитывается
  INVITE_EXTRA: true,               // приглашать доп. календари на встречу (чтобы запись была видна и там)
  LEADS_SHEET_ID: '1v0VNZxWazkyeotblPkx2wjV3RPZMJqHO8z7fXGFODkQ',  // таблица «заявки с сайта и источники»
  NOTIFY_EMAIL: '',                 // куда слать письмо о новой записи (пусто — на почту владельца)
  TITLE: 'Консультация ФинПроект-1'
};

function doGet(e) {
  var a = (e && e.parameter && e.parameter.action) || 'slots';
  if (a === 'slots') return json_({ ok: true, tz: CFG.CLIENT_TZ, days: findSlots_() });
  return json_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    if (d.action === 'lead') { logLead_(d); return json_({ ok: true }); }
    if (d.action !== 'book') return json_({ ok: false, error: 'unknown action' });
    var start = new Date(d.start);
    if (isNaN(start) || !d.name || !d.phone) return json_({ ok: false, error: 'bad request' });
    var end = new Date(start.getTime() + CFG.DURATION_MIN * 60000);
    if (!isFree_(start, end)) return json_({ ok: false, error: 'busy', days: findSlots_() });
    var desc = [
      'Клиент: ' + clean_(d.name), 'Телефон: ' + clean_(d.phone),
      d.email ? 'E-mail: ' + clean_(d.email) : '',
      d.niche ? 'Ниша: ' + clean_(d.niche) : '', d.turnover ? 'Оборот: ' + clean_(d.turnover) : '',
      d.tasks ? 'Задачи: ' + clean_(d.tasks) : '', d.source ? 'Источник: ' + clean_(d.source) : '',
      CFG.ZOOM_LINK ? 'Zoom: ' + CFG.ZOOM_LINK : 'Zoom: ссылку отправить клиенту'
    ].filter(String).join('\n');
    var opts = { description: desc, location: CFG.ZOOM_LINK || 'Zoom' };
    var guests = [];
    if (d.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) guests.push(String(d.email).trim());
    if (CFG.INVITE_EXTRA) guests = guests.concat(CFG.EXTRA_CALENDARS);
    if (guests.length) { opts.guests = guests.join(','); opts.sendInvites = true; }
    var ev = CalendarApp.getDefaultCalendar().createEvent(CFG.TITLE + ' — ' + clean_(d.name), start, end, opts);
    ev.addPopupReminder(15);
    var when = Utilities.formatDate(start, CFG.CLIENT_TZ, 'dd.MM.yyyy HH:mm') + ' МСК (' +
               Utilities.formatDate(start, CFG.OWNER_TZ, 'HH:mm') + ' по Китаю)';
    MailApp.sendEmail(CFG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail(),
      'Новая запись на консультацию: ' + clean_(d.name) + ', ' + when, desc + '\n\nВремя: ' + when);
    try { markBooked_(d.phone, Utilities.formatDate(start, CFG.CLIENT_TZ, 'dd.MM.yyyy HH:mm')); } catch (x) {}
    return json_({ ok: true, when: Utilities.formatDate(start, CFG.CLIENT_TZ, 'dd.MM HH:mm'), zoom: !!CFG.ZOOM_LINK });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

/* ---------- журнал заявок ---------- */
function leadsSheet_() { return SpreadsheetApp.openById(CFG.LEADS_SHEET_ID).getSheetByName('Заявки'); }
function logLead_(d) {
  var now = new Date();
  var dow = Number(Utilities.formatDate(now, CFG.CLIENT_TZ, 'u'));          // 1=пн
  var monday = new Date(now.getTime() - (dow - 1) * 864e5);
  var t = String(d.team_size || '');
  var target = !t ? 'не указан' : (/^(до 5M|5-20M|20-50M)$/.test(t) ? 'да' : 'нет');
  var src = d.src || {};
  leadsSheet_().appendRow([
    Utilities.formatDate(now, CFG.CLIENT_TZ, 'dd.MM.yyyy HH:mm'), Utilities.formatDate(monday, CFG.CLIENT_TZ, 'yyyy-MM-dd'),
    clean_(d.name || ''), "'" + clean_(d.phone || ''), clean_(d.source || ''), clean_(d.tariff || ''), clean_(d.niche || ''),
    clean_(t), target, clean_(d.tasks || ''), clean_(d.page || ''),
    clean_(src.channel || ''), clean_(src.m || ''), clean_(src.c || ''), clean_(src.land || ''), clean_(src.ref || ''), 'нет', ''
  ]);
}
function markBooked_(phone, when) {
  var sh = leadsSheet_(), n = sh.getLastRow(); if (n < 2) return;
  var vals = sh.getRange(2, 4, n - 1, 1).getValues(), p = String(phone).replace(/\D/g, '');
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]).replace(/\D/g, '') === p) { sh.getRange(i + 2, 17, 1, 2).setValues([['да', when]]); return; }
  }
}

/* ---------- свободные окна ---------- */
function findSlots_() {
  var now = new Date(), earliest = new Date(now.getTime() + CFG.LEAD_TIME_MIN * 60000);
  var horizon = new Date(now.getTime() + 14 * 864e5);
  var busy = busy_(now, horizon), out = [];
  for (var i = 0; i < 14 && out.length < CFG.DAYS; i++) {
    var day = new Date(now.getTime() + i * 864e5);
    var ymd = Utilities.formatDate(day, CFG.CLIENT_TZ, 'yyyy-MM-dd');
    var dow = Number(Utilities.formatDate(day, CFG.CLIENT_TZ, 'u')) % 7; // 1=пн … 7=вс → 0
    if (CFG.WORK_DAYS.indexOf(dow) < 0) continue;
    var picked = [], step = 30 * 60000;
    var t = at_(ymd, CFG.WORK_FROM), stop = at_(ymd, CFG.WORK_TO);
    for (; t.getTime() + CFG.DURATION_MIN * 60000 <= stop.getTime(); t = new Date(t.getTime() + step)) {
      if (t < earliest) continue;
      var e = new Date(t.getTime() + CFG.DURATION_MIN * 60000);
      if (overlaps_(busy, t, e) || blocked_(t, e)) continue;
      if (picked.length && t - picked[picked.length - 1] < CFG.MIN_GAP_MIN * 60000) continue;
      picked.push(t); if (picked.length === CFG.SLOTS_PER_DAY) break;
    }
    if (picked.length < CFG.SLOTS_PER_DAY) { // если с зазором не хватило — берём ближайшие свободные
      for (t = at_(ymd, CFG.WORK_FROM); picked.length < CFG.SLOTS_PER_DAY && t.getTime() + CFG.DURATION_MIN * 60000 <= stop.getTime(); t = new Date(t.getTime() + step)) {
        if (t < earliest || picked.some(function (p) { return p.getTime() === t.getTime(); })) continue;
        var e2 = new Date(t.getTime() + CFG.DURATION_MIN * 60000);
        if (!overlaps_(busy, t, e2) && !blocked_(t, e2)) picked.push(t);
      }
      picked.sort(function (a, b) { return a - b; });
    }
    if (picked.length) out.push({
      date: ymd,
      label: ruLabel_(ymd, dow),
      slots: picked.map(function (p) { return { start: p.toISOString(), time: Utilities.formatDate(p, CFG.CLIENT_TZ, 'HH:mm') }; })
    });
  }
  return out;
}
function at_(ymd, hour) { // ymd + час по Москве → Date
  var p = ymd.split('-');
  var guess = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], hour, 0, 0));
  var off = (Number(Utilities.formatDate(guess, CFG.CLIENT_TZ, 'H')) - hour);
  if (off > 12) off -= 24; if (off < -12) off += 24;
  return new Date(guess.getTime() - off * 3600000);
}
function busy_(from, to) {
  var list = [], buf = CFG.BUFFER_MIN * 60000;
  var cals = CalendarApp.getAllOwnedCalendars();
  CFG.EXTRA_CALENDARS.forEach(function (id) {
    var c = null; try { c = CalendarApp.getCalendarById(id); } catch (x) {}
    if (c) cals.push(c); else Logger.log('Нет доступа к календарю ' + id);
  });
  cals.forEach(function (cal) {
    if (cal.isHidden && cal.isHidden()) return;
    cal.getEvents(from, to).forEach(function (ev) {
      if (ev.isAllDayEvent()) return;
      try { if (ev.getTransparency && String(ev.getTransparency()) === 'TRANSPARENT') return; } catch (x) {}
      try { if (ev.getMyStatus && String(ev.getMyStatus()) === 'NO') return; } catch (x) {}
      list.push([ev.getStartTime().getTime() - buf, ev.getEndTime().getTime() + buf]);
    });
  });
  return list;
}
function overlaps_(busy, s, e) { s = s.getTime(); e = e.getTime(); return busy.some(function (b) { return s < b[1] && e > b[0]; }); }
function blocked_(s, e) { // пересекается ли [s,e) с постоянными блоками владельца
  var dow = Number(Utilities.formatDate(s, CFG.OWNER_TZ, 'u')) % 7;
  var h1 = Number(Utilities.formatDate(s, CFG.OWNER_TZ, 'H')) + Number(Utilities.formatDate(s, CFG.OWNER_TZ, 'm')) / 60;
  var h2 = h1 + (e - s) / 3600000;
  return CFG.BLOCKED.some(function (b) { return b.dow === dow && h1 < b.to && h2 > b.from; });
}
function isFree_(s, e) { if (blocked_(s, e)) return false; return !overlaps_(busy_(new Date(s.getTime() - 864e5), new Date(e.getTime() + 864e5)), s, e); }
function ruLabel_(ymd, dow) {
  var D = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var M = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var p = ymd.split('-'); return D[dow] + ', ' + Number(p[2]) + ' ' + M[Number(p[1]) - 1];
}
function clean_(v) { return String(Array.isArray(v) ? v.join(', ') : v).replace(/[<>]/g, '').slice(0, 300); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Проверка из редактора: Выполнить → testSlots, смотреть «Журнал выполнения». */
function testCalendars() {
  CFG.EXTRA_CALENDARS.forEach(function (id) {
    var c = CalendarApp.getCalendarById(id);
    if (!c) { Logger.log(id + ': НЕТ ДОСТУПА'); return; }
    var ev = c.getEvents(new Date(), new Date(Date.now() + 14 * 864e5));
    Logger.log(id + ': событий на 2 недели — ' + ev.length + (ev[0] ? ', первое: ' + ev[0].getTitle() + ' ' + ev[0].getStartTime() : ''));
  });
}
function testSlots() { Logger.log(JSON.stringify(findSlots_(), null, 2)); }
