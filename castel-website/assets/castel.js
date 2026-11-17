/* =====================================================================
   CASTEL STUDIO · CONFIG
   כל פרטי העסק כאן. אחרי עריכה שומרים את הקובץ ומעלים מחדש.
   תמונות: שמים קבצים בתיקייה images/ בשמות שמופיעים ב-images/README.md
   והם יופיעו באתר אוטומטית במקום הרקעים הגרפיים.
   ===================================================================== */
const CONFIG = {
  phone: "055-571-1239",
  tel: "tel:+972555711239",
  bookingUrl: "/#book",   // מערכת התורים של CASTEL STUDIO (מוטמעת באתר, סעיף #book)
  whatsappNumber: "972555711239",                           // מספר הוואטסאפ (בלי + ובלי 0). כל כפתור שולח הודעה מוכנה משלו
  whatsappUrl: "https://wa.me/message/UFGRSWV4FNL2M1",      // הקישור הקצר הישן (לא תומך בהודעה שונה לכל כפתור)
  instagramUrl: "https://www.instagram.com/castel.cutzz?srtk=ZDBiYXB6MTQ5MjZo&utm_source=qr",
  instagramHandle: "@castel.cutzz",

  // לא להמציא. ריק = לא מוצג באתר
  address: { he: "", en: "" },                 // למשל { he: "הרצל 10, אשקלון", en: "10 Herzl St, Ashkelon" }
  hours: [],                                   // למשל [{ he: "ראשון – חמישי", en: "Sun – Thu", time: "10:00 – 20:00" }]
  instructor: { he: "", en: "" },              // שם המדריך, למשל { he: "שם פרטי", en: "First name" }

  academy: {
    sessions: 6, perWeek: 2, totalHours: 13, weeks: 3,
    programs: [
      { id: "group", price: 5500, maxStudents: 5 },
      { id: "vip", price: 6500 }
    ],
    // תוכנית הלימודים המאושרת. hours = משך המפגש
    curriculum: [
      { hours: 2, tag: "Introduction",
        he: ["היכרות ויסודות המקצוע", "מפגש היכרות, כניסה לעולם ספרות הגברים, התלמדות ראשונית והכנה לתהליך הלימוד."],
        en: ["Introduction & foundations", "Getting to know each other, entering the world of men's barbering, first observation and preparing for the learning process."] },
      { hours: 2, tag: "Demonstrations",
        he: ["הדגמות, למידה ושיעורי בית", "מתחילים בלמידה מקצועית ובעבודה על יסודות הספרות. עד שתי הדגמות מעשיות של המדריך, הסברים, רישום במחברת ושיעורי בית להמשך הלמידה."],
        en: ["Demonstrations, learning & homework", "Professional learning and the foundations of barbering. Up to two live demonstrations by the instructor, explanations, written notes and homework to keep learning."] },
      { hours: 2, tag: "First practice",
        he: ["מתחילים לעבוד", "תחילת עבודה מעשית, התנסות ראשונית בטכניקות שנלמדו ותרגול בהדרכת המדריך."],
        en: ["Getting hands-on", "Starting practical work: first experience with the techniques learned, practising under the instructor's guidance."] },
      { hours: 2, tag: "Scissor techniques",
        he: ["אומנות הגזירות ועבודת מספריים", "למידת גזירות, עבודת מספריים, דיוק, שליטה בכלים וטכניקות עבודה שונות."],
        en: ["The art of scissor work", "Learning cutting and scissor work, precision, control of the tools and different working techniques."] },
      { hours: 2, tag: "Hair design",
        he: ["אומנות הפנסים", "היכרות עם עולם הפנסים, יצירת קווים ועיצובים בשיער, למידת יסודות העיצוב ותרגול טכניקות."],
        en: ["The art of hair design", "Introduction to hair designs: creating lines and patterns in the hair, design fundamentals and technique practice."] },
      { hours: 3, tag: "Final session", final: true,
        he: ["מפגש סיום — עבודה מעשית וקבלת תעודות", "מפגש מסכם הכולל שלוש שעות של עבודה מעשית, תרגול הטכניקות שנלמדו וקבלת תעודות סיום."],
        en: ["Final session — practical work & certificates", "A closing session with three hours of practical work, practising everything learned, and receiving certificates of completion."] }
    ]
  },

  // מחירון. desc ריק = לא מוצג תיאור (גזירות / פנסים ממתינים להגדרה מדויקת)
  services: [
    { he: "תספורת רגילה", en: "Classic Haircut", price: 60,
      dhe: "תספורת גברים קלאסית, מותאמת למבנה הפנים ולסגנון שלך.", den: "A classic men's haircut, tailored to your face and style." },
    { he: "תספורת + זקן", en: "Haircut + Beard", price: 60,
      dhe: "תספורת יחד עם סידור הזקן, למראה שלם ומדויק.", den: "A haircut together with a beard tidy-up, for a complete look." },
    { he: "סידור זקן", en: "Beard Tidy-Up", price: 20,
      dhe: "סידור קווים וניקוי הזקן לגימור חד.", den: "Clean lines and a tidy shape for a sharp finish." },
    { he: "תספורת גזירות", en: "Scissor-Work Haircut", price: 100,
      dhe: "תספורת עם עבודת גזירות ומספריים מדויקת.", den: "A haircut with precise cutting and scissor work." },
    { he: "תספורת פנסים", en: "Hair Design Haircut", price: 120,
      dhe: "תספורת עם פנסים: קווים ועיצובים בשיער.", den: "A haircut with lines and designs cut into the hair." }
  ],

  // גלריה: עבודות אמיתיות של CASTEL STUDIO. להוספה: שמים קובץ ב-images/gallery ומוסיפים שורה
  gallery: [
    { src: "images/gallery/05.webp", cat: "design",     title: "Hair Design",   alt: { he: "תספורת עם פייד ופנסים: עיצוב קווים בצד הראש", en: "Fade with a freehand hair design on the side" } },
    { src: "images/gallery/04.webp", cat: "highlights", title: "Highlights",    alt: { he: "תספורת עם פייד וגוונים בהירים בחלק העליון", en: "Fade with blonde highlights on top" } },
    { src: "images/gallery/01.webp", cat: "taper",      title: "Curly Taper",   alt: { he: "שיער מתולתל עם טייפר נמוך וקו בצד", en: "Curly top with a low taper and a side line" } },
    { src: "images/gallery/03.webp?v=3", cat: "design", title: "Freestyle Design", alt: { he: "פייד עם פנסים: עיצוב פריסטייל בצד הראש", en: "Fade with a freestyle hair design on the side" } },
    { src: "images/gallery/02.webp", cat: "skin",       title: "Skin Fade",     alt: { he: "סקין פייד עם שביל חרוט", en: "Skin fade with a hard part" } },
    { src: "images/gallery/06.webp", cat: "crop",       title: "Textured Crop", alt: { he: "קרופ עם טקסטורה וטייפר נמוך", en: "Textured crop with a low taper" } }
  ],
  categories: [
    ["all", "All"], ["design", "Hair Design"], ["highlights", "Highlights"], ["taper", "Taper Fade"],
    ["skin", "Skin Fade"], ["crop", "Textured Crop"]
  ],

  // תמונות אמיתיות מהאינסטגרם (אופציונלי). ריק = האזור מציג רק כפתור לפרופיל
  instagramGallery: [],                        // למשל [{ src: "images/ig/01.webp" }]

  // ביקורות אמיתיות בלבד. ריק = האזור מוסתר
  reviews: []                                  // למשל [{ name: "שם", he: "טקסט", en: "Text", stars: 5, source: "Google" }]
};

