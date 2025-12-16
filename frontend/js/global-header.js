// global-header.js

// Helper function to bind events (Dropdown & Padding)
function initHeaderInteractions(container) {
  // 1. Fix Body Padding for Fixed Header
  const headerEl = container.querySelector('.main-header');
  if (headerEl) {
    const adjustPadding = () => {
      document.body.style.paddingTop = headerEl.offsetHeight + 'px';
    };
    adjustPadding();
    window.addEventListener('resize', adjustPadding);
  }

  // 2. Setup Avatar Dropdown
  const userAvatar = document.getElementById("userAvatar");
  const userDropdown = document.getElementById("userDropdown");

  if (userAvatar && userDropdown) {
    // Prevent duplicate binding if function runs twice
    if (userAvatar.dataset.hasListener) return; 
    userAvatar.dataset.hasListener = "true";

    // Toggle Dropdown on Avatar Click
    userAvatar.addEventListener("click", (e) => {
      e.stopPropagation(); // Stop click from immediately closing the menu via document listener
      
      const isHidden = userDropdown.classList.contains("hidden") || getComputedStyle(userDropdown).display === "none";
      
      if (isHidden) {
        userDropdown.classList.remove("hidden");
        userDropdown.classList.add("show");
      } else {
        userDropdown.classList.add("hidden");
        userDropdown.classList.remove("show");
      }
    });

    // Close Dropdown when clicking anywhere else
    document.addEventListener("click", (e) => {
      if (userDropdown.classList.contains("show")) {
        // If the click is NOT on the avatar and NOT on the dropdown itself
        if (!userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
          userDropdown.classList.add("hidden");
          userDropdown.classList.remove("show");
        }
      }
    });
  }
}

async function loadGlobalHeader() {
  const container = document.getElementById("global-header");
  if (!container) return;

  const componentPath = "/components/header.html";

  try {
    // Attempt 1: Normal Fetch
    const res = await fetch(componentPath, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    // --- RUN INTERACTION LOGIC ---
    initHeaderInteractions(container);

    // Call external managers if they exist
    if (window.layoutManager && typeof window.layoutManager.rebindHeaderEvents === "function") {
      window.layoutManager.rebindHeaderEvents();
    }
    if (window.layoutManager) {
      window.layoutManager.refreshNotificationBadge();
      window.layoutManager.refreshMessageBadge();
    }

  } catch (err) {
    console.error("Failed to load global header, trying fallback:", err);

    // Attempt 2: Fallback Fetch (Absolute URL)
    try {
      const alt = `${location.protocol}//${location.host}/components/header.html`;
      const r2 = await fetch(alt, { cache: "no-store", credentials: "same-origin" });
      if (r2.ok) {
        const htmlFallback = await r2.text();
        container.innerHTML = htmlFallback;
        
        // --- RUN INTERACTION LOGIC (Crucial fix for fallback) ---
        initHeaderInteractions(container);

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