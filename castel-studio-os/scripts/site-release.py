#!/usr/bin/env python3
"""Release the CASTEL STUDIO website (add --draft for a private preview that does not touch the live site) (castel-website/) to Netlify.

1. Stamps every asset reference with a content hash (?v=…) so phones never run stale files.
2. Writes the site version into <meta name="castel-version"> and /version.json — the installed app
   (Home Screen) checks it whenever it comes back to the foreground and reloads itself when it changed.
3. Digest-deploys to Netlify: unchanged files are reused, only changed files are uploaded.
The Netlify API credential is injected by the environment's network proxy (never stored in the repo).
"""
import hashlib, json, os, re, sys, time, urllib.error, urllib.request

SITE_ID = "f8ec0200-590a-42a6-8a9b-b4023f14c146"
ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "castel-website")
PAGES = [("index.html", ""), ("academy/index.html", "../"), ("privacy/index.html", "/"), ("accessibility/index.html", "/"), ("book/index.html", "/"), ("my/index.html", "/"), ("style/index.html", "/"), ("gift/index.html", "/")]
ASSETS = ["assets/castel.css", "assets/castel.js", "assets/booking.js", "assets/account.js", "assets/book.css", "assets/book.js", "assets/review.js", "assets/my.css", "assets/my.js", "assets/style-data.js", "assets/style.js", "assets/gift.js"]
API = "https://api.netlify.com/api/v1"

def sha1(path): return hashlib.sha1(open(path, "rb").read()).hexdigest()
def api(method, url, body=None, ctype="application/json"):
    req = urllib.request.Request(API + url, data=body, method=method, headers={"Content-Type": ctype} if body is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as e:
        print("netlify", method, url, e.code, e.read()[:300].decode("utf-8", "replace"))
        raise

os.chdir(ROOT)
ah = {a: sha1(a)[:10] for a in ASSETS}
version = hashlib.sha1("".join(ah[a] for a in ASSETS).encode()).hexdigest()[:12]
for page, prefix in PAGES:
    s = open(page, encoding="utf-8").read()
    for a in ASSETS:
        s = re.sub(re.escape(prefix + a) + r"\?v=[0-9a-f]+", prefix + a + "?v=" + ah[a], s)
    if 'name="castel-version"' in s:
        s = re.sub(r'<meta name="castel-version" content="[^"]*">', f'<meta name="castel-version" content="{version}">', s)
    else:
        s = s.replace('<meta name="theme-color"', f'<meta name="castel-version" content="{version}">\n<meta name="theme-color"', 1)
    open(page, "w", encoding="utf-8").write(s)
json.dump({"v": version}, open("version.json", "w"))
print("site version", version)
if "--no-deploy" in sys.argv: sys.exit(0)

site = api("GET", f"/sites/{SITE_ID}")
live = {f["id"]: f["sha"] for f in api("GET", f"/deploys/{site['published_deploy']['id']}/files?per_page=1000")}
local = {}
for dirpath, _, files in os.walk("."):
    for fn in files:
        p = os.path.join(dirpath, fn)[2:]
        if p.startswith(".") or p.endswith(".md") or "/." in p: continue
        local["/" + p] = sha1(p)
files = dict(live)
files.update(local)  # local files win; files that exist only on Netlify (e.g. _headers) are kept
draft = "--draft" in sys.argv  # a private preview URL; the live site is not changed
dep = api("POST", f"/sites/{SITE_ID}/deploys", json.dumps({"files": files, "draft": draft}).encode())
need = set(dep.get("required", []))
for path, h in local.items():
    if h in need:
        api("PUT", f"/deploys/{dep['id']}/files{path}", open(path[1:], "rb").read(), "application/octet-stream")
        print("uploaded", path)
for _ in range(40):
    st = api("GET", f"/deploys/{dep['id']}")["state"]
    if st in ("ready", "error"): break
    time.sleep(3)
print("deploy", st)
if draft: print("preview", api("GET", f"/deploys/{dep['id']}")["deploy_ssl_url"])
