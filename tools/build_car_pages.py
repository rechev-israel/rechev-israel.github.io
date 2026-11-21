#!/usr/bin/env python3
"""Build a static page per car (car/<id>/index.html) and the sitemap from cars.json.

Static pages let Google index every car and give WhatsApp/Facebook link previews
with the car's own photo. Run from the repo root: python3 tools/build_car_pages.py
"""
import html, json, os, re, shutil
from urllib.parse import quote

SITE = 'https://rechev-israel.github.io'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'car')

e = lambda s: html.escape(str(s if s is not None else ''), quote=True)
money = lambda n: '₪' + f'{round(n or 0):,}'
km_fmt = lambda n: f'{n:,} ק"מ'
name = lambda c: f"{c.get('make', '')} {c.get('model', '')}".strip()


def wa_num(p):
    d = re.sub(r'\D', '', str(p or ''))
    return '972' + d[1:] if d.startswith('0') else d


def phone_fmt(p):
    d = re.sub(r'\D', '', str(p or ''))
    return f'{d[:3]}-{d[3:6]}-{d[6:]}' if len(d) == 10 else d


def abs_url(path):
    return f"{SITE}/{quote(path.lstrip('/'))}"


def title_of(c):
    bits = [name(c), str(c['year']) if c.get('year') else '', f"יד {c['hand']}" if c.get('hand') else '']
    return ' '.join(b for b in bits if b)


def similar(c, cars):
    others = [x for x in cars if x['id'] != c['id']]
    others.sort(key=lambda x: (x.get('make') != c.get('make'), abs((x.get('price') or 0) - (c.get('price') or 0))))
    return others[:4]


def analytics_snippet():
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    m = re.search(r'<script>\s*!function\(t,e\)\{var o,n,p,r;e\.__SV.*?</script>', src, re.S)
    return m.group(0) if m else ''


# Styling lives in assets/site.css, shared with the home page.

MARK_SVG = ('<svg class="mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect width="48" height="48" rx="9" fill="#050505"/>'
            '<rect x=".75" y=".75" width="46.5" height="46.5" rx="8.25" fill="none" stroke="#e10613" stroke-width="1.5"/>'
            '<path d="M34 8h6l-6 32h-6z" fill="#e10613"/>'
            '<text direction="ltr" x="7" y="31" font-family="Assistant,Arial,sans-serif" font-weight="800" font-size="18" fill="#ffffff">RI</text></svg>')

# icon for each spec row on the car sheet and car pages (see assets/site.css)
SPEC_ICONS = {'שנתון': 'cal', 'קילומטראז\'': 'gauge', 'יד': 'person', 'תיבת הילוכים': 'gear', 'צבע': 'drop', 'אזור': 'pin',
              'תאונות': 'shield', 'היסטוריית טיפולים': 'clip', 'צמיגים': 'tire', 'מפתחות': 'key', 'טסט בתוקף עד': 'check'}

WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z"/></svg>'


def json_ld(c, biz, url):
    car = {
        '@context': 'https://schema.org', '@type': 'Car', 'name': title_of(c), 'url': url,
        'brand': {'@type': 'Brand', 'name': c.get('make', '')}, 'model': c.get('model', ''),
        'image': [abs_url(p) for p in c.get('photos', [])] or [f'{SITE}/assets/og.png'],
        'itemCondition': 'https://schema.org/UsedCondition',
        'offers': {'@type': 'Offer', 'price': c.get('price'), 'priceCurrency': 'ILS', 'url': url,
                   'availability': 'https://schema.org/InStock',
                   'seller': {'@type': 'AutoDealer', 'name': biz['name'], 'telephone': biz['phone'], 'url': SITE + '/'}},
    }
    if c.get('year'): car['modelDate'] = str(c['year']); car['vehicleModelDate'] = str(c['year'])
    if c.get('km') is not None: car['mileageFromOdometer'] = {'@type': 'QuantitativeValue', 'value': c['km'], 'unitCode': 'KMT'}
    if c.get('gear'): car['vehicleTransmission'] = c['gear']
    if c.get('color'): car['color'] = c['color']
    if c.get('hand'): car['numberOfPreviousOwners'] = max(0, int(c['hand']) - 1)
    crumbs = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': 1, 'name': biz['name'], 'item': SITE + '/'},
        {'@type': 'ListItem', 'position': 2, 'name': title_of(c), 'item': url}]}
    dump = lambda o: json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
    return f'<script type="application/ld+json">{dump(car)}</script>\n<script type="application/ld+json">{dump(crumbs)}</script>'


