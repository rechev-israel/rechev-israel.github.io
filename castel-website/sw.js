/* CASTEL STUDIO website service worker: makes the site installable as an app.
 * No fetch handler and no cache: requests go straight to the network (fastest, always up to date). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
