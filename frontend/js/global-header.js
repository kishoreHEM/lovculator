// global-header.js
async function loadGlobalHeader() {
  try {
    const container = document.getElementById("global-header");
    if (!container) return;

    // Use relative path so browser uses current origin + protocol
    const componentPath = "/components/header.html";

    // Try normal fetch
    const res = await fetch(componentPath, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    // Rebind header events & refresh badges after header is injected
    if (window.layoutManager && typeof window.layoutManager.rebindHeaderEvents === "function") {
      window.layoutManager.rebindHeaderEvents();
    }
    if (window.layoutManager) {
      window.layoutManager.refreshNotificationBadge();
      window.layoutManager.refreshMessageBadge();
    }

  } catch (err) {
    console.error("Failed to load global header:", err);

    // Fallback: try absolute same-origin URL (useful in some proxy setups)
    try {
      const alt = `${location.protocol}//${location.host}/components/header.html`;
      const r2 = await fetch(alt, { cache: "no-store", credentials: "same-origin" });
      if (r2.ok) {
        document.getElementById("global-header").innerHTML = await r2.text();
        if (window.layoutManager?.rebindHeaderEvents) window.layoutManager.rebindHeaderEvents();
      } else {
        console.warn("Fallback fetch failed:", r2.status);
      }
    } catch (e2) {
      console.error("Fallback fetch also failed:", e2);
    }
  }
}

document.addEventListener("DOMContentLoaded", loadGlobalHeader);