def page(c, cars, biz, analytics, sold=False):
    url = f"{SITE}/car/{c['id']}/"
    photos = c.get('photos') or ([c['photo']] if c.get('photo') else [])
    t = title_of(c)
    price = c.get('price')
    desc_bits = [t, km_fmt(c['km']) if c.get('km') is not None else '', c.get('gear', ''), c.get('color', ''), c.get('region', '')]
    desc = ' · '.join(b for b in desc_bits if b)
    if sold:
        head_title = f'{t} – נמכר | {biz["name"]}'
        meta_desc = f'{t} נמכר. ראו את כל הרכבים הזמינים ברכב ישראל.'
    else:
        head_title = f'{t} · {money(price)} | {biz["name"]}'
        meta_desc = f'{desc}. מחיר {money(price)}. תמונות אמיתיות מהמגרש, פנייה מהירה בוואטסאפ {phone_fmt(biz["phone"])}.'
    og_img = abs_url(photos[0]) if photos else f'{SITE}/assets/og.png'
    msg = f'שלום, ראיתי באתר את ה{name(c)}{" " + str(c["year"]) if c.get("year") else ""} במחיר {money(price)}. אשמח לפרטים ולתאם נסיעת מבחן.\n{url}'
    wa = f'https://wa.me/{wa_num(biz["phone"])}?text={quote(msg)}'
    wa_plain = f'https://wa.me/{wa_num(biz["phone"])}'
    test = '/'.join(reversed(c['testUntil'].split('-'))) if c.get('testUntil') else ''
    rows = [('שנתון', c.get('year')), ('קילומטראז\'', km_fmt(c['km']) if c.get('km') is not None else ''), ('יד', c.get('hand')),
            ('תיבת הילוכים', c.get('gear')), ('צבע', c.get('color')), ('אזור', c.get('region')), ('תאונות', c.get('accidents')),
            ('היסטוריית טיפולים', c.get('service')), ('צמיגים', c.get('tires')), ('מפתחות', c.get('keys')), ('טסט בתוקף עד', test)]
    tbl = ''.join(f'<div class="ic-{SPEC_ICONS[k]}"><span>{e(k)}</span><b>{e(v)}</b></div>' for k, v in rows if v)
    if photos:
        gal = (f'<div class="gal"><div class="slides" id="slides">'
               + ''.join(f'<img src="/{e(p)}" alt="{e(t)}, תמונה {i + 1}" {"" if i == 0 else "loading=\"lazy\""} decoding="async">' for i, p in enumerate(photos))
               + '</div>' + (f'<span class="cnt" id="cnt">1 / {len(photos)}</span>' if len(photos) > 1 else '') + '</div>')
        if len(photos) > 1:
            gal += '<div class="thumbs" id="thumbs">' + ''.join(
                f'<button type="button" data-i="{i}" aria-label="תמונה {i + 1}" aria-current="{str(i == 0).lower()}"><img src="/{e(p)}" alt="" loading="lazy"></button>'
                for i, p in enumerate(photos)) + '</div>'
    else:
        gal = '<div class="gal"><div class="ph"><div class="nophoto"><img src="/assets/mark.svg" alt=""><span>בקרוב יעלו תמונות</span></div></div></div>'
    sim = similar(c, cars)
    sim_html = ''
    if sim:
        sim_html = '<h2>רכבים נוספים במלאי</h2><div class="sim">' + ''.join(
            f'<a href="/car/{e(s["id"])}/">' + (f'<img src="/{e(s["photos"][0])}" alt="{e(title_of(s))}" loading="lazy">' if s.get('photos') else '')
            + f'<div><b>{e(name(s))} {e(s.get("year", ""))}</b><span>{money(s.get("price"))}</span></div></a>' for s in sim) + '</div>'
    if sold:
        body = (f'<div class="sold">הרכב הזה כבר נמכר. <a href="/">לכל הרכבים הזמינים במלאי</a></div>')
    else:
        price_html = (f'<div class="pricebox"><div>' + (f'<div class="was">{money(c["prevPrice"])}</div>' if c.get('prevPrice') else '')
                      + f'<div class="price">{money(price)}</div></div><div>'
                      + (f'<span class="tag drop">ירד ב-{money(c["prevPrice"] - price)}</span> ' if c.get('prevPrice') else '')
                      + ('<span class="tag">✓ אפשר מימון</span>' if c.get('financing') else '') + '</div></div>')
        body = (price_html + (f'<div class="tbl">{tbl}</div>' if tbl else '')
                + ('' if c.get('financing') else '<div class="onepay">רכב זה נמכר בתשלום אחד בלבד</div>')
                + f'<div class="cta"><a class="btn wa" href="{e(wa)}" target="_blank" rel="noopener" data-track="car_page_whatsapp">{WA_SVG}אני מעוניין, שלחו פרטים</a>'
                + f'<a class="btn ghost" href="tel:{e(biz["phone"])}" data-track="car_page_call">📞 התקשרו</a>'
                + '<button class="btn ghost" type="button" id="share">שיתוף הרכב</button></div>'
                + '<div class="note" id="note">המחיר והזמינות נכונים לעדכון האחרון של המלאי.</div>')
    robots = '<meta name="robots" content="noindex,follow">' if sold else ''
    ld = '' if sold else json_ld(c, biz, url)
    return f'''<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(head_title)}</title>
<meta name="description" content="{e(meta_desc)}">
{robots}
<link rel="canonical" href="{url}">
<meta property="og:type" content="product">
<meta property="og:locale" content="he_IL">
<meta property="og:site_name" content="{e(biz["name"])}">
<meta property="og:title" content="{e(head_title)}">
<meta property="og:description" content="{e(meta_desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{e(og_img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#050505">
<script>try{{if(localStorage.getItem("rv_theme")==="light")document.documentElement.setAttribute("data-theme","light")}}catch(e){{}}</script>
<script src="/assets/fab.js" defer></script>
<link rel="icon" href="/assets/mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap">
<link rel="stylesheet" href="/assets/site.css">
{ld}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/">{MARK_SVG}<span class="lock"><span class="wm">RECHEV<i>-ISRAEL</i></span><b>{e(biz["name"])}</b></span></a>
  <a class="btn ghost" href="/">לכל המלאי</a>
</div></header>
<main class="wrap">
  <nav class="crumbs" aria-label="מיקום בעמוד"><a href="/">{e(biz["name"])}</a> › {e(t)}</nav>
  <div class="cols">
    <div>{gal}</div>
    <div>
      <h1>{e(name(c))}</h1>
      <div class="sub">{e(' · '.join(str(b) for b in [c.get('year'), c.get('region')] if b))}</div>
      {body}
    </div>
  </div>
  {sim_html}
</main>
<footer class="wrap">{e(biz["name"])} · <a href="tel:{e(biz["phone"])}">{e(phone_fmt(biz["phone"]))}</a> · <a href="/">כל המלאי</a> · <a href="/privacy.html">מדיניות פרטיות</a> · <a href="/accessibility.html">הצהרת נגישות</a></footer>
<a class="fab call" href="tel:{e(biz["phone"])}" aria-label="התקשרו אלינו" data-track="car_page_call"><svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true"><path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.6a1 1 0 0 1-.25 1z"/></svg><span class="fab-l">התקשרו</span></a>
<a class="fab" href="{e(wa if not sold else wa_plain)}" target="_blank" rel="noopener" aria-label="שלחו לנו הודעה בוואטסאפ" data-track="car_page_whatsapp">{WA_SVG}<span class="fab-l">וואטסאפ</span></a>
{analytics}
<script>
(function(){{
  var ID = {json.dumps(c["id"])}, SOLD = {str(sold).lower()};
  var track = function(ev, p){{ try{{ window.posthog && posthog.capture && posthog.capture(ev, Object.assign({{car_id: ID}}, p || {{}})); }}catch(e){{}} }};
  track('car_page_view');
  document.querySelectorAll('[data-track]').forEach(function(a){{ a.addEventListener('click', function(){{ track(a.dataset.track); }}); }});
  var sl = document.getElementById('slides'), th = document.getElementById('thumbs'), cnt = document.getElementById('cnt');
  if(sl && th){{
    var btns = th.querySelectorAll('button');
    sl.addEventListener('scroll', function(){{ var i = Math.round(Math.abs(sl.scrollLeft) / sl.clientWidth); btns.forEach(function(b,k){{ b.setAttribute('aria-current', String(k === i)); }}); if(cnt) cnt.textContent = (i + 1) + ' / ' + btns.length; }}, {{passive:true}});
    th.addEventListener('click', function(ev){{ var b = ev.target.closest('button'); if(!b) return; var i = Number(b.dataset.i); sl.scrollTo({{left: (getComputedStyle(sl).direction === 'rtl' ? -1 : 1) * i * sl.clientWidth, behavior: 'smooth'}}); }});
  }}
  var sh = document.getElementById('share');
  if(sh) sh.addEventListener('click', async function(){{
    track('car_share'); var url = location.origin + location.pathname, text = document.title;
    if(navigator.share){{ try{{ await navigator.share({{title: text, text: text, url: url}}); return; }}catch(e){{ if(e && e.name === 'AbortError') return; }} }}
    window.open('https://wa.me/?text=' + encodeURIComponent(text + '\\n' + url), '_blank', 'noopener');
  }});
  // The page is a snapshot; check the live inventory so a sold car never looks available.
  if(!SOLD) fetch('/cars.json', {{cache: 'no-store'}}).then(function(r){{ return r.json(); }}).then(function(d){{
    var live = (d.cars || []).find(function(x){{ return x.id === ID; }});
    if(!live){{ var n = document.getElementById('note'); var box = document.querySelector('.pricebox'); var s = document.createElement('div'); s.className = 'sold'; s.innerHTML = 'הרכב הזה כבר נמכר. <a href="/">לכל הרכבים הזמינים במלאי</a>'; if(box) box.replaceWith(s); var cta = document.querySelector('.cta'); if(cta) cta.remove(); if(n) n.remove(); return; }}
    if(live.price && live.price !== {json.dumps(price)}){{ var p = document.querySelector('.pricebox .price'); if(p) p.textContent = '₪' + new Intl.NumberFormat('he-IL').format(live.price); }}
  }}).catch(function(){{}});
}})();
</script>
</body>
</html>
'''


