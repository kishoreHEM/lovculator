// js/social-features.js

// Assuming socialAPI and authManager are globally available
const api = window.socialAPI;

class SocialFeatures {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('👥 Social Features initialized: Action handlers ready.');
    }

    setupEventListeners() {
        // Global click handlers for social actions
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');

            if (target && target.classList.contains('follow-btn')) {
                this.handleFollow(target);
            }
            if (target && target.classList.contains('message-btn')) {
                this.handleMessage(target);
            }
            // Add other handlers here (e.g., friend-request-btn)
        });
    }

    // ========================
    // PROFILE DISPLAY (Used by ProfileManager)
    // ========================

    displayUserProfile(profile, isCurrentUser) {
        const container = document.getElementById('userProfileContainer');
        if (!container) return;

        // NOTE: This render output should be uniform across SocialFeatures and ProfileManager's initial structure
        container.innerHTML = `
            <div class="user-profile-card enhanced" data-user-id="${profile.id}">
                <div class="profile-cover" style="background: linear-gradient(135deg, #667eea, #764ba2); height: 120px; border-radius: 12px 12px 0 0;"></div>
                
                <div class="profile-header">
                    <div class="avatar-section">
                        <div class="profile-avatar">${profile.avatar_url || '💖'}</div>
                        <div class="profile-actions">
                            ${!isCurrentUser ? `
                                <button class="action-btn message-btn" data-user-id="${profile.id}">
                                    💌 Message
                                </button>
                                <button class="action-btn follow-btn ${this.isFollowing(profile.id) ? 'following' : ''}" 
                                        data-user-id="${profile.id}">
                                    ${this.isFollowing(profile.id) ? 'Following' : 'Follow'}
                                </button>
                            ` : ''}
                            </div>
                    </div>
                    
                    <div class="profile-info">
                        <h2>${profile.display_name || profile.username}</h2>
                        <p class="username">@${profile.username}</p>
                        <p class="user-bio">${profile.bio || 'No bio yet'}</p>
                        
                        <div class="profile-details">
                            ${profile.location ? `<span class="detail">📍 ${profile.location}</span>` : ''}
                            ${profile.relationship_status ? `<span class="detail">💕 ${profile.relationship_status}</span>` : ''}
                            <span class="detail">📅 Joined ${new Date(profile.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div class="profile-stats">
                    <div class="stat">
                        <span class="number" data-stat="stories">${profile.story_count || 0}</span>
                        <span class="label">Love Stories</span>
                    </div>
                    <div class="stat">
                        <span class="number" data-stat="followers">${profile.follower_count || 0}</span>
                        <span class="label">Followers</span>
                    </div>
                    <div class="stat">
                        <span class="number" data-stat="following">${profile.following_count || 0}</span>
                        <span class="label">Following</span>
                    </div>
                </div>
                
                </div>
        `;

        // ProfileManager handles tab setup
    }

    // ========================
    // FOLLOW SYSTEM
    // ========================

    async handleFollow(button) {
        const userId = button.dataset.userId;
        const isFollowing = button.classList.contains('following');

        try {
            if (isFollowing) {
                await api.unfollowUser(userId);
                button.classList.remove('following');
                button.textContent = 'Follow';
                // Update stat count in UI
                this.updateStatCount('followers', -1);
                this.showNotification('Unfollowed user', 'success');
            } else {
                await api.followUser(userId);
                button.classList.add('following');
                button.textContent = 'Following';
                // Update stat count in UI
                this.updateStatCount('followers', 1);
                this.showNotification('Now following user', 'success');
            }
        } catch (error) {
            console.error('Error following user:', error);
            this.showNotification('Failed to follow user', 'error');
        }
    }

    isFollowing(userId) {
        // Placeholder: Replace with logic to check local user state
        return false;
    }

    async getFollowers(userId) {
        // Uses SocialAPI to fetch data
        try {
            const followers = await api.getFollowers(userId);
            this.displayUsers(followers, document.getElementById('followersContainer'), 'followers');
        } catch (error) {
            this.displayEmptyState(document.getElementById('followersContainer'), 'Failed to load followers.');
        }
    }

    async getFollowing(userId) {
        // Uses SocialAPI to fetch data
        try {
            const following = await api.getFollowing(userId);
            this.displayUsers(following, document.getElementById('followingContainer'), 'following');
        } catch (error) {
            this.displayEmptyState(document.getElementById('followingContainer'), 'Failed to load who this user follows.');
        }
    }
    
    // ... (Add direct message handlers, etc.) ...
    
    // ========================
    // UI HELPERS (Moved from ProfileManager)
    // ========================

    displayUsers(users, container, listType) {
        if (!users || users.length === 0) {
            const message = listType === 'followers' ? 'No followers yet.' : 'Not following anyone yet.';
            return this.displayEmptyState(container, message);
        }

        container.innerHTML = users.map(user => `
            <div class="user-card">
                <div class="user-avatar">${user.avatar_url || '💖'}</div>
                <div class="user-info">
                    <h4>${user.display_name || user.username}</h4>
                    <p class="user-bio">${user.bio || 'No bio'}</p>
                </div>
                <button class="action-btn follow-btn ${this.isFollowing(user.id) ? 'following' : ''}" 
                        data-user-id="${user.id}">
                    ${this.isFollowing(user.id) ? 'Following' : 'Follow'}
                </button>
            </div>
        `).join('');
    }
    
    updateStatCount(statName, delta) {
        const statSpan = document.querySelector(`.profile-stats [data-stat="${statName}"]`);
        if (statSpan) {
            statSpan.textContent = parseInt(statSpan.textContent) + delta;
        }
    }
    
    displayEmptyState(container, message) {
         container.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
    }

    showNotification(message, type = 'info') {
        // Assuming ProfileManager's notification system is global or easy to access
        window.profileManager?.showNotification(message, type);
    }

    // Placeholder for other interaction handlers (e.g., messages)
    handleMessage(button) {
        this.showNotification(`Opening message modal for user ${button.dataset.userId}`, 'info');
        // Implement modal logic here
    }
}

const socialFeatures = new SocialFeatures();
window.socialFeatures = socialFeatures; // Make global for ProfileManager access