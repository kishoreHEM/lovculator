/**
 * frontend/js/notifications.js
 * ✅ Final Version: Supports Mobile/Desktop Split & Static Dropdown
 */

class NotificationManager {
    constructor() {
        this.notificationCount = 0;
        this.messageCount = 0;
        this.autoRefreshInterval = null;

        this.init();
    }

    async init() {
        console.log("🔔 NotificationManager initialized");

        this.updateNotificationBadge();
        this.updateMessageBadge();

        // Subscribe to WebSocket events
        this.subscribeToRealTimeEvents();

        // Fallback polling
        this.startAutoRefresh();

        // Attach to the Global Header buttons (if they exist yet)
        // We use a small timeout to ensure header.html is loaded
        setTimeout(() => this.bindHeaderEvents(), 500);
    }

    // ================================
    // 🔗 BINDING (Connects to Header)
    // ================================
    bindHeaderEvents() {
        // We hook into the clicks to Fetch Data when opened
        const triggerFetch = () => this.fetchAndRenderNotifications();

        const deskBtn = document.getElementById("deskNotifBtn");
        const mobBtn = document.getElementById("mobNotifBtn");

        if (deskBtn) deskBtn.addEventListener("click", triggerFetch);
        if (mobBtn) mobBtn.addEventListener("click", triggerFetch);
    }

    // ================================
    // 🔌 REALTIME (WebSocket)
    // ================================
    async subscribeToRealTimeEvents() {
        if (!window.wsManager) {
            setTimeout(() => this.subscribeToRealTimeEvents(), 1000);
            return;
        }

        try {
            await window.wsManager.connect();

            window.wsManager.subscribe("NEW_NOTIFICATION", (data) => {
                this.handleNewNotification(data);
            });

            window.wsManager.subscribe("NEW_MESSAGE", (data) => {
                this.handleNewMessage(data);
            });
        } catch (err) {
            console.error("❌ WS Subscribe Error:", err);
        }
    }

    // ================================
    // 🔽 DATA FETCHING & RENDERING
    // ================================
    
    // Called when user clicks the bell
    async fetchAndRenderNotifications() {
        // 1. Find the existing panel container from header.html
        const container = document.querySelector("#notificationPanel .dropdown-content");
        if (!container) return; // Header not loaded correctly

        // Show loading state
        container.innerHTML = '<div class="dropdown-empty">Loading...</div>';

        try {
            const res = await fetch("/api/notifications?filter=all&page=1&limit=10", {
                credentials: "include",
            });

            const data = res.ok ? await res.json() : { notifications: [] };
            const notifications = Array.isArray(data.notifications) ? data.notifications : [];

            this.renderList(notifications);

            // Mark visible items as read locally & on server
            const unreadIds = notifications
                .filter((n) => !n.is_read && !n.read)
                .map((n) => n.id);

            if (unreadIds.length > 0) {
                this.markListAsRead(unreadIds);
            }
        } catch (error) {
            console.error("❌ Notification load error:", error);
            container.innerHTML = '<div class="dropdown-empty">Failed to load notifications.</div>';
        }
    }

    // ✅ Render into the EXISTING #notificationPanel
    renderList(notifications) {
        const container = document.querySelector("#notificationPanel .dropdown-content");
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = '<div class="dropdown-empty">No new notifications</div>';
            return;
        }

        // Generate HTML
        const html = notifications.map((n) => {
            const formattedText = this.formatNotificationText(n);
            const timeAgo = this.formatTime(n.created_at || n.createdAt);
            const actorAvatar = n.actor?.avatar_url || n.actor_avatar_url || "/images/default-avatar.png";
            const link = n.link || n.url || "#";
            const isUnread = !n.read && !n.is_read;

            return `
                <div class="dropdown-item ${isUnread ? "unread" : ""}" onclick="window.location.href='${link}'">
                   <div style="display:flex; align-items:center; gap:10px;">
                      <img src="${actorAvatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" 
                           onerror="this.src='/images/default-avatar.png'">
                      <div style="flex:1;">
                          <div style="font-size:13px; color:#333;">${formattedText}</div>
                          <div style="font-size:11px; color:#999; margin-top:2px;">${timeAgo}</div>
                      </div>
                      ${isUnread ? '<div style="width:8px; height:8px; background:#e91e63; border-radius:50%;"></div>' : ''}
                   </div>
                </div>
            `;
        }).join("");

