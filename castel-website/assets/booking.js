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
  var manageLink = function (token) { return location.origin + location.pathname + "?booking=" + encodeURIComponent(token) + "#book"; };

  var S = { cfg: null, service: "", staff: "any", date: "", slots: null, start: null, busy: false, error: "", manage: null, token: "" };

  // title is trusted markup built here (static strings + escaped values)
  function step(n, title, inner) { return '<div class="bk-step"><h3 class="bk-h"><span class="bk-n">' + n + "</span><span>" + title + "</span></h3>" + inner + "</div>"; }
  function chip(on, attrs, inner) { return '<button type="button" class="bk-chip' + (on ? " on" : "") + '" aria-pressed="' + on + '" ' + attrs + ">" + inner + "</button>"; }

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
    }).join("") + "</div>");
    if (c.staff.length > 1) h += step(n++, esc(L.barber), '<div class="bk-wrap">' + chip(S.staff === "any", 'data-staff="any"', L.any) + c.staff.map(function (p) { return chip(S.staff === p.id, 'data-staff="' + esc(p.id) + '"', esc(p.name)); }).join("") + "</div>");
    if (S.service) h += step(n++, esc(L.day), '<div class="bk-days">' + c.dates.map(function (d) { return chip(S.date === d, 'data-date="' + d + '"', esc(dayLabel(d))); }).join("") + "</div>");
    if (S.service && S.date) {
      var inner = S.slots === null ? '<p class="bk-muted">' + L.loading + "</p>" : !S.slots.length ? '<p class="bk-muted">' + L.noTimes + "</p>"
        : '<div class="bk-times">' + S.slots.map(function (x) { return chip(S.start === x.start, 'data-start="' + x.start + '" dir="ltr"', x.label); }).join("") + "</div>";
      h += step(n++, esc(L.time) + ' <span class="bk-muted bk-small">· ' + esc(dayLabel(S.date, true)) + "</span>", inner);
    }
    if (S.service && S.date && S.start != null) {
      var svc = c.services.filter(function (s) { return s.id === S.service; })[0];
      var slot = (S.slots || []).filter(function (x) { return x.start === S.start; })[0];
      h += '<form class="bk-step" id="bkForm" novalidate><h3 class="bk-h"><span class="bk-n">' + n + "</span>" + L.details + "</h3>" +
        '<p class="bk-sum"><b>' + esc(svcName(svc)) + "</b> · " + esc(dayLabel(S.date, true)) + ' · <span dir="ltr">' + (slot ? slot.label : "") + "</span> · ₪" + svc.price + "</p>" +
        '<div class="bk-grid2"><label class="bk-field">' + L.name + '<input name="name" autocomplete="name" maxlength="80" required></label>' +
        '<label class="bk-field">' + L.phone + '<input name="phone" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="050-0000000" maxlength="20" required></label></div>' +
        '<label class="bk-field">' + L.note + '<input name="notes" maxlength="500"></label>' +
        '<input name="website" tabindex="-1" autocomplete="off" class="bk-hp" aria-hidden="true">' +
        '<label class="bk-check"><input type="checkbox" name="terms"> ' + L.terms + "</label>" +
        '<label class="bk-check"><input type="checkbox" name="mkt"> ' + L.mkt + "</label>" +
        (S.error ? '<p class="bk-err" role="alert">' + esc(S.error) + "</p>" : "") +
        '<button class="btn bk-submit" type="submit"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? L.loading : L.book) + "</button></form>";
    }
    root.innerHTML = h;
  }

  function renderManage() {
    var L = t(), m = S.manage;
    if (m.error) { root.innerHTML = '<div class="bk-card bk-center"><p class="bk-strong">' + L.notFound + '</p><button type="button" class="btn ghost sm" data-again>' + L.again + "</button></div>"; return; }
    var cancelled = m.status === "CANCELLED";
    var title = cancelled ? L.cancelled : m.status === "CONFIRMED" ? L.booked + (m.firstName ? ", " + esc(m.firstName) : "") + "!" : L.pending;
    var link = manageLink(S.token);
    var h = '<div class="bk-card"><p class="bk-title">' + (cancelled ? "" : '<span class="bk-ok">✓</span>') + title + "</p>" +
      '<ul class="bk-list"><li>' + esc(m.service ? svcName(m.service) : "") + (m.price ? " · ₪" + m.price : "") + "</li><li>" + esc(dayLabel(m.date, true)) + ' · <span dir="ltr">' + m.time + "</span></li>" + (m.staff ? "<li>" + esc(m.staff) + "</li>" : "") + "</ul>";
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
    S.slots = null; S.start = null; render();
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
    if (b.dataset.svc) { S.service = b.dataset.svc; S.start = null; S.error = ""; S.date ? loadSlots() : render(); }
    else if (b.dataset.staff) { S.staff = b.dataset.staff; S.date ? loadSlots() : render(); }
    else if (b.dataset.date) { S.date = b.dataset.date; loadSlots(); }
    else if (b.dataset.start) { S.start = Number(b.dataset.start); S.error = ""; render(); var f = document.getElementById("bkForm"); if (f) f.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
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
      S.manage = null; S.token = ""; S.service = ""; S.date = ""; S.slots = null; S.start = null; S.error = "";
      history.replaceState(null, "", location.pathname + "#book"); init();
    }
  });

  root.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, L = t();
    if (!f.terms.checked || f.name.value.trim().length < 2 || f.phone.value.trim().length < 9) { S.error = L.e.validation; render(); return; }
    var vals = { name: f.name.value, phone: f.phone.value, notes: f.notes.value };
    S.busy = true; S.error = ""; render();
    post("", { serviceId: S.service, staffId: S.staff, date: S.date, start: S.start, name: vals.name, phone: vals.phone, notes: vals.notes || undefined, marketingConsent: f.mkt.checked, terms: true, website: f.website.value })
      .then(function (d) {
        S.busy = false;
        if (d._ok && d.token) {
          history.replaceState(null, "", "?booking=" + encodeURIComponent(d.token) + "#book");
          return openManage(d.token).then(function () { root.scrollIntoView({ behavior: "smooth", block: "start" }); });
        }
        S.error = L.e[d.error] || L.err;
        render();
        var nf = document.getElementById("bkForm");
        if (nf) { nf.name.value = vals.name; nf.phone.value = vals.phone; nf.notes.value = vals.notes; nf.terms.checked = true; }
        if (d.error === "slot_taken") loadSlots();
      }).catch(function () { S.busy = false; S.error = L.err; render(); });
  });

  // Re-render when the site language toggles (keeps typed values).
  new MutationObserver(function () {
    var f = document.getElementById("bkForm"), v = f && { n: f.name.value, p: f.phone.value, o: f.notes.value, t: f.terms.checked, m: f.mkt.checked };
    render();
    var g = document.getElementById("bkForm");
    if (g && v) { g.name.value = v.n; g.phone.value = v.p; g.notes.value = v.o; g.terms.checked = v.t; g.mkt.checked = v.m; }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  function init() {
    S.cfg = null; render();
    get("/config").then(function (d) {
      S.cfg = d;
      if (d.open && d.services.length === 1) S.service = d.services[0].id;
      if (d.open && d.staff.length === 1) S.staff = d.staff[0].id;
      render();
    }).catch(function () { S.cfg = { open: false }; render(); });
  }

  var token = new URLSearchParams(location.search).get("booking");
  if (token && /^[A-Za-z0-9_-]{20,64}$/.test(token)) { openManage(token).then(function () { root.scrollIntoView({ block: "start" }); }); }
  else init();
})();
