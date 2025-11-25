/**
 * frontend/js/social-features.js — Lovculator 💖
 * Unified Social Logic: Follow, Like, Message, and User Cards.
 * Replaces duplicate logic in feed.js and love-stories.js
 */

class SocialFeatures {
    constructor() {
        this.apiBase = window.API_BASE || '/api';
        this.currentUser = window.currentUserId || null;
        
        // Wait for DOM to be ready before attaching global listeners
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('👥 Social Features Initializing...');
        this.setupGlobalListeners();
        this.checkAuth();
    }

    async checkAuth() {
        try {
            const res = await fetch(`${this.apiBase}/auth/me`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                this.currentUser = data.user?.id || data.id;
                window.currentUserId = this.currentUser;
            }
        } catch (e) { console.warn("Auth check failed in SocialFeatures"); }
    }

    // ============================================================
    // 👂 GLOBAL EVENT LISTENERS (The "Magic" Glue)
    // ============================================================
    setupGlobalListeners() {
        document.body.addEventListener('click', (e) => {
            // 1. FOLLOW BUTTONS
            const followBtn = e.target.closest('.follow-toggle-btn, .follow-btn, .action-btn.follow-btn');
            if (followBtn) {
                e.preventDefault();
                e.stopPropagation();
                this.handleFollowClick(followBtn);
            }

            // 2. LIKE BUTTONS
            const likeBtn = e.target.closest('.like-btn, .like-button, .story-action.like-button');
            if (likeBtn) {
                // Determine type based on data attributes or context
                const isStory = likeBtn.closest('.story-card');
                const type = isStory ? 'story' : 'post';
                const id = likeBtn.dataset.id || likeBtn.dataset.storyId || likeBtn.closest('[data-id]')?.dataset.id || likeBtn.closest('[data-story-id]')?.dataset.storyId;
                
                if (id) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleLikeClick(id, type, likeBtn);
                }
            }

            // 3. MESSAGE BUTTONS
            const msgBtn = e.target.closest('.message-btn, [data-action="message-user"]');
            if (msgBtn) {
                e.preventDefault();
                this.handleMessageClick(msgBtn.dataset.userId);
            }
        });
    }

    // ============================================================
    // 🔗 FOLLOW LOGIC
    // ============================================================
    async handleFollowClick(btn) {
        if (!this.currentUser) return this.requireLogin();

        const targetId = btn.dataset.userId || btn.dataset.authorId;
        if (!targetId) return console.error("No user ID on follow button");

        // Prevent self-follow
        if (String(targetId) === String(this.currentUser)) {
            return this.showNotification("You cannot follow yourself.", "warning");
        }

        // Get state from button class/text
        const isFollowing = btn.classList.contains('following') || 
                            btn.textContent.toLowerCase().includes('following');
        
        // Optimistic UI Update
        btn.disabled = true;
        const originalText = btn.textContent;
        
        btn.classList.toggle('following');
        btn.classList.toggle('btn-primary'); // Toggle styles if used
        btn.classList.toggle('btn-secondary');
        btn.textContent = isFollowing ? '+ Follow' : 'Following';

        try {
            const method = isFollowing ? 'DELETE' : 'POST';
            const res = await fetch(`${this.apiBase}/users/${targetId}/follow`, {
                method: method,
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Request failed');
            
            const data = await res.json();
            
            // Update all other follow buttons for this same user on the page
            this.syncFollowButtons(targetId, !isFollowing);
            this.showNotification(isFollowing ? 'Unfollowed user.' : 'Following user!', 'success');

        } catch (error) {
            console.error("Follow error:", error);
            // Revert UI
            btn.textContent = originalText;
            btn.classList.toggle('following');
            this.showNotification("Action failed. Please try again.", "error");
        } finally {
            btn.disabled = false;
        }
    }

    syncFollowButtons(userId, isFollowing) {
        const allButtons = document.querySelectorAll(`[data-user-id="${userId}"], [data-author-id="${userId}"]`);
        allButtons.forEach(b => {
            if (b.classList.contains('follow-toggle-btn') || b.classList.contains('follow-btn')) {
                b.classList.toggle('following', isFollowing);
                b.textContent = isFollowing ? 'Following' : '+ Follow';
            }
        });
    }

    // ============================================================
    // ❤️ LIKE LOGIC
    // ============================================================
    async handleLikeClick(id, type, btn) {
        if (!this.currentUser) return this.requireLogin();

        // Debounce/Disable
        if (btn.disabled) return;
        btn.disabled = true;

        try {
            // API: /api/posts/123/like OR /api/stories/123/like
            // Note: Ensure backend supports plural (posts/stories)
            const endpoint = type === 'story' ? 'stories' : 'posts';
            
            const res = await fetch(`${this.apiBase}/${endpoint}/${id}/like`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!res.ok) throw new Error('Like failed');

            const data = await res.json();
            const newCount = data.like_count || data.likes_count || 0;
            const isLiked = data.is_liked || data.user_liked;

            // Update UI
            btn.classList.toggle('liked', isLiked);
            
            // Update count span inside button
            const countSpan = btn.querySelector('span.count, .like-count');
            if (countSpan) countSpan.textContent = newCount;

            // Optional: Animation effect
            if (isLiked) this.animateHeart(btn);

        } catch (error) {
            console.error("Like error:", error);
        } finally {
            setTimeout(() => btn.disabled = false, 500); // Small delay to prevent spam
        }
    }

    animateHeart(btn) {
        const icon = btn.querySelector('svg');
        if (icon) {
            icon.style.transform = 'scale(1.3)';
            setTimeout(() => icon.style.transform = 'scale(1)', 200);
        }
    }

    // ============================================================
    // 💌 MESSAGING LOGIC
    // ============================================================
    handleMessageClick(userId) {
        if (!this.currentUser) return this.requireLogin();
        
        // Redirect to messages page with user selected
        window.location.href = `/messages.html?user=${userId}`;
    }

    // ============================================================
    // 🎨 UI HELPERS (The "Renderers")
    // ============================================================
    
    /**
     * Generates the User Header HTML (Avatar, Name, Date, Follow Btn)
     * Used by both Feed Cards and Story Cards.
     */
    renderUserHeader(user, dateStr, options = {}) {
        const { isOwner, isFollowing } = options;
        const timeAgo = this.timeSince(new Date(dateStr));
        const avatar = user.avatar_url || '/images/default-avatar.png';
        const name = user.display_name || user.username || 'User';
        const profileLink = `/profile.html?user=${encodeURIComponent(user.username)}`;

        // Follow button HTML (only if not owner)
        const followBtn = (!isOwner && this.currentUser) ? `
            <button class="follow-toggle-btn ${isFollowing ? 'following' : ''}" 
                    data-user-id="${user.id}">
                ${isFollowing ? 'Following' : '+ Follow'}
            </button>
        ` : '';

        return `
            <div class="unified-user-header">
                <a href="${profileLink}" class="avatar-link">
                    <img src="${avatar}" alt="${name}" class="user-avatar-img" onerror="this.src='/images/default-avatar.png'"/>
                </a>
                <div class="user-meta">
                    <a href="${profileLink}" class="user-name-link">
                        <h4>${name}</h4>
                    </a>
                    <span class="post-time">${timeAgo}</span>
                </div>
                ${followBtn}
            </div>
        `;
    }

    // ============================================================
    // 🛠 UTILS
    // ============================================================
    requireLogin() {
        this.showNotification("Please log in to continue.", "warning");
        setTimeout(() => window.location.href = '/login.html', 1500);
    }

    showNotification(msg, type = 'info') {
        // Use existing notification service if available, else alert
        if (window.notificationService) {
            type === 'error' ? window.notificationService.showError(msg) : window.notificationService.showSuccess(msg);
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
            // Optional: Create a simple toast if none exists
        }
    }

    timeSince(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return "Just now";
    }
}

// Initialize Global Instance
window.socialFeatures = new SocialFeatures();