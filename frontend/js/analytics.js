// Global Google Analytics bootstrap (works on every page, not header-dependent)
(function initGA() {
  const id = window.GA_MEASUREMENT_ID || "G-SVKQ1ELD9W";
  if (!id) return;
  if (window.__lovculatorGtagLoaded) return;
  window.__lovculatorGtagLoaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  const existing = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${id}"]`
  );
  if (!existing) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
  }

  window.gtag("js", new Date());
  window.gtag("config", id, {
    page_path: window.location.pathname + window.location.search,
    transport_type: "beacon"
  });
})();
