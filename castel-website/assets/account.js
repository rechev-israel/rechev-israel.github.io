/* =====================================================================
   CASTEL STUDIO · החשבון שלי + התקנה כאפליקציה
   - בתפריט (שלושת הפסים): כרטיס חשבון עם הסטטוס + "התורים שלי".
   - המכשיר מזוהה במפתח פרטי שנשמר רק בטלפון של הלקוח (לא מספר טלפון).
   - חלונית צפה אחרי 2 שניות: הוספת האתר למסך הבית.
   ===================================================================== */
(function () {
  "use strict";
  var API = "https://castel-studio-delta.vercel.app/api/public";
  var DEV = "castel.booking.device";
  var lang = function () { return document.documentElement.lang === "en" ? "en" : "he"; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  var device = function () { var d = read(DEV); return d && /^[A-Za-z0-9_-]{30,64}$/.test(d) ? d : null; };
  var post = function (path, body) { return fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" }).then(function (r) { return r.json().then(function (d) { d._ok = r.ok; return d; }); }); };

  var T = {
    he: {
      me: "החשבון שלי", myAppts: "התורים שלי", guest: "עוד לא קבעת תור מהטלפון הזה", guestSub: "אחרי התור הראשון תראו כאן את כל התורים והביקורים שלכם.",
      book: "קביעת תור", upcoming: "תורים קרובים", history: "היסטוריית ביקורים", none: "אין תורים קרובים.", noHistory: "עוד אין ביקורים קודמים.",
      visits: "ביקורים", since: "לקוח מאז", nextAt: "עוד {n} ביקורים לדרגה הבאה", cancel: "ביטול", cancelQ: "לבטל את התור?", cal: "ליומן",
      tooLate: "כבר מאוחר מדי לבטל אונליין. התקשרו למספרה.", logout: "התנתקות מהמכשיר הזה", logoutQ: "להסיר את החשבון מהמכשיר הזה?", close: "סגירה", loading: "טוען…",
      tier: { NEW: "לקוח חדש", SILVER: "כסף", GOLD: "זהב", PLATINUM: "פלטינום" }, tierL: "סטטוס",
      st: { CONFIRMED: "מאושר", SCHEDULED: "ממתין לאישור", COMPLETED: "הושלם", CANCELLED: "בוטל", NO_SHOW: "לא הגיע" }, min: "דק׳",
      instTitle: "רוצים להוסיף את האתר כאפליקציה למסך הבית?", instSub: "קביעת תור בלחיצה אחת, והתורים שלכם תמיד בהישג יד.", instParen: "(עדיף מאשר כול פעם לחפש את הקישור 😮‍💨)",
      instBtn: "הוספה למסך הבית", later: "לא עכשיו", iosTitle: "בשלושה צעדים פשוטים:",
      ios1: "לחצו על כפתור השיתוף <b>⬆︎</b> בסרגל של ספארי", ios2: "גללו ובחרו <b>״הוספה למסך הבית״</b>", ios3: "לחצו <b>״הוספה״</b>, והאייקון של CASTEL יופיע במסך הבית",
      inApp: "פתחו את האתר בספארי (⋯ ← ״פתיחה בדפדפן״) ואז הוסיפו למסך הבית.", added: "האפליקציה נוספה ✓",
    },
    en: {
      me: "My account", myAppts: "My appointments", guest: "You haven't booked from this phone yet", guestSub: "After your first booking, all your appointments and visits appear here.",
      book: "Book now", upcoming: "Upcoming", history: "Visit history", none: "No upcoming appointments.", noHistory: "No past visits yet.",
      visits: "Visits", since: "Customer since", nextAt: "{n} more visits to the next tier", cancel: "Cancel", cancelQ: "Cancel this appointment?", cal: "Calendar",
      tooLate: "Too late to cancel online. Please call the shop.", logout: "Sign out on this device", logoutQ: "Remove the account from this device?", close: "Close", loading: "Loading…",
      tier: { NEW: "New", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" }, tierL: "Status",
      st: { CONFIRMED: "Confirmed", SCHEDULED: "Pending", COMPLETED: "Completed", CANCELLED: "Cancelled", NO_SHOW: "No-show" }, min: "min",
      instTitle: "Add the site to your home screen as an app?", instSub: "Book in one tap, with your appointments always at hand.", instParen: "(Better than searching for the link every time 😮‍💨)",
      instBtn: "Add to home screen", later: "Not now", iosTitle: "In three simple steps:",
      ios1: "Tap the Share button <b>⬆︎</b> in Safari's bar", ios2: "Scroll and choose <b>“Add to Home Screen”</b>", ios3: "Tap <b>“Add”</b> and the CASTEL icon appears on your home screen",
      inApp: "Open the site in Safari (⋯ → “Open in browser”), then add it to the home screen.", added: "App added ✓",
    },
  };
  var t = function () { return T[lang()]; };
  var dayLabel = function (d) { return new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z")); };
  var svcName = function (s) { return s ? (lang() === "en" ? s.en || s.he : s.he) : ""; };

  // ── data ──
  var data = null, loadingP = null;
  function load(force) {
    var d = device();
    if (!d) { data = null; return Promise.resolve(null); }
    if (!force && loadingP) return loadingP;
    loadingP = post("/me", { d: d }).then(function (r) {
      if (!r._ok) { if (r.error === "unknown_device") store(DEV, null); data = null; } else data = r;
      loadingP = null; paintMenu(); return data;
    }).catch(function () { loadingP = null; return data; });
    return loadingP;
  }
  window.addEventListener("castel:device", function () { load(true); });

  // ── menu card (three lines) + desktop link ──
  function menuCard() {
    var L = t();
    if (!data) return '<button type="button" class="acc-card" data-open-me><span class="acc-ic" aria-hidden="true">◎</span><span><b>' + L.myAppts + "</b><small>" + L.guest + "</small></span></button>";
    var up = data.upcoming[0];
    return '<button type="button" class="acc-card" data-open-me><span class="acc-ic acc-' + data.tier.toLowerCase() + '" aria-hidden="true">★</span><span><b>' + esc(data.firstName) + ' · <i class="acc-tier">' + L.tier[data.tier] + "</i></b><small>" +
      data.visits + " " + L.visits + (up ? " · " + L.myAppts + ": " + esc(dayLabel(up.date)) + " " + up.time : "") + "</small></span><span class=\"acc-go\" aria-hidden=\"true\">‹</span></button>";
  }
  function paintMenu() {
    var nav = document.querySelector("#mmenu nav");
    if (nav) {
      var slot = document.getElementById("accSlot");
      if (!slot) { slot = document.createElement("div"); slot.id = "accSlot"; nav.parentNode.insertBefore(slot, nav); }
      slot.innerHTML = menuCard();
    }
    var end = document.querySelector(".nav-end");
    if (end && !document.getElementById("navMe")) {
      var a = document.createElement("button"); a.type = "button"; a.id = "navMe"; a.className = "nav-book nav-me"; a.setAttribute("data-open-me", "");
      var book = end.querySelector(".nav-book"); end.insertBefore(a, book || end.firstChild);
    }
    var nm = document.getElementById("navMe"); if (nm) nm.textContent = t().myAppts;
  }

  // ── "My appointments" panel ──
  var panel = null;
  function closeMenuIfOpen() { if (document.documentElement.classList.contains("menu-open") || document.body.classList.contains("menu-open")) { var b = document.getElementById("burger"); if (b) b.click(); } }
  function openPanel() {
    closeMenuIfOpen();
    if (!panel) {
      panel = document.createElement("div"); panel.className = "acc-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
      document.body.appendChild(panel);
      panel.addEventListener("click", onPanelClick);
    }
    document.documentElement.classList.add("acc-lock");
    renderPanel(true);
    requestAnimationFrame(function () { panel.classList.add("open"); });
    load(true).then(function () { renderPanel(false); });
  }
  function closePanel() { if (!panel) return; panel.classList.remove("open"); document.documentElement.classList.remove("acc-lock"); }
  function apptRow(a, up) {
    var L = t();
    return '<li class="acc-row' + (up ? " up" : "") + '"><div class="acc-when"><b>' + esc(dayLabel(a.date)) + '</b><span dir="ltr">' + a.time + "</span></div>" +
      '<div class="acc-what"><span>' + esc(svcName(a.service)) + "</span><small>" + a.durationMin + " " + L.min + (a.price ? " · ₪" + a.price : "") + (a.staff ? " · " + esc(a.staff) : "") + "</small></div>" +
      '<span class="acc-st s-' + a.status + '">' + (L.st[a.status] || a.status) + "</span>" +
      (up ? '<div class="acc-acts">' + (a.canCancel ? '<button type="button" class="acc-mini danger" data-cancel="' + esc(a.id) + '">' + L.cancel + "</button>" : "") + "</div>" : "") + "</li>";
  }
  function renderPanel(loading) {
    var L = t(), h = '<div class="acc-sheet"><div class="acc-top"><p class="acc-eyebrow">CASTEL STUDIO</p><button type="button" class="acc-x" data-close aria-label="' + L.close + '">✕</button></div>';
    if (loading && device() && !data) h += '<p class="acc-muted">' + L.loading + "</p>";
    else if (!data) {
      h += '<h2 class="acc-h">' + L.myAppts + '</h2><p class="acc-lead">' + L.guest + '</p><p class="acc-muted">' + L.guestSub + '</p><a class="btn acc-book" href="#book" data-close>' + L.book + "</a>";
    } else {
      var pct = data.next ? Math.round(100 * (1 - data.next.remaining / Math.max(1, data.next.at))) : 100;
      h += '<h2 class="acc-h">' + esc(data.name) + "</h2>" +
        '<div class="acc-status"><div class="acc-badge acc-' + data.tier.toLowerCase() + '"><span>' + L.tierL + "</span><b>" + L.tier[data.tier] + "</b></div>" +
        '<div class="acc-stat"><b>' + data.visits + "</b><span>" + L.visits + '</span></div><div class="acc-stat"><b dir="ltr">' + esc(data.memberSince.split("-").reverse().join(".")) + "</b><span>" + L.since + "</span></div></div>" +
        (data.next ? '<div class="acc-prog"><i style="width:' + pct + '%"></i></div><p class="acc-muted acc-small">' + L.nextAt.replace("{n}", data.next.remaining) + "</p>" : "") +
        '<h3 class="acc-sec">' + L.upcoming + "</h3>" + (data.upcoming.length ? '<ul class="acc-list">' + data.upcoming.map(function (a) { return apptRow(a, true); }).join("") + "</ul>" : '<p class="acc-muted">' + L.none + "</p>") +
        '<a class="btn acc-book" href="#book" data-close>' + L.book + "</a>" +
        '<h3 class="acc-sec">' + L.history + "</h3>" + (data.history.length ? '<ul class="acc-list">' + data.history.map(function (a) { return apptRow(a, false); }).join("") + "</ul>" : '<p class="acc-muted">' + L.noHistory + "</p>") +
        '<p class="acc-err" id="accErr" role="alert" hidden></p><button type="button" class="acc-logout" data-logout>' + L.logout + "</button>";
    }
    panel.innerHTML = h + "</div>";
  }
  function onPanelClick(e) {
    if (e.target === panel) return closePanel();
    var b = e.target.closest("[data-close],[data-cancel],[data-logout]"); if (!b) return;
    if (b.hasAttribute("data-close")) { closePanel(); return; }
    if (b.hasAttribute("data-cancel")) {
      if (!confirm(t().cancelQ)) return;
      b.disabled = true;
      post("/me/cancel", { d: device(), id: b.getAttribute("data-cancel") }).then(function (r) {
        if (r._ok) { load(true).then(function () { renderPanel(false); window.dispatchEvent(new Event("castel:changed")); }); }
        else { var er = document.getElementById("accErr"); er.hidden = false; er.textContent = r.error === "too_late" ? t().tooLate : "✕"; b.disabled = false; }
      });
    }
    if (b.hasAttribute("data-logout")) {
      if (!confirm(t().logoutQ)) return;
      post("/me/forget", { d: device() }).catch(function () {});
      store(DEV, null); try { localStorage.removeItem("castel.booking.me"); } catch (x) { /* */ }
      data = null; paintMenu(); renderPanel(false);
    }
  }
  document.addEventListener("click", function (e) { if (e.target.closest("[data-open-me]")) { e.preventDefault(); openPanel(); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePanel(); });
  new MutationObserver(function () { paintMenu(); if (panel && panel.classList.contains("open")) renderPanel(false); if (pop) renderPop(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // ── Install as app ──
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(function () {});
  var deferred = null, pop = null;
  var standalone = function () { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; };
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var inApp = /Instagram|FBAN|FBAV|Line\/|WhatsApp|TikTok/i.test(navigator.userAgent);
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", function () { store("castel.app.installed", "1"); if (pop) { renderPop(true); setTimeout(hidePop, 1800); } });
  function snoozed() { var v = +(read("castel.app.snooze") || 0); return Date.now() < v; }
  function renderPop(done, ios) {
    var L = t();
    pop.innerHTML = '<div class="inst-card"><button type="button" class="inst-x" data-later aria-label="' + L.close + '">✕</button>' +
      '<img class="inst-ic" src="/images/app-192.png" alt="" width="56" height="56">' +
      (done ? '<p class="inst-t">' + L.added + "</p>" :
      '<p class="inst-t">' + L.instTitle + '</p><p class="inst-s">' + L.instSub + '</p><p class="inst-p">' + L.instParen + "</p>" +
      (ios ? '<div class="inst-ios"><p>' + (inApp ? L.inApp : L.iosTitle) + "</p>" + (inApp ? "" : "<ol><li>" + L.ios1 + "</li><li>" + L.ios2 + "</li><li>" + L.ios3 + "</li></ol>") + '</div><span class="inst-arrow" aria-hidden="true">↓</span>'
        : '<button type="button" class="btn inst-btn" data-install>' + L.instBtn + "</button>") +
      '<button type="button" class="inst-later" data-later>' + L.later + "</button>") + "</div>";
  }
  function hidePop() { if (pop) { pop.classList.remove("show"); setTimeout(function () { if (pop) { pop.remove(); pop = null; } }, 400); } }
  function showPop() {
    if (standalone() || read("castel.app.installed") || snoozed() || pop) return;
    pop = document.createElement("div"); pop.className = "inst-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-live", "polite");
    renderPop(false, false);
    document.body.appendChild(pop);
    requestAnimationFrame(function () { requestAnimationFrame(function () { pop.classList.add("show"); }); });
    pop.addEventListener("click", function (e) {
      if (e.target.closest("[data-later]")) { store("castel.app.snooze", String(Date.now() + 7 * 864e5)); hidePop(); return; }
      if (e.target.closest("[data-install]")) {
        if (deferred) {
          deferred.prompt();
          deferred.userChoice.then(function (c) { deferred = null; if (c && c.outcome === "accepted") { store("castel.app.installed", "1"); renderPop(true); setTimeout(hidePop, 1800); } });
        } else {
          // iPhone/iPad (and browsers without an install API): Apple allows adding only from the Share menu — show the exact steps.
          renderPop(false, true);
        }
      }
    });
  }
  setTimeout(showPop, 2000);

  // Shortcut from the installed app: /?me=1 opens "My appointments"
  if (/[?&]me=1/.test(location.search)) setTimeout(openPanel, 300);

  paintMenu();
  load(false);
})();
