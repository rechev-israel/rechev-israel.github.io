/* =====================================================================
   MY CASTEL · האזור האישי של לקוחות CASTEL STUDIO
   כל הנתונים מגיעים ממערכת הניהול (CASTEL STUDIO OS) דרך מפתח המכשיר הפרטי
   שנוצר כשהלקוח קבע תור מהמכשיר הזה או פתח את קישור התור שלו.
   השרת מחליט של מי הנתונים, לא הדפדפן.
   ===================================================================== */
(function () {
  "use strict";
  var BASE = "https://castel-studio-delta.vercel.app/api/public";
  var PORTAL = BASE + "/portal";
  var root = document.querySelector("[data-my-castel]"), tabsEl = document.getElementById("myTabs");
  if (!root) return;
  var DEV = "castel.booking.device", ME = "castel.booking.me";
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function device() { var d = read(DEV); return d && /^[A-Za-z0-9_-]{30,64}$/.test(d) ? d : ""; }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lang = function () { return document.documentElement.lang === "en" ? "en" : "he"; };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var T = {
    he: {
      title: "MY CASTEL · האזור האישי", backSite: "חזרה לאתר", loading: "טוען…", err: "משהו השתבש. נסו שוב.", saved: "נשמר ✓", close: "סגירה", cancel: "ביטול",
      tabs: ["בית", "תורים", "המועדון", "התספורת", "הגלריה"],
      hello: "שלום, <em>{n}</em>", member: "חבר/ה ב־CASTEL STUDIO מאז {d}", visits: "{n} ביקורים",
      next: "התור הבא שלך", noNext: "אין תור קרוב", noNextSub: "מתי נתראה שוב?", book: "קביעת תור", again: "קביעת תור חוזר", againSub: "אותו שירות, בלי לבחור שוב",
      cal: "ליומן", waze: "Waze", maps: "מפות", cancelAppt: "ביטול התור", cancelQ: "לבטל את התור?", tooLate: "כבר מאוחר מדי לבטל אונליין. התקשרו למספרה.", call: "התקשרות",
      notes: "עדכונים", nReminder: "תזכורת: התור שלך ב־{d} בשעה {t}", nWaitlist: "התפנה תור שמתאים לרשימת ההמתנה שלך: {d} בשעה {t}", nWaitlistGo: "לקביעה", nReward: "מחכה לך הטבה: {l}", nVip: "הודעה לחברי VIP",
      quick: "פעולות מהירות", qBook: "תור חדש", qBookSub: "יום ושעה פנויים", qWait: "רשימת המתנה", qWaitSub: "נודיע כשמתפנה", qCut: "התספורת שלי", qCutSub: "שהספר יידע בדיוק", qLooks: "הגלריה שלי", qLooksSub: "תמונות פרטיות",
      upcoming: "תורים קרובים", history: "היסטוריה", noHistory: "עוד אין היסטוריית תורים.", rate: "דירוג", rated: "דירגת", st: { CONFIRMED: "מאושר", SCHEDULED: "ממתין לאישור", CANCELLED: "בוטל", COMPLETED: "הושלם", NO_SHOW: "לא הגיע" },
      wl: "רשימת המתנה", wlSub: "לא מצאת שעה שמתאימה? נודיע לך כשמתפנה. התור לא נשמר אוטומטית: מי שקובע ראשון מקבל את השעה.", wlSvc: "שירות", wlDates: "ימים מתאימים (עד 5)", wlFrom: "משעה", wlTo: "עד שעה", wlHow: "איך להודיע", wlPortal: "ב־MY CASTEL", wlWa: "גם בוואטסאפ (כשהמספרה מחוברת)", wlJoin: "הצטרפות לרשימה", wlLeave: "יציאה מהרשימה", wlMatch: "התפנה: {d} בשעה {t}", wlActive: "ממתין", wlNone: "בחרו לפחות יום אחד.",
      club: "CASTEL CLUB", clubOff: "מועדון הלקוחות עוד לא פעיל. כשיופעל, הביקורים שלך כבר ייספרו.", toReward: "עוד {n} ביקורים ל{r}", rewardReady: "הגעת להטבה! הציגו אותה במספרה.", rewards: "ההטבות שלי", noRewards: "עדיין אין הטבות.", rs: { AVAILABLE: "זמינה", REDEEMED: "מומשה", EXPIRED: "פגה", VOID: "בוטלה" }, validDays: "תוקף ההטבה: {n} ימים",
      vip: "CASTEL VIP", vipSince: "חבר/ה מאז {d}", vipBenefits: "ההטבות שלך", vipNot: "חברות VIP ניתנת ללקוחות קבועים.", vipAuto: "אחרי {n} ביקורים שהושלמו מצטרפים אוטומטית ({v}/{n}).",
      friends: "חבר מביא חבר", friendsSub: "שתפו את הקוד. חבר חדש שקובע תור דרך הקישור שלכם ומשלים ביקור, מזכה אתכם ב{r}.", friendGets: "והחבר מקבל {r}.", share: "שיתוף", copy: "העתקה", copied: "הועתק", invited: "הוזמנו", qualified: "הצליחו", pendingR: "בהמתנה", shareText: "קובעים תור ב־CASTEL STUDIO עם הקישור שלי:",
      cut: "MY HAIRCUT · התספורת שלי", cutSub: "שמרו מה אתם אוהבים, והספר יראה את זה לפני התור. הפרטים והתמונה שתבחרו כאן גלויים לצוות המספרה.", style: "סגנון תספורת", fade: "סוג פייד", guards: "מספרי מכונה", top: "אורך למעלה", beard: "זקן", styling: "עיצוב / מוצר", cutNotes: "הערות אישיות", refPhoto: "תמונת רפרנס (מהגלריה שלך)", noRef: "בלי תמונה", saveCut: "שמירה", updated: "עודכן {d}",
      ph: { style: "למשל: קרופ טקסטורה", fade: "למשל: סקין פייד גבוה", guards: "למשל: 0 בצדדים, 3 למעלה", top: "למשל: 4 ס״מ", beard: "למשל: קו חד, קצר", styling: "למשל: מט, וקס", notes: "כל מה שחשוב לך" },
      looks: "MY LOOKS · הגלריה שלי", looksSub: "פרטית לגמרי. הצוות רואה רק תמונה שבחרתם לשתף או לסמן לתור הבא.", upload: "העלאת תמונה", uploading: "מעלה…", favorite: "מועדפת", shared: "משותפת עם הספר", forNext: "לתור הבא", note: "הערה", del: "מחיקת התמונה", delQ: "למחוק את התמונה לצמיתות?", useNext: "לבחור לתור הבא", tooBig: "התמונה גדולה מדי.", limit: "הגעת למספר התמונות המקסימלי.", badImg: "הקובץ אינו תמונה תקינה.",
      fb: "איך היה הביקור?", fbService: "דירוג השירות", fbText: "כמה מילים (לא חובה)", fbSuggest: "הצעה לשיפור (פרטי, רק למספרה)", fbPublic: "אפשר לפרסם את הביקורת באתר", fbSend: "שליחה", fbThanks: "תודה על המשוב! 🙏",
      loginT: "MY CASTEL", loginH: "האזור האישי שלך", loginSub: "התורים, המועדון, התספורת שלך והגלריה הפרטית, במקום אחד.", loginHow: "האזור האישי נפתח אוטומטית במכשיר שממנו קבעת תור, או אחרי שפותחים את הקישור של התור שלך.", loginBook: "קביעת תור", loginPhone: "צפייה בתורים לפי מספר טלפון", phone: "מספר טלפון", show: "הצגה", notFound: "לא מצאנו תורים על המספר הזה.",
      lockT: "האזור הפרטי נעול במכשיר הזה", lockS: "פתחו את MY CASTEL מהמכשיר שממנו קבעתם תור, או קבעו תור מכאן, והכול ייפתח.", logout: "התנתקות מהמכשיר"
    },
    en: {
      title: "MY CASTEL · My account", backSite: "Back to site", loading: "Loading…", err: "Something went wrong. Please try again.", saved: "Saved ✓", close: "Close", cancel: "Cancel",
      tabs: ["Home", "Bookings", "Club", "My cut", "Gallery"],
      hello: "Hello, <em>{n}</em>", member: "Member of CASTEL STUDIO since {d}", visits: "{n} visits",
      next: "Your next appointment", noNext: "No upcoming appointment", noNextSub: "When shall we see you again?", book: "Book now", again: "Book again", againSub: "Same service, no need to choose again",
      cal: "Calendar", waze: "Waze", maps: "Maps", cancelAppt: "Cancel booking", cancelQ: "Cancel this booking?", tooLate: "Too late to cancel online. Please call the shop.", call: "Call",
      notes: "Updates", nReminder: "Reminder: your appointment on {d} at {t}", nWaitlist: "A time matching your waitlist opened: {d} at {t}", nWaitlistGo: "Book it", nReward: "A reward is waiting: {l}", nVip: "VIP announcement",
      quick: "Quick actions", qBook: "New booking", qBookSub: "Free days & times", qWait: "Waitlist", qWaitSub: "We'll tell you", qCut: "My haircut", qCutSub: "So your barber knows", qLooks: "My gallery", qLooksSub: "Private photos",
      upcoming: "Upcoming", history: "History", noHistory: "No appointment history yet.", rate: "Rate", rated: "Rated", st: { CONFIRMED: "Confirmed", SCHEDULED: "Awaiting confirmation", CANCELLED: "Cancelled", COMPLETED: "Completed", NO_SHOW: "No-show" },
      wl: "Waitlist", wlSub: "No time that suits you? We'll tell you when one opens. Nothing is reserved automatically: whoever books first gets it.", wlSvc: "Service", wlDates: "Suitable days (up to 5)", wlFrom: "From", wlTo: "Until", wlHow: "How to notify", wlPortal: "In MY CASTEL", wlWa: "Also by WhatsApp (when the shop is connected)", wlJoin: "Join the waitlist", wlLeave: "Leave", wlMatch: "Opened: {d} at {t}", wlActive: "Waiting", wlNone: "Choose at least one day.",
      club: "CASTEL CLUB", clubOff: "The loyalty club isn't active yet. Your visits will already count when it starts.", toReward: "{n} more visits to {r}", rewardReady: "You've earned a reward! Show it at the shop.", rewards: "My rewards", noRewards: "No rewards yet.", rs: { AVAILABLE: "Available", REDEEMED: "Redeemed", EXPIRED: "Expired", VOID: "Void" }, validDays: "Valid for {n} days",
      vip: "CASTEL VIP", vipSince: "Member since {d}", vipBenefits: "Your benefits", vipNot: "VIP membership is for regular clients.", vipAuto: "Join automatically after {n} completed visits ({v}/{n}).",
      friends: "Refer a friend", friendsSub: "Share your code. A new friend who books with your link and completes a visit earns you {r}.", friendGets: "Your friend gets {r}.", share: "Share", copy: "Copy", copied: "Copied", invited: "Invited", qualified: "Succeeded", pendingR: "Pending", shareText: "Book at CASTEL STUDIO with my link:",
      cut: "MY HAIRCUT", cutSub: "Save what you like and your barber sees it before your appointment. These details and the photo you pick are visible to the shop's staff.", style: "Haircut style", fade: "Fade type", guards: "Clipper guards", top: "Length on top", beard: "Beard", styling: "Styling / product", cutNotes: "Personal notes", refPhoto: "Reference photo (from your gallery)", noRef: "No photo", saveCut: "Save", updated: "Updated {d}",
      ph: { style: "e.g. Textured crop", fade: "e.g. High skin fade", guards: "e.g. 0 sides, 3 top", top: "e.g. 4 cm", beard: "e.g. Sharp line, short", styling: "e.g. Matte, wax", notes: "Anything important to you" },
      looks: "MY LOOKS", looksSub: "Completely private. Staff only see a photo you share or mark for your next visit.", upload: "Upload a photo", uploading: "Uploading…", favorite: "Favorite", shared: "Shared with my barber", forNext: "For next visit", note: "Note", del: "Delete photo", delQ: "Delete this photo permanently?", useNext: "Use for my next visit", tooBig: "The photo is too large.", limit: "You've reached the photo limit.", badImg: "That file isn't a valid image.",
      fb: "How was your visit?", fbService: "Service rating", fbText: "A few words (optional)", fbSuggest: "Suggestion (private, shop only)", fbPublic: "You may publish my review on the website", fbSend: "Send", fbThanks: "Thanks for your feedback! 🙏",
      loginT: "MY CASTEL", loginH: "Your private area", loginSub: "Your bookings, club, haircut and private gallery in one place.", loginHow: "MY CASTEL opens automatically on the device you booked from, or after opening your booking link.", loginBook: "Book an appointment", loginPhone: "View bookings by phone number", phone: "Phone number", show: "Show", notFound: "No bookings found for this number.",
      lockT: "Private area locked on this device", lockS: "Open MY CASTEL on the device you booked from, or book from here, and everything opens.", logout: "Sign out of this device"
    }
  };
  var L = function () { return T[lang()]; };
  var fmtD = function (d, o) { return new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", Object.assign({ timeZone: "UTC" }, o)).format(new Date(d + "T12:00:00Z")); };
  var dShort = function (d) { return fmtD(d, { weekday: "short", day: "numeric", month: "numeric" }); };
  var dLong = function (d) { return fmtD(d, { weekday: "long", day: "numeric", month: "long" }); };
  var svcName = function (s) { return !s ? "" : lang() === "en" && s.en && s.en !== s.he ? s.en : s.he; };
  var hm = function (m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
  var ICON = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>',
    cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.2 7.8L20 19M8.2 16.2L20 5"/></svg>',
    img: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 5v14M5 12h14"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="22" height="22"><rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  function api(action, extra) {
    return fetch(PORTAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: action, device: device() }, extra || {})) })
      .then(function (r) { if (action === "ics") return r.ok ? r.text() : Promise.reject(new Error("x")); return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || "x"); e.status = r.status; throw e; } return d; }); });
  }
  function toast(msg) { var t = document.createElement("div"); t.className = "my-toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600); }

  var S = { tab: "home", data: null, err: "", phoneView: null };
  var photoUrls = {};
  function photoUrl(id) {
    if (photoUrls[id]) return Promise.resolve(photoUrls[id]);
    return fetch(PORTAL + "/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ device: device(), id: id }) })
      .then(function (r) { if (!r.ok) throw new Error("x"); return r.blob(); }).then(function (b) { photoUrls[id] = URL.createObjectURL(b); return photoUrls[id]; });
  }
  function hydratePhotos() { root.querySelectorAll("img[data-photo]").forEach(function (img) { photoUrl(img.dataset.photo).then(function (u) { img.src = u; }).catch(function () { /* removed */ }); }); }

  // ───────── views ─────────
  function svcById(id) { return (S.data.services || []).filter(function (s) { return s.id === id; })[0]; }
  function lastRebook() { return (S.data.history || []).filter(function (a) { return a.serviceId && a.status === "COMPLETED"; })[0] || (S.data.history || []).filter(function (a) { return a.serviceId; })[0]; }
  function bookUrl(svc, date) { return "/book/" + (svc ? "?service=" + encodeURIComponent(svc) + (date ? "&date=" + date : "") : ""); }

  function viewHome() {
    var l = L(), d = S.data, n = d.upcoming[0], h = "";
    h += '<p class="my-eyebrow">MY CASTEL</p><h1 class="my-hello">' + l.hello.replace("{n}", esc(d.firstName)) + '</h1><p class="my-sub">' + esc(l.member.replace("{d}", fmtD(d.memberSince, { month: "long", year: "numeric" }))) + " · " + l.visits.replace("{n}", d.visits) + "</p>";
    h += '<section class="my-sec"><h2>' + l.next + "</h2>";
    if (n) {
      h += '<div class="my-card gold my-next"><div class="my-date"><b>' + Number(n.date.slice(8, 10)) + "</b><span>" + esc(fmtD(n.date, { month: "short" })) + '</span></div><div><h3>' + esc(svcName(n.service)) + '</h3><p class="my-muted">' + esc(dLong(n.date)) + ' · <span class="my-time" dir="ltr">' + n.time + "</span></p>" +
        '<p class="my-muted">' + n.durationMin + (lang() === "he" ? " דק׳" : " min") + (n.staff ? " · " + esc(n.staff) : "") + " · " + (l.st[n.status] || n.status) + "</p></div>" +
        '<div class="my-row" style="grid-column:1/-1"><button type="button" class="my-chip" data-ics="' + n.id + '">' + ICON.cal + l.cal + '</button><a class="my-chip" href="' + esc(d.shop.waze) + '" target="_blank" rel="noopener">' + ICON.pin + l.waze + '</a><a class="my-chip" href="' + esc(d.shop.maps) + '" target="_blank" rel="noopener">' + ICON.pin + l.maps + "</a>" +
        (d.shop.phone ? '<a class="my-chip" href="tel:' + esc(d.shop.phone) + '">' + ICON.phone + l.call + "</a>" : "") + (n.canCancel ? '<button type="button" class="my-chip danger" data-cancel="' + n.id + '">' + l.cancelAppt + "</button>" : "") + "</div></div>";
    } else {
      h += '<div class="my-card"><h3>' + l.noNext + '</h3><p class="my-muted">' + l.noNextSub + '</p><div class="my-row"><a class="bp-btn sm" href="/book/">' + l.book + "</a>" + (lastRebook() ? '<a class="bp-btn ghost sm" href="' + bookUrl(lastRebook().serviceId) + '">' + l.again + "</a>" : "") + "</div></div>";
    }
    h += "</section>";
    var notes = (d.notifications || []).map(function (x) {
      if (x.kind === "reminder") return '<div class="my-note"><i aria-hidden="true">⏰</i><span>' + esc(l.nReminder.replace("{d}", dShort(x.date)).replace("{t}", x.time)) + "</span></div>";
      if (x.kind === "waitlist") return '<div class="my-note hot"><i aria-hidden="true">✨</i><span>' + esc(l.nWaitlist.replace("{d}", dShort(x.date)).replace("{t}", x.time)) + '</span><a class="bp-link" href="' + bookUrl(x.serviceId, x.date) + '">' + l.nWaitlistGo + "</a></div>";
      if (x.kind === "reward") return '<div class="my-note hot"><i aria-hidden="true">🎁</i><span>' + esc(l.nReward.replace("{l}", x.label)) + "</span></div>";
      if (x.kind === "vip") return '<div class="my-note"><i aria-hidden="true">👑</i><span><b>' + l.nVip + "</b><br>" + esc(x.text) + "</span></div>";
      return "";
    }).join("");
    if (notes) h += '<section class="my-sec"><h2>' + l.notes + '</h2><div class="my-notes">' + notes + "</div></section>";
    var rb = lastRebook();
    h += '<section class="my-sec"><h2>' + l.quick + '</h2><div class="my-quick">' +
      '<a class="my-q" href="/book/">' + ICON.plus + "<b>" + l.qBook + "</b><small>" + l.qBookSub + "</small></a>" +
      (rb ? '<a class="my-q" href="' + bookUrl(rb.serviceId) + '">' + ICON.repeat + "<b>" + l.again + "</b><small>" + esc(svcName(rb.service)) + "</small></a>" : '<button type="button" class="my-q" data-tab="appts" data-focus="wl">' + ICON.clock + "<b>" + l.qWait + "</b><small>" + l.qWaitSub + "</small></button>") +
      '<button type="button" class="my-q" data-tab="cut">' + ICON.cut + "<b>" + l.qCut + "</b><small>" + l.qCutSub + "</small></button>" +
      '<button type="button" class="my-q" data-tab="looks">' + ICON.img + "<b>" + l.qLooks + "</b><small>" + l.qLooksSub + "</small></button></div></section>";
    if (d.referral) h += '<section class="my-sec"><h2>' + l.friends + "</h2>" + referralCard(d.referral) + "</section>";
    if (d.club) h += '<section class="my-sec">' + clubCard() + "</section>";
    if (d.vip && d.vip.member) h += '<section class="my-sec">' + vipCard() + "</section>";
    return h;
  }

  function apptRow(a, upcoming) {
    var l = L(), act = "";
    if (upcoming) act = '<button type="button" class="my-chip" data-ics="' + a.id + '">' + ICON.cal + l.cal + "</button>" + (a.canCancel ? '<button type="button" class="my-chip danger" data-cancel="' + a.id + '">' + l.cancel + "</button>" : "");
    else {
      if (a.serviceId) act += '<a class="my-chip" href="' + bookUrl(a.serviceId) + '">' + ICON.repeat + l.again + "</a>";
      if (a.canReview) act += '<button type="button" class="my-chip" data-rate="' + a.id + '">★ ' + l.rate + "</button>";
      else if (a.rating) act += '<span class="my-stars" aria-label="' + l.rated + " " + a.rating + '/5">' + "★★★★★".slice(0, a.rating) + "</span>";
    }
    return '<div class="my-appt"><b>' + esc(svcName(a.service)) + '</b><div class="my-appt-act">' + act + '</div><p class="my-muted">' + esc(dShort(a.date)) + ' · <span dir="ltr">' + a.time + "</span> · " + (l.st[a.status] || a.status) + (a.price ? " · ₪" + a.price : "") + "</p></div>";
  }

  function viewAppts() {
    var l = L(), d = S.data, h = '<h1 class="my-hello">' + l.tabs[1] + "</h1>";
    h += '<section class="my-sec"><h2>' + l.upcoming + '</h2><div class="my-card">' + (d.upcoming.length ? d.upcoming.map(function (a) { return apptRow(a, true); }).join("") : '<p class="my-muted">' + l.noNext + '</p><div class="my-row"><a class="bp-btn sm" href="/book/">' + l.book + "</a></div>") + "</div></section>";
    h += '<section class="my-sec" id="wl"><h2>' + l.wl + '</h2><div class="my-card">' + waitlistBlock() + "</div></section>";
    h += '<section class="my-sec"><h2>' + l.history + '</h2><div class="my-card">' + (d.history.length ? d.history.map(function (a) { return apptRow(a, false); }).join("") : '<p class="my-muted">' + l.noHistory + "</p>") + "</div></section>";
    return h;
  }

  function waitlistBlock() {
    var l = L(), d = S.data, h = '<p class="my-muted">' + l.wlSub + "</p>";
    (d.waitlist || []).forEach(function (w) {
      var s = svcById(w.serviceId);
      h += '<div class="my-appt"><b>' + esc(s ? svcName(s) : "") + '</b><div class="my-appt-act">' + (w.match ? '<a class="bp-btn sm" href="' + bookUrl(w.serviceId, w.match.date) + '">' + l.nWaitlistGo + "</a>" : "") + '<button type="button" class="my-chip" data-leave="' + w.id + '">' + l.wlLeave + '</button></div><p class="my-muted">' +
        esc(w.dates.map(dShort).join(", ")) + ' · <span dir="ltr">' + hm(w.from) + "–" + hm(w.to) + "</span> · " + (w.match ? '<span style="color:var(--gold2)">' + esc(l.wlMatch.replace("{d}", dShort(w.match.date)).replace("{t}", w.match.time)) + "</span>" : l.wlActive) + "</p></div>";
    });
    var days = [], now = new Date();
    for (var i = 0; i < 14; i++) { var x = new Date(now.getTime() + i * 864e5); var ds = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(x); if (x.getDay() !== 6) days.push(ds); }
    var hours = []; for (var m = 7 * 60; m <= 23 * 60; m += 30) hours.push(m);
    var opt = function (sel) { return hours.map(function (m) { return '<option value="' + m + '"' + (m === sel ? " selected" : "") + ">" + hm(m) + "</option>"; }).join(""); };
    h += '<form class="my-form two" id="wlForm" style="margin-top:14px" novalidate><label class="bp-field full">' + l.wlSvc + '<select name="serviceId">' + (d.services || []).map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(svcName(s)) + "</option>"; }).join("") + "</select></label>" +
      '<fieldset class="full" style="border:0;padding:0;margin:0"><legend class="bp-field" style="margin-bottom:6px">' + l.wlDates + '</legend><div class="my-dates">' + days.map(function (ds) { return '<label><input type="checkbox" name="dates" value="' + ds + '">' + esc(dShort(ds)) + "</label>"; }).join("") + "</div></fieldset>" +
      '<label class="bp-field">' + l.wlFrom + '<select name="fromMin">' + opt(16 * 60) + '</select></label><label class="bp-field">' + l.wlTo + '<select name="toMin">' + opt(20 * 60) + "</select></label>" +
      '<label class="bp-field full">' + l.wlHow + '<select name="notify"><option value="portal">' + l.wlPortal + '</option><option value="whatsapp">' + l.wlWa + "</option></select></label>" +
      '<p class="bp-err full" role="alert" hidden></p><button class="bp-btn full" type="submit">' + l.wlJoin + "</button></form>";
    return h;
  }

  function clubCard() {
    var l = L(), c = S.data.club;
    if (!c) return '<div class="my-card"><p class="my-eyebrow">' + l.club + '</p><p class="my-muted">' + l.clubOff + "</p></div>";
    var reward = lang() === "en" ? c.rewardEn : c.reward, stamps = "";
    for (var i = 0; i < c.required; i++) stamps += '<span class="my-stamp' + (i < c.inCard ? " on" : "") + (i === c.required - 1 && i >= c.inCard ? " gift" : "") + '" aria-hidden="true"></span>';
    var avail = (S.data.rewards || []).filter(function (r) { return r.status === "AVAILABLE"; }).length;
    return '<div class="my-club" role="group" aria-label="' + l.club + " " + c.inCard + "/" + c.required + '"><div class="my-club-top"><div><p class="my-club-name">CASTEL CLUB</p><p class="my-muted" style="margin-top:6px">' + esc(S.data.name) + '</p></div><div class="my-club-big">' + c.inCard + '<small style="font-size:.45em;color:var(--muted)">/' + c.required + "</small></div></div>" +
      '<div class="my-stamps" style="grid-template-columns:repeat(' + Math.min(c.required, 5) + ',1fr)">' + stamps + "</div>" +
      '<div class="my-club-foot"><span>' + (avail ? l.rewardReady : esc(l.toReward.replace("{n}", c.remaining).replace("{r}", reward))) + "</span><span>" + l.visits.replace("{n}", c.visits) + "</span></div>" +
      (c.conditions ? '<p class="my-muted" style="margin-top:10px;font-size:12px">' + esc(c.conditions) + "</p>" : "") + "</div>";
  }
  function vipCard() {
    var l = L(), v = S.data.vip;
    if (!v) return "";
    if (!v.member) return '<div class="my-card"><p class="my-eyebrow">' + l.vip + '</p><p class="my-muted">' + l.vipNot + (v.autoMinVisits ? " " + esc(l.vipAuto.replace(/\{n\}/g, v.autoMinVisits).replace("{v}", Math.min(v.visits, v.autoMinVisits))) : "") + "</p></div>";
    return '<div class="my-vip" role="img" aria-label="CASTEL VIP ' + esc(S.data.name) + '"><div class="my-vip-top"><span class="my-vip-word">VIP</span><span class="my-vip-chip" aria-hidden="true"></span></div><div><p class="my-vip-name">' + esc(S.data.name) + '</p><p class="my-vip-since">CASTEL STUDIO · ' + esc(l.vipSince.replace("{d}", fmtD(v.since, { month: "long", year: "numeric" }))) + "</p></div></div>" +
      (v.benefits && v.benefits.length ? '<div class="my-card" style="margin-top:14px"><h3>' + l.vipBenefits + '</h3><ul class="my-benefits">' + v.benefits.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul></div>" : "");
  }

  // CASTEL FRIENDS card — used in the club tab, on the home screen and in the phone-number view.
  function referralCard(r) {
    var l = L();
    S.ref = r;
    return '<div class="my-card gold"><p class="my-muted">' + esc(l.friendsSub.replace("{r}", r.reward || (lang() === "he" ? "הטבה" : "a reward"))) + (r.friendReward ? " " + esc(l.friendGets.replace("{r}", r.friendReward)) : "") + "</p>" +
      '<div class="my-code"><b>' + esc(r.code) + '</b><span style="display:flex;gap:8px">' + (navigator.share ? '<button type="button" class="my-chip" data-share>' + l.share + "</button>" : "") + '<button type="button" class="my-chip" data-copy>' + l.copy + "</button></span></div>" +
      '<div class="my-stats"><div><b>' + r.invited + "</b><span>" + l.invited + "</span></div><div><b>" + r.qualified + "</b><span>" + l.qualified + "</span></div><div><b>" + r.pending + "</b><span>" + l.pendingR + "</span></div></div>" +
      (r.conditions ? '<p class="my-muted" style="margin-top:10px;font-size:12px">' + esc(r.conditions) + "</p>" : "") + "</div>";
  }

  function viewClub() {
    var l = L(), d = S.data, h = '<h1 class="my-hello">' + l.tabs[2] + "</h1>";
    h += '<section class="my-sec">' + clubCard() + "</section>";
    if (d.club || (d.rewards || []).length) {
      h += '<section class="my-sec"><h2>' + l.rewards + '</h2><div class="my-card">' + ((d.rewards || []).length ? d.rewards.map(function (r) {
        return '<div class="my-reward"><span>' + esc(r.label) + '<br><small class="my-muted">' + esc(dShort(r.earnedAt)) + (r.expiresAt && r.status === "AVAILABLE" ? " · " + esc(dShort(r.expiresAt)) : "") + '</small></span><span class="my-st' + (r.status === "AVAILABLE" ? " on" : "") + '">' + (l.rs[r.status] || r.status) + "</span></div>";
      }).join("") : '<p class="my-muted">' + l.noRewards + "</p>") + "</div></section>";
    }
    if (d.vip) h += '<section class="my-sec"><h2>' + l.vip + "</h2>" + vipCard() + "</section>";
    if (d.referral) h += '<section class="my-sec"><h2>' + l.friends + "</h2>" + referralCard(d.referral) + "</section>";
    return h;
  }

  function viewCut() {
    var l = L(), p = S.data.haircut || {}, photos = S.data.photos || [], f = function (k, label, ph) { return '<label class="bp-field">' + label + '<input name="' + k + '" maxlength="80" value="' + esc(p[k] || "") + '" placeholder="' + esc(ph) + '"></label>'; };
    return '<h1 class="my-hello">' + l.cut + '</h1><p class="my-sub">' + l.cutSub + "</p>" +
      '<form class="my-form two my-card" id="cutForm" style="margin-top:18px" novalidate>' +
      f("style", l.style, l.ph.style) + f("fade", l.fade, l.ph.fade) + f("guards", l.guards, l.ph.guards) + f("topLength", l.top, l.ph.top) + f("beard", l.beard, l.ph.beard) + f("styling", l.styling, l.ph.styling) +
      '<label class="bp-field full">' + l.cutNotes + '<textarea name="notes" maxlength="800" placeholder="' + esc(l.ph.notes) + '">' + esc(p.notes || "") + "</textarea></label>" +
      '<label class="bp-field full">' + l.refPhoto + '<select name="photoId"><option value="">' + l.noRef + "</option>" + photos.map(function (x, i) { return '<option value="' + x.id + '"' + (p.photoId === x.id ? " selected" : "") + ">" + esc(x.note || (lang() === "he" ? "תמונה " : "Photo ") + (photos.length - i)) + " · " + esc(dShort(x.date)) + "</option>"; }).join("") + "</select></label>" +
      (p.photoId ? '<div class="full" style="max-width:180px"><div class="my-ph"><img data-photo="' + esc(p.photoId) + '" alt=""></div></div>' : "") +
      '<p class="my-saved full" aria-live="polite">' + (p.updatedAt ? esc(l.updated.replace("{d}", dShort(p.updatedAt))) : "") + '</p><button class="bp-btn full" type="submit">' + l.saveCut + "</button></form>";
  }

  function viewLooks() {
    var l = L(), photos = S.data.photos || [], ref = S.data.haircut && S.data.haircut.photoId;
    return '<h1 class="my-hello">' + l.looks + '</h1><p class="my-sub">' + l.looksSub + '</p><div class="my-gal" style="margin-top:18px">' +
      '<label class="my-upload">' + ICON.plus + "<span>" + l.upload + '</span><input type="file" accept="image/*" data-upload></label>' +
      photos.map(function (x) {
        return '<figure class="my-ph"><img data-photo="' + x.id + '" alt="' + esc(x.note || "") + '"><span class="tags">' + (x.favorite ? "<span>★</span>" : "") + (x.shared ? "<span>✂</span>" : "") + (ref === x.id ? "<span>" + l.forNext + "</span>" : "") + "</span>" +
          (x.note ? "<figcaption>" + esc(x.note) + "</figcaption>" : "") + '<button type="button" class="open" data-photo-open="' + x.id + '" aria-label="' + esc(x.note || l.looks) + '"></button></figure>';
      }).join("") + "</div>";
  }

  function renderTabs() {
    var l = L(), keys = ["home", "appts", "club", "cut", "looks"], icons = [ICON.home, ICON.cal, ICON.crown, ICON.cut, ICON.img];
    tabsEl.hidden = false;
    tabsEl.innerHTML = keys.map(function (k, i) { return '<button type="button" data-tab="' + k + '"' + (S.tab === k ? ' aria-current="page"' : "") + ">" + icons[i] + "<span>" + l.tabs[i] + "</span></button>"; }).join("");
  }
  function render() {
    var l = L();
    document.title = l.title;
    if (S.phoneView) return renderPhoneView();
    if (!device()) return renderLogin();
    if (!S.data) { tabsEl.hidden = true; root.innerHTML = S.err ? '<p class="bp-err">' + esc(S.err) + '</p><div class="my-row"><button type="button" class="bp-btn sm" data-reload>' + (lang() === "he" ? "נסו שוב" : "Retry") + "</button></div>" : '<div class="my-skel"></div><div class="my-skel"></div><div class="my-skel"></div>'; return; }
    renderTabs();
    root.innerHTML = S.tab === "appts" ? viewAppts() : S.tab === "club" ? viewClub() : S.tab === "cut" ? viewCut() : S.tab === "looks" ? viewLooks() : viewHome();
    root.innerHTML += '<p style="margin-top:34px;text-align:center"><button type="button" class="bp-link" data-logout>' + l.logout + "</button></p>";
    hydratePhotos();
  }

  function renderLogin() {
    var l = L();
    tabsEl.hidden = true;
    root.innerHTML = '<div class="my-login"><p class="my-eyebrow">' + l.loginT + '</p><h1 class="my-hello">' + l.loginH + '</h1><p class="my-sub">' + l.loginSub + "</p>" +
      '<div class="my-card gold" style="margin-top:22px;text-align:start"><p class="my-muted">' + l.loginHow + '</p><div class="my-row"><a class="bp-btn" href="/book/">' + l.loginBook + "</a></div></div>" +
      '<form class="my-card my-form" id="phoneForm" style="margin-top:14px;text-align:start" novalidate><p class="my-muted">' + l.loginPhone + '</p><label class="bp-field">' + l.phone + '<input name="phone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" maxlength="20" placeholder="050-0000000"></label><p class="bp-err" role="alert" hidden></p><button class="bp-btn ghost" type="submit">' + l.show + "</button></form></div>";
    try { var me = JSON.parse(read(ME) || "null"); if (me && me.phone) root.querySelector("#phoneForm [name=phone]").value = me.phone; } catch (e) { /* ignore */ }
  }
  function renderPhoneView() {
    var l = L(), d = S.phoneView;
    tabsEl.hidden = true;
    var row = function (a) { return '<div class="my-appt"><b>' + esc(svcName(a.service)) + '</b><div class="my-appt-act"></div><p class="my-muted">' + esc(dShort(a.date)) + ' · <span dir="ltr">' + a.time + "</span> · " + (l.st[a.status] || a.status) + "</p></div>"; };
    root.innerHTML = '<p class="my-eyebrow">MY CASTEL</p><h1 class="my-hello">' + l.hello.replace("{n}", esc(d.firstName)) + '</h1><p class="my-sub">' + l.visits.replace("{n}", d.visits) + "</p>" +
      '<section class="my-sec"><h2>' + l.upcoming + '</h2><div class="my-card">' + (d.upcoming.length ? d.upcoming.map(row).join("") : '<p class="my-muted">' + l.noNext + "</p>") + "</div></section>" +
      (S.phoneRef ? '<section class="my-sec"><h2>' + l.friends + "</h2>" + referralCard(S.phoneRef) + "</section>" : "") +
      '<section class="my-sec"><div class="my-lock">' + ICON.lock + "<span><b>" + l.lockT + "</b>" + l.lockS + '</span></div><div class="my-row"><a class="bp-btn sm" href="/book/">' + l.book + '</a><button type="button" class="bp-btn ghost sm" data-back-login>' + l.close + "</button></div></section>" +
      '<section class="my-sec"><h2>' + l.history + '</h2><div class="my-card">' + (d.history.length ? d.history.slice(0, 20).map(row).join("") : '<p class="my-muted">' + l.noHistory + "</p>") + "</div></section>";
  }

  // ───────── actions ─────────
  function load() {
    S.err = ""; render();
    return api("overview").then(function (d) { S.data = d; render(); }).catch(function (e) {
      if (e.status === 401) { store(DEV, null); S.data = null; render(); return; }
      S.err = L().err; render();
    });
  }
  function go(tab, focus) {
    S.tab = tab; render();
    try { history.replaceState(null, "", location.pathname + (tab === "home" ? "" : "#" + tab)); } catch (e) { /* ignore */ }
    var el = focus && document.getElementById(focus);
    window.scrollTo({ top: el ? el.getBoundingClientRect().top + window.pageYOffset - 80 : 0, behavior: reduce ? "auto" : "smooth" });
  }

  function sheet(html, onReady) {
    var box = document.createElement("div"); box.className = "my-sheet"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = '<div class="my-sheet-card"><div style="display:flex;justify-content:flex-end"><button type="button" class="bp-close" data-x aria-label="' + L().close + '">✕</button></div>' + html + "</div>";
    document.body.appendChild(box); var prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    function close() { box.remove(); document.body.style.overflow = prev; document.removeEventListener("keydown", key); }
    function key(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", key);
    box.addEventListener("click", function (e) { if (e.target === box || e.target.closest("[data-x]")) close(); });
    if (onReady) onReady(box, close);
    return close;
  }

  function openPhoto(id) {
    var l = L(), x = (S.data.photos || []).filter(function (p) { return p.id === id; })[0]; if (!x) return;
    var isRef = S.data.haircut && S.data.haircut.photoId === id;
    sheet('<img data-big alt="' + esc(x.note || "") + '"><form class="my-form" style="margin-top:12px" novalidate>' +
      '<label class="my-toggle">' + l.favorite + '<input type="checkbox" name="favorite"' + (x.favorite ? " checked" : "") + "></label>" +
      '<label class="my-toggle">' + l.shared + '<input type="checkbox" name="shared"' + (x.shared ? " checked" : "") + "></label>" +
      '<label class="bp-field">' + l.note + '<input name="note" maxlength="300" value="' + esc(x.note || "") + '"></label>' +
      '<div class="my-row">' + (isRef ? "" : '<button type="button" class="bp-btn ghost sm" data-use-next>' + l.useNext + "</button>") + '<button type="submit" class="bp-btn sm">' + L().saveCut + "</button></div>" +
      '<button type="button" class="bp-link" data-del style="color:#f0c7c2;margin-top:6px">' + l.del + "</button></form>", function (box, close) {
      photoUrl(id).then(function (u) { box.querySelector("[data-big]").src = u; }).catch(function () { /* ignore */ });
      var f = box.querySelector("form");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        api("photo.update", { id: id, note: f.note.value, favorite: f.favorite.checked, sharedWithBarber: f.shared.checked }).then(function () { close(); toast(l.saved); load(); }).catch(function () { toast(l.err); });
      });
      box.addEventListener("click", function (e) {
        if (e.target.closest("[data-del]")) {
          if (!confirm(l.delQ)) return;
          api("photo.delete", { id: id }).then(function () { if (photoUrls[id]) { URL.revokeObjectURL(photoUrls[id]); delete photoUrls[id]; } close(); load(); }).catch(function () { toast(l.err); });
        } else if (e.target.closest("[data-use-next]")) {
          var p = Object.assign({}, S.data.haircut || {}, { photoId: id });
          api("haircut.save", { profile: p }).then(function () { close(); toast(l.saved); load(); }).catch(function () { toast(l.err); });
        }
      });
    });
  }

  function openRating(apptId) {
    var l = L(), rating = 0, sr = 0;
    var starsRow = function (name) { return '<div class="crv-rate bp-rate" data-row="' + name + '" style="justify-content:flex-start;display:flex;gap:4px">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + '/5" style="width:42px;height:42px;font-size:30px;color:#3a3833">★</button>'; }).join("") + "</div>"; };
    sheet('<h2 style="margin:0 0 6px;font-weight:300;font-size:24px">' + l.fb + "</h2>" + starsRow("r") + '<form class="my-form" style="margin-top:10px" novalidate><p class="bp-field" style="margin:0">' + l.fbService + "</p>" + starsRow("s") +
      '<label class="bp-field">' + l.fbText + '<textarea name="text" maxlength="600" rows="3"></textarea></label><label class="bp-field">' + l.fbSuggest + '<textarea name="suggestion" maxlength="600" rows="2"></textarea></label>' +
      '<label class="bp-check"><input type="checkbox" name="pub" checked> <span>' + l.fbPublic + '</span></label><p class="bp-err" role="alert" hidden></p><button class="bp-btn" type="submit">' + l.fbSend + "</button></form>", function (box, close) {
      function paint() { box.querySelectorAll("[data-row]").forEach(function (row) { var v = row.dataset.row === "r" ? rating : sr; row.querySelectorAll("[data-n]").forEach(function (b) { b.style.color = +b.dataset.n <= v ? "var(--gold)" : "#3a3833"; b.setAttribute("aria-pressed", String(+b.dataset.n === v)); }); }); }
      box.addEventListener("click", function (e) { var b = e.target.closest("[data-n]"); if (!b) return; if (b.closest("[data-row]").dataset.row === "r") rating = +b.dataset.n; else sr = +b.dataset.n; paint(); });
      var f = box.querySelector("form");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var err = f.querySelector(".bp-err");
        if (!rating) { err.textContent = lang() === "he" ? "בחרו דירוג בכוכבים" : "Choose a star rating"; err.hidden = false; return; }
        api("review", { appointmentId: apptId, rating: rating, serviceRating: sr || null, text: f.text.value, suggestion: f.suggestion.value, publicConsent: f.pub.checked })
          .then(function () { try { localStorage.setItem("castel.review.done", String(Date.now())); } catch (x) { /* ignore */ } close(); toast(l.fbThanks); load(); })
          .catch(function () { err.textContent = l.err; err.hidden = false; });
      });
    });
  }

  // Phone photos are big: resize on the device before upload (max 1440px, JPEG) — faster and lighter.
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1440, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.82, out = c.toDataURL("image/jpeg", q);
        while (out.length > 1150000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("invalid")); };
      img.src = url;
    });
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("button, a"); if (!t) return;
    var l = L();
    if (t.dataset.tab) { e.preventDefault(); go(t.dataset.tab, t.dataset.focus); }
    else if (t.dataset.ics) {
      api("ics", { appointmentId: t.dataset.ics }).then(function (txt) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })); a.download = "castel-appointment.ics"; document.body.appendChild(a); a.click(); a.remove();
      }).catch(function () { toast(l.err); });
    } else if (t.dataset.cancel) {
      if (!confirm(l.cancelQ)) return;
      api("cancel", { appointmentId: t.dataset.cancel }).then(function () { load(); }).catch(function (x) { toast(x.message === "too_late" ? l.tooLate : l.err); });
    } else if (t.dataset.rate) openRating(t.dataset.rate);
    else if (t.dataset.leave) api("waitlist.leave", { id: t.dataset.leave }).then(load).catch(function () { toast(l.err); });
    else if (t.dataset.photoOpen) openPhoto(t.dataset.photoOpen);
    else if (t.hasAttribute("data-copy")) { (navigator.clipboard ? navigator.clipboard.writeText(S.ref.link) : Promise.reject()).then(function () { toast(l.copied); }).catch(function () { prompt("", S.ref.link); }); }
    else if (t.hasAttribute("data-share")) navigator.share({ title: "CASTEL STUDIO", text: l.shareText, url: S.ref.link }).catch(function () { /* cancelled */ });
    else if (t.hasAttribute("data-reload")) load();
    else if (t.hasAttribute("data-back-login")) { S.phoneView = null; S.phoneRef = null; render(); }
    else if (t.hasAttribute("data-logout")) { if (confirm(l.logout + "?")) { fetch(BASE + "/me/forget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ d: device() }) }).catch(function () { /* ignore */ }); store(DEV, null); S.data = null; render(); } }
  });
  tabsEl.addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) go(b.dataset.tab); });

  root.addEventListener("change", function (e) {
    var inp = e.target; if (!inp.matches("[data-upload]") || !inp.files || !inp.files[0]) return;
    var l = L(), lbl = inp.closest(".my-upload"), span = lbl.querySelector("span");
    span.textContent = l.uploading;
    resizeImage(inp.files[0]).then(function (dataUrl) { return api("photo.upload", { dataUrl: dataUrl }); })
      .then(function () { toast(l.saved); load(); })
      .catch(function (x) { span.textContent = l.upload; toast(x.message === "too_big" ? l.tooBig : x.message === "limit" ? l.limit : x.message === "invalid" ? l.badImg : l.err); });
  });

  root.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, l = L(), err = f.querySelector(".bp-err");
    if (f.id === "phoneForm") {
      fetch(BASE + "/me", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: f.phone.value }) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "x"); return d; }); })
        .then(function (d) {
          S.phoneView = d; S.phoneRef = null; render(); window.scrollTo(0, 0);
          var ph = f.phone.value;
          api("referral.phone", { phone: ph }).then(function (x) { if (x.referral && S.phoneView) { S.phoneRef = x.referral; render(); } }).catch(function () { /* optional */ });
        })
        .catch(function () { err.textContent = l.notFound; err.hidden = false; });
    } else if (f.id === "cutForm") {
      var p = {}; ["style", "fade", "guards", "topLength", "beard", "styling", "notes", "photoId"].forEach(function (k) { p[k] = f[k].value; });
      api("haircut.save", { profile: p }).then(function () { toast(l.saved); return load(); }).catch(function () { toast(l.err); });
    } else if (f.id === "wlForm") {
      var dates = [].slice.call(f.querySelectorAll("[name=dates]:checked")).map(function (x) { return x.value; }).slice(0, 5);
      if (!dates.length) { err.textContent = l.wlNone; err.hidden = false; return; }
      api("waitlist.join", { serviceId: f.serviceId.value, dates: dates, fromMin: +f.fromMin.value, toMin: +f.toMin.value, notify: f.notify.value })
        .then(function () { toast(l.saved); load(); }).catch(function (x) { err.textContent = x.message === "limit" ? (lang() === "he" ? "אפשר עד 3 בקשות פעילות." : "Up to 3 active requests.") : l.err; err.hidden = false; });
    }
  });

  // language toggle (same preference key as the rest of the site)
  function applyLang(lg) {
    var h = document.documentElement; h.lang = lg; h.dir = lg === "en" ? "ltr" : "rtl";
    try { localStorage.setItem("castel-lang", lg); } catch (e) { /* ignore */ }
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lg)); });
    document.querySelectorAll("[data-t-aria]").forEach(function (el) { el.setAttribute("aria-label", T[lg][el.getAttribute("data-t-aria")]); });
    render();
  }
  document.querySelectorAll("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { applyLang(b.dataset.lang); }); });

  // A booking link opened here proves who the customer is → this device can open MY CASTEL.
  var q = new URLSearchParams(location.search), bk = q.get("booking");
  var start = function () { var h = (location.hash || "").slice(1); if (["appts", "club", "cut", "looks"].indexOf(h) >= 0) S.tab = h; applyLang(lang()); if (device()) load(); };
  if (bk && /^[A-Za-z0-9_-]{20,64}$/.test(bk)) {
    fetch(BASE + "/me/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: bk, d: device() || undefined }) })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.deviceToken) store(DEV, d.deviceToken); history.replaceState(null, "", location.pathname); start(); })
      .catch(start);
  } else start();
})();
