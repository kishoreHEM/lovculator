// frontend/js/notifications.js
// 🔔 Global Notifications + Message badge + REAL-TIME (WebSocket + Toast Popup)

class NotificationManager {
    constructor() {
        this.notificationCount = 0;
        this.messageCount = 0;

        this.socket = null;
        this.reconnectTimeout = null;
        this.autoRefreshInterval = null;

        // Bind reference methods
        this.boundCloseNotifications = this.closeNotifications.bind(this);
        this.boundHandleSocketMessage = this.handleSocketMessage.bind(this);
        this.boundReconnect = this.setupWebSocket.bind(this); // 🟢 Bind for explicit reconnect call

        this.init();
    }

    /* ======================================================
       INIT
    ====================================================== */
    init() {
        console.log("🔔 NotificationManager initialized");

        this.setupNotificationHandlers();
        // 🟢 These two calls immediately fetch and update the badge counts on page load
        this.updateNotificationBadge();
        this.updateMessageBadge(); 
        
        this.setupWebSocket();
        this.startAutoRefresh();
    }

    /* ======================================================
       HEADER BUTTON HANDLERS
    ====================================================== */
    setupNotificationHandlers() {
        const notificationsBtn = document.getElementById("notificationsBtn");
        const messagesBtn = document.getElementById("messagesBtn");

        notificationsBtn?.addEventListener("click", () => this.showNotifications());
        messagesBtn?.addEventListener("click", () => {
            window.location.href = "/messages.html";
        });
    }

    /* ======================================================
       FETCH NOTIFICATIONS / SHOW DROPDOWN
    ====================================================== */
    async showNotifications() {
        try {
            const response = await fetch("/api/notifications?filter=all&page=1&limit=5", {
                credentials: "include"
            });

            const data = response.ok ? await response.json() : { notifications: [] };
            this.renderDropdown(data.notifications);

            // Mark all visible as read
            this.markAllAsReadSilent();
        } catch (error) {
            console.error("❌ Notification load error:", error);
            this.renderDropdown([]);
        }
    }

    renderDropdown(notifications) {
    const existing = document.getElementById("notificationsDropdown");
    if (existing) existing.remove();
    
    // Find the position of the notifications button to place the dropdown
    const btn = document.getElementById("notificationsBtn");
    if (!btn) return;
    
    const rect = btn.getBoundingClientRect();

    const dropdown = document.createElement("div");
    dropdown.id = "notificationsDropdown";
    dropdown.className = "notification-dropdown";
    
    // 🟢 Positioning the dropdown right below the button
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + 10}px`;
    dropdown.style.right = `${window.innerWidth - rect.right}px`;
    dropdown.style.zIndex = '1000';

    dropdown.innerHTML = `
        <div class="dropdown-header">
            <h4>Notifications</h4>
            <a href="/notifications.html" class="see-all-link">See All</a>
        </div>
        <div class="dropdown-content">
            ${
                notifications.length > 0
                    ? notifications
                          .map(
                              (n) => `
                    <div class="dropdown-notification-item ${n.is_read ? "" : "unread"}">
                        <img src="${n.actor_avatar_url || "/images/default-avatar.png"}" alt="${n.actor_name || 'User'}" class="notification-avatar">
                        <div class="notification-content">
                            <div class="dropdown-notification-text">${n.message}</div>
                            <div class="dropdown-notification-time">${this.formatTime(n.created_at)}</div>
                            ${!n.is_read ? `
                            <div class="notification-dropdown-actions">
                                <button class="notification-dropdown-action" data-notification-id="${n.id}">Mark as read</button>
                            </div>
                            ` : ''}
                        </div>
                        ${!n.is_read ? '<div class="unread-dot"></div>' : ''}
                    </div>
                `
                          )
                          .join("")
                    : `<div class="no-notifications">No new notifications</div>`
            }
        </div>
        <div class="dropdown-footer">
            <a href="/notifications.html">View all notifications</a>
        </div>
    `;

    document.body.appendChild(dropdown);
    
    // Add event listeners for mark as read buttons
    dropdown.querySelectorAll('.notification-dropdown-action').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const notificationId = button.dataset.notificationId;
            this.markAsRead(notificationId);
        });
    });
    
    setTimeout(() => {
        document.addEventListener("click", this.boundCloseNotifications);
    }, 100);
}

    closeNotifications(event) {
        const dropdown = document.getElementById("notificationsDropdown");
        const btn = document.getElementById("notificationsBtn");
        
        // Check if the click was outside the dropdown AND outside the button
        if (dropdown && btn && !dropdown.contains(event.target) && !btn.contains(event.target)) {
            dropdown.remove();
            document.removeEventListener("click", this.boundCloseNotifications);
        }
    }

    /* ======================================================
       BADGE COUNT REFRESH
    ====================================================== */
    async updateNotificationBadge() {
        try {
            // 🟢 This API call fetches the unread count
            const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
            const data = await res.json();
            this.notificationCount = data.count || 0;
            this.updateNotificationBadgeUI();
        } catch (error) {
            console.error("Error updating notif badge:", error);
        }
    }

    updateNotificationBadgeUI() {
        // 🟢 Targeting the element with class .notification-badge
        const badge = document.querySelector(".notification-badge");
        if (!badge) return;

        if (this.notificationCount > 0) {
            badge.textContent = this.notificationCount > 99 ? "99+" : String(this.notificationCount);
            badge.classList.remove("hidden"); // 🟢 Makes the badge visible
        } else {
            badge.classList.add("hidden");
        }
    }

    async updateMessageBadge() {
        try {
            // 🟢 This API call fetches the unread count
            const res = await fetch("/api/messages/unread-count", { credentials: "include" });
            const data = await res.json();
            this.messageCount = data.count || 0;

            // 🟢 Targeting the element with class .message-badge
            const badge = document.querySelector(".message-badge");
            if (!badge) return;

            if (this.messageCount > 0) {
                badge.textContent = this.messageCount > 99 ? "99+" : String(this.messageCount);
                badge.classList.remove("hidden"); // 🟢 Makes the badge visible
            } else {
                badge.classList.add("hidden");
            }
        } catch (error) {
            console.warn("Messages unread API not ready yet or failed to fetch.");
        }
    }

    /* ======================================================
       MARK ALL READ (SILENT)
    ====================================================== */
    async markAllAsReadSilent() {
        await fetch("/api/notifications/mark-all-read", {
            method: "POST",
            credentials: "include"
        });
        this.updateNotificationBadge();
    }

    /* ======================================================
       WEBSOCKET
    ====================================================== */
    setupWebSocket() {
        clearTimeout(this.reconnectTimeout); // Clear any pending reconnects
        
        try {
            // Check if messagesManager already created the socket (Decoupling is better, but this handles the current structure)
            if (window.messagesManager?.socket) {
                this.socket = window.messagesManager.socket;
                this.socket.removeEventListener("message", this.boundHandleSocketMessage); // Prevent duplicate listeners
                this.socket.addEventListener("message", this.boundHandleSocketMessage);
                console.log("🔌 Reusing existing WS connection for notifications");
                return;
            }
            
            // If no existing socket, create a new one
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            this.socket = new WebSocket(`${protocol}://${window.location.host}`);

