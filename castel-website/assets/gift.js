/* =====================================================================
   CASTEL STUDIO · מתנה בסטייל (כרטיסי מתנה)
   אין תשלום באתר: הבקשה נשלחת למספרה, המספרה גובה בדרך שלה ומאשרת,
   ורק אז נוצר קוד מימוש. הקונה רואה את הכרטיס בקישור הפרטי שלו.
   ===================================================================== */
(function () {
  "use strict";
  var API = "https://castel-studio-delta.vercel.app/api/public/gifts";
  var root = document.querySelector("[data-castel-gift]");
  if (!root) return;
  var MINE = "castel.gifts";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function mine() { try { var v = JSON.parse(localStorage.getItem(MINE) || "[]"); return Array.isArray(v) ? v.filter(function (x) { return typeof x === "string"; }).slice(-10) : []; } catch (e) { return []; } }
  function remember(t) { try { var m = mine(); if (m.indexOf(t) < 0) m.push(t); localStorage.setItem(MINE, JSON.stringify(m.slice(-10))); } catch (e) { /* ignore */ } }
  var me = (function () { try { return JSON.parse(localStorage.getItem("castel.booking.me") || "null") || {}; } catch (e) { return {}; } })();
  var ST = { REQUESTED: "ממתין לאישור תשלום", ACTIVE: "פעיל", REDEEMED: "מומש", CANCELLED: "בוטל", EXPIRED: "פג תוקף" };

  function card(g) {
    var val = g.kind === "service" ? esc(g.serviceName) : "₪" + g.amount;
    return '<div class="gf-card ' + esc(g.design) + '"><div style="display:flex;justify-content:space-between;align-items:center"><span class="gf-sub">CASTEL STUDIO · GIFT</span><span class="gf-sub">' + (ST[g.status] || "") + "</span></div>" +
      '<div><p class="my-muted" style="margin:0">מתנה עבור ' + esc(g.recipientName) + '</p><p class="gf-val">' + val + "</p>" + (g.message ? '<p class="my-muted" style="margin:6px 0 0">״' + esc(g.message) + "״</p>" : "") + "</div>" +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:10px"><span class="gf-code">' + (g.code ? esc(g.code) : "קוד יופיע אחרי אישור התשלום") + "</span>" + (g.expiresAt ? '<span class="my-muted" style="font-size:12px">בתוקף עד ' + esc(g.expiresAt.split("-").reverse().join(".")) + "</span>" : "") + "</div></div>";
  }
  function viewCard(t) {
    root.innerHTML = '<div class="my-skel"></div>';
    fetch(API + "?t=" + encodeURIComponent(t), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (g) {
      remember(t);
      root.innerHTML = '<p class="my-eyebrow">GIFT CARD</p><h1 class="my-hello">מתנה <em>בסטייל</em></h1><section class="my-sec">' + card(g) + "</section>" +
        (g.status === "REQUESTED" ? '<div class="my-note hot"><i aria-hidden="true">⏳</i><span>קיבלנו את הבקשה. ' + esc(g.payNote || "נחזור אליך לתשלום, ומיד אחרי האישור יופיע כאן קוד המימוש.") + "</span></div>" : "") +
        (g.code && g.status === "ACTIVE" ? '<div class="my-row"><button type="button" class="bp-btn" data-share>שליחה למקבל המתנה</button></div>' : "") +
        (g.terms ? '<p class="my-muted" style="margin-top:14px;font-size:12.5px">' + esc(g.terms) + "</p>" : "") +
        '<p class="my-muted" style="margin-top:10px;font-size:12px">שמרו את הקישור הזה: זה הכרטיס שלכם.</p>';
      var sh = root.querySelector("[data-share]");
      if (sh) sh.addEventListener("click", function () {
        var text = "קיבלת מתנה מ־CASTEL STUDIO 🎁 " + (g.kind === "service" ? g.serviceName : "₪" + g.amount) + " · קוד: " + g.code + (g.expiresAt ? " · בתוקף עד " + g.expiresAt.split("-").reverse().join(".") : "");
        if (navigator.share) navigator.share({ title: "CASTEL STUDIO", text: text }).catch(function () { /* cancelled */ });
        else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { sh.textContent = "הועתק ✓"; });
      });
    }).catch(function () { root.innerHTML = '<p class="bp-err">הכרטיס לא נמצא.</p>'; });
  }

  function viewForm(cfg) {
    if (!cfg.enabled) { root.innerHTML = '<div class="my-login"><p class="my-eyebrow">GIFT CARD</p><h1 class="my-hello">מתנה <em>בסטייל</em></h1><p class="my-sub">כרטיסי מתנה יהיו זמינים כאן בקרוב. בינתיים אפשר לפנות אלינו במספרה.</p><div class="my-row" style="justify-content:center"><a class="bp-btn sm" href="/">חזרה לאתר</a></div></div>'; return; }
    var opts = cfg.amounts.map(function (a, i) { return '<label class="my-chip"><input type="radio" name="pick" value="amount:' + a + '"' + (i === 0 ? " checked" : "") + ' style="accent-color:var(--gold)"> ₪' + a + "</label>"; }).join("") +
      (cfg.services || []).map(function (s) { return '<label class="my-chip"><input type="radio" name="pick" value="service:' + esc(s.id) + '" style="accent-color:var(--gold)"> ' + esc(s.he) + " · ₪" + s.price + "</label>"; }).join("");
    var saved = mine();
    root.innerHTML = '<p class="my-eyebrow">GIFT CARD</p><h1 class="my-hello">מתנה <em>בסטייל</em></h1><p class="my-sub">תספורת או סכום לבחירה, עם ברכה אישית. אין תשלום באתר: נחזור אליכם לתשלום, ומיד אחרי האישור תקבלו כרטיס עם קוד מימוש.</p>' +
      (saved.length ? '<p style="margin-top:10px">' + saved.map(function (t, i) { return '<a class="bp-link" href="?t=' + encodeURIComponent(t) + '">הכרטיס שלי ' + (i + 1) + "</a>"; }).join(" · ") + "</p>" : "") +
      '<form class="my-form two my-card" id="gfForm" style="margin-top:18px" novalidate>' +
      '<fieldset class="full" style="border:0;padding:0;margin:0"><legend class="bp-field" style="margin-bottom:8px">מה מעניקים?</legend><div class="my-dates">' + opts + "</div></fieldset>" +
      '<label class="bp-field">שם מקבל המתנה<input name="recipientName" maxlength="60" required></label>' +
      '<label class="bp-field full">ברכה אישית (לא חובה)<textarea name="message" maxlength="300" rows="2" placeholder="יום הולדת שמח! מגיע לך להיראות מעולה"></textarea></label>' +
      '<fieldset class="full" style="border:0;padding:0;margin:0"><legend class="bp-field" style="margin-bottom:8px">עיצוב הכרטיס</legend><div class="gf-designs">' +
      [["noir", "שחור", "linear-gradient(135deg,#17140e,#0a0907)"], ["gold", "זהב", "linear-gradient(135deg,#c9a874,#8b6a3d)"], ["ivory", "שמנת", "linear-gradient(135deg,#f1ebdf,#d9cfbd)"]].map(function (d, i) { return '<label><input type="radio" name="design" value="' + d[0] + '"' + (i === 0 ? " checked" : "") + ' aria-label="' + d[1] + '"><span style="background:' + d[2] + '"></span></label>'; }).join("") + "</div></fieldset>" +
      '<label class="bp-field">השם שלך<input name="buyerName" maxlength="60" autocomplete="name" value="' + esc(me.name || "") + '" required></label>' +
      '<label class="bp-field">הטלפון שלך<input name="buyerPhone" type="tel" inputmode="tel" dir="ltr" autocomplete="tel" maxlength="20" value="' + esc(me.phone || "") + '" placeholder="050-0000000" required></label>' +
      '<input name="website" tabindex="-1" autocomplete="off" class="bp-hp" aria-hidden="true">' +
      '<label class="bp-check full"><input type="checkbox" name="terms"> <span>אני מאשר/ת שהמספרה תחזור אליי לתשלום ותשמור את הפרטים לצורך הכרטיס' + (cfg.expiryMonths ? " (תוקף " + cfg.expiryMonths + " חודשים מיום האישור)" : "") + ".</span></label>" +
      (cfg.terms ? '<p class="my-muted full" style="font-size:12.5px">' + esc(cfg.terms) + "</p>" : "") +
      '<p class="bp-err full" role="alert" hidden></p><button class="bp-btn full" type="submit">שליחת בקשה לכרטיס מתנה</button></form>';
    root.querySelector("#gfForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, err = f.querySelector(".bp-err"), btn = f.querySelector("[type=submit]");
      var pick = (f.querySelector("[name=pick]:checked") || {}).value || "";
      var body = { recipientName: f.recipientName.value, message: f.message.value, design: f.design.value, buyerName: f.buyerName.value, buyerPhone: f.buyerPhone.value, terms: f.terms.checked, website: f.website.value };
      if (pick.indexOf("service:") === 0) { body.kind = "service"; body.serviceId = pick.slice(8); } else { body.kind = "amount"; body.amount = Number(pick.slice(7)); }
      if (!body.recipientName.trim() || !body.buyerName.trim() || body.buyerPhone.replace(/\D/g, "").length < 9 || !body.terms) { err.textContent = "נא למלא שם מקבל, שם וטלפון, ולאשר."; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = "שולח…";
      fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "x"); return d; }); })
        .then(function (d) { if (d.viewToken) { remember(d.viewToken); history.replaceState(null, "", "?t=" + encodeURIComponent(d.viewToken)); viewCard(d.viewToken); window.scrollTo(0, 0); } })
        .catch(function (x) { btn.disabled = false; btn.textContent = "שליחת בקשה לכרטיס מתנה"; err.textContent = x.message === "rate_limited" ? "יותר מדי בקשות. נסו שוב בעוד כמה דקות." : x.message === "invalid" ? "נא לבדוק את הפרטים." : "משהו השתבש. נסו שוב."; err.hidden = false; });
    });
  }

  var t = new URLSearchParams(location.search).get("t");
  if (t && /^[A-Za-z0-9_-]{30,64}$/.test(t)) viewCard(t);
  else { root.innerHTML = '<div class="my-skel"></div>'; fetch(API, { cache: "no-store" }).then(function (r) { return r.json(); }).then(viewForm).catch(function () { viewForm({ enabled: false }); }); }
})();
