/* =====================================================================
   CASTEL STUDIO · הסטייל שלך
   מצא את התספורת שמתאימה לך · המדריך לשיער מושלם · המוצרים שמתאימים לשיער שלך
   התוכן עצמו נמצא ב־style-data.js. בחירת סגנון נשמרת ב"התספורת שלי" או מצורפת לתור,
   דרך אותו API מאובטח של MY CASTEL (מפתח המכשיר של הלקוח).
   ===================================================================== */
(function () {
  "use strict";
  var DATA = window.CASTEL_STYLE, root = document.querySelector("[data-castel-style]");
  if (!root || !DATA) return;
  var PORTAL = "https://castel-studio-delta.vercel.app/api/public/portal";
  var DEV = "castel.booking.device", PENDING = "castel.pendingStyle";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function device() { try { var d = localStorage.getItem(DEV); return d && /^[A-Za-z0-9_-]{30,64}$/.test(d) ? d : ""; } catch (e) { return ""; } }
  function api(action, extra) {
    return fetch(PORTAL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ action: action, device: device() }, extra || {})) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "x"); return d; }); });
  }
  function toast(msg) { var t = document.createElement("div"); t.className = "my-toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800); }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var S = { tab: "finder", qi: 0, answers: {}, results: null, pq: 0, pAnswers: {}, pResults: null, open: "" };
  var styleById = function (id) { return DATA.styles.filter(function (s) { return s.id === id; })[0]; };

  function score(items, answers) {
    return items.map(function (it) {
      var sc = 0;
      Object.keys(answers).forEach(function (k) { var f = it.fits[k]; if (!f) return; sc += f.indexOf(answers[k]) >= 0 ? 2 : -1; });
      return { it: it, sc: sc };
    }).sort(function (a, b) { return b.sc - a.sc; });
  }
  function img(s, cls) {
    return s.image ? '<img class="' + cls + '" src="' + esc(s.image) + '" alt="' + esc(s.he) + '" loading="lazy" decoding="async">'
      : '<div class="' + cls + ' st-mono" aria-hidden="true"><span>' + esc(s.name.split(" ").map(function (w) { return w[0]; }).join("").slice(0, 2)) + "</span></div>";
  }
  function tabs() {
    var t = [["finder", "מצא תספורת"], ["guides", "המדריכים"], ["products", "מוצרים"]];
    return '<div class="st-tabs" role="tablist">' + t.map(function (x) { return '<button type="button" role="tab" aria-selected="' + (S.tab === x[0]) + '" data-st-tab="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>";
  }
  function quiz(qs, idx, answers, prefix) {
    var q = qs[idx];
    return '<div class="my-card st-quiz"><div class="st-prog" aria-hidden="true">' + qs.map(function (_, i) { return "<i" + (i < idx ? ' class="done"' : i === idx ? ' class="cur"' : "") + "></i>"; }).join("") + "</div>" +
      '<p class="my-eyebrow">שאלה ' + (idx + 1) + " מתוך " + qs.length + '</p><h3 class="st-q">' + esc(q.q) + '</h3><div class="st-answers">' +
      q.a.map(function (a) { return '<button type="button" class="st-ans' + (answers[q.id] === a[0] ? " on" : "") + '" data-' + prefix + '="' + q.id + '" data-v="' + a[0] + '">' + esc(a[1]) + "</button>"; }).join("") + "</div>" +
      (idx > 0 ? '<button type="button" class="bp-link" data-' + prefix + '-back style="margin-top:12px">חזרה</button>' : "") + "</div>";
  }

  function viewFinder() {
    var h = '<p class="my-eyebrow">YOUR STYLE</p><h1 class="my-hello">מצא את התספורת <em>שמתאימה לך</em></h1><p class="my-sub">7 שאלות קצרות, ונציע לך סגנונות שכדאי לנסות. ההחלטה הסופית תמיד בשיחה עם הספר.</p>';
    if (!S.results) return h + '<section class="my-sec">' + quiz(DATA.questions, S.qi, S.answers, "fq") + "</section>";
    h += '<section class="my-sec"><h2>ההצעות שלנו בשבילך <button type="button" class="bp-link" data-fq-reset>להתחיל מחדש</button></h2><div class="my-grid">';
    S.results.forEach(function (r, i) {
      var s = r.it;
      h += '<article class="my-card st-res' + (i === 0 ? " gold" : "") + '">' + img(s, "st-img") + '<div class="st-res-body">' + (i === 0 ? '<span class="bp-badge">ההתאמה הכי טובה</span>' : "") +
        '<h3>' + esc(s.he) + ' <small dir="ltr">' + esc(s.name) + '</small></h3><p class="my-muted">' + esc(s.about) + '</p><ul class="my-benefits">' + s.styling.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        '<div class="my-row"><button type="button" class="bp-btn sm" data-pick="' + s.id + '">בחר את הסגנון הזה</button></div></div></article>';
    });
    return h + '</div><p class="my-muted" style="margin-top:14px;font-size:12px">אלה הצעות בלבד, לפי התשובות שלך. התוצאה בפועל תלויה בסוג השיער ובצורת הפנים, והספר ישמח לדייק איתך בתור.</p></section>';
  }
  function viewGuides() {
    var h = '<p class="my-eyebrow">HAIR GUIDE</p><h1 class="my-hello">המדריך שלך <em>לשיער מושלם</em></h1><p class="my-sub">טיפים מעשיים מהכיסא, בלי הבטחות מיותרות.</p><section class="my-sec"><div class="my-grid two">';
    DATA.guides.forEach(function (g) {
      var open = S.open === g.id;
      h += '<article class="my-card st-guide' + (open ? " open" : "") + '"><button type="button" class="st-guide-h" data-guide="' + g.id + '" aria-expanded="' + open + '"><span>' + esc(g.title) + '</span><i aria-hidden="true">' + (open ? "−" : "+") + "</i></button>" +
        (open ? '<div class="st-guide-b"><p class="my-muted">' + esc(g.body) + '</p><ol class="st-steps">' + g.steps.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
          (g.related && g.related.length ? '<p class="my-muted" style="margin-top:10px">סגנונות קשורים: ' + g.related.map(function (id) { var s = styleById(id); return s ? '<button type="button" class="bp-link" data-goto-finder>' + esc(s.he) + "</button>" : ""; }).join(" · ") + "</p>" : "") + "</div>" : "") + "</article>";
    });
    return h + "</div></section>";
  }
  function viewProducts() {
    var h = '<p class="my-eyebrow">PRODUCTS</p><h1 class="my-hello">המוצרים שמתאימים <em>לשיער שלך</em></h1><p class="my-sub">כמה שאלות, והמלצה על סוגי המוצרים שיעבדו לך. רוצים מוצר ספציפי? שאלו אותנו במספרה.</p>';
    if (!S.pResults) return h + '<section class="my-sec">' + quiz(DATA.productQuestions, S.pq, S.pAnswers, "pq") + "</section>";
    h += '<section class="my-sec"><h2>מה מתאים לך <button type="button" class="bp-link" data-pq-reset>להתחיל מחדש</button></h2><div class="my-grid two">';
    S.pResults.forEach(function (r) { var p = r.it; h += '<article class="my-card"><h3>' + esc(p.name) + '</h3><p class="my-muted">' + esc(p.about) + '</p><p class="my-muted" style="margin-top:8px"><b style="color:var(--gold2);font-weight:400">איך משתמשים:</b> ' + esc(p.use) + "</p></article>"; });
    return h + "</div></section>";
  }
  function render() {
    root.innerHTML = tabs() + (S.tab === "guides" ? viewGuides() : S.tab === "products" ? viewProducts() : viewFinder());
  }
  function top() { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }

  // "בחר את הסגנון הזה": save to MY HAIRCUT and/or attach to the next appointment; without MY CASTEL → remember it for the next booking.
  function pick(id) {
    var s = styleById(id); if (!s) return;
    var label = s.he + " (" + s.name + ")";
    var box = document.createElement("div"); box.className = "my-sheet"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = '<div class="my-sheet-card"><div style="display:flex;justify-content:flex-end"><button type="button" class="bp-close" data-x aria-label="סגירה">✕</button></div><h2 style="margin:0 0 6px;font-weight:300;font-size:24px">' + esc(s.he) + '</h2><div data-body><p class="my-muted">טוען…</p></div></div>';
    document.body.appendChild(box);
    var close = function () { box.remove(); };
    box.addEventListener("click", function (e) { if (e.target === box || e.target.closest("[data-x]")) close(); });
    var body = box.querySelector("[data-body]");
    function noAccount() {
      try { localStorage.setItem(PENDING, JSON.stringify({ style: label, until: Date.now() + 14 * 864e5 })); } catch (e) { /* ignore */ }
      body.innerHTML = '<p class="my-muted">שמרנו את הבחירה במכשיר הזה. כשתקבע תור, הסגנון יצורף לתור אוטומטית כבקשה מיוחדת והספר יראה אותו.</p><div class="my-row"><a class="bp-btn" href="/book/">קביעת תור עם הסגנון הזה</a></div>';
    }
    if (!device()) return noAccount();
    api("overview").then(function (d) {
      var next = (d.upcoming || [])[0];
      body.innerHTML = '<p class="my-muted">איפה לשמור את הבחירה?</p><div class="my-form" style="margin-top:10px">' +
        (next ? '<button type="button" class="bp-btn" data-attach="' + next.id + '">לצרף לתור הקרוב (' + esc(next.date.split("-").reverse().slice(0, 2).join(".")) + " · " + esc(next.time) + ")</button>" : "") +
        '<button type="button" class="bp-btn ghost" data-save>לשמור ב"התספורת שלי"</button>' + (next ? "" : '<a class="bp-link" href="/book/" style="text-align:center">או לקבוע תור</a>') + "</div>";
      body.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        b.disabled = true;
        if (b.hasAttribute("data-save")) {
          api("haircut.save", { profile: Object.assign({}, d.haircut || {}, { style: label }) }).then(function () { close(); toast('נשמר ב"התספורת שלי" ✓'); }).catch(function () { b.disabled = false; toast("משהו השתבש. נסו שוב."); });
        } else if (b.dataset.attach) {
          var id = b.dataset.attach;
          api("request.get", { appointmentId: id }).then(function (r) { return api("request.save", { appointmentId: id, request: Object.assign({}, r.request || {}, { style: label }) }); })
            .then(function () { close(); toast("הסגנון צורף לתור ✓ הספר יראה אותו."); }).catch(function () { b.disabled = false; toast("משהו השתבש. נסו שוב."); });
        }
      });
    }).catch(function () { noAccount(); });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.stTab) { S.tab = b.dataset.stTab; render(); }
    else if (b.dataset.fq) {
      S.answers[b.dataset.fq] = b.dataset.v;
      if (S.qi < DATA.questions.length - 1) { S.qi++; render(); }
      else { S.results = score(DATA.styles, S.answers).slice(0, 3); render(); top(); }
    } else if (b.hasAttribute("data-fq-back")) { S.qi = Math.max(0, S.qi - 1); render(); }
    else if (b.hasAttribute("data-fq-reset")) { S.qi = 0; S.answers = {}; S.results = null; render(); top(); }
    else if (b.dataset.pq) {
      S.pAnswers[b.dataset.pq] = b.dataset.v;
      if (S.pq < DATA.productQuestions.length - 1) { S.pq++; render(); }
      else {
        var ranked = score(DATA.products, S.pAnswers).filter(function (r) { return r.sc > 0; });
        if (S.pAnswers.beard !== "yes") ranked = ranked.filter(function (r) { return r.it.id !== "beard-oil"; });
        var hair = ranked.filter(function (r) { return r.it.id !== "beard-oil"; }).slice(0, 3);
        if (!hair.length) hair = score(DATA.products, S.pAnswers).filter(function (r) { return r.it.id !== "beard-oil"; }).slice(0, 2);
        if (S.pAnswers.beard === "yes") hair.push({ it: DATA.products.filter(function (p) { return p.id === "beard-oil"; })[0] });
        S.pResults = hair.filter(function (r) { return r.it; }); render(); top();
      }
    } else if (b.hasAttribute("data-pq-back")) { S.pq = Math.max(0, S.pq - 1); render(); }
    else if (b.hasAttribute("data-pq-reset")) { S.pq = 0; S.pAnswers = {}; S.pResults = null; render(); top(); }
    else if (b.dataset.guide) { S.open = S.open === b.dataset.guide ? "" : b.dataset.guide; render(); }
    else if (b.hasAttribute("data-goto-finder")) { S.tab = "finder"; render(); top(); }
    else if (b.dataset.pick) pick(b.dataset.pick);
  });

  var h = (location.hash || "").slice(1);
  if (["guides", "products"].indexOf(h) >= 0) S.tab = h;
  render();
})();
