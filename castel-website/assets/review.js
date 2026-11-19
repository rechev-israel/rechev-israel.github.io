/* =====================================================================
   CASTEL STUDIO · ביקורות לקוחות
   - באנר עדין כשלקוח מוכר (שקבע תור מהמכשיר הזה) נכנס לאתר, כ־2 שניות אחרי הכניסה.
   - חלון הביקורת (כוכבים + טקסט) — משמש גם אחרי קביעת תור בעמוד /book/.
   ביקורת נשלחת למערכת הניהול ומתפרסמת באתר מיד.
   ===================================================================== */
(function () {
  "use strict";
  var API = "https://castel-studio-delta.vercel.app/api/public/reviews";
  var ME = "castel.booking.me", DONE = "castel.review.done", SNOOZE = "castel.review.snooze";
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function me() { try { var v = JSON.parse(read(ME) || "null"); return v && typeof v.phone === "string" ? v : null; } catch (e) { return null; } }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lang = function () { return document.documentElement.lang === "en" ? "en" : "he"; };

  var T = {
    he: {
      bnTitle: "איך היה אצלנו{n}? ✂️", bnSub: "הביקורת שלך עוזרת ללקוחות חדשים לבחור, ולוקחת 10 שניות.", bnBtn: "השארת ביקורת", later: "אחר כך", close: "סגירה",
      ask: "נשמח לשמוע ממך ✨", askSub: "כמה כוכבים ומילים על החוויה ב־CASTEL STUDIO.", text: "מה תרצה לספר? (לא חובה)", name: "השם שיופיע", send: "פרסום הביקורת", sending: "שולח…",
      thanks: "תודה רבה! 🙏", thanksSub: "הביקורת שלך פורסמה באתר.", pick: "בחרו דירוג בכוכבים", stars: ["גרוע", "לא משהו", "בסדר", "טוב מאוד", "מושלם"],
      err: "משהו השתבש. נסו שוב.", notFound: "לא מצאנו תור על המספר השמור במכשיר. אפשר להשאיר ביקורת אחרי שקובעים תור.", rate: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות."
    },
    en: {
      bnTitle: "How was your visit{n}? ✂️", bnSub: "Your review helps new clients choose, and takes 10 seconds.", bnBtn: "Leave a review", later: "Later", close: "Close",
      ask: "We'd love your feedback ✨", askSub: "A few stars and words about your CASTEL STUDIO experience.", text: "Anything to share? (optional)", name: "Name to show", send: "Post review", sending: "Sending…",
      thanks: "Thank you! 🙏", thanksSub: "Your review is now live on the website.", pick: "Choose a star rating", stars: ["Poor", "Meh", "OK", "Very good", "Perfect"],
      err: "Something went wrong. Please try again.", notFound: "We couldn't find a booking for the phone saved on this device. You can review after booking.", rate: "Too many attempts. Try again in a few minutes."
    }
  };
  var L = function () { return T[lang()]; };

  var css = '.crv-wrap{position:fixed;inset:0;z-index:2147483000;display:grid;align-items:end;justify-items:center;background:rgba(0,0,0,.66);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:crvF .3s cubic-bezier(.2,.7,.1,1) both;overscroll-behavior:contain}' +
    '.crv-wrap.out{animation:crvO .25s both}@keyframes crvF{from{opacity:0}}@keyframes crvO{to{opacity:0}}' +
    '.crv-card{position:relative;width:min(100%,460px);max-height:92vh;overflow-y:auto;padding:26px 20px calc(env(safe-area-inset-bottom) + 20px);color:#F5F3EF;background:radial-gradient(120% 70% at 50% 0%,rgba(198,164,119,.14),transparent 60%),#111110;border:1px solid rgba(198,164,119,.28);border-bottom:0;text-align:center;font-family:inherit;animation:crvU .45s cubic-bezier(.2,.7,.1,1) both}' +
    '@keyframes crvU{from{transform:translateY(40px);opacity:0}}@media(min-width:560px){.crv-wrap{align-items:center}.crv-card{border-bottom:1px solid rgba(198,164,119,.28);padding-bottom:24px}}' +
    '@media(prefers-reduced-motion:reduce){.crv-wrap,.crv-card,.crv-bn{animation:none!important;transition:none!important}}' +
    '.crv-x{position:absolute;top:10px;inset-inline-end:10px;width:36px;height:36px;background:none;border:0;color:#A6A29B;font-size:16px;cursor:pointer}' +
    '.crv-eye{margin:0;font-family:Manrope,sans-serif;font-size:10.5px;letter-spacing:.34em;color:#C6A477}' +
    '.crv-card h2{margin:6px 0 4px;font-weight:300;font-size:26px;line-height:1.2}.crv-sub{margin:0;color:#A6A29B;font-size:13.5px;line-height:1.5}' +
    '.crv-card form{display:grid;gap:12px;margin-top:14px;text-align:start}' +
    '.crv-rate{display:flex;justify-content:center;gap:6px}.crv-rate button{width:48px;height:48px;font-size:34px;line-height:1;background:none;border:0;color:#3a3833;cursor:pointer;transition:transform .25s,color .25s}' +
    '.crv-rate button.on{color:#C6A477;text-shadow:0 0 18px rgba(198,164,119,.45)}.crv-rate button:active{transform:scale(.88)}' +
    '.crv-lbl{margin:-4px 0 0;text-align:center;font-size:13px;color:#E2C99F;min-height:20px}' +
    '.crv-f{display:grid;gap:6px;font-size:13px;color:#A6A29B}.crv-f input,.crv-f textarea{padding:12px 14px;background:#151514;border:1px solid rgba(245,243,239,.09);color:#F5F3EF;font:inherit;font-size:16px;border-radius:0;resize:vertical}' +
    '.crv-f input:focus,.crv-f textarea:focus{outline:none;border-color:#C6A477}' +
    '.crv-hp{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);opacity:0;pointer-events:none}' +
    '.crv-err{margin:0;padding:10px 12px;border:1px solid rgba(180,87,79,.5);background:rgba(180,87,79,.1);color:#f0c7c2;font-size:14px}' +
    '.crv-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;min-height:54px;padding:0 20px;background:#C6A477;color:#0B0B0B;border:0;font:inherit;font-size:16px;font-weight:500;cursor:pointer}' +
    '.crv-btn:disabled{opacity:.55}.crv-ghost{background:none;color:#A6A29B;min-height:44px;font-size:14px}' +
    '.crv-ok{width:70px;height:70px;margin:6px auto 12px;border-radius:50%;border:1px solid #C6A477;display:grid;place-items:center;color:#C6A477;font-size:30px}' +
    '.crv-bn{position:fixed;z-index:2147482000;inset-inline:12px;bottom:calc(env(safe-area-inset-bottom) + 12px);max-width:440px;margin-inline:auto;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;align-items:center;padding:16px 16px 14px;color:#F5F3EF;' +
    'background:radial-gradient(120% 120% at 100% 0%,rgba(198,164,119,.16),transparent 60%),#111110;border:1px solid rgba(198,164,119,.4);box-shadow:0 22px 60px -20px rgba(0,0,0,.9),0 0 0 1px rgba(0,0,0,.4);transform:translateY(130%);opacity:0;transition:transform .55s cubic-bezier(.2,.7,.1,1),opacity .4s}' +
    '.crv-bn.show{transform:none;opacity:1}.crv-bn-st{grid-row:span 2;font-size:22px;letter-spacing:1px;color:#C6A477;line-height:1;writing-mode:horizontal-tb}' +
    '.crv-bn-t{margin:0;font-size:16px;font-weight:400;line-height:1.3;padding-inline-end:26px}.crv-bn-s{margin:0;font-size:12.5px;color:#A6A29B;line-height:1.45}' +
    '.crv-bn-row{grid-column:1/-1;display:flex;gap:8px;margin-top:10px}.crv-bn-row .crv-btn{min-height:44px;font-size:14.5px;flex:1}.crv-bn-row .crv-ghost{flex:0 0 auto;width:auto;padding:0 14px}' +
    '.crv-bn .crv-x{top:6px}';
  function injectCss() { if (document.getElementById("crv-css")) return; var s = document.createElement("style"); s.id = "crv-css"; s.textContent = css; document.head.appendChild(s); }

  /** Open the review window. opts: { token?, phone?, name?, current?: {rating,text}, onDone?(rating,text) } */
  function open(opts) {
    opts = opts || {}; injectCss(); hideBanner();
    var l = L(), cur = opts.current || { rating: 0, text: "" }, rating = cur.rating || 0;
    var box = document.createElement("div");
    box.className = "crv-wrap"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "crvT");
    box.innerHTML = '<div class="crv-card"><button type="button" class="crv-x" data-x aria-label="' + l.close + '">✕</button>' +
      '<p class="crv-eye">CASTEL STUDIO</p><h2 id="crvT">' + l.ask + '</h2><p class="crv-sub">' + l.askSub + "</p>" +
      '<form novalidate><div class="crv-rate" role="radiogroup" aria-label="' + l.pick + '">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" aria-checked="false" data-r="' + n + '" aria-label="' + n + " · " + l.stars[n - 1] + '">★</button>'; }).join("") + "</div>" +
      '<p class="crv-lbl" aria-live="polite">&nbsp;</p>' +
      '<label class="crv-f">' + l.text + '<textarea name="text" maxlength="600" rows="3">' + esc(cur.text) + "</textarea></label>" +
      '<label class="crv-f">' + l.name + '<input name="name" maxlength="60" value="' + esc(opts.name || "") + '"></label><input name="website" tabindex="-1" autocomplete="off" class="crv-hp" aria-hidden="true">' +
      '<p class="crv-err" role="alert" hidden></p><button class="crv-btn" type="submit">' + l.send + '</button><button type="button" class="crv-btn crv-ghost" data-x>' + l.later + "</button></form></div>";
    document.body.appendChild(box);
    var prevOverflow = document.body.style.overflow, prevFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    function paint() { box.querySelectorAll("[data-r]").forEach(function (b) { var n = +b.dataset.r; b.classList.toggle("on", n <= rating); b.setAttribute("aria-checked", String(n === rating)); }); box.querySelector(".crv-lbl").innerHTML = rating ? l.stars[rating - 1] : "&nbsp;"; }
    function close() { box.classList.add("out"); document.body.style.overflow = prevOverflow; document.removeEventListener("keydown", onKey); setTimeout(function () { box.remove(); }, 250); try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    paint();
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest("[data-x]")) { if (!box.dataset.sent) store(SNOOZE, String(Date.now() + 3 * 864e5)); return close(); }
      var r = e.target.closest("[data-r]"); if (r) { rating = +r.dataset.r; paint(); box.querySelector(".crv-err").hidden = true; }
    });
    box.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, err = box.querySelector(".crv-err"), btn = f.querySelector("[type=submit]");
      if (!rating) { err.textContent = l.pick; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = l.sending;
      var body = { rating: rating, text: f.text.value, name: f.name.value, website: f.website.value };
      if (opts.token) body.token = opts.token; else body.phone = opts.phone;
      fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "x"); return d; }); })
        .then(function () {
          box.dataset.sent = "1"; store(DONE, String(Date.now())); store(SNOOZE, null);
          box.querySelector(".crv-card").innerHTML = '<div class="crv-ok" aria-hidden="true">✓</div><h2>' + l.thanks + '</h2><p class="crv-sub">' + l.thanksSub + '</p><button type="button" class="crv-btn" data-x style="margin-top:16px;width:auto;min-width:140px">' + l.close + "</button>";
          window.dispatchEvent(new Event("castel:reviewed"));
          if (opts.onDone) opts.onDone(rating, f.text.value);
        }).catch(function (x) {
          btn.disabled = false; btn.textContent = l.send;
          err.textContent = x.message === "not_found" ? l.notFound : x.message === "rate_limited" ? l.rate : l.err; err.hidden = false;
        });
    });
    setTimeout(function () { var first = box.querySelector("[data-r]"); try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
  }

  // ── Entry banner: known customers (phone saved on this device), not reviewed yet, not snoozed ──
  var banner = null;
  function hideBanner() { if (!banner) return; var b = banner; banner = null; b.classList.remove("show"); setTimeout(function () { b.remove(); }, 500); }
  function canShow() {
    var m = me();
    if (!m || read(DONE)) return false;
    var sn = +(read(SNOOZE) || 0); if (sn && Date.now() < sn) return false;
    if (/^\/book\//.test(location.pathname)) return false; // the booking page invites to review right after booking
    if (document.querySelector(".crv-wrap, .bp-modal")) return false;
    return true;
  }
  function showBanner() {
    if (banner || !canShow()) return;
    // Don't stack on top of the "add to Home Screen" popup: wait until it's gone.
    if (document.querySelector(".inst-pop")) { setTimeout(showBanner, 1500); return; }
    injectCss();
    var l = L(), m = me(), first = (m.name || "").trim().split(/\s+/)[0];
    banner = document.createElement("aside");
    banner.className = "crv-bn"; banner.setAttribute("role", "dialog"); banner.setAttribute("aria-label", l.bnBtn);
    banner.innerHTML = '<button type="button" class="crv-x" data-bx aria-label="' + l.close + '">✕</button><span class="crv-bn-st" aria-hidden="true">★</span>' +
      '<p class="crv-bn-t">' + esc(l.bnTitle.replace("{n}", first ? ", " + first : "")) + '</p><p class="crv-bn-s">' + l.bnSub + "</p>" +
      '<div class="crv-bn-row"><button type="button" class="crv-btn" data-bgo>★ ' + l.bnBtn + '</button><button type="button" class="crv-btn crv-ghost" data-bx>' + l.later + "</button></div>";
    document.body.appendChild(banner);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (banner) banner.classList.add("show"); }); });
    banner.addEventListener("click", function (e) {
      if (e.target.closest("[data-bx]")) { store(SNOOZE, String(Date.now() + 3 * 864e5)); hideBanner(); }
      else if (e.target.closest("[data-bgo]")) { var who = me(); open({ phone: who && who.phone, name: who && who.name }); }
    });
  }

  window.CastelReview = { open: open };
  setTimeout(showBanner, 2000);
})();
