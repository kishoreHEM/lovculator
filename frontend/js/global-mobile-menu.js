async function loadMobileMenu() {
    const container = document.getElementById("global-mobile-menu");
    if (!container) return;

    try {
        const res = await fetch("/components/mobile-menu.html", { cache: "no-store" });
        const html = await res.text();

        container.innerHTML = html;

        // Re-bind sidebar user data (name, avatar, counts, etc.)
        if (window.layoutManager && typeof window.layoutManager.bindSidebarData === "function") {
            window.layoutManager.bindSidebarData();
        }

        // Re-bind mobile drawer open/close event
        if (window.layoutManager && typeof window.layoutManager.bindMobileMenuToggle === "function") {
            window.layoutManager.bindMobileMenuToggle();
        }

    } catch (err) {
        console.error("Mobile menu load failed:", err);
    }
}

document.addEventListener("DOMContentLoaded", loadMobileMenu);
