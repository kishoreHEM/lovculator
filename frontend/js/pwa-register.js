// Lightweight, page-independent SW registration for PWA scanners and browsers.
(function registerLovculatorSW() {
  if (!("serviceWorker" in navigator)) return;
  if (window.__lovculatorSwRegistered) return;
  window.__lovculatorSwRegistered = true;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch (err) {
      console.warn("Service worker registration skipped:", err?.message || err);
    }
  });
})();
