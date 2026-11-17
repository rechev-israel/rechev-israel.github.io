/* CASTEL STUDIO booking widget.
 * Usage on any website:
 *   <div data-castel-booking></div>
 *   <script src="https://castel-studio-delta.vercel.app/embed.js" async></script>
 */
(function () {
  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : "https://castel-studio-delta.vercel.app";
  function mount(el) {
    if (el.getAttribute("data-mounted")) return;
    el.setAttribute("data-mounted", "1");
    var f = document.createElement("iframe");
    f.src = origin + "/embed/book";
    f.title = "קביעת תור — CASTEL STUDIO";
    f.loading = "lazy";
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "width:100%;min-height:520px;border:0;display:block;background:transparent;color-scheme:dark;transition:height .2s";
    el.appendChild(f);
    window.addEventListener("message", function (e) {
      if (e.origin !== origin || e.source !== f.contentWindow || !e.data) return;
      if (e.data.type === "castel-booking:height" && e.data.height > 0) f.style.height = Math.min(e.data.height + 4, 6000) + "px";
      if (e.data.type === "castel-booking:scroll") el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  function init() { var n = document.querySelectorAll("[data-castel-booking]"); for (var i = 0; i < n.length; i++) mount(n[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