/* ===================================================================== */
const I18N = {
  he: {
    skip: "דילוג לתוכן",
    "aria.nav": "ניווט ראשי", "aria.lang": "שפה", "aria.menu": "פתיחת תפריט", "aria.menuClose": "סגירת תפריט", "aria.menuDlg": "תפריט",
    "aria.mnav": "תפריט נייד", "aria.gallery": "גלריה", "aria.close": "סגירה", "aria.prev": "הקודם", "aria.next": "הבא",
    "aria.filter": "סינון לפי סגנון", "aria.open": "פתיחת תמונה במסך מלא", live: "האתר מוצג עכשיו בעברית",
    "alt.instructor": "הספר והמדריך של CASTEL STUDIO",
    "nav.home": "ראשי", "nav.academy": "האקדמיה", "nav.course": "על הקורס", "nav.shop": "המספרה", "nav.gallery": "גלריה",
    "nav.contact": "יצירת קשר", "nav.book": "קביעת תור", "nav.faq": "שאלות נפוצות",
    "cta.details": "לפרטים על הקורס", "cta.learn": "אני רוצה ללמוד ספרות", "cta.start": "מתחילים את הדרך",
    "cta.book": "קביעת תור", "cta.bookCut": "קביעת תור לתספורת",
    "h.h1": "מאפס למקצוע.", "h.second": "הדרך שלך לעולם ספרות הגברים מתחילה כאן.",
    "h.s1": "6 מפגשים", "h.s2": "13 שעות", "h.s3": "3 שבועות",
    "h.support": "קורס ספרות גברים למתחילים. 6 מפגשים, 13 שעות הכשרה, פעמיים בשבוע — ללא צורך בניסיון קודם.",
    "h.cta1": "לגלות את הקורס",
    "ac.course": "קורס ספרות גברים למתחילים",
    "ai.h": "לא רק ללמוד להסתפר. ללמוד את אמנות הספרות.", "ai.sub": "הצעד הראשון שלך למקצוע חדש.",
    "ac.desc": "קורס ספרות גברים למתחילים מבית CASTEL STUDIO ACADEMY. שישה מפגשים מקצועיים, פעמיים בשבוע, שעתיים בכל מפגש — עם דגש על יסודות המקצוע, דיוק ופיתוח מיומנויות מעשיות.",
    "ac.intro2": "הקורס בנוי לאנשים שמתחילים מאפס. בשישה מפגשים של שעתיים לומדים את יסודות ספרות הגברים, עם דגש על דיוק ועל עבודה מעשית.",
    "ac.page": "לכל פרטי הקורס", "ac.seeDetails": "ללוח הזמנים והמחיר",
    "ac.h1a": "מאפס למקצוע.", "ac.h1b": "הדרך שלך מתחילה כאן.",
    "ac.fo1": "יסודות המקצוע", "ac.fo2": "דיוק", "ac.fo3": "מיומנויות מעשיות",
    "st.title": "הקורס במספרים", "st.sessions": "מפגשים", "st.hours": "שעות הכשרה", "st.weeks": "שבועות", "st.price": "מחיר הקורס",
    "why.title": "למה ללמוד ב־CASTEL STUDIO", "why.intro": "ללמוד מקצוע מאדם שעושה אותו, בסטנדרט שרואים בכל תספורת.",
    "why.1t": "לומדים מספר פעיל", "why.1p": "הקורס מועבר על ידי הספר של CASTEL STUDIO, עם כארבע שנות ניסיון מקצועי.",
    "why.2t": "מבנה ברור", "why.2p": "6 מפגשים של שעתיים, פעמיים בשבוע. כשלושה שבועות מההתחלה ועד הסוף.",
    "why.3t": "דגש על עשייה", "why.3p": "יסודות המקצוע, דיוק ופיתוח מיומנויות מעשיות לאורך כל הקורס.",
    "why.4t": "הסטנדרט של הסטודיו", "why.4p": "אותה רמת דיוק שרואים בעבודות של CASTEL STUDIO בגלריה ובאינסטגרם.",
    "who.title": "למי הקורס מתאים?", "who.msg": "לא צריך ניסיון קודם. <em>צריך רצון להתחיל.</em>",
    "who.1": "למי שמעולם לא עבד כספר", "who.2": "למי שרוצה ללמוד ספרות גברים מאפס",
    "who.3": "למי שמחפש לפתח מיומנות מקצועית חדשה", "who.4": "למי שרוצה לבדוק קריירה עתידית בעולם הספרות",
    "jr.title": "מסלול הלמידה", "jr.intro": "שישה מפגשים של שעתיים, פעמיים בשבוע. פירוט הנושאים של כל מפגש יתעדכן בקרוב.",
    "jr.conf": "פרט מאושר", "jr.pend": "יתעדכן בקרוב", "jr.week": "שבוע", "jr.hrs": "שעתיים",
    "jr.topicSoon": "נושא המפגש יתעדכן בקרוב", "jr.tagSoon": "בהכנה", "jr.more": "לוח הזמנים והמחיר המלא",
    "reg.p": "הצעד הראשון שלך למקצוע חדש מתחיל בהודעה אחת.",
    "about.years": "שנות ניסיון מקצועי",
    "about.lead": "ב־CASTEL STUDIO אנחנו מאמינים שתספורת טובה היא הרבה מעבר למראה. היא שילוב של <em>דיוק</em>, מקצועיות, יחס אישי וסטייל שמותאם לכל לקוח.",
    "about.p1": "כארבע שנים של עבודה מאחורי הכיסא לימדו אותנו שההבדל בין תספורת טובה לתספורת מצוינת נמצא במילימטרים. את אותו סטנדרט מלמדים באקדמיה.",
    "about.p2": "הסטודיו מתמחה בסגנונות גברים מודרניים: פיידים, טקסטורה ותספורות מספריים, עם תשומת לב לכל פרט.",
    "about.pil1": "מעברים חלקים וקווים חדים", "about.pil2": "תנועה טבעית בשיער", "about.pil3": "גימור שרואים מקרוב",
    "inst.lead": "מלמדים את מה שעושים <em>כל יום</em> מאחורי הכיסא.",
    "inst.p1": "הקורס מועבר על ידי הספר של CASTEL STUDIO, עם כארבע שנות ניסיון מקצועי בספרות גברים.",
    "inst.p2": "ההתמחות שלו היא סגנונות גברים מודרניים: פיידים, טקסטורה ותספורות מספריים, עם דגש על דיוק ועל פרטים קטנים.",
    "inst.work": "לעבודות של המדריך",
    "port.title": "העבודות של המדריך", "port.intro": "העבודות האמיתיות מהכיסא מראות את הסטנדרט שלומדים בקורס.", "port.all": "לגלריה המלאה",
    "ac.dTitle": "לוח זמנים ומחיר", "ac.dIntro": "כל הפרטים המאושרים של הקורס. למועד המחזור הקרוב, כתבו לנו בוואטסאפ.",
    "ac.f1k": "למי מתאים", "ac.f1v": "מתחילים לגמרי. לא נדרש ניסיון קודם.",
    "ac.f2k": "מפגשים", "ac.f2v": "6 מפגשים, פעמיים בשבוע",
    "ac.f3k": "משך מפגש", "ac.f3v": "שעתיים",
    "ac.f4k": "סך הכול", "ac.f4v": "13 שעות הכשרה",
    "ac.f5k": "משך הקורס", "ac.f5v": "כ־3 שבועות, בהנחה שאין הפסקות",
    "ac.f6k": "מחיר הקורס", "ac.tlT": "קצב הקורס", "ac.session": "מפגש",
    "ac.note": "הקורס נותן בסיס מקצועי ומיומנויות מעשיות לתחילת הדרך במקצוע. מועדי המחזור הקרוב ופירוט המפגשים נמסרים בוואטסאפ.",
    "faq.title": "שאלות נפוצות", "faq.intro": "לא מצאתם תשובה? כתבו לנו בוואטסאפ ונענה על כל שאלה.",
    "faq": [
      ["האם צריך ניסיון קודם?", "לא. הקורס מיועד למתחילים לגמרי, ללא ניסיון קודם."],
      ["כמה מפגשים יש בקורס?", "<b>6 מפגשים.</b>"],
      ["כמה זמן נמשך כל מפגש?", "<b>שעתיים.</b> בסך הכול 13 שעות הכשרה."],
      ["כמה פעמים בשבוע לומדים?", "<b>פעמיים בשבוע.</b> הקורס נמשך כ־3 שבועות, בהנחה שאין הפסקות."],
      ["כמה עולה הקורס?", "<b>₪5,500.</b>"],
      ["מתי המחזור הקרוב ומה לומדים בכל מפגש?", "את המועדים ואת פירוט המפגשים מקבלים ישירות מאיתנו. <a href=\"{WA}\">כתבו לנו בוואטסאפ</a>."]
    ],
    "shop.title": "דיוק בכל תספורת. סטייל בכל פרט.", "svc.intro": "מחירון שקוף, בלי הפתעות. כל שירות נעשה באותה רמת דיוק.",
    "svc.note": "המחירים בשקלים חדשים.", "svc.book": "קביעת תור",
    "gal.title": "הגלריה", "gal.intro": "מבחר עבודות מהכיסא. לחיצה על תמונה פותחת אותה במסך מלא.", "gal.ph": "תמונה זמנית",
    "rev.title": "מה הלקוחות אומרים",
    "ig.more": "לעוד עבודות באינסטגרם", "ig.text": "עבודות אחרונות, סרטונים ומה שקורה בסטודיו.",
    "ct.title": "יצירת קשר", "ct.intro": "בחרו את הערוץ המתאים: שאלות על הקורס, תור לתספורת או כל דבר אחר.",
    "ch.aT": "פניות לאקדמיה", "ch.aP": "שאלות על הקורס והרשמה, ישירות בוואטסאפ.",
    "ch.bT": "תורים למספרה", "ch.bP": "קביעת תור לתספורת ישירות כאן באתר.", "bk.title": "קביעת תור", "bk.intro": "בוחרים שירות, יום ושעה. התור נקבע תוך דקה.",
    "ch.gT": "פניות כלליות", "ct.call": "חיוג", "ct.city": "אשקלון, ישראל", "ct.hours": "שעות פעילות", "ct.addr": "כתובת", "ct.nav": "ניווט",
    "foot.rights": "כל הזכויות שמורות", "foot.tag": "אקדמיה לספרות גברים ומספרה פרימיום באשקלון",
    title: { home: "CASTEL STUDIO ACADEMY · קורס ספרות גברים למתחילים באשקלון", academy: "קורס ספרות גברים למתחילים · CASTEL STUDIO ACADEMY · אשקלון" }
  },
  en: {
    skip: "Skip to content",
    "aria.nav": "Main navigation", "aria.lang": "Language", "aria.menu": "Open menu", "aria.menuClose": "Close menu", "aria.menuDlg": "Menu",
    "aria.mnav": "Mobile navigation", "aria.gallery": "Gallery", "aria.close": "Close", "aria.prev": "Previous", "aria.next": "Next",
    "aria.filter": "Filter by style", "aria.open": "Open image fullscreen", live: "The site is now in English",
    "alt.instructor": "The CASTEL STUDIO barber and instructor",
    "nav.home": "Home", "nav.academy": "Academy", "nav.course": "The Course", "nav.shop": "Barbershop", "nav.gallery": "Gallery",
    "nav.contact": "Contact", "nav.book": "Book", "nav.faq": "FAQ",
    "cta.details": "Course details", "cta.learn": "I want to learn barbering", "cta.start": "Start my journey",
    "cta.book": "Book an appointment", "cta.bookCut": "Book a haircut",
    "h.h1": "From zero to the craft.", "h.second": "Your path into men's barbering starts here.",
    "h.s1": "6 sessions", "h.s2": "13 hours", "h.s3": "3 weeks",
    "h.support": "A men's barbering course for beginners. 6 sessions, 13 training hours, twice a week, no previous experience needed.",
    "h.cta1": "Discover the course",
    "ac.course": "Men's Barbering Course for Beginners",
    "ai.h": "Not just learning to cut hair. Learning the art of barbering.", "ai.sub": "Your first step toward a new profession.",
    "ac.desc": "A men's barbering course for beginners by CASTEL STUDIO ACADEMY. Six professional sessions, twice a week, two hours each, focused on the foundations of the craft, precision and hands-on skills.",
    "ac.intro2": "The course is built for people starting from zero. Over six two-hour sessions you learn the foundations of men's barbering, with a focus on precision and practical work.",
    "ac.page": "Full course details", "ac.seeDetails": "Schedule & price",
    "ac.h1a": "From zero to the craft.", "ac.h1b": "Your path starts here.",
    "ac.fo1": "Foundations of the craft", "ac.fo2": "Precision", "ac.fo3": "Hands-on skills",
    "st.title": "The course in numbers", "st.sessions": "Sessions", "st.hours": "Training hours", "st.weeks": "Weeks", "st.price": "Course price",
    "why.title": "Why learn at CASTEL STUDIO", "why.intro": "Learn the craft from someone who practises it, at the standard you see in every cut.",
    "why.1t": "Learn from a working barber", "why.1p": "The course is taught by the CASTEL STUDIO barber, with around four years of professional experience.",
    "why.2t": "A clear structure", "why.2p": "6 two-hour sessions, twice a week. About three weeks from start to finish.",
    "why.3t": "Hands-on focus", "why.3p": "Foundations of the craft, precision and practical skills throughout the course.",
    "why.4t": "The studio standard", "why.4p": "The same precision you see in CASTEL STUDIO's work in the gallery and on Instagram.",
    "who.title": "Who is the course for?", "who.msg": "No experience needed. <em>Just the will to start.</em>",
    "who.1": "People who have never worked as barbers", "who.2": "Anyone who wants to learn men's barbering from zero",
    "who.3": "Those looking to develop a new professional skill", "who.4": "Anyone exploring a future career in barbering",
    "jr.title": "The learning journey", "jr.intro": "Six two-hour sessions, twice a week. The topic of each session will be published soon.",
    "jr.conf": "Confirmed detail", "jr.pend": "Coming soon", "jr.week": "Week", "jr.hrs": "2 hours",
    "jr.topicSoon": "Session topic coming soon", "jr.tagSoon": "In preparation", "jr.more": "Full schedule and price",
    "reg.p": "Your first step toward a new profession starts with one message.",
    "about.years": "years of professional experience",
    "about.lead": "At CASTEL STUDIO we believe a great haircut goes far beyond looks. It is a blend of <em>precision</em>, craft, personal attention and style tailored to every client.",
    "about.p1": "Around four years behind the chair taught us that the difference between a good cut and a great one is measured in millimetres. The academy teaches that same standard.",
    "about.p2": "The studio specialises in modern men's styles: fades, texture and scissor cuts, with attention to every detail.",
    "about.pil1": "Seamless transitions, sharp lines", "about.pil2": "Natural movement", "about.pil3": "A finish that holds up close",
    "inst.lead": "Teaching what we do <em>every day</em> behind the chair.",
    "inst.p1": "The course is taught by the CASTEL STUDIO barber, with around four years of professional experience in men's barbering.",
    "inst.p2": "His focus is modern men's styles: fades, texture and scissor cuts, with an eye for precision and small details.",
    "inst.work": "See the instructor's work",
    "port.title": "The instructor's work", "port.intro": "Real work from the chair shows the standard you learn in the course.", "port.all": "Full gallery",
    "ac.dTitle": "Schedule & price", "ac.dIntro": "Every confirmed detail of the course. For the next intake, message us on WhatsApp.",
    "ac.f1k": "Who it's for", "ac.f1v": "Complete beginners. No previous experience required.",
    "ac.f2k": "Sessions", "ac.f2v": "6 sessions, twice a week",
    "ac.f3k": "Session length", "ac.f3v": "2 hours",
    "ac.f4k": "In total", "ac.f4v": "13 training hours",
    "ac.f5k": "Course length", "ac.f5v": "About 3 weeks, assuming no interruptions",
    "ac.f6k": "Course price", "ac.tlT": "Course rhythm", "ac.session": "Session",
    "ac.note": "The course gives you a professional foundation and hands-on skills to begin your path in the craft. Upcoming dates and session details are shared on WhatsApp.",
    "faq.title": "Frequently asked questions", "faq.intro": "Didn't find your answer? Message us on WhatsApp and we'll answer any question.",
    "faq": [
      ["Do I need previous experience?", "No. The course is designed for complete beginners with no previous experience."],
      ["How many sessions are there?", "<b>6 sessions.</b>"],
      ["How long is each session?", "<b>2 hours.</b> 13 training hours in total."],
      ["How often do we meet?", "<b>Twice a week.</b> The course takes about 3 weeks, assuming no interruptions."],
      ["How much does the course cost?", "<b>₪5,500.</b>"],
      ["When is the next intake, and what does each session cover?", "Dates and session details are shared directly. <a href=\"{WA}\">Message us on WhatsApp</a>."]
    ],
    "shop.title": "Precision in every cut. Style in every detail.", "svc.intro": "Transparent pricing, no surprises. Every service gets the same precision.",
    "svc.note": "Prices in Israeli shekels.", "svc.book": "Book",
    "gal.title": "Gallery", "gal.intro": "Selected work from the chair. Tap any image to view it fullscreen.", "gal.ph": "Placeholder",
    "rev.title": "Client words",
    "ig.more": "More work on Instagram", "ig.text": "Latest work, videos and life in the studio.",
    "ct.title": "Contact", "ct.intro": "Pick the right channel: course questions, a haircut appointment or anything else.",
    "ch.aT": "Academy inquiries", "ch.aP": "Course questions and registration, directly on WhatsApp.",
    "ch.bT": "Barbershop appointments", "ch.bP": "Book a haircut right here on the site.", "bk.title": "Book an appointment", "bk.intro": "Pick a service, day and time. Booked in a minute.",
    "ch.gT": "General contact", "ct.call": "Call", "ct.city": "Ashkelon, Israel", "ct.hours": "Opening hours", "ct.addr": "Address", "ct.nav": "Directions",
    "foot.rights": "All rights reserved", "foot.tag": "Men's barbering academy and premium barbershop in Ashkelon",
    title: { home: "CASTEL STUDIO ACADEMY · Men's Barbering Course for Beginners · Ashkelon", academy: "Men's Barbering Course for Beginners · CASTEL STUDIO ACADEMY · Ashkelon" }
  }
};


