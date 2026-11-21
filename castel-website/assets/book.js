/* =====================================================================
   CASTEL STUDIO · עמוד קביעת תור ייעודי (/book/)
   עיצוב ושלבים בלבד. כל הנתונים, הזמינות והתורים מגיעים מאותה מערכת ניהול
   (CASTEL STUDIO OS) ומאותו API של קביעת התורים באתר. אין כאן מסד נתונים נפרד.
   ===================================================================== */
(function () {
  "use strict";
  var API = "https://castel-studio-delta.vercel.app/api/public/booking";
  var root = document.querySelector("[data-castel-book-page]");
  if (!root) return;

  var T = {
    he: {
      title: "קביעת תור", intro: "בוחרים שירות, יום ושעה. התור נקבע תוך דקה.", privacy: "מדיניות פרטיות", a11y: "הצהרת נגישות", backSite: "חזרה לאתר",
      steps: ["שירות", "יום", "שעה", "פרטים", "אישור"], stepOf: "שלב {n} מתוך 5", back: "חזרה",
      h1: "בחירת שירות", h1s: "בחרו את הטיפול שמתאים לכם", h2: "בחירת יום", h2s: "הימים המסומנים פנויים לקביעה", h3: "בחירת שעה", h4: "הפרטים שלך", h4s: "כדי שנוכל לשמור לך את התור", h5: "אישור קביעת התור", h5s: "בדקו שהכול נכון ואשרו",
      barber: "ספר", any: "כל ספר פנוי", min: "דק׳", loading: "טוען…",
      prevM: "החודש הקודם", nextM: "החודש הבא", wd: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"], legendFree: "יש שעות פנויות", legendNone: "סגור / מלא", free: "פנוי", full: "אין שעות פנויות",
      noDays: "אין כרגע ימים פנויים לשירות הזה. נסו שירות אחר או צרו קשר.", noTimes: "אין שעות פנויות ביום הזה. חזרו ובחרו יום אחר.",
      morning: "בוקר", noon: "צהריים", evening: "ערב", premNote: "★ שעות פרימיום, שמורות לתור פרימיום.",
      name: "שם מלא", phone: "טלפון נייד", note: "הערה (לא חובה)",
      terms: "אני מאשר/ת שמירת הפרטים לצורך ניהול התור וקבלת אישור ותזכורת (<a href=\"/privacy/\" target=\"_blank\">מדיניות פרטיות</a>).", mkt: "אשמח לקבל עדכונים ומבצעים (לא חובה).", remember: "לזכור את השם והטלפון במכשיר הזה (נשמר רק בטלפון שלך)",
      next: "המשך לאישור", confirm: "אישור קביעת תור", sending: "קובע את התור…",
      service: "שירות", date: "תאריך", timeL: "שעה", duration: "משך", price: "מחיר", customer: "שם", phoneL: "טלפון", noteL: "הערה", status: "סטטוס",
      hi: "שלום {n} 👋", savedDetails: "הפרטים שמורים במכשיר הזה", editDetails: "עריכת פרטים", notMe: "לא אני",
      quickNote: "בלחיצה על אישור קביעת תור את/ה מאשר/ת שימוש בפרטים לניהול התור.",
      ref: "מספר הזמנה", google: "Google Calendar", shareAppt: "שתף את התור", details: "צפה בפרטי התור", detailsSub: "בקשות מיוחדות, תזכורת והאזור האישי", styleAttached: "הסגנון שבחרת צורף לתור ✓",
      live: { pending: "ממתין לאישור", confirmed: "התור אושר", soon: "התור מתקרב", delay: "יש עיכוב", ready: "אפשר להיכנס", completed: "התור הושלם", cancelled: "התור בוטל", no_show: "לא הגעת" }, delayBy: "כ־{n} דק׳", shareText: "נתראה ב־CASTEL STUDIO ✂️ {s} · {d} בשעה {t}",
      booked: "התור נקבע", pending: "הבקשה התקבלה. נאשר בהקדם", cancelled: "התור בוטל", cal: "הוספה ליומן", cancel: "ביטול התור", cancelQ: "לבטל את התור?",
      save: "שמרו את הקישור הזה כדי לנהל את התור:", copy: "העתקה", copied: "הועתק", again: "קביעת תור נוסף", home: "חזרה לאתר",
      rvAsk: "נשמח לשמוע ממך ✨", rvAskSub: "איך החוויה ב־CASTEL STUDIO? כמה מילים וכוכבים עוזרים לנו מאוד.", rvText: "מה תרצה לספר? (לא חובה)", rvName: "השם שיופיע", rvSend: "שליחת ביקורת", rvLater: "אחר כך", rvThanks: "תודה רבה! 🙏", rvThanksSub: "הביקורת שלך פורסמה באתר.", rvPick: "בחרו דירוג בכוכבים", rvLeave: "השארת ביקורת", rvYours: "הביקורת שלך", rvEdit: "עריכה", rvTitle: "מה הלקוחות אומרים", rvCount: "{n} ביקורות", rvStars: ["גרוע", "לא משהו", "בסדר", "טוב מאוד", "מושלם"], close: "סגירה",
      tooLate: "כבר מאוחר מדי לבטל אונליין. התקשרו למספרה.", cancelUntil: "ביטול אונליין אפשרי עד {h} שעות לפני התור.",
      closed: "קביעת תורים אונליין תיפתח בקרוב.", contact: "בינתיים אפשר לפנות אלינו:", err: "משהו השתבש. נסו שוב.", notFound: "התור לא נמצא.",
      st: { CONFIRMED: "מאושר", SCHEDULED: "ממתין לאישור", CANCELLED: "בוטל", COMPLETED: "הושלם", NO_SHOW: "לא הגיע" }, premium: "Premium",
      e: { slot_taken: "השעה הזאת נתפסה הרגע. בחרו שעה אחרת.", phone: "מספר הטלפון לא תקין.", limit: "כבר יש לכם תורים פתוחים. לשינוי צרו קשר עם המספרה.", blocked: "לא ניתן לקבוע תור אונליין. לפרטים צרו קשר עם המספרה.", rate_limited: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.", validation: "נא למלא שם וטלפון ולאשר את השמירה.", name: "נא למלא שם מלא.", phoneShort: "נא למלא מספר טלפון תקין.", terms: "נא לאשר את שמירת הפרטים.", disabled: "קביעת תורים סגורה כרגע." }
    },
    en: {
      title: "Book an appointment", intro: "Pick a service, a day and a time. Done in a minute.", privacy: "Privacy policy", a11y: "Accessibility", backSite: "Back to site",
      steps: ["Service", "Day", "Time", "Details", "Confirm"], stepOf: "Step {n} of 5", back: "Back",
      h1: "Choose a service", h1s: "Select the treatment that suits you", h2: "Choose a day", h2s: "Marked days have free times", h3: "Choose a time", h4: "Your details", h4s: "So we can hold your appointment", h5: "Confirm your booking", h5s: "Check everything and confirm",
      barber: "Barber", any: "Any available", min: "min", loading: "Loading…",
      prevM: "Previous month", nextM: "Next month", wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], legendFree: "Available", legendNone: "Closed / full", free: "free", full: "No free times",
      noDays: "No available days for this service right now. Try another service or contact us.", noTimes: "No free times on this day. Go back and pick another day.",
      morning: "Morning", noon: "Afternoon", evening: "Evening", premNote: "★ Premium hours, reserved for the premium appointment.",
      name: "Full name", phone: "Mobile phone", note: "Note (optional)",
      terms: "I agree my details are stored to manage this booking and to receive a confirmation and reminder (<a href=\"/privacy/\" target=\"_blank\">privacy policy</a>).", mkt: "Send me news and offers (optional).", remember: "Remember my name and phone on this device (stored only on your phone)",
      next: "Continue to confirmation", confirm: "Confirm booking", sending: "Booking…",
      service: "Service", date: "Date", timeL: "Time", duration: "Duration", price: "Price", customer: "Name", phoneL: "Phone", noteL: "Note", status: "Status",
      hi: "Hi {n} 👋", savedDetails: "Details saved on this device", editDetails: "Edit details", notMe: "Not me",
      quickNote: "By confirming you agree your details are used to manage this booking.",
      ref: "Booking ref", google: "Google Calendar", shareAppt: "Share", details: "Booking details", detailsSub: "Special requests, reminders and your account", styleAttached: "Your chosen style was attached ✓",
      live: { pending: "Awaiting confirmation", confirmed: "Confirmed", soon: "Coming up", delay: "Running late", ready: "Come in now", completed: "Completed", cancelled: "Cancelled", no_show: "Missed" }, delayBy: "~{n} min", shareText: "See you at CASTEL STUDIO ✂️ {s} · {d} at {t}",
      booked: "You're booked", pending: "Request received. We'll confirm soon", cancelled: "Booking cancelled", cal: "Add to calendar", cancel: "Cancel booking", cancelQ: "Cancel this booking?",
      save: "Keep this link to manage your booking:", copy: "Copy", copied: "Copied", again: "Book another", home: "Back to site",
      rvAsk: "We'd love your feedback ✨", rvAskSub: "How was your CASTEL STUDIO experience? A few words and stars help us a lot.", rvText: "Anything to share? (optional)", rvName: "Name to show", rvSend: "Send review", rvLater: "Later", rvThanks: "Thank you! 🙏", rvThanksSub: "Your review is now live on the website.", rvPick: "Choose a star rating", rvLeave: "Leave a review", rvYours: "Your review", rvEdit: "Edit", rvTitle: "What clients say", rvCount: "{n} reviews", rvStars: ["Poor", "Meh", "OK", "Very good", "Perfect"], close: "Close",
      tooLate: "Too late to cancel online. Please call the shop.", cancelUntil: "Online cancellation up to {h}h before.",
      closed: "Online booking opens soon.", contact: "Meanwhile, reach us:", err: "Something went wrong. Please try again.", notFound: "Booking not found.",
      st: { CONFIRMED: "Confirmed", SCHEDULED: "Awaiting confirmation", CANCELLED: "Cancelled", COMPLETED: "Completed", NO_SHOW: "No-show" }, premium: "Premium",
      e: { slot_taken: "That time was just taken. Pick another.", phone: "Invalid phone number.", limit: "You already have upcoming bookings. Contact the shop to change.", blocked: "Online booking isn't available. Please contact the shop.", rate_limited: "Too many attempts. Try again in a few minutes.", validation: "Please fill name and phone and accept.", name: "Please enter your full name.", phoneShort: "Please enter a valid phone number.", terms: "Please accept storing your details.", disabled: "Booking is closed right now." }
    }
  };
  // Customer-facing descriptions and imagery (presentation only — prices, durations and IDs come from the system).
  var LOOK = [
    { test: function (s) { return s.premiumOnly; }, img: "/images/hero-m.webp", he: "תספורת מחוץ לשעות הפעילות", en: "A haircut outside regular opening hours" },
    { test: function (s) { return /גזיר/.test(s.he); }, img: "/images/gallery/04.webp", he: "תספורת גזירות כל הראש בסטייל אופנתי", en: "Full scissor cut in a fashionable style" },
    { test: function (s) { return /גבר/.test(s.he); }, img: "/images/gallery/06.webp", he: "תספורת משולבת עם עיצוב לזקן", en: "Haircut combined with beard styling" }
  ];
  function look(s) { for (var i = 0; i < LOOK.length; i++) if (LOOK[i].test(s)) return LOOK[i]; return { img: "/images/gallery/02.webp", he: "", en: "" }; }

  var lang = function () { return document.documentElement.lang === "en" ? "en" : "he"; };
  var t = function () { return T[lang()]; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var get = function (p) { return fetch(API + p, { cache: "no-store" }).then(function (r) { return r.json().then(function (d) { d._status = r.status; return d; }); }); };
  var post = function (p, body) { return fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { d._ok = r.ok; return d; }); }); };
  var fmt = function (d, o) { return new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", Object.assign({ timeZone: "UTC" }, o)).format(new Date(d + "T12:00:00Z")); };
  var longDay = function (d) { return fmt(d, { weekday: "long", day: "numeric", month: "long" }); };
  var svcName = function (s) { return lang() === "en" && s.en && s.en !== s.he ? s.en : s.he; };

  // Same on-device memory as the homepage booking form (shared keys, so returning customers are recognised everywhere).
  var MEM = "castel.booking.me";
  // MY CASTEL: this device's private key (issued by the system after a booking on this device or opening a booking link).
  var DEV = "castel.booking.device", REF = "castel.ref";
  function readDev() { try { var d = localStorage.getItem(DEV); return d && /^[A-Za-z0-9_-]{30,64}$/.test(d) ? d : ""; } catch (e) { return ""; } }
  function saveDev(d) { try { if (d && /^[A-Za-z0-9_-]{30,64}$/.test(d)) localStorage.setItem(DEV, d); } catch (e) { /* private mode */ } }
  function readRef() { try { var v = JSON.parse(localStorage.getItem(REF) || "null"); return v && v.code && v.until > Date.now() ? v.code : ""; } catch (e) { return ""; } }
  var PORTAL = API.replace(/\/booking$/, "/portal"), ME_API = API.replace(/\/booking$/, "/me");
  function claimDevice(token) { // a booking link proves who the customer is → this device can open MY CASTEL
    fetch(ME_API + "/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, d: readDev() || undefined }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.deviceToken) saveDev(d.deviceToken); }).catch(function () { /* optional */ });
  }
  function readMe() { try { var v = JSON.parse(localStorage.getItem(MEM) || "null"); return v && typeof v.name === "string" && typeof v.phone === "string" ? v : null; } catch (e) { return null; } }
  function saveMe(v) { try { localStorage.setItem(MEM, JSON.stringify({ name: v.name.trim().slice(0, 80), phone: v.phone.trim().slice(0, 20) })); } catch (e) { /* private mode */ } }
  function forgetMe() { try { localStorage.removeItem(MEM); } catch (e) { /* ignore */ } }

  var S = { step: 1, dir: "fwd", cfg: null, service: "", staff: "any", date: "", month: "", days: null, slots: null, start: null,
    me: readMe(), form: { name: "", phone: "", notes: "", terms: false, mkt: false, remember: true }, error: "", busy: false, manage: null, token: "" };
  if (S.me) { S.form.name = S.me.name; S.form.phone = S.me.phone; S.form.terms = true; }

  // ── availability cache (one request per service returns all days with their times) ──
  var cache = {}, FRESH = 90000;
  function fetchDays(svc, staff, force) {
    var k = svc + "|" + staff, c = cache[k];
    if (!force && c && Date.now() - c.at < FRESH) return c.p || Promise.resolve(c.days);
    var e = { at: Date.now(), days: null, p: null };
    e.p = get("/days?serviceId=" + svc + "&staffId=" + staff + "&slots=1").then(function (d) { e.days = d.days || []; e.p = null; return e.days; }).catch(function () { delete cache[k]; return []; });
    cache[k] = e; return e.p;
  }
  function applyDays(days) {
    S.days = days;
    var ff = days.filter(function (x) { return x.free > 0; })[0];
    if (!S.month || !days.some(function (x) { return x.date.slice(0, 7) === S.month; })) S.month = ff ? ff.date.slice(0, 7) : (days[0] ? days[0].date.slice(0, 7) : "");
  }
  function loadDays(force) {
    var k = S.service + "|" + S.staff;
    S.days = null; S.date = ""; S.slots = null; S.start = null;
    var c = cache[k];
    if (!force && c && c.days && Date.now() - c.at < FRESH) { applyDays(c.days); return; }
    fetchDays(S.service, S.staff, force).then(function (days) { if (k !== S.service + "|" + S.staff) return; applyDays(days); if (S.step === 2) render(); });
  }
  function loadSlots() {
    S.start = null;
    var day = (S.days || []).filter(function (x) { return x.date === S.date; })[0];
    if (day && day.slots) { S.slots = day.slots; return; }
    S.slots = null; var key = S.service + S.staff + S.date;
    get("/slots?serviceId=" + S.service + "&staffId=" + S.staff + "&date=" + S.date).then(function (d) { if (key === S.service + S.staff + S.date) { S.slots = d.slots || []; if (S.step === 3) render(); } })
      .catch(function () { S.slots = []; if (S.step === 3) render(); });
  }

  // ── building blocks ──
  function svcObj() { return S.cfg && S.cfg.services.filter(function (s) { return s.id === S.service; })[0]; }
  function slotObj() { return (S.slots || []).filter(function (x) { return x.start === S.start; })[0]; }
  function progress() {
    var L = t();
    return '<ol class="bp-prog" aria-label="' + esc(L.stepOf.replace("{n}", S.step)) + '">' + L.steps.map(function (s, i) {
      var n = i + 1; return '<li class="' + (n < S.step ? "done" : n === S.step ? "cur" : "") + '"' + (n === S.step ? ' aria-current="step"' : "") + ">" + s + "</li>";
    }).join("") + "</ol>";
  }
  function bar() {
    var L = t();
    var back = S.step > 1 ? '<button type="button" class="bp-back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' + L.back + "</button>" : "<span></span>";
    return '<div class="bp-bar">' + back + '<span class="bp-stepno">' + esc(L.stepOf.replace("{n}", S.step)) + "</span></div>";
  }
  function picked() {
    var L = t(), out = [], s = svcObj(), sl = slotObj();
    if (S.step > 1 && s) out.push(esc(svcName(s)));
    if (S.step > 2 && S.date) out.push(esc(fmt(S.date, { weekday: "short", day: "numeric", month: "numeric" })));
    if (S.step > 3 && sl) out.push('<bdi dir="ltr">' + sl.label + "</bdi>");
    return out.length ? '<div class="bp-picked">' + out.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" : "";
  }
  function head(h, sub) { return '<h2 class="bp-h" tabindex="-1">' + h + (sub ? "<small>" + sub + "</small>" : "") + "</h2>"; }

  function stepService() {
    var L = t(), c = S.cfg, note = c.note && c.note[lang()];
    return reviewsStrip() + head(L.h1, L.h1s) + (note ? '<p class="bp-note">' + esc(note) + "</p>" : "") + '<div class="bp-svcs">' + c.services.map(function (s) {
      var lk = look(s), on = S.service === s.id, desc = lk[lang()];
      return '<button type="button" class="bp-svc' + (on ? " on" : "") + (s.premiumOnly ? " prem" : "") + '" data-svc="' + esc(s.id) + '" aria-pressed="' + on + '">' +
        '<span class="bp-svc-img"><img src="' + lk.img + '" alt="" loading="lazy" decoding="async"></span>' +
        '<span class="bp-svc-body">' + (s.premiumOnly ? '<span class="bp-badge">★ ' + L.premium + "</span>" : "") +
        '<span class="bp-svc-name">' + esc(svcName(s)) + "</span>" + (desc ? '<span class="bp-svc-desc">' + esc(desc) + "</span>" : "") +
        '<span class="bp-svc-meta"><span class="dur">' + s.durationMin + " " + L.min + '</span><span class="price"><span class="bp-cur">₪</span>' + s.price + "</span></span></span>" +
        '<span class="bp-svc-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>';
    }).join("") + "</div>";
  }
  function stepDay() {
    var L = t(), h = head(L.h2, L.h2s) + picked();
    if (S.cfg.staff.length > 1) h += '<div class="bp-staff">' + [{ id: "any", name: L.any }].concat(S.cfg.staff).map(function (p) { return '<button type="button" class="bp-chip' + (S.staff === p.id ? " on" : "") + '" data-staff="' + esc(p.id) + '" aria-pressed="' + (S.staff === p.id) + '">' + esc(p.name) + "</button>"; }).join("") + "</div>";
    if (S.days === null) return h + '<div class="bp-skel" style="height:330px"></div>';
    if (!S.days.some(function (d) { return d.free > 0; })) return h + '<p class="bp-note">' + L.noDays + "</p>";
    var map = {}, months = [];
    S.days.forEach(function (d) { map[d.date] = d.free; var m = d.date.slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
    var m = S.month || months[0], mi = months.indexOf(m), y = +m.slice(0, 4), mo = +m.slice(5, 7);
    var first = new Date(Date.UTC(y, mo - 1, 1)), lead = first.getUTCDay(), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate(), today = S.days[0].date;
    var rtl = lang() === "he";
    h += '<div class="bp-cal"><div class="bp-cal-head">' +
      '<button type="button" class="bp-mnav" data-month="' + (months[mi - 1] || "") + '" aria-label="' + L.prevM + '"' + (mi > 0 ? "" : " disabled") + ">" + (rtl ? "›" : "‹") + "</button>" +
      '<p class="bp-cal-title">' + esc(new Intl.DateTimeFormat(rtl ? "he-IL" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)) + "</p>" +
      '<button type="button" class="bp-mnav" data-month="' + (months[mi + 1] || "") + '" aria-label="' + L.nextM + '"' + (mi < months.length - 1 ? "" : " disabled") + ">" + (rtl ? "‹" : "›") + "</button></div>" +
      '<div class="bp-grid" role="grid">' + L.wd.map(function (w) { return '<span class="bp-wd">' + w + "</span>"; }).join("");
    for (var i = 0; i < lead; i++) h += '<span class="bp-day" aria-hidden="true"></span>';
    for (var d = 1; d <= dim; d++) {
      var ds = m + "-" + String(d).padStart(2, "0"), inR = ds in map, free = map[ds] || 0, sel = S.date === ds;
      var cls = "bp-day" + (inR ? (free > 0 ? " avail" : " none") : "") + (sel ? " on" : "") + (ds === today ? " today" : "");
      var lbl = esc(longDay(ds) + " · " + (free > 0 ? free + " " + L.free : L.full));
      h += free > 0 ? '<button type="button" class="' + cls + '" data-date="' + ds + '" aria-pressed="' + sel + '" aria-label="' + lbl + '">' + d + "</button>"
        : '<span class="' + cls + '"' + (inR ? ' aria-label="' + lbl + '"' : ' aria-hidden="true"') + ">" + d + "</span>";
    }
    return h + '</div><div class="bp-legend"><span><i></i>' + L.legendFree + '</span><span><i class="x"></i>' + L.legendNone + "</span></div></div>";
  }
  function stepTime() {
    var L = t(), h = head(L.h3, esc(longDay(S.date))) + picked();
    if (S.slots === null) return h + '<div class="bp-skel" style="height:200px"></div>';
    if (!S.slots.length) return h + '<p class="bp-note">' + L.noTimes + "</p>";
    var groups = [[L.morning, []], [L.noon, []], [L.evening, []]];
    S.slots.forEach(function (x) { var hr = parseInt(x.label, 10); groups[hr < 12 ? 0 : hr < 17 ? 1 : 2][1].push(x); });
    groups.forEach(function (g) {
      if (!g[1].length) return;
      h += '<div class="bp-times-group"><h3>' + g[0] + '</h3><div class="bp-times">' + g[1].map(function (x) {
        return '<button type="button" class="bp-time' + (x.premium ? " prem" : "") + (S.start === x.start ? " on" : "") + '" data-start="' + x.start + '" dir="ltr" aria-pressed="' + (S.start === x.start) + '">' + x.label + "</button>";
      }).join("") + "</div></div>";
    });
    if (S.slots.some(function (x) { return x.premium; })) h += '<p class="bp-muted bp-small" style="margin-top:12px">' + L.premNote + "</p>";
    return h;
  }
  function stepDetails() {
    var L = t(), f = S.form;
    return head(L.h4, L.h4s) + picked() + '<form class="bp-form" id="bpForm" novalidate>' +
      '<label class="bp-field">' + L.name + '<input name="name" autocomplete="name" maxlength="80" required value="' + esc(f.name) + '"></label>' +
      '<label class="bp-field">' + L.phone + '<input name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="050-0000000" maxlength="20" required value="' + esc(f.phone) + '"></label>' +
      '<label class="bp-field">' + L.note + '<input name="notes" maxlength="500" value="' + esc(f.notes) + '"></label>' +
      '<input name="website" tabindex="-1" autocomplete="off" class="bp-hp" aria-hidden="true">' +
      '<label class="bp-check"><input type="checkbox" name="terms"' + (f.terms ? " checked" : "") + "> <span>" + L.terms + "</span></label>" +
      '<label class="bp-check"><input type="checkbox" name="mkt"' + (f.mkt ? " checked" : "") + "> <span>" + L.mkt + "</span></label>" +
      '<label class="bp-check"><input type="checkbox" name="remember"' + (f.remember ? " checked" : "") + "> <span>" + L.remember + "</span></label>" +
      (S.error ? '<p class="bp-err" role="alert">' + esc(S.error) + "</p>" : "") +
      '<button class="bp-btn" type="submit">' + L.next + "</button></form>";
  }
  function summary(s, date, label, premium, extra) {
    var L = t(), lk = look(s);
    return '<div class="bp-sum"><div class="bp-sum-head"><img src="' + lk.img + '" alt=""><div><b>' + esc(svcName(s)) + (premium ? ' <span class="bp-badge" style="vertical-align:middle">★</span>' : "") + "</b><span>" + esc(lk[lang()] || "") + "</span></div></div>" +
      '<dl class="bp-dl"><dt>' + L.date + "</dt><dd>" + esc(longDay(date)) + "</dd><dt>" + L.timeL + '</dt><dd><bdi dir="ltr">' + esc(label) + "</bdi></dd><dt>" + L.duration + "</dt><dd>" + s.durationMin + " " + L.min + "</dd>" +
      (extra || "") + "<dt>" + L.price + '</dt><dd class="price"><span class="bp-cur">₪</span>' + s.price + "</dd></dl>";
  }
  function stepConfirm() {
    var L = t(), s = svcObj(), sl = slotObj() || { label: "" }, f = S.form;
    var who = "<dt>" + L.customer + "</dt><dd>" + esc(f.name) + "</dd><dt>" + L.phoneL + '</dt><dd><bdi dir="ltr">' + esc(f.phone) + "</bdi></dd>" + (f.notes ? "<dt>" + L.noteL + "</dt><dd>" + esc(f.notes) + "</dd>" : "");
    var h = head(S.me && !S.editing ? esc(L.hi.replace("{n}", f.name.split(" ")[0])) : L.h5, L.h5s) + summary(s, S.date, sl.label, sl.premium, who) +
      '<div class="bp-edit"><span>' + (S.me ? L.savedDetails : "") + '</span><span><button type="button" class="bp-link" data-edit>' + L.editDetails + "</button>" + (S.me ? ' · <button type="button" class="bp-link" data-forget>' + L.notMe + "</button>" : "") + "</span></div></div>";
    return h + '<div class="bp-confirm">' + (S.error ? '<p class="bp-err" role="alert">' + esc(S.error) + "</p>" : "") +
      '<button type="button" class="bp-btn" data-confirm' + (S.busy ? " disabled" : "") + ">" + (S.busy ? L.sending : L.confirm) + "</button>" +
      (S.me ? '<p class="bp-muted bp-small" style="margin:0;text-align:center">' + L.quickNote + "</p>" : "") + "</div>";
  }

  // ── Reviews ──
  var RV_API = API.replace(/\/booking$/, "/reviews");
  function stars(n) { var o = ""; for (var i = 1; i <= 5; i++) o += i <= n ? "★" : "☆"; return o; }
  var reviews = null;
  function loadReviews() { fetch(RV_API, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) { reviews = d; if (S.step === 1 && !S.manage) render(); }).catch(function () { /* optional */ }); }
  function reviewsStrip() {
    if (!reviews || !reviews.count) return "";
    var L = t();
    return '<section class="bp-rvs" aria-label="' + esc(L.rvTitle) + '"><div class="bp-rvs-head"><span class="bp-rvs-avg">' + reviews.average.toFixed(1) + '</span><span><b class="bp-stars-s" aria-hidden="true">' + stars(Math.round(reviews.average)) + '</b><small>' + L.rvTitle + " · " + L.rvCount.replace("{n}", reviews.count) + "</small></span></div>" +
      '<div class="bp-rvs-list">' + reviews.items.map(function (r) {
        return '<figure class="bp-rv"><b class="bp-stars-s" aria-label="' + r.rating + '/5">' + stars(r.rating) + "</b>" + (r.text ? "<blockquote>" + esc(r.text) + "</blockquote>" : "") + "<figcaption>" + esc(r.name) + "</figcaption></figure>";
      }).join("") + "</div></section>";
  }
  function openReview() {
    var m0 = S.manage || {};
    if (window.CastelReview) return window.CastelReview.open({ token: S.token, name: (S.form && S.form.name) || m0.name || "", current: m0.review, onDone: function (rating, text) { if (S.manage) { S.manage.review = { rating: rating, text: text }; renderManage(); } } });
    var L = t(), m = S.manage || {}, cur = m.review || { rating: 0, text: "" };
    var name = (S.form && S.form.name) || m.name || "";
    var box = document.createElement("div");
    box.className = "bp-modal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "rvT");
    box.innerHTML = '<div class="bp-modal-card"><button type="button" class="bp-modal-x" data-x aria-label="' + L.close + '">✕</button>' +
      '<p class="bp-modal-eye">CASTEL STUDIO</p><h2 id="rvT">' + L.rvAsk + "</h2><p class=\"bp-muted bp-small\">" + L.rvAskSub + "</p>" +
      '<form novalidate><div class="bp-rate" role="radiogroup" aria-label="' + L.rvPick + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="' + (cur.rating === n) + '" data-r="' + n + '" aria-label="' + n + " · " + L.rvStars[n - 1] + '">★</button>'; }).join("") + "</div>" +
      '<p class="bp-rate-lbl" aria-live="polite">' + (cur.rating ? L.rvStars[cur.rating - 1] : "&nbsp;") + "</p>" +
      '<label class="bp-field">' + L.rvText + '<textarea name="text" maxlength="600" rows="3">' + esc(cur.text) + "</textarea></label>" +
      '<label class="bp-field">' + L.rvName + '<input name="name" maxlength="60" value="' + esc(name) + '"></label><input name="website" tabindex="-1" autocomplete="off" class="bp-hp" aria-hidden="true">' +
      '<p class="bp-err" role="alert" hidden></p><button class="bp-btn" type="submit">' + L.rvSend + '</button><button type="button" class="bp-btn ghost sm bp-later" data-x>' + L.rvLater + "</button></form></div>";
    document.body.appendChild(box); document.body.style.overflow = "hidden";
    var rating = cur.rating, prevFocus = document.activeElement;
    function paint() { box.querySelectorAll("[data-r]").forEach(function (b) { var n = +b.dataset.r; b.classList.toggle("on", n <= rating); b.setAttribute("aria-checked", String(n === rating)); }); box.querySelector(".bp-rate-lbl").innerHTML = rating ? L.rvStars[rating - 1] : "&nbsp;"; }
    function close() { box.classList.add("out"); document.body.style.overflow = ""; setTimeout(function () { box.remove(); }, 250); if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    paint();
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest("[data-x]")) return close();
      var r = e.target.closest("[data-r]"); if (r) { rating = +r.dataset.r; paint(); box.querySelector(".bp-err").hidden = true; }
    });
    box.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, err = box.querySelector(".bp-err"), btn = f.querySelector("[type=submit]");
      if (!rating) { err.textContent = L.rvPick; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = L.loading;
      fetch(RV_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: S.token, rating: rating, text: f.text.value, name: f.name.value, website: f.website.value }) })
        .then(function (r) { return r.json().then(function (d) { d._ok = r.ok; return d; }); })
        .then(function (d) {
          if (!d._ok) throw new Error(d.error || "x");
          if (S.manage) S.manage.review = { rating: rating, text: f.text.value };
          box.querySelector(".bp-modal-card").innerHTML = '<div class="bp-ok" style="margin-top:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2>' + L.rvThanks + '</h2><p class="bp-muted bp-small">' + L.rvThanksSub + '</p><button type="button" class="bp-btn sm" data-x style="margin-top:14px">' + L.close + "</button>";
          renderManage();
        }).catch(function (x) { btn.disabled = false; btn.textContent = L.rvSend; err.textContent = (L.e[x.message] || L.err); err.hidden = false; });
    });
    setTimeout(function () { var first = box.querySelector("[data-r]"); if (first) try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 50);
  }

  function renderManage() {
    var L = t(), m = S.manage;
    if (m.error) { root.innerHTML = '<div class="bp-done"><h2>' + L.notFound + '</h2><div class="bp-row"><button type="button" class="bp-btn sm" data-again>' + L.again + "</button></div></div>"; return; }
    var cancelled = m.status === "CANCELLED";
    var title = cancelled ? L.cancelled : m.status === "CONFIRMED" ? L.booked + (m.firstName ? ", " + esc(m.firstName) : "") + "!" : L.pending;
    var link = location.origin + "/book/?booking=" + encodeURIComponent(S.token);
    var s = { he: m.service ? m.service.he : "", en: m.service ? m.service.en : "", durationMin: m.durationMin || "", price: m.price || 0, premiumOnly: /פרימיום/.test(m.service ? m.service.he : "") };
    var extra = (m.name ? "<dt>" + L.customer + "</dt><dd>" + esc(m.name) + "</dd>" : "") + (m.staff ? "<dt>" + L.barber + "</dt><dd>" + esc(m.staff) + "</dd>" : "") +
      (m.ref ? "<dt>" + L.ref + '</dt><dd><bdi dir="ltr" style="letter-spacing:.12em">' + esc(m.ref) + "</bdi></dd>" : "") +
      "<dt>" + L.status + '</dt><dd><span class="bp-st s-' + esc(m.status) + (m.live ? " lv-" + esc(m.live) : "") + '">' + esc(m.live ? L.live[m.live] || m.live : L.st[m.status] || m.status) + (m.live === "delay" && m.delayMin ? " · " + esc(L.delayBy.replace("{n}", m.delayMin)) : "") + "</span></dd>";
    var h = '<div class="bp-done">' + (cancelled ? "" : '<div class="bp-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>') + "<h2>" + title + "</h2>" + summary(s, m.date, m.time, false, extra) + "</div>";
    if (!cancelled && !m.past) {
      if (S.styleAttached) h += '<p class="bp-muted bp-small" style="color:var(--gold2)">' + L.styleAttached + "</p>";
      h += '<div class="bp-row"><a class="bp-btn ghost sm" href="' + API + "/ics?t=" + encodeURIComponent(S.token) + '">' + L.cal + "</a>" + (m.google ? '<a class="bp-btn ghost sm" href="' + esc(m.google) + '" target="_blank" rel="noopener">' + L.google + "</a>" : "") +
        '<button type="button" class="bp-btn ghost sm" data-share-appt>' + L.shareAppt + "</button>" + (m.canCancel ? '<button type="button" class="bp-btn ghost sm bp-danger" data-cancel>' + L.cancel + "</button>" : "") + "</div>";
      h += '<div class="bp-row"><a class="bp-btn sm" href="/my/?booking=' + encodeURIComponent(S.token) + '">✦ ' + L.details + '</a></div><p class="bp-muted bp-small" style="margin-top:6px">' + L.detailsSub + "</p>";
      if (!m.canCancel) h += '<p class="bp-muted bp-small">' + L.cancelUntil.replace("{h}", Math.round(m.cancelNoticeMin / 60)) + "</p>";
      h += '<p class="bp-muted bp-small" style="margin:18px 0 0;text-align:start">' + L.save + '</p><div class="bp-linkbox"><input readonly dir="ltr" value="' + esc(link) + '"><button type="button" class="bp-btn ghost sm" data-copy>' + L.copy + "</button></div>";
    }
    if (S.error) h += '<p class="bp-err" role="alert" style="margin-top:12px">' + esc(S.error) + "</p>";
    if (!cancelled) h += m.review ? '<div class="bp-rv-mine"><span>' + L.rvYours + ' <b class="bp-stars-s">' + stars(m.review.rating) + '</b></span><button type="button" class="bp-link" data-review>' + L.rvEdit + "</button></div>"
      : '<div class="bp-row"><button type="button" class="bp-btn ghost sm" data-review>★ ' + L.rvLeave + "</button></div>";
    h += '<div class="bp-row"><button type="button" class="bp-btn sm" data-again>' + L.again + '</button><a class="bp-btn ghost sm" href="/">' + L.home + "</a></div></div>";
    root.innerHTML = h;
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function render(animate) {
    var L = t();
    if (S.manage) return renderManage();
    var c = S.cfg;
    if (!c) { root.innerHTML = progress() + '<div class="bp-panel"><div class="bp-skel"></div><div class="bp-skel"></div></div>'; return; }
    if (!c.open) {
      var ph = c.phone ? '<div class="bp-row"><a class="bp-btn ghost sm" href="tel:' + esc(c.phone) + '" dir="ltr">' + esc(c.phone) + '</a><a class="bp-btn sm" href="https://wa.me/' + esc(String(c.phone).replace(/\D/g, "").replace(/^0/, "972")) + '" target="_blank" rel="noopener">WhatsApp</a></div>' : "";
      root.innerHTML = '<div class="bp-done"><h2>' + L.closed + "</h2>" + (c.phone ? '<p class="bp-muted">' + L.contact + "</p>" + ph : "") + "</div>";
      return;
    }
    var body = S.step === 1 ? stepService() : S.step === 2 ? stepDay() : S.step === 3 ? stepTime() : S.step === 4 ? stepDetails() : stepConfirm();
    root.innerHTML = progress() + '<section class="bp-panel' + (animate && !reduce ? " in-" + S.dir : "") + '">' + bar() + body + "</section>";
  }
  function go(n, dir) {
    S.step = n; S.dir = dir || (n > S.step ? "fwd" : "back"); S.error = "";
    render(true);
    var top = root.getBoundingClientRect().top + window.pageYOffset - 70;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    var hd = root.querySelector(".bp-h"); if (hd) try { hd.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }
  function readForm() {
    var f = document.getElementById("bpForm"); if (!f) return;
    S.form = { name: f.name.value, phone: f.phone.value, notes: f.notes.value, terms: f.terms.checked, mkt: f.mkt.checked, remember: f.remember.checked, website: f.website.value };
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    var L = t();
    if (b.dataset.svc) {
      if (S.service !== b.dataset.svc) { S.service = b.dataset.svc; loadDays(); }
      b.classList.add("on"); // instant feedback, then glide on
      setTimeout(function () { go(2, "fwd"); }, reduce ? 0 : 180);
    } else if (b.dataset.staff) { S.staff = b.dataset.staff; loadDays(); render(); }
    else if (b.classList.contains("bp-mnav")) { if (b.dataset.month) { S.month = b.dataset.month; render(); } }
    else if (b.dataset.date) { if (S.date !== b.dataset.date) { S.date = b.dataset.date; loadSlots(); } go(3, "fwd"); }
    else if (b.dataset.start) { S.start = Number(b.dataset.start); go(S.me && !S.editing ? 5 : 4, "fwd"); }
    else if (b.hasAttribute("data-back")) { if (S.step === 4) readForm(); go(S.step === 5 && S.me && !S.editing ? 3 : S.step - 1, "back"); }
    else if (b.hasAttribute("data-edit")) { S.editing = true; go(4, "back"); }
    else if (b.hasAttribute("data-forget")) { forgetMe(); S.me = null; S.editing = true; S.form = { name: "", phone: "", notes: "", terms: false, mkt: false, remember: true }; go(4, "back"); }
    else if (b.hasAttribute("data-confirm")) submit();
    else if (b.hasAttribute("data-cancel")) {
      if (!confirm(L.cancelQ)) return;
      post("/cancel", { token: S.token }).then(function (d) { if (d._ok) { S.error = ""; return openManage(S.token); } S.error = d.error === "too_late" ? L.tooLate : L.err; render(); });
    } else if (b.hasAttribute("data-copy")) {
      var inp = root.querySelector(".bp-linkbox input"); inp.select();
      (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.resolve(document.execCommand("copy"))).then(function () { b.textContent = L.copied; });
    } else if (b.hasAttribute("data-share-appt") && S.manage) {
      // Only what and when — never the private link or personal details.
      var m2 = S.manage, txt = L.shareText.replace("{s}", m2.service ? svcName(m2.service) : "").replace("{d}", fmt(m2.date, { weekday: "short", day: "numeric", month: "numeric" })).replace("{t}", m2.time);
      if (navigator.share) navigator.share({ title: "CASTEL STUDIO", text: txt }).catch(function () { /* cancelled */ });
      else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { b.textContent = L.copied; });
    } else if (b.hasAttribute("data-review")) { openReview();
    } else if (b.hasAttribute("data-again")) {
      S.manage = null; S.token = ""; S.service = ""; S.date = ""; S.days = null; S.slots = null; S.start = null; S.error = ""; S.editing = false; S.me = readMe();
      if (S.me) S.form = { name: S.me.name, phone: S.me.phone, notes: "", terms: true, mkt: false, remember: true };
      history.replaceState(null, "", location.pathname); S.step = 1; init();
    }
  });

  root.addEventListener("input", function (e) {
    if (e.target.getAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid");
    var er = root.querySelector("#bpForm .bp-err"); if (er) { er.remove(); S.error = ""; }
  });
  root.addEventListener("change", function (e) { if (e.target.name === "terms") { var er = root.querySelector("#bpForm .bp-err"); if (er) { er.remove(); S.error = ""; } } });

  root.addEventListener("submit", function (e) {
    e.preventDefault(); readForm();
    var L = t(), f = S.form, form = e.target, bad = null;
    if (f.name.trim().length < 2) bad = ["name", L.e.name];
    else if (f.phone.replace(/\D/g, "").length < 9) bad = ["phone", L.e.phoneShort];
    else if (!f.terms) bad = ["terms", L.e.terms];
    if (bad) {
      S.error = bad[1]; render();
      var el = document.getElementById("bpForm").elements[bad[0]]; if (el.type !== "checkbox") el.setAttribute("aria-invalid", "true"); el.focus();
      return;
    }
    void form; go(5, "fwd");
  });

  var sending = false;
  function submit() {
    if (sending) return; // one tap = one booking request
    var L = t(), f = S.form;
    sending = true; S.busy = true; S.error = ""; render();
    post("", { serviceId: S.service, staffId: S.staff, date: S.date, start: S.start, name: f.name, phone: f.phone, notes: f.notes || undefined, marketingConsent: !!f.mkt, terms: true, website: f.website || "", deviceToken: readDev() || undefined })
      .then(function (d) {
        sending = false; S.busy = false;
        if (d._ok && d.token) {
          if (f.remember) { saveMe(f); S.me = readMe(); } else { forgetMe(); S.me = null; }
          if (d.deviceToken) saveDev(d.deviceToken);
          var pend = (function () { try { var v = JSON.parse(localStorage.getItem("castel.pendingStyle") || "null"); return v && v.style && v.until > Date.now() ? v.style : ""; } catch (x) { return ""; } })();
          if (pend) fetch(PORTAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request.save", token: d.token, request: { style: pend } }) })
            .then(function (r) { if (r.ok) { S.styleAttached = true; try { localStorage.removeItem("castel.pendingStyle"); } catch (x) { /* ignore */ } if (S.manage) renderManage(); } }).catch(function () { /* optional */ });
          var refCode = readRef();
          if (refCode) fetch(PORTAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "referral.claim", token: d.token, code: refCode }) })
            .then(function () { try { localStorage.removeItem(REF); } catch (e) { /* ignore */ } }).catch(function () { /* optional */ });
          window.dispatchEvent(new Event("castel:booked"));
          cache = {};
          history.replaceState(null, "", location.pathname + "?booking=" + encodeURIComponent(d.token));
          return openManage(d.token).then(function () { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); setTimeout(function () { if (S.manage && !S.manage.error && !S.manage.review) openReview(); }, 1400); });
        }
        S.error = L.e[d.error] || L.err;
        if (d.error === "slot_taken") {
          var dt = S.date; S.start = null;
          fetchDays(S.service, S.staff, true).then(function (days) { applyDays(days); S.date = dt; loadSlots(); go(3, "back"); S.error = L.e.slot_taken; render(); });
          return;
        }
        if (d.error === "phone" || d.error === "validation") { S.editing = true; go(4, "back"); S.error = L.e[d.error]; render(); return; }
        render();
      }).catch(function () { sending = false; S.busy = false; S.error = L.err; render(); });
  }

  function openManage(token) {
    S.token = token;
    return get("/manage?t=" + encodeURIComponent(token)).then(function (d) { S.manage = d._status === 200 ? d : { error: true }; render(); })
      .catch(function () { S.manage = { error: true }; render(); });
  }

  // language toggle (same preference key as the rest of the site)
  function applyLang(l) {
    var h = document.documentElement; h.lang = l; h.dir = l === "en" ? "ltr" : "rtl";
    try { localStorage.setItem("castel-lang", l); } catch (e) { /* private mode */ }
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === l)); });
    document.querySelectorAll("[data-t]").forEach(function (el) { var k = el.getAttribute("data-t"); if (T[l][k]) el.textContent = T[l][k]; });
    document.querySelectorAll("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", T[l][el.getAttribute("data-t-aria")]); });
    document.title = T[l].title + " · CASTEL STUDIO";
    if (S.step === 4) readForm();
    render();
  }
  document.querySelectorAll("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { applyLang(b.dataset.lang); }); });

  function init() {
    S.cfg = null; render();
    get("/config").then(function (d) {
      S.cfg = d;
      if (d.open && d.staff.length === 1) S.staff = d.staff[0].id;
      render(true);
      if (d.open) d.services.forEach(function (sv) { fetchDays(sv.id, S.staff); }); // prefetch: days and times are ready before the customer taps
      // "Book again" / waitlist from MY CASTEL: the service (and maybe the day) is already chosen — the customer still picks and confirms.
      var qp = new URLSearchParams(location.search), qs = qp.get("service"), qd = qp.get("date");
      if (d.open && qs && d.services.some(function (sv) { return sv.id === qs; })) {
        S.service = qs; loadDays(); go(2, "fwd");
        if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) fetchDays(S.service, S.staff).then(function (days) {
          if (S.service !== qs || S.step !== 2) return;
          applyDays(days);
          if (days.some(function (x) { return x.date === qd && x.free > 0; })) { S.date = qd; S.month = qd.slice(0, 7); loadSlots(); go(3, "fwd"); } else render();
        });
      }
    }).catch(function () { S.cfg = { open: false }; render(); });
  }

  applyLang(lang());
  loadReviews();
  var tok = new URLSearchParams(location.search).get("booking");
  if (tok && /^[A-Za-z0-9_-]{20,64}$/.test(tok)) { openManage(tok); claimDevice(tok); } else init();
})();
