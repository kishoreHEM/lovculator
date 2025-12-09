/**
 * frontend/js/notifications.js
 * ✅ FIXED VERSION: Uses shared WebSocketManager & Correct Data Path
 */

class NotificationManager {
    constructor() {
        this.notificationCount = 0;
        this.messageCount = 0;
        
        // No local socket - we use the global window.wsManager
        this.init();
    }

    async init() {
        console.log("🔔 NotificationManager initialized");
        this.setupNotificationHandlers();
        this.updateNotificationBadge();
        this.updateMessageBadge(); 
        
        // ✅ FIX: Wait for shared WS Manager, then subscribe
        this.subscribeToRealTimeEvents();
        
        this.startAutoRefresh();
    }

    async subscribeToRealTimeEvents() {
        // Wait for wsManager to be available (defined in messages.js)
        if (!window.wsManager) {
            console.log("⏳ Waiting for WebSocketManager...");
            setTimeout(() => this.subscribeToRealTimeEvents(), 500);
            return;
        }

        try {
            await window.wsManager.connect();

            // ✅ Subscribe using the shared manager
            window.wsManager.subscribe("NEW_NOTIFICATION", (data) => this.handleNewNotification(data));
            window.wsManager.subscribe("NEW_MESSAGE", (data) => this.handleNewMessage(data));
            
            console.log("✅ NotificationManager subscribed to shared WebSocket");
        } catch (err) {
            console.error("Failed to subscribe to notifications:", err);
        }
    }

    setupNotificationHandlers() {
        const notificationsBtn = document.getElementById("notificationsBtn");
        const messagesBtn = document.getElementById("messagesBtn");

        notificationsBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showNotifications();
        });
        
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
            
            this.renderDropdown(data.notifications);

            // Mark visible unread items as read
            const unreadIds = data.notifications
                .filter(n => !n.is_read && !n.read)
                .map(n => n.id);

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
        
        // Deduplicate based on ID
        const uniqueNotifications = Array.from(
            new Map(notifications.map(n => [n.id, n])).values()
        );

        const rect = btn.getBoundingClientRect();
        const dropdown = document.createElement("div");
        dropdown.id = "notificationsDropdown";
        dropdown.className = "notification-dropdown";
        
        // Positioning
        dropdown.style.position = 'absolute';
        dropdown.style.top = `${rect.bottom + 10}px`;
        // Prevent going off-screen on mobile
        if (window.innerWidth < 500) {
            dropdown.style.right = '10px';
            dropdown.style.left = '10px';
            dropdown.style.width = 'auto';
        } else {
            dropdown.style.right = `${window.innerWidth - rect.right}px`;
            dropdown.style.width = '320px';
        }
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
                            const actorAvatar = n.actor?.avatar_url || n.actor_avatar_url || "/images/default-avatar.png";
                            
                            return `
                                <div class="dropdown-notification-item ${n.read || n.is_read ? "" : "unread"}" onclick="window.location.href='${n.link || '#'}'">
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
        
        // Close on outside click
        const closeHandler = (e) => {
            if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener("click", closeHandler);
            }
        };
        setTimeout(() => document.addEventListener("click", closeHandler), 10);
    }

    formatNotificationText(notification) {
        const { type, message, data } = notification;
        // If message is pre-formatted from backend, use it
        if (message) return this.safeText(message);
        
        // Fallback construction
        const actorName = notification.actor_display_name || "Someone";
        return `<strong>${this.safeText(actorName)}</strong> sent a notification`;
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

    async updateNotificationBadge() {
        try {
            const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
            const data = await res.json();
            this.notificationCount = data.count || 0;
            this.updateNotificationBadgeUI();
        } catch (error) {}
    }

    updateNotificationBadgeUI() {
        const badge = document.querySelector(".notification-badge"); // Ensure this class exists in your header HTML
        if (!badge) return;

        if (this.notificationCount > 0) {
            badge.textContent = this.notificationCount > 99 ? "99+" : String(this.notificationCount);
            badge.style.display = "flex"; // Changed from removing 'hidden' class to explicit display
        } else {
            badge.style.display = "none";
        }
    }

    async updateMessageBadge() {
        try {
            const res = await fetch("/api/messages/unread-count", { credentials: "include" });
            const data = await res.json();
            this.messageCount = data.count || 0;

            const badge = document.getElementById("messagesBadge"); // Use ID for specificity
            if (!badge) return;

            if (this.messageCount > 0) {
                badge.textContent = this.messageCount > 99 ? "99+" : String(this.messageCount);
                badge.style.display = "flex";
            } else {
                badge.style.display = "none";
            }
        } catch (error) {}
    }

    async markListAsRead(ids) {
        if (!ids || ids.length === 0) return;
        
        // Optimistic UI update
        this.notificationCount = Math.max(0, this.notificationCount - ids.length);
        this.updateNotificationBadgeUI();

        // Send requests in background
        ids.forEach(id => {
            fetch(`/api/notifications/${id}/read`, { 
                method: "POST", 
                credentials: "include" 
            }).catch(e => console.error(`Failed to mark ${id} read`, e));
        });
    }

    // ✅ EVENT HANDLER: New Notification
    handleNewNotification(data) {
        console.log("🔔 WebSocket Notification:", data);
        
        // 1. Increment count
        this.notificationCount++;
        this.updateNotificationBadgeUI();
        
        // 2. Show Toast
        // ✅ FIX: Access nested notification object if present
        const msgText = data.notification?.message || data.message || "New notification";
        this.showToast(msgText);
    }

    // ✅ EVENT HANDLER: New Message
    handleNewMessage(data) {
        console.log("💌 WebSocket Message Notification");
        this.updateMessageBadge();
        // Optional: Toast for message (if not on messages page)
        if (!window.location.pathname.includes('messages')) {
             const sender = data.message?.sender_username || "Someone";
             this.showToast(`Message from ${sender}`);
        }
    }

    showToast(message) {
        const toast = document.createElement("div");
        toast.className = "toast-popup";
        toast.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span>🔔</span>
                <span>${message}</span>
            </div>
        `;
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: #333; color: white; 
            padding: 12px 20px; border-radius: 8px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.2); 
            z-index: 10000; font-size: 14px;
            opacity: 0; transform: translateY(-20px);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => { 
            toast.style.opacity = '1'; 
            toast.style.transform = 'translateY(0)'; 
        }, 50);
        
        // Animate out
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            toast.style.transform = 'translateY(-20px)'; 
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval); 
        this.autoRefreshInterval = setInterval(() => {
            this.updateNotificationBadge();
            this.updateMessageBadge();
        }, 60000); // Check every minute as backup
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Only init if the bell icon exists
    if (document.getElementById("notificationsBtn") || document.querySelector(".notification-badge")) {
        window.notificationManager = new NotificationManager();
    }
});