/* ---------- academy programs + curriculum copy (confirmed by CASTEL STUDIO) ---------- */
Object.assign(I18N.he, {
  "h.s2": "13 שעות", "h.s3": "3 שבועות", "h.s4": "2 מסלולים",
  "h.support": "קורס ספרות גברים למתחילים מבית CASTEL STUDIO ACADEMY. שני מסלולי לימוד, שישה מפגשים, 13 שעות הכשרה וללא צורך בניסיון קודם.",
  "ai.h": "מאפס למקצוע. בדרך שמתאימה לך.", "ai.sub": "שני מסלולים. מטרה אחת. הדרך שלך למקצוע.",
  "ai.h2": "לא רק ללמוד להסתפר. ללמוד את אמנות הספרות.",
  "ac.h1a": "מאפס למקצוע.", "ac.h1b": "בדרך שמתאימה לך.",
  "ac.desc": "קורס ספרות גברים למתחילים מבית CASTEL STUDIO ACADEMY: שישה מפגשים, פעמיים בשבוע, 13 שעות הכשרה ותעודת סיום. לומדים בקבוצה קטנה של עד חמישה תלמידים, או באופן אישי אחד על אחד.",
  "ac.intro2": "הקורס בנוי לאנשים שמתחילים מאפס: הדגמות של המדריך, הסברים, תרגול מעשי ושיעורי בית, עד מפגש סיום של שלוש שעות עבודה מעשית וקבלת תעודה.",
  "ac.page": "לעמוד האקדמיה",
  "st.hours": "שעות הכשרה", "st.perweek": "מפגשים בשבוע",
  "why.1t": "לומדים מספר פעיל", "why.1p": "הקורס מועבר על ידי הספר של CASTEL STUDIO, עם כארבע שנות ניסיון מקצועי.",
  "why.2t": "קבוצה קטנה או אחד על אחד", "why.2p": "עד חמישה תלמידים בקבוצה, או מסלול אישי שבו כל תשומת הלב ממוקדת בך.",
  "why.3t": "הדגמות ותרגול מעשי", "why.3p": "הדגמות של המדריך, רישום במחברת, שיעורי בית ועבודה מעשית בהדרכה צמודה.",
  "why.4t": "תעודת סיום", "why.4p": "במפגש השישי, אחרי שלוש שעות של עבודה מעשית, מקבלים תעודת סיום מטעם CASTEL STUDIO ACADEMY.",
  "who.msg": "כל מקצוען התחיל פעם <em>מאפס.</em>", "who.sub": "לא צריך ניסיון קודם. צריך רצון להתחיל.",
  "who.1": "למי שאין לו ניסיון קודם בספרות", "who.5": "למי שמעדיף ללמוד בקבוצה קטנה או באופן אישי",
  "stm.q": "לא משנה מאיפה אתה מתחיל. <em>משנה לאן אתה רוצה להגיע.</em>",
  "pg.title": "שני מסלולים. מטרה אחת.", "pg.intro": "אותה תוכנית לימודים, אותן 13 שעות הכשרה. ההבדל הוא במסגרת הלימוד ובתשומת הלב האישית.",
  "pg.note": "בשני המסלולים לומדים בדיוק את אותה תוכנית לימודים, באותו מספר מפגשים ובאותו היקף שעות. המסלול האישי יקר ב־₪1,000 כי הלימוד בו הוא אחד על אחד.",
  "pg.group": "מסלול קבוצתי", "pg.vip": "מסלול אישי VIP",
  "pg.gTag": "עד 5 תלמידים בקבוצה", "pg.vTag": "הזמן שלך. הקצב שלך. ההתקדמות שלך.",
  "pg.gDesc": "קורס ספרות גברים למתחילים בקבוצה קטנה של עד חמישה תלמידים, עם הדרכה מקצועית, תרגול וליווי לאורך הדרך.",
  "pg.vDesc": "מסלול לימוד אישי אחד על אחד, שבו כל תשומת הלב ממוקדת בך. הדרכה אישית, משוב מדויק ותרגול שמותאם להתקדמות שלך.",
  "pg.common": ["6 מפגשים, פעמיים בשבוע", "מפגשים 1–5: שעתיים · מפגש 6: שלוש שעות", "13 שעות הכשרה, כ־3 שבועות", "מתאים למתחילים מאפס", "תעודת סיום בסוף הקורס"],
  "pg.gOnly": ["עד 5 תלמידים בקבוצה"],
  "pg.vOnly": ["תלמיד אחד ומדריך אחד", "הסברים ומשוב אישיים", "תיקונים ממוקדים", "לימוד שמותאם לקצב ההתקדמות שלך", "אותה תוכנית לימודים כמו במסלול הקבוצתי"],
  "pg.badge": "אחד על אחד", "pg.per": "למסלול המלא",
  "pg.gList": ["עד 5 תלמידים בקבוצה", "הדרכה מקצועית ותרגול", "ליווי לאורך הדרך"],
  "pg.vList": ["תלמיד אחד ומדריך אחד", "הסברים ומשוב אישיים", "תיקונים ממוקדים ולימוד בקצב שלך"],
  "pg.both": "בשני המסלולים",
  "cmp.title": "השוואה מהירה", "cmp.col": "", "cmp.rows": [
    ["מסגרת הלימוד", "עד 5 תלמידים בקבוצה", "אחד על אחד"],
    ["תשומת לב", "הדרכה וליווי בקבוצה קטנה", "משוב אישי, תיקונים ממוקדים וליווי צמוד"],
    ["תוכנית הלימודים", "6 מפגשים · 13 שעות", "זהה: 6 מפגשים · 13 שעות"],
    ["תעודת סיום", "כן", "כן"],
    ["מחיר", "₪5,500", "₪6,500"]
  ],
  "cta.register": "אני רוצה להירשם", "cta.regGroup": "להרשמה למסלול הקבוצתי", "cta.regVip": "להרשמה למסלול VIP",
  "cta.ask": "שאלה? כתבו לנו בוואטסאפ", "cta.start": "מתחילים את הדרך",
  "cta.choose": "לבחירת מסלול הלימוד", "cta.group": "אני רוצה להצטרף לקבוצה", "cta.vip": "אני רוצה מסלול אישי",
  "cu.title": "תוכנית הלימודים", "cu.intro": "שישה מפגשים, פעמיים בשבוע. תוכנית זהה בשני המסלולים.",
  "cu.h2": "שעתיים", "cu.h3": "שלוש שעות", "cu.session": "מפגש",
  "vid.line": "היום אתה לומד. מחר אתה יוצר.",
  "shop.intro": "לצד האקדמיה, CASTEL STUDIO היא מספרת גברים פעילה. העבודות האלה הן הסטנדרט שלומדים בקורס.",
  "port.intro": "העבודות האמיתיות מהכיסא מראות את הסטנדרט שלומדים בקורס.",
  "faq.intro": "לא מצאתם תשובה? כתבו לנו בוואטסאפ ונענה על כל שאלה.",
  "faq": [
    ["האם צריך ניסיון קודם?", "לא. הקורס מיועד למתחילים מאפס."],
    ["כמה מסלולים קיימים?", "שני מסלולים: <b>קבוצתי</b> ו<b>אישי VIP</b>."],
    ["כמה תלמידים יש במסלול הקבוצתי?", "עד <b>חמישה תלמידים</b>."],
    ["מה ההבדל בין המסלולים?", "במסלול האישי הלימוד הוא אחד על אחד, עם הדרכה ומשוב אישיים. תוכנית הלימודים והיקף השעות זהים."],
    ["כמה מפגשים יש בקורס?", "<b>שישה מפגשים.</b>"],
    ["כמה זמן נמשך כל מפגש?", "חמשת המפגשים הראשונים נמשכים <b>שעתיים</b> כל אחד, והמפגש האחרון נמשך <b>שלוש שעות</b>."],
    ["כמה שעות לימוד יש בסך הכול?", "<b>13 שעות.</b>"],
    ["כמה פעמים בשבוע לומדים?", "<b>פעמיים בשבוע.</b>"],
    ["כמה זמן נמשך הקורס?", "כ<b>שלושה שבועות</b>, בהתאם לקיום המפגשים כסדרם."],
    ["כמה עולה הקורס הקבוצתי?", "<b>₪5,500.</b>"],
    ["כמה עולה המסלול האישי?", "<b>₪6,500.</b>"],
    ["האם מקבלים תעודה?", "כן, <b>תעודת סיום</b> במסגרת המפגש השישי."],
    ["יש לי שאלה אחרת", "נשמח לענות. <a href=\"{WA}\">כתבו לנו בוואטסאפ</a>."]
  ],
  title: { home: "CASTEL STUDIO ACADEMY · קורס ספרות גברים למתחילים באשקלון", academy: "קורס ספרות גברים למתחילים · מסלול קבוצתי ואישי VIP · CASTEL STUDIO ACADEMY" }
});
Object.assign(I18N.en, {
  "h.s1": "6 sessions", "h.s2": "13 hours", "h.s3": "3 weeks", "h.s4": "2 programs",
  "h.support": "A men's barbering course for beginners by CASTEL STUDIO ACADEMY. Two learning programs, six sessions, 13 training hours, no previous experience needed.",
  "ai.h": "From zero to the craft. Your way.", "ai.sub": "Two programs. One goal. Your path into the profession.",
  "ai.h2": "Not just learning to cut hair. Learning the art of barbering.",
  "ac.h1a": "From zero to the craft.", "ac.h1b": "Your way.",
  "ac.desc": "A men's barbering course for beginners by CASTEL STUDIO ACADEMY: six sessions, twice a week, 13 training hours and a certificate of completion. Learn in a small group of up to five students, or privately one-on-one.",
  "ac.intro2": "The course is built for people starting from zero: instructor demonstrations, explanations, hands-on practice and homework, up to a three-hour practical final session where you receive your certificate.",
  "ac.page": "Explore the academy",
  "st.hours": "Training hours", "st.perweek": "Sessions per week",
  "why.1t": "Learn from a working barber", "why.1p": "The course is taught by the CASTEL STUDIO barber, with around four years of professional experience.",
  "why.2t": "Small group or one-on-one", "why.2p": "Up to five students per group, or a private program where all the attention is on you.",
  "why.3t": "Demonstrations & practice", "why.3p": "Instructor demonstrations, written notes, homework and hands-on work with close guidance.",
  "why.4t": "Certificate of completion", "why.4p": "In the sixth session, after three hours of practical work, you receive a certificate of completion from CASTEL STUDIO ACADEMY.",
  "who.msg": "Every professional once started <em>from zero.</em>", "who.sub": "No experience needed. Just the will to start.",
  "who.1": "People with no previous barbering experience", "who.5": "Those who prefer a small group or private instruction",
  "stm.q": "It doesn't matter where you start. <em>It matters where you want to go.</em>",
  "pg.title": "Two programs. One goal.", "pg.intro": "The same curriculum, the same 13 training hours. The difference is the format and the personal attention.",
  "pg.note": "Both programs follow exactly the same curriculum, with the same number of sessions and the same hours. The private program costs ₪1,000 more because it is taught one-on-one.",
  "pg.group": "Group Academy", "pg.vip": "Private VIP Academy",
  "pg.gTag": "Up to 5 students per group", "pg.vTag": "Your time. Your pace. Your progress.",
  "pg.gDesc": "A men's barbering course for beginners in a small group of up to five students, with professional instruction, practice and guidance along the way.",
  "pg.vDesc": "A private one-on-one program where all the attention is on you. Personal instruction, precise feedback and practice adapted to your progress.",
  "pg.common": ["6 sessions, twice a week", "Sessions 1–5: 2 hours · Session 6: 3 hours", "13 training hours, about 3 weeks", "Designed for complete beginners", "Certificate of completion at the end"],
  "pg.gOnly": ["Up to 5 students per group"],
  "pg.vOnly": ["One student, one instructor", "Personal explanations and feedback", "Focused corrections", "Teaching adapted to your progress", "The same curriculum as the group program"],
  "pg.badge": "One-on-one", "pg.per": "full program",
  "pg.gList": ["Up to 5 students per group", "Professional instruction and practice", "Guidance along the way"],
  "pg.vList": ["One student, one instructor", "Personal explanations and feedback", "Focused corrections at your own pace"],
  "pg.both": "Included in both programs",
  "cmp.title": "Quick comparison", "cmp.col": "", "cmp.rows": [
    ["Format", "Up to 5 students per group", "One-on-one"],
    ["Attention", "Instruction and guidance in a small group", "Personal feedback, focused corrections, close guidance"],
    ["Curriculum", "6 sessions · 13 hours", "Identical: 6 sessions · 13 hours"],
    ["Certificate", "Yes", "Yes"],
    ["Price", "₪5,500", "₪6,500"]
  ],
  "cta.register": "I want to register", "cta.regGroup": "Register for the group program", "cta.regVip": "Register for the VIP program",
  "cta.ask": "Questions? Message us on WhatsApp", "cta.start": "Start my journey",
  "cta.choose": "Choose your program", "cta.group": "I want to join a group", "cta.vip": "I want the private program",
  "cu.title": "The curriculum", "cu.intro": "Six sessions, twice a week. The same in both programs.",
  "cu.h2": "2 hours", "cu.h3": "3 hours", "cu.session": "Session",
  "vid.line": "Today you learn. Tomorrow you create.",
  "shop.intro": "Alongside the academy, CASTEL STUDIO is a working men's barbershop. This work is the standard taught in the course.",
  "port.intro": "Real work from the chair shows the standard you learn in the course.",
  "faq.intro": "Didn't find your answer? Message us on WhatsApp and we'll answer any question.",
  "faq": [
    ["Do I need previous experience?", "No. The course is designed for complete beginners."],
    ["How many programs are there?", "Two: <b>Group</b> and <b>Private VIP</b>."],
    ["How many students are in the group program?", "Up to <b>five students</b>."],
    ["What's the difference between the programs?", "The private program is one-on-one, with personal instruction and feedback. The curriculum and hours are identical."],
    ["How many sessions are there?", "<b>Six sessions.</b>"],
    ["How long is each session?", "The first five sessions are <b>2 hours</b> each, and the final session is <b>3 hours</b>."],
    ["How many training hours in total?", "<b>13 hours.</b>"],
    ["How often do we meet?", "<b>Twice a week.</b>"],
    ["How long does the course take?", "About <b>three weeks</b>, as long as sessions run on schedule."],
    ["How much is the group program?", "<b>₪5,500.</b>"],
    ["How much is the private program?", "<b>₪6,500.</b>"],
    ["Do I get a certificate?", "Yes, a <b>certificate of completion</b> in the sixth session."],
    ["I have another question", "We're happy to help. <a href=\"{WA}\">Message us on WhatsApp</a>."]
  ],
  title: { home: "CASTEL STUDIO ACADEMY · Men's Barbering Course for Beginners · Ashkelon", academy: "Men's Barbering Course · Group & Private VIP · CASTEL STUDIO ACADEMY" }
});

