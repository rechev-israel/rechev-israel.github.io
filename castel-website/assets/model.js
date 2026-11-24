/* =====================================================================
   CASTEL MODEL EXPERIENCE · בקשה להגיע כמודליסט
   זו בקשה, לא קביעת תור: הבקשה נשלחת לאישור אישי של הספר.
   מקום אחד בלבד בכל יום (נאכף בשרת ובמסד הנתונים), שעתיים, ללא עלות.
   ===================================================================== */
(function () {
  "use strict";
  var API = "https://castel-studio-delta.vercel.app/api/public/model";
  var root = document.querySelector("[data-castel-model]");
  if (!root) return;
  var DEV = "castel.booking.device", MINE = "castel.models";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var lang = function () { return document.documentElement.lang === "en" ? "en" : "he"; };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var me = (function () { try { return JSON.parse(read("castel.booking.me") || "null") || {}; } catch (e) { return {}; } })();

  var T = {
    he: {
      title: "מודליסט", intro: "חוויית ספרות יצירתית, בבחירת הספר.", steps: ["שירות", "יום", "שעה", "פרטים", "תמונות", "תנאים", "שליחה"], back: "חזרה", stepOf: "שלב {n} מתוך 7",
      svcName: "מודליסט", svcBadge: "מקום אחד בלבד בכל יום", free: "ללא עלות", dur: "כשעתיים", pick: "אני רוצה להגיש בקשה",
      desc: "פתוחים לשינוי? מחפשים מודליסטים לחוויית ספרות יצירתית וייחודית, שבה בחירת התספורת, הסגנון והעיצוב היא בידי הספר בלבד. ההשתתפות ללא עלות, אורכת כשעתיים ומותנית בהתאמה ובאישור אישי של הספר.",
      conds: ["בחירת התספורת והסגנון היא בידי הספר בלבד.", "השירות אינו מיועד למי שמחפש תספורת ספציפית.", "יש להקצות שעתיים מלאות למפגש.", "חובה לצרף תמונות עדכניות של השיער.", "ניתן לקבל מודליסט אחד בלבד בכל יום.", "ההגעה מותנית באישור אישי של הספר."],
      notRegular: "זו לא תספורת רגילה שבה בוחרים סגנון. הספר מחליט על התספורת.",
      h2: "בחירת יום", h2s: "ימים עם מקום פנוי למודליסט", h3: "בחירת שעה", h3s: "חלון של שעתיים רצופות", h4: "הפרטים שלך", h5: "תמונות השיער", h6: "התנאים", h7: "סיכום ושליחה",
      taken: "לא ניתן להגיש בקשת מודליסט נוספת ביום זה.", closedDay: "אין מודליסטים ביום הזה.", legendOpen: "יש מקום", legendTaken: "המקום נתפס", noDays: "כרגע אין ימים פנויים למודליסט. נסו שוב בהמשך.", off: "בקשות מודליסט סגורות כרגע.",
      noTimes: "אין חלון פנוי של שעתיים ביום הזה.", name: "שם מלא", phone: "טלפון נייד", notes: "משהו שחשוב שהספר יידע? (לא חובה)", next: "המשך",
      photosIntro: "כדי שנוכל לבדוק את התאמתך כמודליסט, יש לצרף שלוש תמונות ברורות ועדכניות של השיער — מקדימה, מהצד ומאחור.",
      front: "תמונה מקדימה", side: "תמונה מהצד", backV: "תמונה מאחור", camera: "צילום", gallery: "מהגלריה", replace: "החלפה", processing: "מעבד…",
      agree: "אני מבין ומאשר שאני מגיע כמודליסט, שבחירת התספורת והסגנון היא בידי הספר בלבד, שמשך המפגש הוא כשעתיים וששליחת הבקשה אינה מהווה אישור לתור. אני מבין שאוכל לסרב לשינוי לפני ביצועו.",
      photoConsent: "אני מסכים/ה שהתמונות יישמרו באופן פרטי וייבדקו על ידי הספר בלבד, לצורך בדיקת ההתאמה. התמונות לא יפורסמו, ויימחקו אוטומטית אחרי סגירת הבקשה.",
      notPublic: "הסכמה זו אינה הסכמה לצילום, לווידאו או לפרסום ברשתות. על כל אלה נבקש הסכמה נפרדת.",
      sumService: "שירות", sumDate: "תאריך", sumTime: "שעה", sumDur: "משך", sumPrice: "מחיר", sumName: "שם", sumPhone: "טלפון", sumPhotos: "תמונות", photosOk: "3 תמונות ✓",
      submit: "שליחת בקשה למודליסט", sending: "שולח…", notConfirmed: "שימו לב: זו בקשה בלבד ולא תור מאושר.",
      okTitle: "הבקשה שלך התקבלה בהצלחה!", okBody: "התמונות והפרטים שלך הועברו לבדיקה אישית של הספר. התור עדיין לא מאושר. לאחר בדיקת ההתאמה, סטטוס הבקשה יתעדכן באזור האישי שלך.",
      myArea: "לאזור האישי", statusT: "סטטוס הבקשה", cancel: "ביטול הבקשה", cancelQ: "לבטל את הבקשה?", reason: "הערת הספר", altT: "הוצע לך מועד חלופי", applyAlt: "הגשת בקשה למועד הזה", newApp: "הגשת בקשה חדשה", save: "שמרו את הקישור הזה כדי לעקוב אחרי הבקשה.",
      st: { PENDING_APPROVAL: "ממתין לאישור", APPROVED: "הבקשה אושרה", REJECTED: "הבקשה נדחתה", ALT_PROPOSED: "הוצע מועד חלופי", CANCELLED: "הבקשה בוטלה", EXPIRED: "תוקף הבקשה פג" },
      approvedNote: "נתראה! התור מופיע עכשיו באזור האישי שלך, עם כרטיס התור.",
      e: { name: "נא למלא שם מלא.", phone: "מספר הטלפון לא תקין.", photos: "יש לצרף את שלוש התמונות.", terms: "יש לאשר את התנאים.", photo_consent: "יש לאשר את שמירת התמונות לבדיקה.", day_taken: "לא ניתן להגיש בקשת מודליסט נוספת ביום זה.", slot_taken: "השעה הזאת כבר לא פנויה. בחרו שעה אחרת.", day_closed: "אין מודליסטים ביום הזה.", too_big: "אחת התמונות גדולה מדי.", photo_invalid: "אחת התמונות אינה קובץ תמונה תקין.", limit: "הגעת למספר התמונות המקסימלי.", blocked: "לא ניתן להגיש בקשה אונליין. צרו קשר עם המספרה.", rate_limited: "יותר מדי ניסיונות. נסו שוב מאוחר יותר.", disabled: "בקשות מודליסט סגורות כרגע.", err: "משהו השתבש. נסו שוב." }
    },
    en: {
      title: "Hair Model", intro: "A creative barbering experience, the barber's choice.", steps: ["Service", "Day", "Time", "Details", "Photos", "Terms", "Send"], back: "Back", stepOf: "Step {n} of 7",
      svcName: "Hair Model", svcBadge: "Only one spot per day", free: "Free", dur: "About 2 hours", pick: "Apply",
      desc: "Open to change? We're looking for hair models for a creative, unique barbering experience where the cut, style and finish are entirely the barber's choice. Free of charge, about two hours, subject to suitability and the barber's personal approval.",
      conds: ["The cut and style are the barber's choice only.", "Not for anyone looking for a specific haircut.", "Allow a full two hours.", "Recent photos of your hair are required.", "Only one hair model per day.", "Subject to the barber's personal approval."],
      notRegular: "This is not a regular haircut where you choose the style. The barber decides.",
      h2: "Choose a day", h2s: "Days with a free model spot", h3: "Choose a time", h3s: "A two-hour window", h4: "Your details", h5: "Hair photos", h6: "Terms", h7: "Summary",
      taken: "Another hair-model request can't be submitted for this day.", closedDay: "No hair models on this day.", legendOpen: "Spot available", legendTaken: "Spot taken", noDays: "No free model days right now. Please check back later.", off: "Hair-model requests are closed right now.",
      noTimes: "No free two-hour window on this day.", name: "Full name", phone: "Mobile phone", notes: "Anything the barber should know? (optional)", next: "Continue",
      photosIntro: "To check your suitability as a hair model, attach three clear, recent photos of your hair — front, side and back.",
      front: "Front", side: "Side", backV: "Back", camera: "Camera", gallery: "Gallery", replace: "Replace", processing: "Processing…",
      agree: "I understand and confirm that I'm coming as a hair model, that the cut and style are the barber's choice only, that the session takes about two hours and that sending this request does not confirm an appointment. I understand I can refuse a change before it's done.",
      photoConsent: "I agree that the photos are stored privately and reviewed only by the barber to check suitability. They won't be published and are deleted automatically after the request closes.",
      notPublic: "This is not consent to photography, video or social-media publication. We'll ask separately for any of those.",
      sumService: "Service", sumDate: "Date", sumTime: "Time", sumDur: "Duration", sumPrice: "Price", sumName: "Name", sumPhone: "Phone", sumPhotos: "Photos", photosOk: "3 photos ✓",
      submit: "Send hair-model request", sending: "Sending…", notConfirmed: "Note: this is a request, not a confirmed appointment.",
      okTitle: "Your request was received!", okBody: "Your photos and details were sent to the barber for a personal review. The appointment is not confirmed yet. After the review, the status will update in your account.",
      myArea: "My account", statusT: "Request status", cancel: "Cancel request", cancelQ: "Cancel this request?", reason: "Barber's note", altT: "An alternative time was proposed", applyAlt: "Apply for this time", newApp: "New request", save: "Keep this link to follow your request.",
      st: { PENDING_APPROVAL: "Awaiting approval", APPROVED: "Approved", REJECTED: "Declined", ALT_PROPOSED: "Alternative proposed", CANCELLED: "Cancelled", EXPIRED: "Expired" },
      approvedNote: "See you! The appointment is now in your account with its appointment card.",
      e: { name: "Please enter your full name.", phone: "Invalid phone number.", photos: "All three photos are required.", terms: "Please accept the terms.", photo_consent: "Please allow storing the photos for review.", day_taken: "Another hair-model request can't be submitted for this day.", slot_taken: "That time is no longer free. Pick another.", day_closed: "No hair models on this day.", too_big: "One of the photos is too large.", photo_invalid: "One of the files isn't a valid image.", limit: "Photo limit reached.", blocked: "Online requests aren't available. Please contact the shop.", rate_limited: "Too many attempts. Try later.", disabled: "Hair-model requests are closed right now.", err: "Something went wrong. Please try again." }
    }
  };
  var L = function () { return T[lang()]; };
  var fmt = function (d, o) { return new Intl.DateTimeFormat(lang() === "he" ? "he-IL" : "en-GB", Object.assign({ timeZone: "UTC" }, o)).format(new Date(d + "T12:00:00Z")); };
  var longDay = function (d) { return fmt(d, { weekday: "long", day: "numeric", month: "long" }); };

  var S = { step: 1, dir: "fwd", days: null, enabled: true, date: "", month: "", slots: null, start: null, label: "", info: "", form: { name: me.name || "", phone: me.phone || "", notes: "" }, photos: { front: "", side: "", back: "" }, terms: false, photoConsent: false, error: "", busy: false };

  function prog() { var l = L(); return '<ol class="bp-prog" style="grid-template-columns:repeat(7,1fr)">' + l.steps.map(function (s, i) { var n = i + 1; return '<li class="' + (n < S.step ? "done" : n === S.step ? "cur" : "") + '">' + s + "</li>"; }).join("") + "</ol>"; }
  function bar() { var l = L(); return '<div class="bp-bar">' + (S.step > 1 ? '<button type="button" class="bp-back" data-back><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' + l.back + "</button>" : "<span></span>") + '<span class="bp-stepno">' + l.stepOf.replace("{n}", S.step) + "</span></div>"; }
  function head(h, sub) { return '<h2 class="bp-h" tabindex="-1">' + h + (sub ? "<small>" + sub + "</small>" : "") + "</h2>"; }
  function err() { return S.error ? '<p class="bp-err" role="alert">' + esc(S.error) + "</p>" : ""; }

  function step1() {
    var l = L();
    return head(l.svcName, "") + '<div class="bp-svc prem on" style="grid-template-columns:1fr;cursor:default" role="group"><span class="bp-svc-body"><span class="bp-badge">★ ' + l.svcBadge + "</span>" +
      '<span class="bp-svc-name">CASTEL MODEL EXPERIENCE · ' + l.svcName + '</span><span class="bp-svc-desc">' + l.desc + "</span>" +
      '<ul class="my-benefits" style="margin-top:8px">' + l.conds.map(function (c) { return "<li>" + c + "</li>"; }).join("") + "</ul>" +
      '<p class="bp-note" style="margin-top:12px">' + l.notRegular + "</p>" +
      '<span class="bp-svc-meta"><span class="dur">' + l.dur + ' · 120 ' + (lang() === "he" ? "דק׳" : "min") + '</span><span class="price">' + l.free + "</span></span></span></div>" +
      '<div class="my-row"><button type="button" class="bp-btn" data-go2>' + l.pick + "</button></div>";
  }
  function step2() {
    var l = L(), h = head(l.h2, l.h2s);
    if (S.days === null) return h + '<div class="bp-skel" style="height:330px"></div>';
    if (!S.enabled) return h + '<p class="bp-note">' + l.off + "</p>";
    if (!S.days.some(function (d) { return d.status === "open"; })) return h + '<p class="bp-note">' + l.noDays + "</p>";
    var map = {}, months = [];
    S.days.forEach(function (d) { map[d.date] = d.status; var m = d.date.slice(0, 7); if (months.indexOf(m) < 0) months.push(m); });
    var m = S.month || months[0], mi = months.indexOf(m), y = +m.slice(0, 4), mo = +m.slice(5, 7);
    var first = new Date(Date.UTC(y, mo - 1, 1)), lead = first.getUTCDay(), dim = new Date(Date.UTC(y, mo, 0)).getUTCDate(), rtl = lang() === "he";
    h += (S.info ? '<p class="bp-note">' + esc(S.info) + "</p>" : "") + '<div class="bp-cal"><div class="bp-cal-head"><button type="button" class="bp-mnav" data-month="' + (months[mi - 1] || "") + '"' + (mi > 0 ? "" : " disabled") + ">" + (rtl ? "›" : "‹") + '</button><p class="bp-cal-title">' + esc(new Intl.DateTimeFormat(rtl ? "he-IL" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)) + '</p><button type="button" class="bp-mnav" data-month="' + (months[mi + 1] || "") + '"' + (mi < months.length - 1 ? "" : " disabled") + ">" + (rtl ? "‹" : "›") + '</button></div><div class="bp-grid">' +
      (rtl ? ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map(function (w) { return '<span class="bp-wd">' + w + "</span>"; }).join("");
    for (var i = 0; i < lead; i++) h += '<span class="bp-day" aria-hidden="true"></span>';
    for (var d = 1; d <= dim; d++) {
      var ds = m + "-" + String(d).padStart(2, "0"), st = map[ds];
      if (st === "open") h += '<button type="button" class="bp-day avail' + (S.date === ds ? " on" : "") + '" data-date="' + ds + '" aria-label="' + esc(longDay(ds)) + '">' + d + "</button>";
      else if (st === "taken") h += '<button type="button" class="bp-day none" data-taken="' + ds + '" aria-label="' + esc(longDay(ds) + " · " + l.taken) + '">' + d + "</button>";
      else h += '<span class="bp-day' + (st ? " none" : "") + '"' + (st ? "" : ' aria-hidden="true"') + ">" + d + "</span>";
    }
    return h + '</div><div class="bp-legend"><span><i></i>' + l.legendOpen + '</span><span><i class="x"></i>' + l.legendTaken + "</span></div></div>";
  }
  function step3() {
    var l = L(), h = head(l.h3, longDay(S.date) + " · " + l.h3s);
    if (S.slots === null) return h + '<div class="bp-skel" style="height:160px"></div>';
    if (!S.slots.length) return h + '<p class="bp-note">' + l.noTimes + "</p>";
    return h + err() + '<div class="bp-times" style="margin-top:16px">' + S.slots.map(function (x) { return '<button type="button" class="bp-time' + (S.start === x.start ? " on" : "") + '" data-start="' + x.start + '" data-label="' + x.label + '" dir="ltr">' + x.label + "</button>"; }).join("") + "</div>";
  }
  function step4() {
    var l = L(), f = S.form;
    return head(l.h4, "") + '<form class="bp-form" id="mdDetails" novalidate><label class="bp-field">' + l.name + '<input name="name" autocomplete="name" maxlength="80" value="' + esc(f.name) + '" required></label>' +
      '<label class="bp-field">' + l.phone + '<input name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="20" placeholder="050-0000000" value="' + esc(f.phone) + '" required></label>' +
      '<label class="bp-field">' + l.notes + '<input name="notes" maxlength="600" value="' + esc(f.notes) + '"></label>' + err() + '<button class="bp-btn" type="submit">' + l.next + "</button></form>";
  }
  function step5() {
    var l = L(), slot = function (k, label) {
      var v = S.photos[k];
      return '<div class="md-ph"><p class="md-ph-t">' + label + "</p>" + (v ? '<img src="' + v + '" alt="' + esc(label) + '">' : '<div class="md-ph-empty" aria-hidden="true">+</div>') +
        '<div class="md-ph-btns"><label class="my-chip">' + (v ? l.replace : l.camera) + '<input type="file" accept="image/*" capture="environment" data-photo="' + k + '" hidden></label>' + (v ? "" : '<label class="my-chip">' + l.gallery + '<input type="file" accept="image/*" data-photo="' + k + '" hidden></label>') + "</div></div>";
    };
    var ready = S.photos.front && S.photos.side && S.photos.back;
    return head(l.h5, "") + '<p class="bp-note">' + l.photosIntro + '</p><div class="md-phs">' + slot("front", l.front) + slot("side", l.side) + slot("back", l.backV) + "</div>" + err() +
      '<button type="button" class="bp-btn" data-go6' + (ready ? "" : " disabled") + ">" + l.next + "</button>";
  }
  function step6() {
    var l = L();
    return head(l.h6, "") + '<form class="bp-form" id="mdTerms" novalidate><label class="bp-check"><input type="checkbox" name="terms"' + (S.terms ? " checked" : "") + "> <span>" + l.agree + "</span></label>" +
      '<label class="bp-check"><input type="checkbox" name="photoConsent"' + (S.photoConsent ? " checked" : "") + "> <span>" + l.photoConsent + "</span></label>" +
      '<p class="bp-muted bp-small" style="margin:0">' + l.notPublic + "</p>" + err() + '<button class="bp-btn" type="submit">' + l.next + "</button></form>";
  }
  function step7() {
    var l = L();
    return head(l.h7, "") + '<div class="bp-sum"><dl class="bp-dl"><dt>' + l.sumService + "</dt><dd>" + l.svcName + "</dd><dt>" + l.sumDate + "</dt><dd>" + esc(longDay(S.date)) + "</dd><dt>" + l.sumTime + '</dt><dd><bdi dir="ltr">' + esc(S.label) + "</bdi></dd><dt>" + l.sumDur + "</dt><dd>" + l.dur + "</dd><dt>" + l.sumName + "</dt><dd>" + esc(S.form.name) + "</dd><dt>" + l.sumPhone + '</dt><dd><bdi dir="ltr">' + esc(S.form.phone) + "</bdi></dd><dt>" + l.sumPhotos + "</dt><dd>" + l.photosOk + "</dd><dt>" + l.sumPrice + '</dt><dd class="price">' + l.free + "</dd></dl></div>" +
      '<p class="bp-note">' + l.notConfirmed + "</p>" + err() + '<div class="bp-confirm"><button type="button" class="bp-btn" data-submit' + (S.busy ? " disabled" : "") + ">" + (S.busy ? l.sending : l.submit) + "</button></div>";
  }

  function render(animate) {
    var steps = [null, step1, step2, step3, step4, step5, step6, step7];
    root.innerHTML = prog() + '<section class="bp-panel' + (animate && !reduce ? " in-" + S.dir : "") + '">' + bar() + steps[S.step]() + "</section>";
  }
  function go(n, dir) { S.step = n; S.dir = dir; S.error = ""; render(true); window.scrollTo({ top: Math.max(0, root.getBoundingClientRect().top + window.pageYOffset - 70), behavior: reduce ? "auto" : "smooth" }); }
  function loadDays() {
    S.days = null; render();
    fetch(API, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      S.enabled = !!d.enabled; S.days = d.days || [];
      var want = new URLSearchParams(location.search).get("date"), firstOpen = S.days.filter(function (x) { return x.status === "open"; })[0];
      S.month = (want && S.days.some(function (x) { return x.date === want; }) ? want : firstOpen ? firstOpen.date : (S.days[0] || {}).date || "").slice(0, 7);
      if (S.step === 2) render();
    }).catch(function () { S.enabled = false; S.days = []; if (S.step === 2) render(); });
  }
  function loadSlots() {
    S.slots = null; S.start = null;
    fetch(API + "?date=" + S.date, { cache: "no-store" }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "x"); return d; }); })
      .then(function (d) { S.slots = d.slots || []; if (S.step === 3) render(); })
      .catch(function (e) { S.slots = []; S.error = L().e[e.message] || ""; if (S.step === 3) render(); });
  }
  function resize(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), c = document.createElement("canvas");
        c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var q = 0.85, out = c.toDataURL("image/jpeg", q);
        while (out.length > 1150000 && q > 0.45) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("photo_invalid")); };
      img.src = url;
    });
  }

  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    var l = L();
    if (b.hasAttribute("data-back")) go(S.step - 1, "back");
    else if (b.hasAttribute("data-go2")) { go(2, "fwd"); if (S.days === null) loadDays(); }
    else if (b.classList.contains("bp-mnav")) { if (b.dataset.month) { S.month = b.dataset.month; render(); } }
    else if (b.dataset.taken) { S.info = l.taken; render(); }
    else if (b.dataset.date) { S.info = ""; S.date = b.dataset.date; loadSlots(); setTimeout(function () { go(3, "fwd"); }, reduce ? 0 : 120); }
    else if (b.dataset.start) { S.start = Number(b.dataset.start); S.label = b.dataset.label; go(4, "fwd"); }
    else if (b.hasAttribute("data-go6")) { if (!(S.photos.front && S.photos.side && S.photos.back)) { S.error = l.e.photos; render(); return; } go(6, "fwd"); }
    else if (b.hasAttribute("data-submit")) submit();
  });
  root.addEventListener("change", function (e) {
    var inp = e.target; if (!inp.dataset || !inp.dataset.photo || !inp.files || !inp.files[0]) return;
    var k = inp.dataset.photo, l = L(), t = inp.closest(".md-ph").querySelector(".md-ph-t"); t.textContent = l.processing;
    resize(inp.files[0]).then(function (d) { S.photos[k] = d; S.error = ""; render(); }).catch(function () { S.error = l.e.photo_invalid; render(); });
  });
  root.addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, l = L();
    if (f.id === "mdDetails") {
      S.form = { name: f.name.value.trim(), phone: f.phone.value.trim(), notes: f.notes.value.trim() };
      if (S.form.name.length < 2) { S.error = l.e.name; render(); return; }
      if (S.form.phone.replace(/\D/g, "").length < 9) { S.error = l.e.phone; render(); return; }
      go(5, "fwd");
    } else if (f.id === "mdTerms") {
      S.terms = f.terms.checked; S.photoConsent = f.photoConsent.checked;
      if (!S.terms) { S.error = l.e.terms; render(); return; }
      if (!S.photoConsent) { S.error = l.e.photo_consent; render(); return; }
      go(7, "fwd");
    }
  });

  var sending = false;
  function submit() {
    if (sending) return;
    var l = L(); sending = true; S.busy = true; S.error = ""; render();
    var dev = read(DEV);
    fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit", name: S.form.name, phone: S.form.phone, notes: S.form.notes, date: S.date, start: S.start, photos: S.photos, consentTerms: S.terms, consentPhotos: S.photoConsent, deviceToken: dev && /^[A-Za-z0-9_-]{30,64}$/.test(dev) ? dev : undefined }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "err"); return d; }); })
      .then(function (d) {
        sending = false; S.busy = false;
        if (d.deviceToken) store(DEV, d.deviceToken);
        try { var m = JSON.parse(read(MINE) || "[]"); m.push(d.token); store(MINE, JSON.stringify(m.slice(-10))); } catch (x) { /* ignore */ }
        try { localStorage.setItem("castel.booking.me", JSON.stringify({ name: S.form.name, phone: S.form.phone })); } catch (x) { /* ignore */ }
        history.replaceState(null, "", location.pathname + "?t=" + encodeURIComponent(d.token));
        showStatus(d.token, true);
      })
      .catch(function (x) {
        sending = false; S.busy = false; S.error = l.e[x.message] || l.e.err;
        if (x.message === "day_taken" || x.message === "slot_taken") { go(x.message === "day_taken" ? 2 : 3, "back"); S.error = l.e[x.message]; if (x.message === "day_taken") loadDays(); else loadSlots(); }
        render();
      });
  }

  function showStatus(token, fresh) {
    var l = L();
    root.innerHTML = '<div class="bp-skel"></div>';
    fetch(API + "?t=" + encodeURIComponent(token), { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (a) {
      var h = '<div class="bp-done">' + (fresh ? '<div class="bp-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2>' + l.okTitle + '</h2><p class="bp-muted" style="max-width:520px;margin:10px auto 0">' + l.okBody + "</p>" : "<h2>" + l.statusT + "</h2>") +
        '<div class="bp-sum"><dl class="bp-dl"><dt>' + l.sumService + "</dt><dd>" + l.svcName + "</dd><dt>" + l.sumDate + "</dt><dd>" + esc(longDay(a.date)) + "</dd><dt>" + l.sumTime + '</dt><dd><bdi dir="ltr">' + esc(a.time) + "</bdi></dd><dt>" + l.sumDur + "</dt><dd>" + l.dur + "</dd><dt>" + l.statusT + '</dt><dd><span class="bp-st lv-' + (a.status === "APPROVED" ? "ready" : a.status === "PENDING_APPROVAL" ? "delay" : "x") + '">' + esc(l.st[a.status] || a.status) + "</span></dd></dl></div>";
      if (a.status === "APPROVED") h += '<p class="bp-note" style="text-align:start">' + l.approvedNote + "</p>";
      if (a.reason) h += '<p class="bp-note" style="text-align:start"><b>' + l.reason + ":</b> " + esc(a.reason) + "</p>";
      if (a.alt) h += '<div class="bp-note" style="text-align:start"><b>' + l.altT + ":</b> " + esc(longDay(a.alt.date)) + ' · <bdi dir="ltr">' + esc(a.alt.time) + '</bdi></div><div class="bp-row"><a class="bp-btn sm" href="/model/?date=' + esc(a.alt.date) + '">' + l.applyAlt + "</a></div>";
      h += '<div class="bp-row"><a class="bp-btn sm" href="/my/">' + l.myArea + "</a>" + (a.canCancel ? '<button type="button" class="bp-btn ghost sm bp-danger" data-cancel-app>' + l.cancel + "</button>" : '<a class="bp-btn ghost sm" href="/model/">' + l.newApp + "</a>") + "</div>" +
        '<p class="bp-muted bp-small" style="margin-top:14px">' + l.save + "</p></div>";
      root.innerHTML = h;
      var c = root.querySelector("[data-cancel-app]");
      if (c) c.addEventListener("click", function () {
        if (!confirm(l.cancelQ)) return;
        fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", t: token }) }).then(function () { showStatus(token, false); });
      });
    }).catch(function () { root.innerHTML = '<p class="bp-err">' + L().e.err + "</p>"; });
  }

  function applyLang(lg) {
    var h = document.documentElement; h.lang = lg; h.dir = lg === "en" ? "ltr" : "rtl";
    try { localStorage.setItem("castel-lang", lg); } catch (e) { /* ignore */ }
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lg)); });
    document.querySelectorAll("[data-t]").forEach(function (el) { var k = el.getAttribute("data-t"); if (T[lg][k]) el.textContent = T[lg][k]; });
    var t = new URLSearchParams(location.search).get("t");
    if (t) showStatus(t, false); else render();
  }
  document.querySelectorAll("[data-lang]").forEach(function (b) { b.addEventListener("click", function () { applyLang(b.dataset.lang); }); });

  var tok = new URLSearchParams(location.search).get("t");
  if (tok && /^[A-Za-z0-9_-]{20,64}$/.test(tok)) applyLang(lang());
  else { applyLang(lang()); if (new URLSearchParams(location.search).get("date")) { go(2, "fwd"); } loadDays(); }
})();
