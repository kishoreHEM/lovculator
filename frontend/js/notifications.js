/**
 * frontend/js/notifications.js
 * ✅ Final Version: Uses shared WebSocketManager & correct data paths
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
        // We do NOT call setupNotificationHandlers here immediately because 
        // the header might not exist yet. LayoutManager will handle the clicks.
        
        this.updateNotificationBadge();
        this.updateMessageBadge();

        // Subscribe to WebSocket events (shared manager)
        this.subscribeToRealTimeEvents();

        // Fallback polling (for safety)
        this.startAutoRefresh();
    }

    // ================================
    // 🔌 REALTIME (WebSocket)
    // ================================
    async subscribeToRealTimeEvents() {
        // Wait until wsManager exists
        if (!window.wsManager) {
            console.log("⏳ Waiting for WebSocketManager in notifications...");
            setTimeout(() => this.subscribeToRealTimeEvents(), 500);
            return;
        }

        try {
            // Ensure connection (idempotent in your wsManager)
            await window.wsManager.connect();

            // Listen for NEW_NOTIFICATION events
            window.wsManager.subscribe("NEW_NOTIFICATION", (data) => {
                this.handleNewNotification(data);
            });

            // Listen for NEW_MESSAGE events (for unread message badge)
            window.wsManager.subscribe("NEW_MESSAGE", (data) => {
                this.handleNewMessage(data);
            });

            console.log("✅ NotificationManager subscribed to WebSocket events");
        } catch (err) {
            console.error("❌ Failed to subscribe to WS events in notifications:", err);
        }
    }

    // ================================
    // 🔽 DROPDOWN & FETCH
    // ================================
    async showNotifications() {
        try {
            const res = await fetch("/api/notifications?filter=all&page=1&limit=5", {
                credentials: "include",
            });

            const data = res.ok ? await res.json() : {
                notifications: []
            };
            const notifications = Array.isArray(data.notifications) ?
                data.notifications :
                [];

            this.renderDropdown(notifications);

            // Mark visible unread items as read
            const unreadIds = notifications
                .filter((n) => !n.is_read && !n.read)
                .map((n) => n.id);

            if (unreadIds.length > 0) {
                this.markListAsRead(unreadIds);
            }
        } catch (error) {
            console.error("❌ Notification load error:", error);
            this.renderDropdown([]);
        }
    }

    renderDropdown(notifications) {
        const existing = document.getElementById("notificationsDropdown");
        if (existing) existing.remove();

        const btn = document.getElementById("notificationsBtn");
        if (!btn) {
            console.error("Notification button not found in DOM");
            return;
        }

        // Deduplicate by ID
        const uniqueNotifications = Array.from(
            new Map(
                notifications
                .filter((n) => n && n.id != null)
                .map((n) => [n.id, n])
            ).values()
        );

        const rect = btn.getBoundingClientRect();
        const dropdown = document.createElement("div");
        dropdown.id = "notificationsDropdown";
        dropdown.className = "notification-dropdown";

        // Positioning
        dropdown.style.position = "absolute";
        dropdown.style.top = `${rect.bottom + 10}px`;
        dropdown.style.zIndex = "1000";

        if (window.innerWidth < 500) {
            dropdown.style.left = "10px";
            dropdown.style.right = "10px";
            dropdown.style.width = "auto";
        } else {
            dropdown.style.right = `${window.innerWidth - rect.right}px`;
            dropdown.style.width = "320px";
        }

        // Render Content
        dropdown.innerHTML = `
      <div class="dropdown-header">
        <h4>Notifications</h4>
        <a href="/notifications.html" class="see-all-link">See All</a>
      </div>
      <div class="dropdown-content">
        ${
          uniqueNotifications.length > 0
            ? uniqueNotifications
                .map((n) => {
                  const formattedText = this.formatNotificationText(n);
                  const timeAgo = this.formatTime(n.created_at || n.createdAt);
                  const actorAvatar =
                    n.actor?.avatar_url ||
                    n.actor_avatar_url ||
                    "/images/default-avatar.png";
                  const link = n.link || n.url || "#";

                  return `
                <div class="dropdown-notification-item ${
                  n.read || n.is_read ? "" : "unread"
                }" onclick="window.location.href='${link}'">
                  <img
                    src="${actorAvatar}"
                    alt="User"
                    class="notification-avatar"
                    onerror="this.onerror=null;this.src='/images/default-avatar.png';"
                  >
                  <div class="notification-content">
                    <div class="dropdown-notification-text">${formattedText}</div>
                    <div class="dropdown-notification-time">${timeAgo}</div>
                  </div>
                  ${
                    !n.read && !n.is_read
                      ? '<div class="unread-dot"></div>'
                      : ""
                  }
                </div>
              `;
                })
                .join("")
            : `<div class="no-notifications">No new notifications</div>`
        }
      </div>
      <div class="dropdown-footer">
        <a href="/notifications.html">View all notifications</a>
      </div>
    `;

        document.body.appendChild(dropdown);

        // Click outside to close
        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener("click", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("click", closeHandler), 10);
    }

    // ================================
    // 🔤 TEXT / TIME HELPERS
    // ================================
    formatNotificationText(notification) {
        if (notification.message) {
            return notification.message; // do not rewrite meaning
        }

        const name = notification.actor_display_name || "Someone";

        switch (notification.type) {
            case "comment":
                return `${name} commented on your post`;
            case "like":
                return `${name} liked your post`;
            case "follow":
                return `${name} started following you`;
            default:
                return `${name} sent a notification`;
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
        if (isNaN(date.getTime())) return "";

        const now = new Date();
        const diff = now - date;
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        if (hrs < 24) return `${hrs}h ago`;
        return `${days}d ago`;
    }

    // ================================
    // 🔢 BADGE COUNTS
    // ================================
    async updateNotificationBadge() {
        try {
            const res = await fetch("/api/notifications/unread-count", {
                credentials: "include",
            });
            const data = res.ok ? await res.json() : {};
            this.notificationCount = data.count || 0;
            this.updateNotificationBadgeUI();
        } catch (error) {
            // Silent fail - fallback polling will re-try
        }
    }

    updateNotificationBadgeUI() {
        // Support both id & class (LayoutManager uses ID 'notificationBadge')
        const badge =
            document.getElementById("notificationBadge") ||
            document.querySelector(".notification-badge");

        if (!badge) return;

        if (this.notificationCount > 0) {
            badge.textContent =
                this.notificationCount > 99 ? "99+" : String(this.notificationCount);
            badge.classList.remove("hidden");
            badge.style.display = "flex";
        } else {
            badge.classList.add("hidden");
            badge.style.display = "none";
        }
    }

    async updateMessageBadge() {
        try {
            const res = await fetch("/api/messages/unread-count", {
                credentials: "include",
            });
            const data = res.ok ? await res.json() : {};
            this.messageCount = data.count || 0;

            const badge = document.getElementById("messagesBadge");
            if (!badge) return;

            if (this.messageCount > 0) {
                badge.textContent =
                    this.messageCount > 99 ? "99+" : String(this.messageCount);
                badge.classList.remove("hidden");
                badge.style.display = "flex";
            } else {
                badge.classList.add("hidden");
                badge.style.display = "none";
            }
        } catch (error) {
            // ignore
        }
    }

    // ================================
    // ✅ MARK AS READ
    // ================================
    async markListAsRead(ids) {
        if (!ids || ids.length === 0) return;

        // Optimistic: decrease badge
        this.notificationCount = Math.max(
            0,
            this.notificationCount - ids.length
        );
        this.updateNotificationBadgeUI();

        // Fire & forget
        ids.forEach((id) => {
            fetch(`/api/notifications/${id}/read`, {
                method: "POST",
                credentials: "include",
            }).catch((e) => console.error(`Failed to mark ${id} read`, e));
        });
    }

    // ================================
    // 🔔 REALTIME EVENT HANDLERS
    // ================================
    handleNewNotification(data) {
        console.log("🔔 WebSocket Notification received:", data);

        // 🛡 Detect proper payload shape
        const notification = data.notification || data;

        // 🛑 Prevent duplicate increment when the backend unread count syncs later
        if (!notification.is_read && !notification.read) {
            this.notificationCount++;
            this.updateNotificationBadgeUI();
        }

        // 🔄 Always sync unread count from server
        this.updateNotificationBadge();

        // 🎉 Toast display
        const msgText =
            notification.message ||
            data.message ||
            "📩 You received a new notification";

        this.showToast(this.safeText(msgText));
    }

    handleNewMessage(data) {
        console.log("💌 WebSocket Message Notification:", data);

        this.updateMessageBadge();

        if (!window.location.pathname.includes("messages")) {
            const msg = data.message || {};
            const sender =
                msg.sender_display_name ||
                msg.sender_username ||
                msg.from_username ||
                "Someone";

            this.showToast(`💬 New message from ${this.safeText(sender)}`);
        }
    }

    // ================================
    // ✨ NEW BEAUTIFUL TOAST UI
    // ================================
    showToast(message) {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            z-index: 10000;
        `;
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = "toast-minimal";
        toast.innerHTML = `
        <span style="margin-right:6px;">🔔</span>
        ${this.safeText(message)}
    `;

        toast.style.cssText = `
        background: rgba(30, 30, 30, 0.90);
        color: white;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 13px;
        display: flex;
        align-items: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.25s ease-in-out;
        cursor: pointer;
        max-width: 260px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        }, 30);

        toast.addEventListener("click", () => dismiss());

        const dismiss = () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-10px)";
            setTimeout(() => toast.remove(), 250);
        };

        setTimeout(dismiss, 3000);
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);

        this.autoRefreshInterval = setInterval(() => {
            this.updateNotificationBadge();
            this.updateMessageBadge();
        }, 60000);
    }
}

// ✅ FIXED: Always initialize, even if elements aren't ready yet
document.addEventListener("DOMContentLoaded", () => {
    window.notificationManager = new NotificationManager();
});