/* ---------- WhatsApp: ready-made message per button ---------- */
Object.assign(I18N.he, {
  "wa.group": "היי, מה נשמע? 👋\nאני רוצה להירשם לקורס הספרות של CASTEL STUDIO ACADEMY – *מסלול קבוצתי* (₪5,500).\nאשמח לפרטים על המחזור הקרוב ואיפה הקורס מתקיים 🙏",
  "wa.vip": "היי, מה נשמע? 👋\nאני רוצה להירשם לקורס הספרות של CASTEL STUDIO ACADEMY – *מסלול אישי VIP* (₪6,500).\nאשמח לדעת מתי אפשר להתחיל ואיפה הקורס מתקיים 🙏",
  "wa.register": "היי, מה נשמע? 👋\nאני רוצה להירשם לקורס הספרות של CASTEL STUDIO ACADEMY.\nאשמח לשמוע על המסלולים, המועדים ואיפה זה נמצא 🙏",
  "wa.ask": "היי, מה נשמע? 🙂\nיש לי שאלה לגבי קורס הספרות של CASTEL STUDIO ACADEMY:",
  "wa.general": "היי CASTEL STUDIO, מה נשמע? 🙂"
});
Object.assign(I18N.en, {
  "wa.group": "Hi! 👋\nI'd like to register for the CASTEL STUDIO ACADEMY barbering course – *Group program* (₪5,500).\nCould you tell me about the next intake and where the course takes place? 🙏",
  "wa.vip": "Hi! 👋\nI'd like to register for the CASTEL STUDIO ACADEMY barbering course – *Private VIP program* (₪6,500).\nWhen can I start, and where does the course take place? 🙏",
  "wa.register": "Hi! 👋\nI'd like to register for the CASTEL STUDIO ACADEMY barbering course.\nCould you tell me about the programs, dates and location? 🙏",
  "wa.ask": "Hi! 🙂\nI have a question about the CASTEL STUDIO ACADEMY barbering course:",
  "wa.general": "Hi CASTEL STUDIO! 🙂"
});
function waLink(kind) { return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(t("wa." + (kind || "general")))}`; }

/* ---------- basics ---------- */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const PAGE = document.body.dataset.page || "home";
const ROOT = PAGE === "academy" ? "../" : "";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let LANG = "he";
try { const s = localStorage.getItem("castel-lang"); if (s === "en" || s === "he") LANG = s; } catch (e) {}
const t = k => (I18N[LANG][k] ?? I18N.he[k] ?? k);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => n.toLocaleString("en-US");
const pad = n => String(n).padStart(2, "0");
document.documentElement.classList.add("js");

// old bookmark: /#academy → academy page
if (PAGE === "home" && location.hash === "#academy") location.replace("academy/index.html");

/* ---------- real images: show when the file exists, otherwise keep the generated art ---------- */
function slotImage(img) {
  const host = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement.parentElement : img.parentElement;
  const ok = () => host && host.classList.add("has-img");
  const fail = () => img.remove();
  if (img.complete) { img.naturalWidth ? ok() : fail(); }
  else { img.addEventListener("load", ok, { once: true }); img.addEventListener("error", fail, { once: true }); }
}

/* ---------- generated placeholder art (only painted when visible, once per width) ---------- */
function seeded(n) { let s = n * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
function paintStudio(c, seed, opts = {}) {
  if (!c || c.parentElement && c.parentElement.classList.contains("has-img")) return;
  const r = c.getBoundingClientRect(); if (!r.width || !r.height) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.5), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (c.dataset.pw === String(w)) return;
  c.dataset.pw = w; c.width = w; c.height = h;
  const x = c.getContext("2d", { alpha: false }), rnd = seeded(seed);
  x.fillStyle = "#0B0B0B"; x.fillRect(0, 0, w, h);
  const lx = w * (opts.lx ?? (.25 + rnd() * .5)), ly = h * (opts.ly ?? (.15 + rnd() * .3));
  let g = x.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * (opts.spread ?? .75));
  g.addColorStop(0, "rgba(198,164,119,.34)"); g.addColorStop(.35, "rgba(120,92,60,.14)"); g.addColorStop(1, "rgba(11,11,11,0)");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const strands = Math.round((opts.strands ?? 260) * Math.min(1, (w * h) / 1.6e6 + .35));
  x.lineCap = "round";
  const dir = rnd() * Math.PI;
  for (let i = 0; i < strands; i++) {
    const y0 = h * (.2 + rnd() * .9), x0 = w * (-.1 + rnd() * 1.2), len = (.25 + rnd() * .6) * Math.max(w, h);
    const ang = dir + (rnd() - .5) * .5, cx = x0 + Math.cos(ang) * len * .5, cy = y0 - Math.sin(ang) * len * .5 + (rnd() - .5) * h * .15;
    const ex = x0 + Math.cos(ang) * len, ey = y0 - Math.sin(ang) * len * .9;
    const a = Math.max(0, .22 - Math.hypot(cx - lx, cy - ly) / Math.max(w, h) * .25) * (.4 + rnd());
    if (a < .01) continue;
    x.strokeStyle = rnd() > .82 ? `rgba(198,164,119,${a})` : `rgba(234,226,213,${a * .7})`;
    x.lineWidth = (.4 + rnd() * 1.4) * dpr;
    x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(cx, cy, ex, ey); x.stroke();
  }
  g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .8);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.7)");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
}
const ART = new Map(); // canvas -> [seed, opts]
let artIO = null;
function registerArt(c, seed, opts) {
  if (!c) return; ART.set(c, [seed, opts || {}]);
  if (!artIO && "IntersectionObserver" in window) artIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const [s, o] = ART.get(e.target) || []; paintStudio(e.target, s, o); } }), { rootMargin: "300px 0px" });
  artIO ? artIO.observe(c) : paintStudio(c, seed, opts);
}
function scanArt(root = document) { root.querySelectorAll("canvas[data-seed]").forEach(c => { if (!ART.has(c)) registerArt(c, +c.dataset.seed); }); }
function repaintVisible() { ART.forEach(([s, o], c) => { const r = c.getBoundingClientRect(); if (r.bottom > -300 && r.top < innerHeight + 300) paintStudio(c, s, o); }); }

function media(item, seed, alt) {
  const frag = document.createDocumentFragment();
  const c = document.createElement("canvas"); c.setAttribute("aria-hidden", "true"); c.dataset.seed = seed; frag.appendChild(c);
  if (item && item.src) { const i = new Image(); i.src = ROOT + item.src; i.alt = alt || ""; i.loading = "lazy"; i.decoding = "async"; i.dataset.fallback = ""; frag.appendChild(i); }
  return frag;
}

/* ---------- rendering ---------- */
function setText() {
  const html = document.documentElement;
  html.lang = LANG; html.dir = LANG === "he" ? "rtl" : "ltr";
  $$("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
  $$("[data-i18n-html]").forEach(el => el.innerHTML = t(el.dataset.i18nHtml));
  $$("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
  $$("[data-i18n-alt]").forEach(el => el.setAttribute("alt", t(el.dataset.i18nAlt)));
  $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === LANG)));
  document.title = t("title")[PAGE];
  $$("[data-phone]").forEach(el => el.textContent = CONFIG.phone);
  $$("[data-wa]").forEach(a => a.setAttribute("href", waLink(a.dataset.wa)));
  const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();
  const nm = $("#instName"); if (nm) { const v = CONFIG.instructor[LANG] || CONFIG.instructor.he; nm.textContent = v; nm.hidden = !v; }
}

function renderMarquee() {
  const el = $("#mq"); if (!el) return;
  const words = ["Castel Studio <i>Academy</i>", "Master <i>the craft</i>", "06 Sessions · 13 Hours · <i>02 Programs</i>", "Group · <i>Private VIP</i>", "Ashkelon · <i>Academy &amp; Barbershop</i>"];
  const one = words.map(w => `<span>${w}</span>`).join("");
  el.innerHTML = one + one;
}

function renderServices() {
  const el = $("#svcList"); if (!el) return;
  el.innerHTML = CONFIG.services.map((s, i) => {
    const name = LANG === "he" ? s.he : s.en, d = LANG === "he" ? s.dhe : s.den;
    return `<article class="svc rv">
      <span class="num" aria-hidden="true">${pad(i + 1)}</span>
      <h3>${esc(name)}${LANG === "he" ? `<small lang="en">${esc(s.en)}</small>` : ""}</h3>
      <p>${esc(d || "")}</p>
      <span class="price"><sup>₪</sup>${s.price}</span>
      <a class="btn sm ghost" href="${esc(CONFIG.bookingUrl)}" data-book>${t("svc.book")}<span class="sr"> · ${esc(name)}</span></a>
    </article>`;
  }).join("");
}

/* gallery (full grid on home, short "portfolio" on academy) */
let galFilter = "all";
const LAYOUT = ["t1", "t2", "t3", "t4", "t5", "t6", "t7"];
function renderFilters() {
  const el = $("#filters"); if (!el) return;
  const used = new Set(CONFIG.gallery.map(g => g.cat));
  el.innerHTML = CONFIG.categories.filter(([k]) => k === "all" || used.has(k))
    .map(([k, label]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${k === galFilter}" lang="en">${label}</button>`).join("");
}
function renderGalleries() {
  $$("[data-gallery]").forEach(grid => {
    const limit = +grid.dataset.limit || 0, isMain = grid.id === "grid";
    const f = isMain ? galFilter : "all";
    grid.classList.toggle("filtered", isMain && f !== "all");
    let view = CONFIG.gallery.map((g, i) => ({ ...g, i })).filter(g => f === "all" || g.cat === f);
    if (limit) view = view.slice(0, limit);
    grid._view = view; grid.innerHTML = "";
    view.forEach((g, n) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tile slot " + (isMain && f === "all" ? LAYOUT[n % LAYOUT.length] : "") + (isMain && n === 0 ? " big" : "");
      b.setAttribute("aria-label", `${g.title} · ${t("aria.open")}`);
      b.appendChild(media(g, 11 + g.i * 7, (g.alt && (g.alt[LANG] || g.alt.he)) || g.title));
      b.insertAdjacentHTML("beforeend", `<span class="cap" aria-hidden="true"><b>${esc(g.title)}</b><span class="ph">${t("gal.ph")}</span></span>`);
      b.addEventListener("click", () => openLB(grid, n, b));
      grid.appendChild(b);
    });
    grid.querySelectorAll("img[data-fallback]").forEach(slotImage);
    scanArt(grid);
  });
}

