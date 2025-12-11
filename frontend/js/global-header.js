async function loadGlobalHeader() {
    try {
        const container = document.getElementById("global-header");
        if (!container) return;

        const res = await fetch("/components/header.html", { cache: "no-store" });
        const html = await res.text();

        container.innerHTML = html;

        // ⭐ VERY IMPORTANT ⭐
        // Now that header exists, reattach event listeners
        if (window.layoutManager && typeof window.layoutManager.rebindHeaderEvents === "function") {
            window.layoutManager.rebindHeaderEvents();
        }

        // After loading header.html
if (window.layoutManager && window.layoutManager.bindMobileMenuToggle) {
    window.layoutManager.bindMobileMenuToggle();
}


        // Refresh badges AFTER header is ready
        if (window.layoutManager) {
            window.layoutManager.refreshNotificationBadge();
            window.layoutManager.refreshMessageBadge();
        }

    } catch (err) {
        console.error("Failed to load global header:", err);
    }
}

document.addEventListener("DOMContentLoaded", loadGlobalHeader);
