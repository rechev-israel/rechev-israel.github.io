# CASTEL STUDIO website (Netlify)

Static site served at https://remarkable-sfogliatella-b3c7b4.netlify.app (Netlify site id f8ec0200-590a-42a6-8a9b-b4023f14c146). Deployed via the Netlify API (digest deploy; unchanged files reused).

Online booking is embedded in the `#book` section (index.html) through the CASTEL STUDIO OS widget:

```html
<div data-castel-booking></div>
<script src="https://castel-studio-delta.vercel.app/embed.js" async></script>
```

Every "קביעת תור" button points to `/#book`. Bookings go straight into the OS (calendar, customers, notifications).
If the site moves to a new domain, add it to `EMBED_ALLOWED_ORIGINS` in Vercel so the widget may be framed there.
