/**
 * frontend/js/notifications.js
 * ✅ Final Version: Full Realtime Support + Mobile/Desktop Fixes + Toast Popups Restored
 */

class NotificationManager {
    constructor() {
        this.notificationCount = 0;
        this.messageCount = 0;
        this.autoRefreshInterval = null;
        this.pushSetupDone = false;
        this.realtimeSubscribed = false;

        this.init();
    }

    async init() {
        console.log("🔔 NotificationManager initialized");

        // 1. Initial Badge Fetch
        this.updateNotificationBadge();
        this.updateMessageBadge();

        // 2. Subscribe to WebSocket (Live Updates)
        this.subscribeToRealTimeEvents();

        // 3. Fallback Polling (Every 60s)
        this.startAutoRefresh();

        this.maybeSetupPushNotifications();

        // 4. Bind to Header Buttons (Wait for header.html to load)
        setTimeout(() => this.bindHeaderEvents(), 500);
    }

    async maybeSetupPushNotifications() {
    if (this.pushSetupDone) return;
    try {
        const me = await fetch(`${window.API_BASE}/auth/me`, {
            credentials: "include",
            cache: "no-store"
        });
        if (!me.ok) return;
        this.pushSetupDone = true;
        await this.setupPushNotifications();
    } catch (err) {
        console.warn("Push auth check failed:", err);
    }
}

    async setupPushNotifications() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.log("Push not supported");
            return;
        }

        const fallbackVapidKey = "BPhvrTAciFdUoThpX3NNJuBUQJCAch3w7ZUwHlSPnZHNYJ9p6mQkAnCZR8BDi6YfM6hjXZdG_T4Y10rxmActWm0";
        const vapidKey = window.VAPID_PUBLIC_KEY || fallbackVapidKey;
        if (!window.VAPID_PUBLIC_KEY) {
            window.VAPID_PUBLIC_KEY = vapidKey;
            console.warn("VAPID public key was missing on window. Applied fallback key.");
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.log("Notification permission denied");
            return;
        }

        const registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            const convertedKey = this.urlBase64ToUint8Array(vapidKey);

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedKey
            });
        }

        const res = await fetch("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(subscription)
        });

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`Subscribe failed: HTTP ${res.status} ${body}`);
        }

        console.log("✅ Push subscribed successfully");

    } catch (err) {
        console.error("Push setup failed:", err);
    }
}

urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}



    // ================================
    // 🔗 HEADER BINDING (Connects Clicks)
    // ================================
    bindHeaderEvents() {
        // Trigger fetch when user clicks either Desktop or Mobile bell
        const triggerFetch = (e) => {
            // global-header.js handles the toggle (open/close)
            // We just need to ensure data is fetched when it opens
            this.fetchAndRenderNotifications();
        };

        const deskBtn = document.getElementById("deskNotifBtn");
        const mobBtn = document.getElementById("mobNotifBtn");

        if (deskBtn) deskBtn.addEventListener("click", triggerFetch);
        if (mobBtn) mobBtn.addEventListener("click", triggerFetch);
    }

    // ================================
    // 🔌 REALTIME (WebSocket)
    // ================================
    async subscribeToRealTimeEvents() {
        if (this.realtimeSubscribed) return;
        // Wait until wsManager exists (it might load slightly after this script)
        if (!window.wsManager) {
            console.log("⏳ Waiting for WebSocketManager...");
            setTimeout(() => this.subscribeToRealTimeEvents(), 1000);
            return;
        }

        try {
            await window.wsManager.connect();

            // Subscribe: New Notification
            window.wsManager.subscribe("NEW_NOTIFICATION", (data) => {
                this.handleNewNotification(data);
            });

            // Subscribe: New Message
            window.wsManager.subscribe("NEW_MESSAGE", (data) => {
                this.handleNewMessage(data);
            });

            this.realtimeSubscribed = true;
            console.log("✅ Live Notifications Connected");
        } catch (err) {
            console.error("❌ WS Subscribe Error:", err);
        }
    }

    // ================================
    // 🔔 EVENT HANDLERS (Live Logic)
    // ================================
    handleNewNotification(data) {
        console.log("🔔 WebSocket Notification received:", data);

        // 🛡 Parse Payload: Support { notification: ... } or flat object
        const notification = data.notification || data;

        // 1. Increment Count (Prevent duplicate increment if backend sends read status)
        if (!notification.is_read && !notification.read) {
            this.notificationCount++;
            this.updateBadgesUI();
        }

        // 2. Sync exact count from server (Safety check)
        this.updateNotificationBadge();

        // 3. SHOW TOAST (The "Live" Popup)
        const msgText = notification.message || data.message || "📩 You received a new notification";
        this.showToast(this.safeText(msgText));
        
        // 4. If dropdown is currently open, refresh the list immediately
        const panel = document.getElementById("notificationPanel");
        if (panel && panel.classList.contains("show")) {
            this.fetchAndRenderNotifications();
        }
    }

    handleNewMessage(data) {
        console.log("💌 WebSocket Message received:", data);

        // 1. Update Badge
        this.messageCount++; // Optimistic increment
        this.updateMessageBadge(); // Sync with server

        // 2. Show Toast (unless we are on the messages page)
        if (!window.location.pathname.includes("messages")) {
            const msg = data.message || {};
            const sender = msg.sender_display_name || "Someone";
            this.showToast(`💬 New message from ${this.safeText(sender)}`);
        }
    }

    // ================================
    // 🔽 DATA FETCHING (Dropdown)
    // ================================
    async fetchAndRenderNotifications() {
        // Target the STATIC container in header.html
        const container = document.querySelector("#notificationPanel .dropdown-content");
        if (!container) return; 

        // Show Loading State only if empty
        if(container.children.length === 0 || container.querySelector('.dropdown-empty')) {
            container.innerHTML = '<div class="dropdown-empty">Loading...</div>';
        }

        try {
            const res = await fetch("/api/notifications?filter=all&page=1&limit=10", {
                credentials: "include",
            });

            const data = res.ok ? await res.json() : { notifications: [] };
            const notifications = Array.isArray(data.notifications) ? data.notifications : [];

            this.renderList(notifications);

            // Mark loaded unread items as read
            const unreadIds = notifications
                .filter((n) => !n.is_read && !n.read)
                .map((n) => n.id);

            if (unreadIds.length > 0) {
                this.markListAsRead(unreadIds);
            }
        } catch (error) {
            console.error("❌ Notification load error:", error);
            container.innerHTML = '<div class="dropdown-empty">Failed to load.</div>';
        }
    }

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
                   <div style="display:flex; align-items:center; gap:12px;">
                      <img src="${actorAvatar}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:1px solid #eee;" 
                           onerror="this.src='/images/default-avatar.png'">
                      <div style="flex:1;">
                          <div style="font-size:13px; color:#333; line-height: 1.3;">${formattedText}</div>
                          <div style="font-size:11px; color:#999; margin-top:4px;">${timeAgo}</div>
                      </div>
                      ${isUnread ? '<div style="width:8px; height:8px; background:#e91e63; border-radius:50%; flex-shrink:0;"></div>' : ''}
                   </div>
                </div>
            `;
        }).join("");

        container.innerHTML = html;
    }

    // ================================
    // 🔢 BADGE UPDATES
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
        // Helper to update specific button's badge
        const setBadge = (btnId, count) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            const badge = btn.querySelector(".badge");
            if (!badge) return;

            if (count > 0) {
                badge.textContent = count > 99 ? "99+" : String(count);
                badge.style.display = "flex";
            } else {
                badge.style.display = "none";
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
        
        // Optimistic UI Update: Decrease badge count immediately
        this.notificationCount = Math.max(0, this.notificationCount - ids.length);
        this.updateBadgesUI();

        ids.forEach((id) => {
            fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" })
            .catch(e => console.error("Read mark failed", e));
        });
    }

    // ================================
    // ✨ TOAST NOTIFICATIONS (Restored)
    // ================================
    showToast(message) {
        let container = document.getElementById("toastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "toastContainer";
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                z-index: 10000;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");
        toast.className = "toast-minimal";
        toast.innerHTML = `
            <span style="margin-right:8px;">🔔</span>
            <span style="font-weight:500;">${this.safeText(message)}</span>
        `;

        toast.style.cssText = `
            background: rgba(30, 30, 30, 0.95);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            display: flex;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease-in-out;
            cursor: pointer;
            min-width: 250px;
            max-width: 320px;
        `;

        container.appendChild(toast);

        // Animate In
        setTimeout(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        }, 50);

        // Click to dismiss
        toast.addEventListener("click", () => dismiss());

        const dismiss = () => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(-10px)";
            setTimeout(() => toast.remove(), 300);
        };

        // Auto dismiss after 4 seconds
        setTimeout(dismiss, 4000);
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
    // Expose methods for global-header.js interactions
    window.layoutManager = {
        refreshNotificationBadge: () => window.notificationManager?.updateNotificationBadge(),
        refreshMessageBadge: () => window.notificationManager?.updateMessageBadge(),
        toggleNotifications: () => window.notificationManager?.fetchAndRenderNotifications(),
        toggleMessages: () => { /* Message logic */ }
    };

    window.notificationManager = new NotificationManager();
});