function renderAcademy() {
  const A = CONFIG.academy;
  const items = [[A.sessions, "st.sessions"], [A.totalHours, "st.hours"], [A.weeks, "st.weeks"], [A.perWeek, "st.perweek"]];
  $$("[data-stats]").forEach(box => box.innerHTML = items.map(([n, k]) =>
    `<div class="stat"><b data-to="${n}">${pad(n)}</b><span>${t(k)}</span></div>`).join(""));
  const [g, v] = A.programs;
  $$("[data-pricechips]").forEach(el => el.innerHTML =
    `<a class="chip-price" href="#programs"><span lang="en">Group</span><b>₪${fmt(g.price)}</b></a><a class="chip-price vip" href="#programs"><span lang="en">Private VIP</span><b>₪${fmt(v.price)}</b></a>`);
  const waG = esc(waLink("group")), waV = esc(waLink("vip"));
  const li = arr => arr.map(x => `<li>${esc(x)}</li>`).join("");
  const card = (vip, p, key) => `
    <article class="prog rv${vip ? " vip" : ""}" aria-labelledby="pg${key}">
      ${vip ? `<span class="prog-badge">${t("pg.badge")}</span>` : ""}
      <span class="label en">${vip ? "Private VIP Academy" : "Group Academy"}</span>
      <h3 id="pg${key}">${t(vip ? "pg.vip" : "pg.group")}</h3>
      <p class="prog-tag">${t(vip ? "pg.vTag" : "pg.gTag")}</p>
      <p class="prog-price"><span class="sr">₪${fmt(p.price)}</span><span class="pp" aria-hidden="true"><sup>₪</sup><span class="pp-num" data-to="${p.price}" data-id="${key}">${fmt(p.price)}</span></span><small>${t("pg.per")}</small></p>
      <p class="prog-desc">${t(vip ? "pg.vDesc" : "pg.gDesc")}</p>
      <ul class="prog-list">${li(t(vip ? "pg.vList" : "pg.gList"))}</ul>
      <a class="btn${vip ? "" : " ghost"}" href="${vip ? waV : waG}" data-wa="${vip ? "vip" : "group"}">${t(vip ? "cta.regVip" : "cta.regGroup")}</a>
    </article>`;
  $$("[data-programs]").forEach(el => el.innerHTML = card(false, g, "G") + card(true, v, "V") +
    `<div class="prog-both rv"><span class="label en">Both Programs</span><h3>${t("pg.both")}</h3><ul>${li(t("pg.common"))}</ul></div>`);
  $$("[data-compare]").forEach(el => el.innerHTML = `
    <table class="cmp">
      <caption>${t("cmp.title")}</caption>
      <thead><tr><td></td><th scope="col">${t("pg.group")}</th><th scope="col" class="v">${t("pg.vip")}</th></tr></thead>
      <tbody>${t("cmp.rows").map(r => `<tr><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td class="v">${esc(r[2])}</td></tr>`).join("")}</tbody>
    </table>`);
}

