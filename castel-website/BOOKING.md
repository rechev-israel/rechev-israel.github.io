# CASTEL STUDIO website (Netlify)

Static site served at https://remarkable-sfogliatella-b3c7b4.netlify.app (Netlify site id f8ec0200-590a-42a6-8a9b-b4023f14c146). Deployed via the Netlify API (digest deploy; unchanged files reused).

Online booking is a native part of the site: section `#book` in index.html + `assets/booking.js` (site design, no iframe).
It calls the CASTEL STUDIO OS public API (`https://castel-studio-delta.vercel.app/api/public/booking/*`: config, slots, create, manage, cancel, ics), which allows CORS only for this site's origin and `EMBED_ALLOWED_ORIGINS`.
Every booking lands in the OS (calendar, customers, notifications). After booking the customer gets a private link on this site: `/?booking=<token>#book` (view, add to calendar, cancel).
If the site moves to a new domain, add it to `EMBED_ALLOWED_ORIGINS` in Vercel.
