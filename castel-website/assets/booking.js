/* =====================================================================
   CASTEL STUDIO · קביעת תורים באתר
   הטופס הוא חלק מהאתר. ברקע הוא מדבר עם מערכת הניהול (CASTEL STUDIO OS),
   כך שכל תור נכנס אוטומטית ליומן, ללקוחות ולהתראות.
   ===================================================================== */
(function () {
  "use strict";
  var API = "https://castel-studio-delta.vercel.app/api/public/booking";
  var root = document.querySelector("[data-castel-booking]");
  if (!root) return;

  var T = {
    he: {
      loading: "טוען…", svc: "בחירת שירות", barber: "בחירת ספר", any: "כל ספר פנוי", day: "בחירת יום", time: "בחירת שעה",
      noTimes: "אין שעות פנויות ביום הזה. נסו יום אחר.", details: "פרטים ואישור", name: "שם מלא", phone: "טלפון נייד", note: "הערה (לא חובה)",
      terms: "אני מאשר/ת שמירת הפרטים לצורך ניהול התור וקבלת אישור ותזכורת.", mkt: "אשמח לקבל עדכונים ומבצעים (לא חובה).",
      book: "קביעת התור", booked: "התור נקבע", pending: "הבקשה התקבלה. נאשר בהקדם", cal: "הוספה ליומן", cancel: "ביטול התור",
      cancelQ: "לבטל את התור?", cancelled: "התור בוטל", again: "קביעת תור נוסף", save: "שמרו את הקישור הזה כדי לנהל את התור:",
      copy: "העתקת קישור", copied: "הועתק", closed: "קביעת תורים אונליין תיפתח בקרוב.", contact: "בינתיים אפשר לפנות אלינו:",
      tooLate: "כבר מאוחר מדי לבטל אונליין. התקשרו למספרה.", cancelUntil: "ביטול אונליין אפשרי עד {h} שעות לפני התור.",
      min: "דק׳", err: "משהו השתבש. נסו שוב.", notFound: "התור לא נמצא.",
      hello: "שלום {n}, הפרטים שלך מולאו אוטומטית.", notMe: "לא אני", hi: "שלום {n} 👋", quickNote: "התור יישמר על שמך ובטלפון שלך. בלחיצה על קביעת התור את/ה מאשר/ת שימוש בפרטים לניהול התור.", remember: "לזכור את השם והטלפון במכשיר הזה (נשמר רק בטלפון שלך)",
      wd: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"], prevM: "החודש הקודם", nextM: "החודש הבא", free: "פנוי", full: "אין שעות פנויות",
      legendFree: "יש שעות פנויות", legendNone: "סגור / מלא", customer: "שם", service: "שירות", date: "תאריך", timeL: "שעה", duration: "משך", status: "סטטוס",
      st: { CONFIRMED: "מאושר", SCHEDULED: "ממתין לאישור", CANCELLED: "בוטל", COMPLETED: "הושלם", NO_SHOW: "לא הגיע" }, noDays: "אין כרגע ימים פנויים. נסו שוב מאוחר יותר או צרו קשר.",
      e: { slot_taken: "השעה הזאת נתפסה הרגע. בחרו שעה אחרת.", phone: "מספר הטלפון לא תקין.", limit: "כבר יש לכם תורים פתוחים. לשינוי צרו קשר עם המספרה.", rate_limited: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.", validation: "נא למלא שם וטלפון ולאשר.", disabled: "קביעת תורים סגורה כרגע." }
    },
    en: {
      loading: "Loading…", svc: "Choose a service", barber: "Choose a barber", any: "Any available", day: "Choose a day", time: "Choose a time",
      noTimes: "No free times on this day. Try another day.", details: "Your details", name: "Full name", phone: "Mobile phone", note: "Note (optional)",
      terms: "I agree my details are stored to manage this booking and to receive a confirmation and reminder.", mkt: "Send me news and offers (optional).",
      book: "Confirm booking", booked: "You're booked", pending: "Request received. We'll confirm soon", cal: "Add to calendar", cancel: "Cancel booking",
      cancelQ: "Cancel this booking?", cancelled: "Booking cancelled", again: "Book another", save: "Keep this link to manage your booking:",
      copy: "Copy link", copied: "Copied", closed: "Online booking opens soon.", contact: "Meanwhile, reach us:",
      tooLate: "Too late to cancel online. Please call the shop.", cancelUntil: "Online cancellation up to {h}h before.",
      min: "min", err: "Something went wrong. Please try again.", notFound: "Booking not found.",
      hello: "Hi {n}, your details were filled in automatically.", notMe: "Not me", hi: "Hi {n} 👋", quickNote: "Booked under your saved name and phone. By confirming you agree they are used to manage this booking.", remember: "Remember my name and phone on this device (stored only on your phone)",
      wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], prevM: "Previous month", nextM: "Next month", free: "free", full: "No free times",
      legendFree: "Available", legendNone: "Closed / full", customer: "Name", service: "Service", date: "Date", timeL: "Time", duration: "Duration", status: "Status",
      st: { CONFIRMED: "Confirmed", SCHEDULED: "Awaiting confirmation", CANCELLED: "Cancelled", COMPLETED: "Completed", NO_SHOW: "No-show" }, noDays: "No available days right now. Please try later or contact us.",
      e: { slot_taken: "That time was just taken. Pick another.", phone: "Invalid phone number.", limit: "You already have upcoming bookings. Contact the shop to change.", rate_limited: "Too many attempts. Try again in a few minutes.", validation: "Please fill name and phone and accept.", disabled: "Booking is closed right now." }
    }
  };
  var lang = function () { return document.documentElement.lang === "en" ? "en" : "he"; };
  var t = function () { return T[lang()]; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var get = function (path) { return fetch(API + path, { cache: "no-store" }).then(function (r) { return r.json().then(function (d) { d._status = r.status; return d; }); }); };
  var post = function (path, body) { return fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d._ok = r.ok; return d; }); }); };
  var dayLabel = function (d, long) { return new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", long ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" } : { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z")); };
  var svcName = function (s) { return lang() === "en" ? (s.en || s.he) : s.he; };
  // ── Remembered customer: stored ONLY in this browser (localStorage), never sent anywhere except with a booking ──
  var MEM = "castel.booking.me";
  function readMe() { try { var v = JSON.parse(localStorage.getItem(MEM) || "null"); return v && typeof v.name === "string" && typeof v.phone === "string" ? v : null; } catch (e) { return null; } }
  function saveMe(v) { try { localStorage.setItem(MEM, JSON.stringify({ name: v.name.trim().slice(0, 80), phone: v.phone.trim().slice(0, 20) })); } catch (e) { /* private mode */ } }
  function forgetMe() { try { localStorage.removeItem(MEM); } catch (e) { /* ignore */ } }

  // ── Guided flow: scroll to the next step and reveal it softly ──
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var shown = {};
  function goTo(key) {
    requestAnimationFrame(function () {
      var el = root.querySelector('[data-step="' + key + '"]'); if (!el) return;
      var nav = document.querySelector(".nav, header");
      var off = (nav ? nav.getBoundingClientRect().height : 70) + 14;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - off, behavior: reduce ? "auto" : "smooth" });
    });
  }
  // shown[key] = time the step first appeared. A redraw during its entrance continues the animation where it was.
  var ENTER_MS = 500;
  function animateNew() {
    var now = {}, t = Date.now();
    root.querySelectorAll("[data-step]").forEach(function (el) {
      var k = el.getAttribute("data-step");
      now[k] = shown[k] || t;
      var age = t - now[k];
      if (!reduce && age < ENTER_MS) { el.classList.add("bk-enter"); el.style.animationDelay = -age + "ms"; }
    });
    shown = now;
  }

  var manageLink = function (token) { return location.origin + location.pathname + "?booking=" + encodeURIComponent(token) + "#book"; };

  var S = { me: readMe(), cfg: null, service: "", staff: "any", date: "", slots: null, start: null, busy: false, error: "", manage: null, token: "", days: null, month: "" };

  // title is trusted markup built here (static strings + escaped values)
  function step(n, title, inner, key) { return '<div class="bk-step" data-step="' + key + '"><h3 class="bk-h"><span class="bk-n">' + n + "</span><span>" + title + "</span></h3>" + inner + "</div>"; }
  function chip(on, attrs, inner) { return '<button type="button" class="bk-chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" ' + attrs + ">" + inner + "</button>"; }

  // ── Month calendar (Sunday-first, Israel) ──
  function ym(d) { return d.slice(0, 7); }
  function calendar() {
    var L = t();
    if (S.days === null) return '<p class="bk-muted">' + L.loading + "</p>";
    var map = {}; S.days.forEach(function (d) { map[d.date] = d.free; });
    var months = []; S.days.forEach(function (d) { if (months.indexOf(ym(d.date)) < 0) months.push(ym(d.date)); });
    if (!S.days.some(function (d) { return d.free > 0; })) return '<p class="bk-muted">' + L.noDays + "</p>";
    var m = S.month || months[0], mi = months.indexOf(m);
    var y = +m.slice(0, 4), mo = +m.slice(5, 7);
    var first = new Date(Date.UTC(y, mo - 1, 1)), startWd = first.getUTCDay(), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    var today = S.days[0].date;
    var title = new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
    var h = '<div class="bk-cal"><div class="bk-cal-head">' +
      '<button type="button" class="bk-nav" data-month="' + (months[mi - 1] || "") + '" aria-label="' + L.prevM + '"' + (mi > 0 ? "" : " disabled") + '><span aria-hidden="true">' + (lang() === "he" ? "›" : "‹") + "</span></button>" +
      '<p class="bk-cal-title">' + esc(title) + "</p>" +
      '<button type="button" class="bk-nav" data-month="' + (months[mi + 1] || "") + '" aria-label="' + L.nextM + '"' + (mi < months.length - 1 ? "" : " disabled") + '><span aria-hidden="true">' + (lang() === "he" ? "‹" : "›") + "</span></button></div>" +
      '<div class="bk-cal-grid" role="grid">' + L.wd.map(function (w) { return '<span class="bk-wd" role="columnheader">' + w + "</span>"; }).join("");
    for (var i = 0; i < startWd; i++) h += '<span class="bk-day bk-empty" aria-hidden="true"></span>';
    for (var d = 1; d <= dim; d++) {
      var ds = m + "-" + String(d).padStart(2, "0");
      var inRange = ds in map, free = map[ds] || 0, sel = S.date === ds;
      var cls = "bk-day" + (inRange ? (free > 0 ? " avail" : " none") : " out") + (sel ? " on" : "") + (ds === today ? " today" : "");
      var lbl = new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(ds + "T12:00:00Z")) + " · " + (free > 0 ? free + " " + L.free : L.full);
      h += free > 0 ? '<button type="button" class="' + cls + '" data-date="' + ds + '" aria-pressed="' + sel + '" aria-label="' + esc(lbl) + '"><b>' + d + "</b><i></i></button>"
        : '<span class="' + cls + '"' + (inRange ? ' aria-label="' + esc(lbl) + '"' : "") + "><b>" + d + "</b></span>";
    }
    h += '</div><div class="bk-legend"><span><i class="dot avail"></i>' + L.legendFree + '</span><span><i class="dot none"></i>' + L.legendNone + "</span></div></div>";
    return h;
  }
  // ── Availability cache: one request per service returns all days AND their times; prefetched on page load ──
  var cache = {}, FRESH_MS = 90000;
  function cacheKey(svc, staff) { return svc + "|" + staff; }
  function fetchDays(svc, staff, force) {
    var k = cacheKey(svc, staff), c = cache[k];
    if (!force && c && (c.days || c.p) && Date.now() - c.at < FRESH_MS) return c.p || Promise.resolve(c.days);
    var entry = { at: Date.now(), days: null, p: null };
    entry.p = get("/days?serviceId=" + svc + "&staffId=" + staff + "&slots=1").then(function (d) { entry.days = d.days || []; entry.p = null; return entry.days; })
      .catch(function () { delete cache[k]; return []; });
    cache[k] = entry;
    return entry.p;
  }
  function prefetchAll() { if (S.cfg && S.cfg.open) S.cfg.services.forEach(function (sv) { fetchDays(sv.id, S.staff); }); }
  function applyDays(days) {
    S.days = days;
    var firstFree = days.filter(function (x) { return x.free > 0; })[0];
    if (!S.month || !days.some(function (x) { return ym(x.date) === S.month; })) S.month = firstFree ? ym(firstFree.date) : (days[0] ? ym(days[0].date) : "");
  }

  function loadDays(force) {
    if (!S.service) return;
    S.date = ""; S.slots = null; S.start = null;
    var k = cacheKey(S.service, S.staff), c = cache[k];
    if (!force && c && c.days && Date.now() - c.at < FRESH_MS) { applyDays(c.days); render(); return; }
    S.days = null; render();
    fetchDays(S.service, S.staff, force).then(function (days) {
      if (k !== cacheKey(S.service, S.staff)) return;
      applyDays(days); render();
    });
  }

  function render() {
    var L = t();
    if (S.manage) return renderManage();
    var c = S.cfg;
    if (!c) { root.innerHTML = '<p class="bk-muted">' + L.loading + "</p>"; return; }
    if (!c.open) {
      var ph = c.phone ? '<div class="bk-row"><a class="btn ghost sm" href="tel:' + esc(c.phone) + '" dir="ltr">' + esc(c.phone) + '</a><a class="btn sm" href="https://wa.me/' + esc(String(c.phone).replace(/\D/g, "").replace(/^0/, "972")) + '" target="_blank" rel="noopener">WhatsApp</a></div>' : "";
      root.innerHTML = '<div class="bk-card bk-center"><p class="bk-strong">' + L.closed + "</p>" + (c.phone ? '<p class="bk-muted">' + L.contact + "</p>" + ph : "") + "</div>";
      return;
    }
    var n = 1, h = "";
    var note = c.note && c.note[lang()];
    if (note) h += '<p class="bk-note">' + esc(note) + "</p>";
    h += step(n++, esc(L.svc), '<div class="bk-grid2">' + c.services.map(function (s) {
      return chip(S.service === s.id, 'data-svc="' + esc(s.id) + '"', '<span class="bk-sname">' + esc(svcName(s)) + '</span><span class="bk-meta">' + s.durationMin + " " + L.min + " · <b>₪" + s.price + "</b></span>");
    }).join("") + "</div>", "svc");
    if (c.staff.length > 1) h += step(n++, esc(L.barber), '<div class="bk-wrap">' + chip(S.staff === "any", 'data-staff="any"', L.any) + c.staff.map(function (p) { return chip(S.staff === p.id, 'data-staff="' + esc(p.id) + '"', esc(p.name)); }).join("") + "</div>", "barber");
    if (S.service) h += step(n++, esc(L.day), calendar(), "day");
    if (S.service && S.date) {
      var inner = S.slots === null ? '<p class="bk-muted">' + L.loading + "</p>" : !S.slots.length ? '<p class="bk-muted">' + L.noTimes + "</p>"
        : '<div class="bk-times">' + S.slots.map(function (x) { return chip(S.start === x.start, 'data-start="' + x.start + '" dir="ltr"', x.label); }).join("") + "</div>";
      h += step(n++, esc(L.time) + ' <span class="bk-muted bk-small">· ' + esc(dayLabel(S.date, true)) + "</span>", inner, "time");
    }
    if (S.service && S.date && S.start != null) {
      var svc = c.services.filter(function (s) { return s.id === S.service; })[0];
      var slot = (S.slots || []).filter(function (x) { return x.start === S.start; })[0];
      var me = S.me;
      var sum = '<p class="bk-sum"><b>' + esc(svcName(svc)) + "</b> · " + esc(dayLabel(S.date, true)) + ' · <span dir="ltr">' + (slot ? slot.label : "") + "</span> · " + svc.durationMin + " " + L.min + " · ₪" + svc.price + "</p>";
      var err = S.error ? '<p class="bk-err" role="alert">' + esc(S.error) + "</p>" : "";
      var btn = '<button class="btn bk-submit" type="submit"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? L.loading : L.book) + "</button>";
      var hp = '<input name="website" tabindex="-1" autocomplete="off" class="bk-hp" aria-hidden="true">';
      if (me) {
        // Returning customer on this device: no form at all — just a greeting and one button.
        h += '<form class="bk-step bk-quick" id="bkForm" data-step="details" novalidate>' +
          '<p class="bk-hi">' + esc(L.hi.replace("{n}", me.name.split(" ")[0])) + "</p>" + sum +
          '<input type="hidden" name="name" value="' + esc(me.name) + '"><input type="hidden" name="phone" value="' + esc(me.phone) + '"><input type="hidden" name="notes" value="">' +
          '<input type="hidden" name="terms" value="1"><input type="hidden" name="mkt" value=""><input type="hidden" name="remember" value="1">' + hp +
          err + btn + '<p class="bk-muted bk-small bk-quick-note">' + L.quickNote + ' <button type="button" class="bk-link-btn" data-forget>' + L.notMe + "</button></p></form>";
      } else {
        h += '<form class="bk-step" id="bkForm" data-step="details" novalidate><h3 class="bk-h"><span class="bk-n">' + n + "</span>" + L.details + "</h3>" + sum +
          '<div class="bk-grid2"><label class="bk-field">' + L.name + '<input name="name" autocomplete="name" maxlength="80" required></label>' +
          '<label class="bk-field">' + L.phone + '<input name="phone" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="050-0000000" maxlength="20" required></label></div>' +
          '<label class="bk-field">' + L.note + '<input name="notes" maxlength="500"></label>' + hp +
          '<label class="bk-check"><input type="checkbox" name="terms"> ' + L.terms + "</label>" +
          '<label class="bk-check"><input type="checkbox" name="mkt"> ' + L.mkt + "</label>" +
          '<label class="bk-check"><input type="checkbox" name="remember" checked> ' + L.remember + "</label>" +
          err + btn + "</form>";
      }
    }
    root.innerHTML = h;
    animateNew();
  }

  function renderManage() {
    var L = t(), m = S.manage;
    if (m.error) { root.innerHTML = '<div class="bk-card bk-center"><p class="bk-strong">' + L.notFound + '</p><button type="button" class="btn ghost sm" data-again>' + L.again + "</button></div>"; return; }
    var cancelled = m.status === "CANCELLED";
    var title = cancelled ? L.cancelled : m.status === "CONFIRMED" ? L.booked + (m.firstName ? ", " + esc(m.firstName) : "") + "!" : L.pending;
    var link = manageLink(S.token);
    var h = '<div class="bk-card"><p class="bk-title">' + (cancelled ? "" : '<span class="bk-ok">✓</span>') + title + "</p>" +
      '<dl class="bk-dl">' +
        (m.name ? "<dt>" + L.customer + "</dt><dd>" + esc(m.name) + "</dd>" : "") +
        "<dt>" + L.service + "</dt><dd>" + esc(m.service ? svcName(m.service) : "") + (m.price ? " · ₪" + m.price : "") + "</dd>" +
        "<dt>" + L.date + "</dt><dd>" + esc(dayLabel(m.date, true)) + "</dd>" +
        "<dt>" + L.timeL + '</dt><dd><span dir="ltr" class="bk-num">' + m.time + "</span></dd>" +
        "<dt>" + L.duration + "</dt><dd>" + (m.durationMin || "") + " " + L.min + "</dd>" +
        (m.staff ? "<dt>" + (lang() === "he" ? "ספר" : "Barber") + "</dt><dd>" + esc(m.staff) + "</dd>" : "") +
        "<dt>" + L.status + '</dt><dd><span class="bk-badge s-' + m.status + '">' + (L.st[m.status] || m.status) + "</span></dd></dl>";
    if (!cancelled && !m.past) {
      h += '<div class="bk-row"><a class="btn ghost sm" href="' + API + "/ics?t=" + encodeURIComponent(S.token) + '">' + L.cal + "</a>" +
        (m.canCancel ? '<button type="button" class="btn ghost sm bk-danger" data-cancel>' + L.cancel + "</button>" : "") + "</div>";
      if (!m.canCancel) h += '<p class="bk-muted bk-small">' + L.cancelUntil.replace("{h}", Math.round(m.cancelNoticeMin / 60)) + "</p>";
      h += '<p class="bk-muted bk-small">' + L.save + '</p><div class="bk-row"><input class="bk-link" readonly dir="ltr" value="' + esc(link) + '"><button type="button" class="btn ghost sm" data-copy>' + L.copy + "</button></div>";
    }
    if (S.error) h += '<p class="bk-err" role="alert">' + esc(S.error) + "</p>";
    h += '<button type="button" class="bk-again" data-again>' + L.again + "</button></div>";
    root.innerHTML = h;
  }

  function loadSlots() {
    if (!S.service || !S.date) return;
    S.start = null;
    var day = (S.days || []).filter(function (x) { return x.date === S.date; })[0];
    if (day && day.slots) { S.slots = day.slots; render(); return; } // instant: already prefetched
    S.slots = null; render();
    var key = S.service + S.staff + S.date;
    get("/slots?serviceId=" + S.service + "&staffId=" + S.staff + "&date=" + S.date).then(function (d) {
      if (key !== S.service + S.staff + S.date) return;
      S.slots = d.slots || []; render();
    }).catch(function () { S.slots = []; render(); });
  }

  function openManage(token) {
    S.token = token;
    return get("/manage?t=" + encodeURIComponent(token)).then(function (d) { S.manage = d._status === 200 ? d : { error: true }; render(); })
      .catch(function () { S.manage = { error: true }; render(); });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.svc) { S.service = b.dataset.svc; S.start = null; S.error = ""; loadDays(); goTo(root.querySelector('[data-step="barber"]') ? "barber" : "day"); }
    else if (b.dataset.staff) { S.staff = b.dataset.staff; loadDays(); goTo("day"); }
    else if (b.dataset.month !== undefined && b.classList.contains("bk-nav")) { if (b.dataset.month) { S.month = b.dataset.month; render(); } }
    else if (b.dataset.date) { S.date = b.dataset.date; loadSlots(); goTo("time"); }
    else if (b.dataset.start) { S.start = Number(b.dataset.start); S.error = ""; render(); goTo("details"); }
    else if (b.hasAttribute("data-forget")) {
      forgetMe(); S.me = null;
      var keep = document.getElementById("bkForm"); var notes = keep ? keep.notes.value : "";
      render(); var nf2 = document.getElementById("bkForm"); if (nf2) { nf2.notes.value = notes; nf2.name.focus(); }
    }
    else if (b.hasAttribute("data-cancel")) {
      if (!confirm(t().cancelQ)) return;
      post("/cancel", { token: S.token }).then(function (d) {
        if (d._ok) return openManage(S.token);
        S.error = d.error === "too_late" ? t().tooLate : t().err; render();
      });
    } else if (b.hasAttribute("data-copy")) {
      var inp = root.querySelector(".bk-link"); inp.select();
      (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.resolve(document.execCommand("copy"))).then(function () { b.textContent = t().copied; });
    } else if (b.hasAttribute("data-again")) {
      S.manage = null; S.token = ""; S.service = ""; S.date = ""; S.slots = null; S.start = null; S.error = ""; shown = {}; S.me = readMe();
      history.replaceState(null, "", location.pathname + "#book"); init();
    }
  });

  function on(f, name) { var el = f.elements[name]; return !!el && (el.type === "checkbox" ? el.checked : el.value === "1"); }
  root.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, L = t();
    if (!on(f, "terms") || f.name.value.trim().length < 2 || f.phone.value.trim().length < 9) { S.error = L.e.validation; render(); return; }
    var vals = { name: f.name.value, phone: f.phone.value, notes: f.notes.value, remember: on(f, "remember") };
    S.busy = true; S.error = ""; render();
    post("", { serviceId: S.service, staffId: S.staff, date: S.date, start: S.start, name: vals.name, phone: vals.phone, notes: vals.notes || undefined, marketingConsent: on(f, "mkt"), terms: true, website: f.website.value })
      .then(function (d) {
        S.busy = false;
        if (d._ok && d.token) {
          if (vals.remember) { saveMe(vals); S.me = readMe(); } else { forgetMe(); S.me = null; }
          cache = {};
          history.replaceState(null, "", "?booking=" + encodeURIComponent(d.token) + "#book");
          return openManage(d.token).then(function () { root.scrollIntoView({ behavior: "smooth", block: "start" }); });
        }
        S.error = L.e[d.error] || L.err;
        render();
        var nf = document.getElementById("bkForm");
        if (nf && nf.terms.type === "checkbox") { nf.name.value = vals.name; nf.phone.value = vals.phone; nf.notes.value = vals.notes; nf.terms.checked = true; nf.remember.checked = vals.remember; }
        if (d.error === "slot_taken") { var dt = S.date; fetchDays(S.service, S.staff, true).then(function (days) { applyDays(days); S.date = dt; loadSlots(); }); }
      }).catch(function () { S.busy = false; S.error = L.err; render(); });
  });

  // Re-render when the site language toggles (keeps typed values).
  new MutationObserver(function () {
    var f = document.getElementById("bkForm"), v = f && f.terms.type === "checkbox" && { n: f.name.value, p: f.phone.value, o: f.notes.value, t: f.terms.checked, m: f.mkt.checked, r: f.remember.checked };
    render();
    var g = document.getElementById("bkForm");
    if (g && v) { g.name.value = v.n; g.phone.value = v.p; g.notes.value = v.o; g.terms.checked = v.t; g.mkt.checked = v.m; g.remember.checked = v.r; }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function init() {
    S.cfg = null; render();
    get("/config").then(function (d) {
      S.cfg = d;
      if (d.open && d.services.length === 1) S.service = d.services[0].id;
      if (d.open && d.staff.length === 1) S.staff = d.staff[0].id;
      render();
      prefetchAll();
      if (S.service) loadDays();
    }).catch(function () { S.cfg = { open: false }; render(); });
  }

  var token = new URLSearchParams(location.search).get("booking");
  if (token && /^[A-Za-z0-9_-]{20,64}$/.test(token)) { openManage(token).then(function () { root.scrollIntoView({ block: "start" }); }); }
  else init();
})();