const GRAD = '<svg class="grad" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/></svg>';
function renderCurriculum() {
  const html = CONFIG.academy.curriculum.map((c, i) => {
    const [title, desc] = c[LANG] || c.he;
    return `<li class="cur${c.final ? " final" : ""}" tabindex="0">
      <div class="cur-top"><span class="cur-n" lang="en">${pad(i + 1)}</span>${c.final ? GRAD : ""}<span class="cur-tag" lang="en">${esc(c.tag)}</span></div>
      <h3><span class="sr">${t("cu.session")} ${i + 1}: </span>${esc(title)}</h3>
      <span class="cur-dur">${t(c.hours === 3 ? "cu.h3" : "cu.h2")}</span>
      <p>${esc(desc)}</p>
    </li>`;
  }).join("");
  $$("[data-curriculum]").forEach(el => el.innerHTML = html);
}

/* optional academy video: plays only if the file exists, never with sound, never with reduced motion */
function setupVideo() {
  const slot = $(".hero-video-slot"); if (!slot || reduced) return;
  const save = navigator.connection && navigator.connection.saveData; if (save) return;
  const v = document.createElement("video");
  v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = "metadata";
  v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
  v.className = "hero-video"; v.poster = slot.dataset.poster || "";
  v.addEventListener("error", () => v.remove(), { once: true });
  v.addEventListener("playing", () => { slot.closest(".hero").classList.add("has-video"); const l = $(".video-line"); if (l) l.hidden = false; }, { once: true });
  const src = document.createElement("source"); src.src = slot.dataset.video; src.type = "video/mp4";
  src.addEventListener("error", () => v.remove(), { once: true });
  v.appendChild(src); slot.appendChild(v);
}