def main():
    data = json.load(open(os.path.join(ROOT, 'cars.json'), encoding='utf-8'))
    biz = {'name': (data.get('business') or {}).get('name') or 'רכב ישראל', 'phone': '0554679136'}
    cars = [c for c in data.get('cars', []) if c.get('id')]
    sold = [s for s in data.get('sold', []) if s.get('id') and s['id'] not in {c['id'] for c in cars}]
    analytics = analytics_snippet()
    want = set()
    for c in cars:
        c.setdefault('photos', [])
    for c, is_sold in [(c, False) for c in cars] + [(s, True) for s in sold]:
        if not re.fullmatch(r'[A-Za-z0-9_-]+', c['id']):
            continue
        want.add(c['id'])
        d = os.path.join(OUT, c['id'])
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(page(c, cars, biz, analytics, sold=is_sold))
    if os.path.isdir(OUT):
        for old in os.listdir(OUT):
            if old not in want:
                shutil.rmtree(os.path.join(OUT, old), ignore_errors=True)
    lastmod = (data.get('updatedAt') or '')[:10]
    urls = [f'<url><loc>{SITE}/</loc>{f"<lastmod>{lastmod}</lastmod>" if lastmod else ""}<changefreq>daily</changefreq></url>']
    urls += [f'<url><loc>{SITE}/car/{c["id"]}/</loc>{f"<lastmod>{c["arrived"]}</lastmod>" if c.get("arrived") else ""}</url>' for c in cars if c['id'] in want]
    urls += [f'<url><loc>{SITE}/{p}</loc></url>' for p in ('privacy.html', 'accessibility.html')]
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(urls) + '</urlset>\n')
    print(f'{len(cars)} car pages, {len(sold)} sold pages')


if __name__ == '__main__':
    main()
