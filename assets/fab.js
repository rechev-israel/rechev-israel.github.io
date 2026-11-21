/* Phone: the call / WhatsApp bar waits until the visitor has scrolled past the first screen,
   so it never covers the budget chips or the spec table at the top of a page. Desktop is unaffected (CSS). */
(function () {
  var root = document.documentElement, queued = false;
  function sync() {
    queued = false;
    root.classList.toggle('fab-on', window.scrollY > window.innerHeight * 0.5);
  }
  function ask() {
    if (!queued) { queued = true; requestAnimationFrame(sync); }
  }
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', ask);
  sync();
})();