function renderFAQ() {
  const el = $("#faqList"); if (!el) return;
  const open = [...el.querySelectorAll("details")].map(d => d.open);
  el.innerHTML = t("faq").map(([q, a], i) => `<details${open[i] ? " open" : ""}><summary>${esc(q)}</summary><div class="ans">${a.replace("{WA}", esc(waLink("ask")) + "\" data-wa=\"ask")}</div></details>`).join("");
}

function renderReviews() {
  const sec = $("#reviews"); if (!sec) return;
  sec.hidden = !CONFIG.reviews.length;
  if (!CONFIG.reviews.length) return;
  const star = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.6.7-4.9 4.5 1.4 6.6L12 17.2l-6 3.3 1.4-6.6-4.9-4.5 6.6-.7z"/></svg>';
  $("#rvTrack").innerHTML = CONFIG.reviews.map(r => `
    <figure class="review">
      <div class="stars" role="img" aria-label="${r.stars} / 5">${star.repeat(r.stars)}</div>
      <blockquote>${esc(LANG === "he" ? r.he : (r.en || r.he))}</blockquote>
      <figcaption><b>${esc(r.name)}</b> <span>${esc(r.source || "")}</span></figcaption>
    </figure>`).join("");
}

function renderInstagram() {
  const ig = $("#igGrid"); if (!ig) return;
  ig.innerHTML = "";
  CONFIG.instagramGallery.filter(g => g.src).forEach(g => {
    const a = document.createElement("a"); a.href = CONFIG.instagramUrl; a.className = "slot"; a.setAttribute("aria-label", "Instagram " + CONFIG.instagramHandle);
    a.appendChild(media(g, 300, "")); ig.appendChild(a);
  });
  ig.querySelectorAll("img[data-fallback]").forEach(slotImage); scanArt(ig);
}

function renderContactExtra() {
  const box = $("#ctExtra"); if (!box) return;
  const addr = CONFIG.address[LANG] || CONFIG.address.he;
  let html = "";
  if (addr) {
    const q = encodeURIComponent((CONFIG.address.he || addr) + " אשקלון");
    html += `<div class="ch"><span class="label en">Address</span><h3>${esc(addr)}</h3><div class="row"><a class="btn sm ghost" href="https://www.google.com/maps/search/?api=1&query=${q}">${t("ct.nav")}</a></div></div>`;
  }
  if (CONFIG.hours.length) html += `<div class="ch"><span class="label en">Opening Hours</span><h3>${t("ct.hours")}</h3><ul class="hours-list">${CONFIG.hours.map(h => `<li><span>${esc(h[LANG] || h.he)}</span><span>${esc(h.time)}</span></li>`).join("")}</ul></div>`;
  box.innerHTML = html;
}

function renderAll() {
  setText(); renderMarquee(); renderServices(); renderFilters(); renderGalleries(); renderAcademy(); renderCurriculum(); priceCount();
  renderFAQ(); renderReviews(); renderInstagram(); renderContactExtra();
  observeReveal(); countUp();
  if (window.__watchCTAs) window.__watchCTAs();
}

/* ---------- language ---------- */
$$(".lang button").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.lang === LANG) return;
  LANG = b.dataset.lang; try { localStorage.setItem("castel-lang", LANG); } catch (e) {}
  renderAll();
  const live = $("#live"); if (live) { live.textContent = ""; setTimeout(() => live.textContent = t("live"), 50); }
}));

/* ---------- gallery filter ---------- */
const filters = $("#filters");
if (filters) filters.addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  galFilter = b.dataset.cat;
  $$(".chip").forEach(c => c.setAttribute("aria-pressed", String(c === b)));
  renderGalleries();
});

/* ---------- focus trap helper ---------- */
function trap(container, e) {
  if (e.key !== "Tab") return;
  const f = [...container.querySelectorAll("a[href], button:not([disabled])")].filter(el => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------- lightbox ---------- */
const lb = $("#lb");
let lbView = [], lbIdx = 0, lbReturn = null;
function showLB() {
  const g = lbView[lbIdx], st = $("#lbStage"); st.innerHTML = ""; st.className = "lb-stage slot";
  st.appendChild(media(g, 11 + g.i * 7, (g.alt && (g.alt[LANG] || g.alt.he)) || g.title));
  const img = st.querySelector("img"); if (img) slotImage(img);
  $("#lbCap").innerHTML = `<span lang="en">${esc(g.title)}</span><small>${lbIdx + 1} / ${lbView.length}</small>`;
  paintStudio(st.querySelector("canvas"), 11 + g.i * 7);
  if (!g.src) $("#lbCap small").textContent += " · " + t("gal.ph");
}
function openLB(grid, n, from) {
  lbView = grid._view; lbIdx = n; lbReturn = from;
  lb.hidden = false; lb.classList.add("open"); document.body.style.overflow = "hidden";
  showLB(); $("#lbClose").focus();
}
function closeLB() { lb.classList.remove("open"); lb.hidden = true; document.body.style.overflow = ""; lbReturn && lbReturn.focus(); }
const step = d => { lbIdx = (lbIdx + d + lbView.length) % lbView.length; showLB(); };
if (lb) {
  $("#lbClose").addEventListener("click", closeLB);
  $("#lbPrev").addEventListener("click", () => step(-1));
  $("#lbNext").addEventListener("click", () => step(1));
  lb.addEventListener("click", e => { if (e.target === lb) closeLB(); });
  let tx = 0;
  lb.addEventListener("touchstart", e => tx = e.touches[0].clientX, { passive: true });
  lb.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) < 40) return;
    step((dx < 0) !== (LANG === "he") ? 1 : -1);
  });
  lb.addEventListener("keydown", e => {
    trap(lb, e);
    const rtl = LANG === "he";
    if (e.key === "ArrowRight") step(rtl ? -1 : 1);
    if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
  });
}

