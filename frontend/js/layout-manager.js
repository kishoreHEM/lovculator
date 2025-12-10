// js/layout-manager.js
class LayoutManager {
    constructor() {
        this.notificationCount = 0;
        this.messageCount = 0;

        this.init();
    }

    init() {
        this.loadUserData();
        this.attachEventListeners();

        // NEW — Refresh badges on page load
        this.refreshNotificationBadge();
        this.refreshMessageBadge();

        this.loadDefaultContent();
    }

    /* ======================================================
       LOAD USER DETAILS
    ====================================================== */
    async loadUserData() {
        try {
            const res = await fetch("/api/auth/me", { credentials: "include" });
            const data = await res.json();

            if (data.success && data.user) {
                window.currentUser = data.user;
                window.currentUserId = data.user.id;  // ⭐ FIXED ⭐
                this.updateUserInterface(data.user);
            }

        } catch (err) {
            console.error("Auth load failed:", err);
        }
    }

    updateUserInterface(user) {
        const name = user.display_name || user.username || "Guest";
        const avatar = user.avatar_url || "/images/default-avatar.png";

        document.querySelectorAll("#sidebarUserName, .user-info h4")
            .forEach(el => el.textContent = name);

        document.querySelectorAll("#userAvatar, #sidebarAvatar")
            .forEach(el => el.src = avatar);

        const creatorAvatar = document.getElementById("creatorAvatar");
        if (creatorAvatar) creatorAvatar.src = avatar;
    }

    /* ======================================================
       🔔 BADGE REFRESH FUNCTIONS
    ====================================================== */

    async refreshNotificationBadge() {
        try {
            const res = await fetch("/api/notifications/unread-count", {
                credentials: "include"
            });
            const data = await res.json();

            const badge = document.getElementById("notificationBadge");

            if (!badge) return;

            if (data.count > 0) {
                badge.innerText = data.count > 99 ? "99+" : data.count;
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }

        } catch (err) {
            console.error("Failed to refresh notification badge", err);
        }
    }

    async refreshMessageBadge() {
        try {
            const res = await fetch("/api/messages/unread-count", {
                credentials: "include"
            });
            const data = await res.json();

            const badge = document.getElementById("messagesBadge");

            if (!badge) return;

            if (data.count > 0) {
                badge.innerText = data.count > 99 ? "99+" : data.count;
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }

        } catch (err) {
            console.error("Failed to refresh message badge", err);
        }
    }

    /* ======================================================
       NAVIGATION HANDLING
    ====================================================== */
    attachEventListeners() {
        const userAvatar = document.getElementById("userAvatar");
        const userDropdown = document.getElementById("userDropdown");

        if (userAvatar && userDropdown) {
            userAvatar.addEventListener("click", (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle("hidden");
            });

            document.addEventListener("click", () => {
                userDropdown.classList.add("hidden");
            });
        }

        document.querySelectorAll(".nav-item").forEach(item => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                this.handleNavigation(item.getAttribute("href"));
            });
        });

        // Highlight notification icon when on notifications page
        if (window.location.pathname.includes("notifications")) {
            const notifBtn = document.getElementById("notificationsBtn");
            if (notifBtn) {
                notifBtn.style.background = "#ff4b8d22";
                notifBtn.style.borderRadius = "6px";
            }
        }
    }

    handleNavigation(path) {
        if (path === "/" || path === "/index.html") {
            this.loadHomeContent();
        } else if (path === "/love-calculator") {
            this.loadLoveCalculator();
        } else if (path === "/love-stories.html") {
            this.loadLoveStories();
        } else if (path === "/notifications.html") {
            window.location.href = "/notifications.html";
        }
    }

    /* ======================================================
       MAIN PAGE CONTENT
    ====================================================== */
    loadDefaultContent() { this.loadHomeContent(); }

    loadHomeContent() {
        const mainContent = document.getElementById("mainContent");
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div id="feedContainer" class="feed-container"></div>
            <div id="feedEmptyState" class="feed-empty hidden">
                <p>No posts yet 💖</p>
            </div>
        `;

        if (window.loadFeed) window.loadFeed();
    }

    loadLoveCalculator() {
        const mainContent = document.getElementById("mainContent");
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="content-section">
                <h2>💑 Love Calculator</h2>
                <p>Calculate your love compatibility!</p>
                <button class="btn-primary" onclick="window.location.href='/love-calculator.html'">
                    Go to Love Calculator
                </button>
            </div>
        `;
    }

    loadLoveStories() {
        const mainContent = document.getElementById("mainContent");
        if (!mainContent) return;

        mainContent.innerHTML = `
            <div class="content-section">
                <h2>📖 Love Stories</h2>
                <p>Beautiful stories from our community.</p>
                <button class="btn-primary" onclick="window.location.href='/love-stories.html'">
                    Browse Stories
                </button>
            </div>
        `;
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    window.layoutManager = new LayoutManager();
});
