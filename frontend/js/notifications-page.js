class NotificationsPage {
    constructor() {
        this.currentFilter = "all";
        this.currentPage = 1;
        this.hasMore = true;
        this.isLoading = false;
        this.unreadNotificationIds = [];
        this.init();
    }

    init() {
        if (document.getElementById("notificationsContainer")) {
            this.loadUserData();
            this.attachEventListeners();
            this.loadNotifications();
        }
    }

    // --- Data Loading & Auth ---

    async loadUserData() {
        try {
            const response = await fetch("/api/auth/me", { credentials: "include" });
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    this.updateUserInterface(data.user);
                }
            }
        } catch (error) {
            console.log("User not logged in or API unavailable");
        }
    }

    updateUserInterface(user) {
        if (!user) return;

        const userNameElements = document.querySelectorAll(
            "#sidebarUserName, .user-info h4"
        );
        const userAvatarElements = document.querySelectorAll(
            "#userAvatar, #sidebarAvatar"
        );

        const safeName = this.safeText(user.display_name || user.username);

        userNameElements.forEach((el) => {
            el.textContent = safeName;
        });

        userAvatarElements.forEach((el) => {
            el.src = user.avatar_url || "/images/default-avatar.png";
            el.onerror = function () {
                this.onerror = null;
                this.src = "/images/default-avatar.png";
            };
        });
    }

    // --- Event Handling ---

    attachEventListeners() {
        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                this.handleFilterChange(e.target.dataset.filter);
            });
        });

        document
            .getElementById("markAllRead")
            ?.addEventListener("click", () => this.markAllAsReadClientSide());
        document
            .getElementById("clearAll")
            ?.addEventListener("click", () => this.clearAllNotifications());
        document
            .getElementById("loadMoreNotifications")
            ?.addEventListener("click", () => this.loadMoreNotifications());

        const userAvatar = document.getElementById("userAvatar");
        const userDropdown = document.getElementById("userDropdown");

        if (userAvatar && userDropdown) {
            userAvatar.addEventListener("click", (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle("hidden");
            });

            document.addEventListener("click", (e) => {
                if (
                    !userAvatar.contains(e.target) &&
                    !userDropdown.contains(e.target)
                ) {
                    userDropdown.classList.add("hidden");
                }
            });
        }
    }

    handleFilterChange(filter) {
        document
            .querySelectorAll(".tab-btn")
            .forEach((btn) => btn.classList.remove("active"));
        document
            .querySelector(`[data-filter="${filter}"]`)
            ?.classList.add("active");

        this.currentFilter = filter;
        this.currentPage = 1;
        this.hasMore = true;
        this.loadNotifications(true);
    }

    // --- Core Notification Logic ---

    async loadNotifications(isFilterChange = false) {
        if (this.isLoading && !isFilterChange) return;

        this.isLoading = true;
        if (this.currentPage === 1) this.showLoading();

        try {
            const response = await fetch(
                `/api/notifications?filter=${this.currentFilter}&page=${this.currentPage}`,
                { credentials: "include" }
            );

            if (!response.ok) throw new Error("Failed to load notifications");

            const data = await response.json();
            const notifications = Array.isArray(data.notifications)
                ? data.notifications
                : [];

            // Track unread ids
            if (notifications.length) {
                const newUnread = notifications
                    .filter((n) => !n.is_read && !n.read)
                    .map((n) => n.id);
                this.unreadNotificationIds = [
                    ...new Set([...this.unreadNotificationIds, ...newUnread]),
                ];
            }

            this.displayNotifications(notifications, this.currentPage === 1);

            // ✅ read pagination.hasMore (backend sends pagination object)
            const pagination = data.pagination || {};
            this.hasMore = !!pagination.hasMore;

            this.updateLoadMoreButton();
        } catch (error) {
            console.error("Error loading notifications:", error);
            this.showError("Failed to load notifications.");
        } finally {
            this.isLoading = false;
        }
    }

    displayNotifications(notifications, clearExisting) {
        const container = document.getElementById("notificationsContainer");
        const emptyState = document.getElementById("emptyState");

        if (!container) return;

        if (clearExisting) container.innerHTML = "";

        if ((!notifications || notifications.length === 0) && this.currentPage === 1) {
            container.classList.add("hidden");
            emptyState?.classList.remove("hidden");
            return;
        }

        emptyState?.classList.add("hidden");
        container.classList.remove("hidden");

        const uniqueNotifications = Array.from(
            new Map(notifications.map((n) => [n.id, n])).values()
        );

        const fragment = document.createDocumentFragment();
        uniqueNotifications.forEach((notification) => {
            const notificationElement =
                this.createNotificationElement(notification);
            fragment.appendChild(notificationElement);
        });
        container.appendChild(fragment);
    }

    createNotificationElement(notification) {
        const div = document.createElement("div");
        const isRead = notification.read || notification.is_read;
        div.className = `notification-item ${isRead ? "" : "unread"}`;
        div.dataset.notificationId = notification.id;

        const iconClass = `type-${notification.type}`;
        const timeAgo = this.formatTimeAgo(notification.created_at);
        const actorAvatar =
            notification.actor?.avatar_url ||
            notification.actor_avatar_url ||
            "/images/default-avatar.png";

        div.innerHTML = `
            <div class="notification-icon ${iconClass}">
                <img 
                    src="${actorAvatar}" 
                    class="notif-avatar" 
                    alt="User Avatar"
                    onerror="this.onerror=null;this.src='/images/default-avatar.png';"
                >
            </div>
            <div class="notification-content">
                <p class="notification-text">${this.formatNotificationText(
                    notification
                )}</p>
                <div class="notification-meta">
                    <span class="notification-time">${timeAgo}</span>
                    ${
                        notification.context
                            ? `<span class="notification-context">${this.safeText(
                                  notification.context
                              )}</span>`
                            : ""
                    }
                </div>
                ${
                    !isRead
                        ? `
                    <div class="notification-actions">
                        <button class="notification-action-btn" data-id="${
                            notification.id
                        }" data-action="mark-read">Mark as read</button>
                    </div>
                `
                        : ""
                }
            </div>
            ${!isRead ? '<div class="unread-dot"></div>' : ""}
        `;

        // Click on notification item (except buttons)
        div.addEventListener("click", (e) => {
            if (!e.target.closest(".notification-action-btn")) {
                this.handleNotificationClick(notification);
            }
        });

        // Mark-read button
        const markReadBtn = div.querySelector('[data-action="mark-read"]');
        if (markReadBtn) {
            markReadBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.markAsRead(notification.id);
            });
        }

        return div;
    }

    /**
     * ✅ FIXED: Always respects backend message
     * - Uses notification.message if present
     * - Only falls back to type-based text when message is missing
     * - Avoids weird text like "commented on your 20"
     */
    formatNotificationText(notification) {
        if (notification.message) {
            // Backend already builds: "Kishore commented on your post"
            return this.safeText(notification.message);
        }

        const actorName =
            notification.actor_display_name ||
            (notification.actor && notification.actor.display_name) ||
            notification.actor_username ||
            (notification.actor && notification.actor.username) ||
            "Someone";
        const safeName = this.safeText(actorName);

        switch (notification.type) {
            case "like":
                return `${safeName} liked your post`;
            case "comment":
                return `${safeName} commented on your post`;
            case "follow":
                return `${safeName} started following you`;
            case "message":
                return `${safeName} sent you a message`;
            case "system":
                return this.safeText(notification.message || "System notification");
            default:
                return this.safeText(
                    notification.message || "You have a new notification"
                );
        }
    }

    async handleNotificationClick(notification) {
        // Mark as read if needed
        if (!notification.read && !notification.is_read) {
            this.optimisticMarkAsRead(notification.id);
            this.markAsRead(notification.id);
        }

        // ✅ Prefer backend link when provided
        if (notification.link) {
            window.location.href = notification.link;
            return;
        }

        // Fallback logic (in case older notifications lack `link`)
        const data = notification.data || {};

        switch (notification.type) {
            case "like":
            case "comment":
                if (data.post_id) {
                    window.location.href = `/post.html?id=${data.post_id}`;
                }
                break;
            case "follow":
                if (data.user_id) {
                    window.location.href = `/profile.html?user=${data.user_id}`;
                }
                break;
            case "message":
                if (data.conversation_id) {
                    window.location.href = `/messages.html?conversation=${data.conversation_id}`;
                }
                break;
            default:
                break;
        }
    }

    optimisticMarkAsRead(notificationId) {
        const item = document.querySelector(
            `.notification-item[data-notification-id="${notificationId}"]`
        );
        if (item) {
            item.classList.remove("unread");
            item.querySelector(".unread-dot")?.remove();
            item.querySelector(".notification-actions")?.remove();
        }
    }

    async markAsRead(notificationId) {
        try {
            this.optimisticMarkAsRead(notificationId);
            await fetch(`/api/notifications/${notificationId}/read`, {
                method: "POST",
                credentials: "include",
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }

    async markAllAsReadClientSide() {
        if (!this.unreadNotificationIds || this.unreadNotificationIds.length === 0) {
            const unreadElements = document.querySelectorAll(
                ".notification-item.unread"
            );
            unreadElements.forEach((el) => {
                const id = el.dataset.notificationId;
                if (id) this.unreadNotificationIds.push(id);
            });
        }

        if (this.unreadNotificationIds.length === 0) return;

        document
            .querySelectorAll(".notification-item.unread")
            .forEach((item) => {
                item.classList.remove("unread");
                item.querySelector(".unread-dot")?.remove();
                item.querySelector(".notification-actions")?.remove();
            });

        const promises = this.unreadNotificationIds.map((id) =>
            fetch(`/api/notifications/${id}/read`, {
                method: "POST",
                credentials: "include",
            }).catch((err) => console.error(`Failed to mark ${id}`, err))
        );

        this.unreadNotificationIds = [];
        await Promise.allSettled(promises);
    }

    async clearAllNotifications() {
        if (!confirm("Are you sure you want to clear all notifications?")) return;

        try {
            const response = await fetch("/api/notifications/clear-all", {
                method: "DELETE",
                credentials: "include",
            });

            if (response.ok) {
                const container = document.getElementById("notificationsContainer");
                const emptyState = document.getElementById("emptyState");
                if (container) container.innerHTML = "";
                emptyState?.classList.remove("hidden");
                document
                    .getElementById("loadMoreContainer")
                    ?.classList.add("hidden");
            }
        } catch (error) {
            console.error("Error clearing notifications:", error);
        }
    }

    async loadMoreNotifications() {
        if (this.isLoading || !this.hasMore) return;
        this.currentPage++;
        await this.loadNotifications();
    }

    updateLoadMoreButton() {
        const container = document.getElementById("loadMoreContainer");
        if (container) {
            container.classList.toggle("hidden", !this.hasMore);
        }
    }

    showLoading() {
        const container = document.getElementById("notificationsContainer");
        if (!container) return;
        container.innerHTML = `
            <div class="loading-notifications">
                <div class="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById("notificationsContainer");
        if (!container) return;

        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Error</h3>
                <p>${this.safeText(message)}</p>
                <button class="retry-btn" id="retryBtn">Try Again</button>
            </div>
        `;

        document.getElementById("retryBtn")?.addEventListener("click", () => {
            this.currentPage = 1;
            this.loadNotifications(true);
        });
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }

    safeText(str) {
        if (!str) return "";
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }
}

// ✅ Inline page-specific CSS (spinner, error state, avatar)
const pageErrorStyles = `
    .error-state { text-align: center; padding: 40px 20px; color: #e74c3c; }
    .error-icon { font-size: 48px; margin-bottom: 16px; }
    .retry-btn { background: #ff4b8d; color: white; border: none; border-radius: 6px; padding: 10px 20px; margin-top: 16px; cursor: pointer; transition: background-color 0.2s; }
    .retry-btn:hover { background: #d9417c; }
    .loading-notifications { text-align: center; padding: 20px; color: #666; }
    .loading-spinner { border: 4px solid #f3f3f3; border-top: 4px solid #ff4b8d; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px; }
    .notif-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        border: 2px solid #fff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = pageErrorStyles;
document.head.appendChild(styleSheet);

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("notificationsContainer")) {
        window.notificationsPage = new NotificationsPage();
    }
});
