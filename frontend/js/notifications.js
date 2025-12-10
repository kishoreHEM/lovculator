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
    this.setupNotificationHandlers();
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
  // 🧷 UI BINDINGS
  // ================================
  setupNotificationHandlers() {
    const notificationsBtn = document.getElementById("notificationsBtn");
    const messagesBtn = document.getElementById("messagesBtn");

    if (notificationsBtn) {
      notificationsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showNotifications();
      });
    }

    if (messagesBtn) {
      messagesBtn.addEventListener("click", () => {
        window.location.href = "/messages.html";
      });
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

      const data = res.ok ? await res.json() : { notifications: [] };
      const notifications = Array.isArray(data.notifications)
        ? data.notifications
        : [];

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
    if (!btn) return;

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
    const { message } = notification;

    // Backend already formats the text? Use it.
    if (message) return this.safeText(message);

    const actorName =
      notification.actor_display_name ||
      notification.actor_username ||
      "Someone";

    return `<strong>${this.safeText(actorName)}</strong> sent you a notification`;
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
    // Support both id & class
    const badge =
      document.getElementById("notificationsBadge") ||
      document.querySelector(".notification-badge");

    if (!badge) return;

    if (this.notificationCount > 0) {
      badge.textContent =
        this.notificationCount > 99 ? "99+" : String(this.notificationCount);
      badge.style.display = "flex";
    } else {
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
        badge.style.display = "flex";
      } else {
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
    console.log("🔔 WebSocket Notification:", data);

    // Payload shapes to support:
    // { type: 'NEW_NOTIFICATION', notification: {...} }
    // { type: 'NEW_NOTIFICATION', ...notificationFields }
    const notification = data.notification || data;

    // 1. Update count
    this.notificationCount++;
    this.updateNotificationBadgeUI();

    // 2. Toast text
    const msgText =
      notification.message ||
      data.message ||
      "You have a new notification";
    this.showToast(msgText);
  }

  handleNewMessage(data) {
    console.log("💌 WebSocket Message Notification:", data);
    this.updateMessageBadge();

    // If not already on messages page, show toast
    if (!window.location.pathname.includes("messages")) {
      const msg = data.message || {};
      const sender =
        msg.sender_display_name ||
        msg.sender_username ||
        msg.from_username ||
        "Someone";
      this.showToast(`New message from ${sender}`);
    }
  }

  // ================================
  // 🍞 TOAST UI
  // ================================
  showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-popup";
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span>🔔</span>
        <span>${this.safeText(message)}</span>
      </div>
    `;

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 14px;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    }, 50);

    // Animate out
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ================================
  // ⏱ BACKUP POLLING
  // ================================
  startAutoRefresh() {
    if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);

    this.autoRefreshInterval = setInterval(() => {
      this.updateNotificationBadge();
      this.updateMessageBadge();
    }, 60000); // every 60s
  }
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
  // Only init if something related exists on the page
  if (
    document.getElementById("notificationsBtn") ||
    document.getElementById("notificationsBadge") ||
    document.querySelector(".notification-badge")
  ) {
    window.notificationManager = new NotificationManager();
  }
});
