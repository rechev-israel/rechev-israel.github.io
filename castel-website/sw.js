/* CASTEL STUDIO website service worker: makes the site installable as an app.
 * It deliberately caches nothing, so customers always see the latest prices, times and bookings. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => { /* network as usual */ });