        container.innerHTML = html;
    }

    // ================================
    // 🔤 HELPERS
    // ================================
    formatNotificationText(notification) {
        if (notification.message) return notification.message;
        const name = notification.actor_display_name || "Someone";
        switch (notification.type) {
            case "comment": return `<strong>${name}</strong> commented on your post`;
            case "like": return `<strong>${name}</strong> liked your post`;
            case "follow": return `<strong>${name}</strong> started following you`;
            default: return `<strong>${name}</strong> sent a notification`;
        }
    }

    safeText(str) {
        if (!str) return "";
        const div = document.createElement("div");
        div.textContent = String(str);
        return div.innerHTML;
    }

    formatTime(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // seconds

        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    // ================================
    // 🔢 BADGE UPDATES (Fix for Desktop + Mobile)
    // ================================
    async updateNotificationBadge() {
        try {
            const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
            const data = res.ok ? await res.json() : {};
            this.notificationCount = data.count || 0;
            this.updateBadgesUI();
        } catch (e) { /* ignore */ }
    }

    async updateMessageBadge() {
        try {
            const res = await fetch("/api/messages/unread-count", { credentials: "include" });
            const data = res.ok ? await res.json() : {};
            this.messageCount = data.count || 0;
            this.updateBadgesUI();
        } catch (e) { /* ignore */ }
    }

    updateBadgesUI() {
        // Helper to update a specific badge element
        const setBadge = (btnId, count) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            // The badge is the <span> inside the button
            const badge = btn.querySelector(".badge"); 
            if (!badge) return;

            if (count > 0) {
                badge.textContent = count > 99 ? "99+" : String(count);
                badge.style.display = "flex"; // Show
            } else {
                badge.style.display = "none"; // Hide
            }
        };

        // Update BOTH Desktop and Mobile Badges
        setBadge("deskNotifBtn", this.notificationCount);
        setBadge("mobNotifBtn", this.notificationCount);

        setBadge("deskMsgBtn", this.messageCount);
        setBadge("mobMsgBtn", this.messageCount);
    }

    // ================================
    // ✅ MARK AS READ
    // ================================
    async markListAsRead(ids) {
        if (!ids || ids.length === 0) return;
        
        // Optimistic UI Update
        this.notificationCount = Math.max(0, this.notificationCount - ids.length);
        this.updateBadgesUI();

        ids.forEach((id) => {
            fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" })
            .catch(e => console.error("Read mark failed", e));
        });
    }

    // ================================
    // 🔔 EVENT HANDLERS
    // ================================
    handleNewNotification(data) {
        const notif = data.notification || data;
        // Increment count immediately
        this.notificationCount++;
        this.updateBadgesUI();
        
        // Show Toast
        const msg = notif.message || "You have a new notification";
        this.showToast(msg);
    }

    handleNewMessage(data) {
        this.messageCount++;
        this.updateBadgesUI();
        if (!window.location.pathname.includes("messages")) {
            this.showToast("You have a new message");
        }
    }

    showToast(message) {
        // Reuse your existing toast logic here...
        // (Copied from your original file for brevity)
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.style.cssText = "position:fixed; top:20px; right:20px; z-index:10000; display:flex; flex-direction:column; gap:10px;";
            document.body.appendChild(container);
        }
        const toast = document.createElement("div");
        toast.style.cssText = "background:#333; color:#fff; padding:10px 20px; border-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.2); animation:fadeIn 0.3s;";
        toast.innerHTML = `🔔 ${this.safeText(message)}`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = setInterval(() => {
            this.updateNotificationBadge();
            this.updateMessageBadge();
        }, 60000);
    }
}

// Global Init
document.addEventListener("DOMContentLoaded", () => {
    // Expose layoutManager methods that global-header.js looks for
    window.layoutManager = {
        refreshNotificationBadge: () => window.notificationManager?.updateNotificationBadge(),
        refreshMessageBadge: () => window.notificationManager?.updateMessageBadge(),
        // global-header.js handles the UI toggle, we handle the Data fetch
        toggleNotifications: () => window.notificationManager?.fetchAndRenderNotifications(),
        toggleMessages: () => { /* Add message fetch logic if needed */ }
    };

    window.notificationManager = new NotificationManager();
});