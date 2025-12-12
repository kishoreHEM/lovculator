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
        this.refreshNotificationBadge();
        this.refreshMessageBadge();
        this.loadDefaultContent();
    }

    rebindHeaderEvents() {
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

        const notifBtn = document.getElementById("notificationsBtn");
        if (notifBtn) {
            notifBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.notificationManager && typeof window.notificationManager.showNotifications === "function") {
                    window.notificationManager.showNotifications();
                }
            });
        }

        const msgBtn = document.getElementById("messagesBtn");
        if (msgBtn) {
            msgBtn.addEventListener("click", () => {
                window.location.href = "/messages";
            });
        }

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.href = "/login";
            });
        }
    }

    bindSidebarData() {
        if (!window.currentUser) return;
        const user = window.currentUser;

        document.querySelectorAll("#sidebarUserName")
            .forEach(el => el.textContent = user.display_name || user.username);

        document.querySelectorAll("#sidebarAvatar")
            .forEach(el => el.src = user.avatar_url || "/images/default-avatar.png");
    }

    // ✅ ROBUST MOBILE MENU LOGIC (Keep this one!)
    bindMobileMenuToggle() {
        // 1. Get Elements
        const openBtn = document.getElementById("mobileMenuBtn"); // In Header
        const closeBtn = document.getElementById("mobileMenuClose"); // In Sidebar
        
        // Support both ID (mobile-menu.html) and class selection
        const sidebar = document.getElementById("mobileSidebar") || document.querySelector(".main-sidebar");
        const overlay = document.getElementById("sidebarOverlay");

        // We need at least the open button and sidebar to proceed
        if (!openBtn || !sidebar) return;

        // 2. Open Event
        // Remove old listeners to prevent stacking if called multiple times
        const newOpenBtn = openBtn.cloneNode(true);
        openBtn.parentNode.replaceChild(newOpenBtn, openBtn);
        
        newOpenBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.add("open");
            if (overlay) overlay.classList.add("active");
        });

        // 3. Close Button Event
        if (closeBtn) {
            closeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                sidebar.classList.remove("open");
                if (overlay) overlay.classList.remove("active");
            });
        }

        // 4. Overlay Click Event
        if (overlay) {
            overlay.addEventListener("click", () => {
                sidebar.classList.remove("open");
                overlay.classList.remove("active");
            });
        }

        // 5. Click Outside (Safety fallback)
        document.addEventListener("click", (e) => {
            if (window.innerWidth <= 768 && 
                sidebar.classList.contains("open") && 
                !sidebar.contains(e.target) && 
                !newOpenBtn.contains(e.target)) {
                
                sidebar.classList.remove("open");
                if (overlay) overlay.classList.remove("active");
            }
        });
    }

    /* ======================================================
       LOAD USER DETAILS
    ====================================================== */
    async loadUserData() {
        try {
            const res = await fetch("/api/auth/me", {
                credentials: "include"
            });
            const data = await res.json();

            if (data.success && data.user) {
                window.currentUser = data.user;
                window.currentUserId = data.user.id;
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

    // ❌ DELETED THE DUPLICATE FUNCTION HERE ❌

    /* ======================================================
       🔔 BADGE REFRESH FUNCTIONS
    ====================================================== */

    async refreshNotificationBadge() {
        if (window.notificationManager) {
            window.notificationManager.updateNotificationBadge();
            return;
        }

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
        if (window.notificationManager) {
            window.notificationManager.updateMessageBadge();
            return;
        }

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
        document.querySelectorAll(".nav-item").forEach(item => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                this.handleNavigation(item.getAttribute("href"));
            });
        });

        if (window.location.pathname.includes("notifications")) {
            setTimeout(() => {
                const notifBtn = document.getElementById("notificationsBtn");
                if (notifBtn) {
                    notifBtn.style.background = "#ff4b8d22";
                    notifBtn.style.borderRadius = "6px";
                }
            }, 500);
        }
    }

    handleNavigation(path) {
        if (path === "/" || path === "/index.html") {
            this.loadHomeContent();
        } else if (path === "/love-calculator") {
            this.loadLoveCalculator();
        } else if (path === "/love-stories") {
            this.loadLoveStories();
        } else if (path === "/notifications") {
            window.location.href = "/notifications";
        } else {
            window.location.href = path;
        }
    }

    /* ======================================================
       MAIN PAGE CONTENT
    ====================================================== */
    loadDefaultContent() {
        this.loadHomeContent();
    }

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
                <button class="btn-primary" onclick="window.location.href='/love-calculator'">
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
                <button class="btn-primary" onclick="window.location.href='/love-stories'">
                    Browse Stories
                </button>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.layoutManager = new LayoutManager();
});