            this.socket.addEventListener("open", () =>
                console.log("✅ Notifications WebSocket Connected")
            );

            this.socket.addEventListener("message", this.boundHandleSocketMessage);

            this.socket.addEventListener("close", () => {
                console.log("⚠️ WS closed — Reconnecting in 5s...");
                // 🟢 Use the bound method for clean recursion
                this.reconnectTimeout = setTimeout(this.boundReconnect, 5000); 
            });
            
            this.socket.addEventListener("error", (err) => {
                console.error("❌ WS error:", err);
                this.socket?.close(); // Force close to trigger the 'close' handler and retry
            });

        } catch (error) {
            console.error("❌ WS init failed:", error);
            this.reconnectTimeout = setTimeout(this.boundReconnect, 5000); 
        }
    }

    handleSocketMessage(event) {
        let data = null;
        try {
            data = JSON.parse(event.data);
        } catch {
            return;
        }

        if (!data.type) return;

        switch (data.type) {
            case "NEW_NOTIFICATION":
                // 🟢 Update local count and badge UI immediately
                this.notificationCount++;
                this.updateNotificationBadgeUI();
                this.showToast(data.message);
                break;

            case "NEW_MESSAGE":
                // 🟢 Refresh message badge
                this.updateMessageBadge();
                this.showToast("📨 New message received");
                break;
        }
    }

    /* ======================================================
       LIVE TOAST POPUP
    ====================================================== */
    showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast-popup";
        toast.textContent = message;

        // Apply temporary inline styles for visibility (assuming you have toast styles in CSS)
        toast.style.cssText = `
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: #ff4b8d; 
            color: white; 
            padding: 10px 15px; 
            border-radius: 6px; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s, transform 0.3s;
            transform: translateX(100%);
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 50);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ======================================================
       AUTO REFRESH EVERY 60 SEC
    ====================================================== */
    startAutoRefresh() {
        // Clear any existing interval to prevent duplicates
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval); 
        
        this.autoRefreshInterval = setInterval(() => {
            this.updateNotificationBadge();
            this.updateMessageBadge();
        }, 60000); // Refreshes every minute
    }

    /* ======================================================
       TIME FORMAT HELPERS
    ====================================================== */
    formatTime(dateString) {
        const date = new Date(dateString);
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
}

document.addEventListener("DOMContentLoaded", () => {
    window.notificationManager = new NotificationManager();
});