/* ---------- reviews carousel ---------- */
const track = $("#rvTrack");
const rvStep = d => { const card = track && track.querySelector(".review"); if (!card) return; track.scrollBy({ left: (LANG === "he" ? -d : d) * (card.offsetWidth + 20), behavior: reduced ? "auto" : "smooth" }); };
$("#rvPrev")?.addEventListener("click", () => rvStep(-1));
$("#rvNext")?.addEventListener("click", () => rvStep(1));

/* ---------- mobile menu ---------- */
const mm = $("#mmenu"), burger = $("#burger");
function toggleMenu(open) {
  document.body.classList.toggle("menu-open", open);
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", t(open ? "aria.menuClose" : "aria.menu"));
  open ? mm.removeAttribute("inert") : mm.setAttribute("inert", "");
  document.body.style.overflow = open ? "hidden" : "";
  $$(".mmenu a.ml").forEach((a, i) => a.style.transitionDelay = open ? (0.12 + i * 0.04) + "s" : "0s");
  if (open) setTimeout(() => mm.querySelector("a")?.focus(), 80); else burger.focus({ preventScroll: true });
}
burger.addEventListener("click", () => toggleMenu(!document.body.classList.contains("menu-open")));
$$(".mmenu a").forEach(a => a.addEventListener("click", () => { if (document.body.classList.contains("menu-open")) toggleMenu(false); }));
document.addEventListener("keydown", e => {
  if (document.body.classList.contains("menu-open")) {
    if (e.key === "Escape") toggleMenu(false);
    else if (e.key === "Tab") { const items = [burger, ...mm.querySelectorAll("a[href]")]; const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  }
  if (e.key === "Escape" && lb && lb.classList.contains("open")) closeLB();
});

/* ---------- reveal + count-up ---------- */
let revIO;
function observeReveal() {
  if (!("IntersectionObserver" in window) || reduced) { $$(".rv").forEach(el => el.classList.add("in")); return; }
  revIO && revIO.disconnect();
  revIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revIO.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".rv:not(.in)").forEach(el => revIO.observe(el));
}
/* price count-up: ₪0 → final, once per visit, ease-out, width locked so nothing shifts */
const priceDone = new Set();
let pIO;
function priceCount() {
  const nums = $$(".pp-num[data-to]");
  if (reduced || !("IntersectionObserver" in window)) return; // final prices already in the markup
  pIO && pIO.disconnect();
  pIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target.querySelector(".pp-num"); pIO.unobserve(e.target);
    if (!el || priceDone.has(el.dataset.id)) return;
    priceDone.add(el.dataset.id);
    const to = +el.dataset.to, t0 = performance.now(), dur = 1050;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? fmt(Math.round(to * eased / 10) * 10) : fmt(to);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: .45 });
  nums.forEach(el => {
    if (priceDone.has(el.dataset.id)) return;            // already counted: keep the final value (e.g. after a language switch)
    el.style.minWidth = el.getBoundingClientRect().width + "px"; // reserve the final width
    el.textContent = "0";
    pIO.observe(el.closest(".prog"));
  });
}

let cIO;
function countUp() {
  if (reduced || !("IntersectionObserver" in window)) return;
  cIO && cIO.disconnect();
  cIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; cIO.unobserve(e.target);
    const b = e.target, to = +b.dataset.to, cur = b.dataset.cur === "1", t0 = performance.now(), dur = 1300;
    const tick = now => { const p = Math.min(1, (now - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      b.innerHTML = cur ? "<sup>₪</sup>" + fmt(v) : pad(v); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), { threshold: .6 });
  $$(".stat b[data-to]").forEach(b => cIO.observe(b));
}

/* ---------- active link + sticky zone via IntersectionObserver (no layout reads on scroll) ---------- */
const navMap = PAGE === "home"
  ? { home: "#home", course: "#course", why: "#course", who: "#course", programs: "#course", curriculum: "#course", register: "#course", barbershop: "#barbershop", gallery: "#gallery", contact: "#contact" }
  : { curriculum: "#curriculum", contact: "#contact" };
const shopIds = new Set(["barbershop", "gallery"]);
const inView = new Set();
if ("IntersectionObserver" in window) {
  const secIO = new IntersectionObserver(es => {
    es.forEach(e => e.isIntersecting ? inView.add(e.target.id) : inView.delete(e.target.id));
    let cur = null; $$("main section[id]").forEach(s => { if (inView.has(s.id) && navMap[s.id] && !cur) cur = navMap[s.id]; });
    if (PAGE === "home") $$(".links a").forEach(a => a.classList.toggle("active", a.getAttribute("href") === cur));
    else $$(".links a").forEach(a => a.classList.toggle("active", a.getAttribute("aria-current") === "page" && !cur || a.getAttribute("href") === cur));
    const zone = [...inView].some(id => shopIds.has(id)) ? "shop" : "academy";
    if (document.body.dataset.zone !== zone) document.body.dataset.zone = zone;
  }, { rootMargin: "-40% 0px -50% 0px" });
  $$("main section[id]").forEach(s => secIO.observe(s));
}
document.body.dataset.zone = "academy";

/* ---------- sticky CTA: stays out of the way when a real CTA is already visible ---------- */
const ctaVisible = new Set();
if ("IntersectionObserver" in window) {
  const ctaIO = new IntersectionObserver(es => {
    es.forEach(e => e.isIntersecting ? ctaVisible.add(e.target) : ctaVisible.delete(e.target));
    if (typeof onScroll === "function") requestAnimationFrame(onScroll);
  }, { rootMargin: "0px 0px 0px 0px" });
  const watchCTAs = () => { ctaIO.disconnect(); ctaVisible.clear();
    $$(".hero .hero-actions, .prog, .prog-both, .prog-compare, #register .hero-actions, .ch-grid, .gal-actions, .shop-head .btn, .svc .btn, .faq-wrap .btn, .foot").forEach(el => ctaIO.observe(el)); };
  watchCTAs(); window.__watchCTAs = watchCTAs;
}

/* ---------- scroll: transforms only ---------- */
const nav = $("#nav"), prog = $("#prog"), sticky = $("#sticky");
let heroBg = null, ticking = false, docH = 0, vh = innerHeight;
const measure = () => { docH = document.documentElement.scrollHeight - innerHeight; vh = innerHeight; };
function onScroll() {
  const y = scrollY;
  nav.classList.toggle("scrolled", y > 40);
  prog.style.transform = `scaleX(${docH > 0 ? Math.min(1, y / docH) : 0})`;
  if (!reduced && heroBg && y < vh * 1.2) heroBg.style.transform = `translate3d(0, ${y * .25}px, 0)`;
  sticky.classList.toggle("show", y > vh * .65 && y < docH - 520 && !ctaVisible.size);
  ticking = false;
}
addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });

/* ---------- hero + about art ---------- */
function setupHero() {
  const hc = $("#heroCanvas");
  const academyLook = hc && hc.dataset.variant === "academy";
  registerArt(hc, academyLook ? 151 : 7, academyLook ? { lx: .35, ly: .25, spread: .95, strands: 480 } : { lx: .62, ly: .22, spread: .9, strands: 520 });
  if (hc) paintStudio(hc, ...ART.get(hc));
  registerArt($("#aboutCanvas"), 41, { lx: .3, ly: .3, strands: 300 });
  heroBg = $(".hero .hero-img") || hc;
}
let rzW = innerWidth, rz;
addEventListener("resize", () => {
  clearTimeout(rz);
  rz = setTimeout(() => { measure(); if (innerWidth !== rzW) { rzW = innerWidth; repaintVisible(); } }, 200); // ignore mobile URL-bar height changes
});

/* ---------- boot ---------- */
$$("img[data-fallback]").forEach(slotImage);
renderAll();
setupHero();
setupVideo();
scanArt();
measure(); onScroll();
addEventListener("load", () => { measure(); heroBg = $(".hero .hero-img") || $("#heroCanvas"); });
const finish = () => { document.body.classList.add("loaded"); requestAnimationFrame(() => document.body.classList.remove("intro")); };
if (reduced) finish(); else setTimeout(finish, 650);
