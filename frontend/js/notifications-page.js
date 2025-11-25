class NotificationsPage {
    constructor() {
        this.currentFilter = 'all';
        this.currentPage = 1;
        this.hasMore = true;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.loadUserData();
        this.attachEventListeners();
        this.loadNotifications();
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // 🟢 FIX 1: Extract the nested 'user' object from the API response
                if (data.success && data.user) {
                    this.updateUserInterface(data.user);
                }
            }
        } catch (error) {
            console.log('User not logged in');
        }
    }

    updateUserInterface(user) {
        const userNameElements = document.querySelectorAll('#sidebarUserName, .user-info h4');
        const userAvatarElements = document.querySelectorAll('#userAvatar, #sidebarAvatar');

        // Check if user object exists before trying to access properties
        if (!user) return; 

        userNameElements.forEach(el => {
            // Use display_name or fallback to username
            el.textContent = user.display_name || user.username; 
        });

        userAvatarElements.forEach(el => {
            // Use avatar_url or fallback to default image
            el.src = user.avatar_url || '/images/default-avatar.png'; 
        });
    }

    attachEventListeners() {
        // Filter tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFilterChange(e.target.dataset.filter);
            });
        });

        // Action buttons
        document.getElementById('markAllRead')?.addEventListener('click', () => {
            this.markAllAsRead();
        });

        document.getElementById('clearAll')?.addEventListener('click', () => {
            this.clearAllNotifications();
        });

        // Load more
        document.getElementById('loadMoreNotifications')?.addEventListener('click', () => {
            this.loadMoreNotifications();
        });

        // User menu
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');

        if (userAvatar && userDropdown) {
            userAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                // Only hide if the click target is not the avatar or inside the dropdown
                if (!userAvatar.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.add('hidden');
                }
            });
        }
    }

    handleFilterChange(filter) {
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        // Ensure the element exists before adding active class
        document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');

        // Reset and load with new filter
        this.currentFilter = filter;
        this.currentPage = 1;
        this.hasMore = true;
        this.loadNotifications(true); // true to indicate a filter change and full clear
    }

    async loadNotifications(isFilterChange = false) {
        if (this.isLoading && !isFilterChange) return;
        
        this.isLoading = true;
        
        // Show loading state only on first load or filter change
        if (this.currentPage === 1) {
             this.showLoading();
        }

        try {
            const response = await fetch(`/api/notifications?filter=${this.currentFilter}&page=${this.currentPage}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.displayNotifications(data.notifications, this.currentPage === 1);
                this.hasMore = data.hasMore;
                this.updateLoadMoreButton();
            } else {
                throw new Error('Failed to load notifications');
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            this.showError('Failed to load notifications');
        } finally {
            this.isLoading = false;
        }
    }

    displayNotifications(notifications, clearExisting) {
        const container = document.getElementById('notificationsContainer');
        const emptyState = document.getElementById('emptyState');

        // Clear container if it's the first page load or a filter change
        if (clearExisting) {
            container.innerHTML = '';
        }

        if (notifications.length === 0 && this.currentPage === 1) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.classList.remove('hidden');

        notifications.forEach(notification => {
            const notificationElement = this.createNotificationElement(notification);
            container.appendChild(notificationElement);
        });
    }

    createNotificationElement(notification) {
        const div = document.createElement('div');
        div.className = `notification-item ${notification.read ? '' : 'unread'}`;
        div.dataset.notificationId = notification.id; // Added data attribute for targeting
        
        const iconClass = this.getNotificationIconClass(notification.type);
        const timeAgo = this.formatTimeAgo(notification.created_at);
        const actorAvatar = notification.actor?.avatar_url || "/images/default-avatar.png";

        div.innerHTML = `
            <div class="notification-icon ${iconClass}">
                <img src="${actorAvatar}" class="notif-avatar" alt="User Avatar">
            </div>
            <div class="notification-content">
                <p class="notification-text">${this.formatNotificationText(notification)}</p>
                <div class="notification-meta">
                    <span class="notification-time">${timeAgo}</span>
                    ${notification.context ? `<span class="notification-context">${notification.context}</span>` : ''}
                </div>
                ${!notification.read ? `
                    <div class="notification-actions">
                        <button class="notification-action-btn" data-id="${notification.id}" data-action="mark-read">
                            Mark as read
                        </button>
                    </div>
                ` : ''}
            </div>
            ${!notification.read ? '<div class="unread-dot"></div>' : ''}
        `;

        // Add click handler
        div.addEventListener('click', (e) => {
            // Check if click target is NOT the action button
            if (!e.target.closest('.notification-action-btn')) {
                this.handleNotificationClick(notification);
            }
        });

        // Add action button handlers
        const markReadBtn = div.querySelector('[data-action="mark-read"]');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the main div click handler
                this.markAsRead(notification.id);
            });
        }

        return div;
    }
    
    // Note: Removed redundant getNotificationIcon as actor avatar is used in createNotificationElement
    
    getNotificationIconClass(type) {
        // Can be used to apply type-specific styles
        return `type-${type}`;
    }

    formatNotificationText(notification) {
    const { type, actor, message, data } = notification;

    const username = actor?.display_name || actor?.username || 'Someone';

    switch (type) {
        case 'like':
            return `<strong>${username}</strong> liked your ${data?.post_type === 'story' ? 'love story' : 'post'}`;
        case 'comment':
            return `<strong>${username}</strong> commented on your ${data?.post_type === 'story' ? 'love story' : 'post'}`;
        case 'follow':
            return `<strong>${username}</strong> started following you`;
        case 'message':
            return `<strong>${username}</strong> sent you a message`;
        case 'system':
            return message;
        default:
            return message || 'A new event occurred'; // Fallback
    }
}


    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    async handleNotificationClick(notification) {
        // Mark as read
        if (!notification.read) {
            // Optimistically update UI before API call for better perceived performance
            this.optimisticMarkAsRead(notification.id);
            await this.markAsRead(notification.id);
        }

        // Navigate using the link from backend if available
        if (notification.link) {
            window.location.href = notification.link;
            return;
        }

        // Fallback navigation based on notification type
        switch (notification.type) {
            case 'like':
            case 'comment':
                if (notification.data.post_id) {
                    window.location.href = `/post.html?id=${notification.data.post_id}`;
                }
                break;
            case 'follow':
                if (notification.data.user_id) {
                    window.location.href = `/profile.html?user=${notification.data.user_id}`;
                }
                break;
            case 'message':
                if (notification.data.conversation_id) {
                    window.location.href = `/messages.html?conversation=${notification.data.conversation_id}`;
                }
                break;
        }
    }

    optimisticMarkAsRead(notificationId) {
        const item = document.querySelector(`.notification-item[data-notification-id="${notificationId}"]`);
        if (item) {
            item.classList.remove('unread');
            item.querySelector('.unread-dot')?.remove();
            item.querySelector('.notification-actions')?.remove();
        }
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                 // Optionally revert optimistic changes or show error if API fails
                 console.error('API failed to mark notification as read');
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Optionally revert optimistic changes or show error
        }
    }

    async markAllAsRead() {
        try {
            const response = await fetch('/api/notifications/mark-all-read', {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                // Update all notifications in UI
                document.querySelectorAll('.notification-item.unread').forEach(item => {
                    item.classList.remove('unread');
                    item.querySelector('.unread-dot')?.remove();
                    item.querySelector('.notification-actions')?.remove();
                });
            } else {
                throw new Error('Failed to mark all as read');
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
            alert('Failed to mark all notifications as read');
        }
    }

    async clearAllNotifications() {
        if (!confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch('/api/notifications/clear-all', {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                // Clear UI
                document.getElementById('notificationsContainer').innerHTML = '';
                document.getElementById('emptyState').classList.remove('hidden');
                document.getElementById('loadMoreContainer')?.classList.add('hidden');
            } else {
                throw new Error('Failed to clear notifications');
            }
        } catch (error) {
            console.error('Error clearing notifications:', error);
            alert('Failed to clear notifications');
        }
    }

    async loadMoreNotifications() {
        if (this.isLoading || !this.hasMore) return;

        this.currentPage++;
        await this.loadNotifications();
    }

    updateLoadMoreButton() {
        const container = document.getElementById('loadMoreContainer');
        if (!container) return;
        
        if (this.hasMore) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    showLoading() {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="loading-notifications">
                <div class="loading-spinner"></div>
                <p>Loading notifications...</p>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Error loading notifications</h3>
                <p>${message}</p>
                <button class="retry-btn" id="retryBtn">Try Again</button>
            </div>
        `;
        
        // 🟢 FIX 2: Attach the event listener here to access 'this' correctly
        document.getElementById('retryBtn')?.addEventListener('click', () => {
            this.currentPage = 1; // Reset to page 1 for a clean retry
            this.loadNotifications();
        });
    }
}


// Add error state styles (Good practice to keep styles separate, but included here for completeness)
const errorStyles = `
    .error-state {
        text-align: center;
        padding: 40px 20px;
        color: #e74c3c;
    }
    .error-icon {
        font-size: 48px;
        margin-bottom: 16px;
    }
    .retry-btn {
        background: #ff4b8d;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 20px;
        margin-top: 16px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .retry-btn:hover {
        background: #d9417c;
    }
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = errorStyles;
document.head.appendChild(styleSheet);


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.notificationsPage = new NotificationsPage();
});

// ❌ The broken listener outside the class has been removed.