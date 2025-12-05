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
        this.boundReconnect = this.setupWebSocket.bind(this);

        this.init();
    }

    init() {
        console.log("🔔 NotificationManager initialized");
        this.setupNotificationHandlers();
        this.updateNotificationBadge();
        this.updateMessageBadge(); 
        this.setupWebSocket();
        this.startAutoRefresh();
    }

    setupNotificationHandlers() {
        const notificationsBtn = document.getElementById("notificationsBtn");
        const messagesBtn = document.getElementById("messagesBtn");

        notificationsBtn?.addEventListener("click", () => this.showNotifications());
        messagesBtn?.addEventListener("click", () => {
            window.location.href = "/messages.html";
        });
    }

    async showNotifications() {
        try {
            const response = await fetch("/api/notifications?filter=all&page=1&limit=5", {
                credentials: "include"
            });

            const data = response.ok ? await response.json() : { notifications: [] };
            
            // 1. Render dropdown first
            this.renderDropdown(data.notifications);

            // 2. Identify unread IDs
            const unreadIds = data.notifications
                .filter(n => !n.is_read && !n.read)
                .map(n => n.id);

            // 3. Mark unread as read (Client-side loop workaround)
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
        if (!btn) return;
        
        // Deduplicate
        const uniqueNotifications = Array.from(
            new Map(notifications.map(n => [n.id, n])).values()
        );

        const rect = btn.getBoundingClientRect();
        const dropdown = document.createElement("div");
        dropdown.id = "notificationsDropdown";
        dropdown.className = "notification-dropdown";
        
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
                    uniqueNotifications.length > 0
                        ? uniqueNotifications.map((n) => {
                            const formattedText = this.formatNotificationText(n);
                            const timeAgo = this.formatTime(n.created_at);
                            
                            // Check flat fields for avatar too
                            const actorAvatar = n.actor?.avatar_url || n.actor_avatar_url || "/images/default-avatar.png";
                            
                            return `
                                <div class="dropdown-notification-item ${n.read || n.is_read ? "" : "unread"}">
                                    <img 
                                        src="${actorAvatar}" 
                                        alt="User" 
                                        class="notification-avatar"
                                        onerror="this.onerror=null;this.src='/images/default-avatar.png';"
                                    >
                                    <div class="notification-content">
                                        <div class="dropdown-notification-text">${formattedText}</div>
                                        <div class="dropdown-notification-time">${timeAgo}</div>
                                        ${!n.read && !n.is_read ? `
                                        <div class="notification-dropdown-actions">
                                            <button class="notification-dropdown-action" data-notification-id="${n.id}">Mark as read</button>
                                        </div>
                                        ` : ''}
                                    </div>
                                    ${!n.read && !n.is_read ? '<div class="unread-dot"></div>' : ''}
                                </div>
                            `;
                        }).join("")
                        : `<div class="no-notifications">No new notifications</div>`
                }
            </div>
            <div class="dropdown-footer">
                <a href="/notifications.html">View all notifications</a>
            </div>
        `;

        document.body.appendChild(dropdown);
        
        dropdown.querySelectorAll('.notification-dropdown-action').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAsRead(button.dataset.notificationId);
            });
        });
        
        setTimeout(() => {
            document.addEventListener("click", this.boundCloseNotifications);
        }, 100);
    }

    formatNotificationText(notification) {
        const { type, actor, message, data } = notification;
        
        const displayName = actor?.display_name || notification.actor_display_name;
        const userName = actor?.username || notification.actor_username;
        
        const nameToDisplay = this.safeText(displayName || userName || 'Someone');

        switch (type) {
            case 'like':
                return `<strong>${nameToDisplay}</strong> liked your ${data?.post_type === 'story' ? 'love story' : 'post'}`;
            case 'comment':
                return `<strong>${nameToDisplay}</strong> commented on your ${data?.post_type === 'story' ? 'love story' : 'post'}`;
            case 'follow':
                return `<strong>${nameToDisplay}</strong> started following you`;
            case 'message':
                return `<strong>${nameToDisplay}</strong> sent you a message`;
            case 'system':
                return this.safeText(message);
            default:
                return this.safeText(message || 'A new event occurred');
        }
    }

    safeText(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

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

    closeNotifications(event) {
        const dropdown = document.getElementById("notificationsDropdown");
        const btn = document.getElementById("notificationsBtn");
        
        if (dropdown && btn && !dropdown.contains(event.target) && !btn.contains(event.target)) {
            dropdown.remove();
            document.removeEventListener("click", this.boundCloseNotifications);
        }
    }

    async updateNotificationBadge() {
        try {
            const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
            const data = await res.json();
            this.notificationCount = data.count || 0;
            this.updateNotificationBadgeUI();
        } catch (error) {}
    }

    updateNotificationBadgeUI() {
        const badge = document.querySelector(".notification-badge");
        if (!badge) return;

        if (this.notificationCount > 0) {
            badge.textContent = this.notificationCount > 99 ? "99+" : String(this.notificationCount);
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }

    async updateMessageBadge() {
        try {
            const res = await fetch("/api/messages/unread-count", { credentials: "include" });
            const data = await res.json();
            this.messageCount = data.count || 0;

            const badge = document.querySelector(".message-badge");
            if (!badge) return;

            if (this.messageCount > 0) {
                badge.textContent = this.messageCount > 99 ? "99+" : String(this.messageCount);
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }
        } catch (error) {}
    }

    // ✅ ADDED THIS MISSING METHOD
    async markListAsRead(ids) {
        if (!ids || ids.length === 0) return;
        this.notificationCount = Math.max(0, this.notificationCount - ids.length);
        this.updateNotificationBadgeUI();

        ids.forEach(id => {
            fetch(`/api/notifications/${id}/read`, { 
                method: "POST", 
                credentials: "include" 
            }).catch(e => console.error(`Failed to mark ${id} read`, e));
        });
    }

    async markAsRead(id) {
        try {
            await fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" });
            const btn = document.querySelector(`button[data-notification-id="${id}"]`);
            if (btn) {
                const item = btn.closest('.dropdown-notification-item');
                item.classList.remove('unread');
                item.querySelector('.unread-dot')?.remove();
                btn.parentElement.remove();
            }
            this.updateNotificationBadge();
        } catch (e) { console.error(e); }
    }

    setupWebSocket() {
        clearTimeout(this.reconnectTimeout); 
        try {
            if (window.messagesManager?.socket) {
                this.socket = window.messagesManager.socket;
                this.socket.removeEventListener("message", this.boundHandleSocketMessage);
                this.socket.addEventListener("message", this.boundHandleSocketMessage);
                return;
            }
            
            const protocol = window.location.protocol === "https:" ? "wss" : "ws";
            this.socket = new WebSocket(`${protocol}://${window.location.host}`);

            this.socket.addEventListener("message", this.boundHandleSocketMessage);
            this.socket.addEventListener("close", () => {
                this.reconnectTimeout = setTimeout(this.boundReconnect, 5000); 
            });
            this.socket.addEventListener("error", () => this.socket?.close());

        } catch (error) {
            this.reconnectTimeout = setTimeout(this.boundReconnect, 5000); 
        }
    }

    handleSocketMessage(event) {
        let data = null;
        try { data = JSON.parse(event.data); } catch { return; }
        if (!data.type) return;

        switch (data.type) {
            case "NEW_NOTIFICATION":
                this.notificationCount++;
                this.updateNotificationBadgeUI();
                this.showToast(data.message);
                break;
            case "NEW_MESSAGE":
                this.updateMessageBadge();
                this.showToast("📨 New message received");
                break;
        }
    }

    showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast-popup";
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: #ff4b8d; 
            color: white; padding: 10px 15px; border-radius: 6px; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 10000;
            opacity: 0; transition: opacity 0.3s, transform 0.3s; transform: translateX(100%);
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 50);
        setTimeout(() => { 
            toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; 
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval); 
        this.autoRefreshInterval = setInterval(() => {
            this.updateNotificationBadge();
            this.updateMessageBadge();
        }, 60000);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("notificationsBtn")) {
        window.notificationManager = new NotificationManager();
    }
});