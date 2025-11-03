// Social Features Manager
class SocialFeatures {
    constructor() {
        this.api = new SocialAPI();
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        this.setupEventListeners();
        console.log('👥 Social Features initialized');
    }

    async loadCurrentUser() {
        // Get current user from your existing user system
        this.currentUser = window.userProfiles?.currentUser;
        return this.currentUser;
    }

    setupEventListeners() {
        // Global click handlers for social actions
        document.addEventListener('click', (e) => {
            if (e.target.closest('.follow-btn')) {
                this.handleFollow(e.target.closest('.follow-btn'));
            }
            if (e.target.closest('.friend-request-btn')) {
                this.handleFriendRequest(e.target.closest('.friend-request-btn'));
            }
            if (e.target.closest('.message-btn')) {
                this.handleMessage(e.target.closest('.message-btn'));
            }
        });
    }

    // ========================
    // PROFILE MANAGEMENT
    // ========================

    async getUserProfile(username) {
        try {
            const profile = await this.api.getUserProfile(username);
            this.displayUserProfile(profile);
            return profile;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            this.showError('Failed to load profile');
        }
    }

    async updateUserProfile(profileData) {
        try {
            const updatedProfile = await this.api.updateUserProfile(this.currentUser.id, profileData);
            this.currentUser = { ...this.currentUser, ...updatedProfile };
            this.displayUserProfile(updatedProfile);
            this.showSuccess('Profile updated successfully!');
            return updatedProfile;
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showError('Failed to update profile');
        }
    }

    displayUserProfile(profile) {
        const container = document.getElementById('userProfileContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="user-profile-card enhanced">
                <div class="profile-cover" style="background: linear-gradient(135deg, #667eea, #764ba2); height: 120px; border-radius: 12px 12px 0 0;"></div>
                
                <div class="profile-header">
                    <div class="avatar-section">
                        <div class="profile-avatar">${profile.avatar_url || '💖'}</div>
                        <div class="profile-actions">
                            <button class="action-btn message-btn" data-user-id="${profile.id}">
                                💌 Message
                            </button>
                            <button class="action-btn follow-btn ${this.isFollowing(profile.id) ? 'following' : ''}" 
                                    data-user-id="${profile.id}">
                                ${this.isFollowing(profile.id) ? 'Following' : 'Follow'}
                            </button>
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
                        <span class="number">${profile.follower_count || 0}</span>
                        <span class="label">Followers</span>
                    </div>
                    <div class="stat">
                        <span class="number">${profile.following_count || 0}</span>
                        <span class="label">Following</span>
                    </div>
                    <div class="stat">
                        <span class="number">${profile.story_count || 0}</span>
                        <span class="label">Stories</span>
                    </div>
                </div>

                <div class="profile-tabs">
                    <button class="tab-btn active" data-tab="stories">Love Stories</button>
                    <button class="tab-btn" data-tab="followers">Followers</button>
                    <button class="tab-btn" data-tab="following">Following</button>
                </div>

                <div class="tab-content">
                    <div id="stories-tab" class="tab-pane active">
                        <!-- User's love stories will go here -->
                    </div>
                    <div id="followers-tab" class="tab-pane">
                        <!-- Followers list will go here -->
                    </div>
                    <div id="following-tab" class="tab-pane">
                        <!-- Following list will go here -->
                    </div>
                </div>
            </div>
        `;

        this.setupProfileTabs();
    }

    // ========================
    // FOLLOW SYSTEM
    // ========================

    async handleFollow(button) {
        const userId = button.dataset.userId;
        const isFollowing = button.classList.contains('following');

        try {
            if (isFollowing) {
                await this.api.unfollowUser(userId, this.currentUser.id);
                button.classList.remove('following');
                button.textContent = 'Follow';
                this.showSuccess('Unfollowed user');
            } else {
                await this.api.followUser(userId, this.currentUser.id);
                button.classList.add('following');
                button.textContent = 'Following';
                this.showSuccess('Now following user');
            }
        } catch (error) {
            console.error('Error following user:', error);
            this.showError('Failed to follow user');
        }
    }

    isFollowing(userId) {
        // Check if current user is following this user
        // This would be managed in your state management
        return false; // Implement based on your data
    }

    async getFollowers(userId) {
        try {
            const followers = await this.api.getFollowers(userId);
            this.displayFollowers(followers);
            return followers;
        } catch (error) {
            console.error('Error fetching followers:', error);
        }
    }

    async getFollowing(userId) {
        try {
            const following = await this.api.getFollowing(userId);
            this.displayFollowing(following);
            return following;
        } catch (error) {
            console.error('Error fetching following:', error);
        }
    }

    // ========================
    // FRIEND REQUESTS
    // ========================

    async handleFriendRequest(button) {
        const userId = button.dataset.userId;

        try {
            await this.api.sendFriendRequest(this.currentUser.id, userId);
            button.disabled = true;
            button.textContent = 'Request Sent';
            this.showSuccess('Friend request sent!');
        } catch (error) {
            console.error('Error sending friend request:', error);
            this.showError('Failed to send friend request');
        }
    }

    async getFriendRequests() {
        try {
            const requests = await this.api.getFriendRequests(this.currentUser.id);
            this.displayFriendRequests(requests);
            return requests;
        } catch (error) {
            console.error('Error fetching friend requests:', error);
        }
    }

    async respondToFriendRequest(requestId, status) {
        try {
            await this.api.respondToFriendRequest(requestId, status);
            this.showSuccess(status === 'accepted' ? 'Friend request accepted!' : 'Friend request declined');
            this.getFriendRequests(); // Refresh the list
        } catch (error) {
            console.error('Error responding to friend request:', error);
            this.showError('Failed to respond to friend request');
        }
    }

    // ========================
    // DIRECT MESSAGES
    // ========================

    async handleMessage(button) {
        const userId = button.dataset.userId;
        this.openMessageModal(userId);
    }

    async openMessageModal(userId) {
        // Create message modal
        const modal = document.createElement('div');
        modal.className = 'message-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Send Message</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <textarea class="message-input" placeholder="Type your message..." rows="4"></textarea>
                </div>
                <div class="modal-footer">
                    <button class="send-message-btn">Send Message</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
        modal.querySelector('.send-message-btn').addEventListener('click', async () => {
            const message = modal.querySelector('.message-input').value.trim();
            if (message) {
                await this.sendMessage(userId, message);
                modal.remove();
            }
        });
    }

    async sendMessage(receiverId, message) {
        try {
            await this.api.sendMessage(this.currentUser.id, receiverId, message);
            this.showSuccess('Message sent!');
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('Failed to send message');
        }
    }

    async getConversation(userId) {
        try {
            const messages = await this.api.getConversation(this.currentUser.id, userId);
            this.displayConversation(messages);
            return messages;
        } catch (error) {
            console.error('Error fetching conversation:', error);
        }
    }

    // ========================
    // UI HELPERS
    // ========================

    setupProfileTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                
                // Update active tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Show correct content
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                document.getElementById(`${tabName}-tab`).classList.add('active');
                
                // Load tab content
                this.loadTabContent(tabName);
            });
        });
    }

    async loadTabContent(tabName) {
        const userId = this.getCurrentProfileUserId(); // Implement this based on your routing
        
        switch (tabName) {
            case 'followers':
                await this.getFollowers(userId);
                break;
            case 'following':
                await this.getFollowing(userId);
                break;
            case 'stories':
                // Load user's stories
                break;
        }
    }

    displayFollowers(followers) {
        const container = document.getElementById('followers-tab');
        if (!container) return;

        container.innerHTML = `
            <div class="users-list">
                ${followers.map(user => `
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
                `).join('')}
            </div>
        `;
    }

    displayFollowing(following) {
        const container = document.getElementById('following-tab');
        if (!container) return;

        container.innerHTML = `
            <div class="users-list">
                ${following.map(user => `
                    <div class="user-card">
                        <div class="user-avatar">${user.avatar_url || '💖'}</div>
                        <div class="user-info">
                            <h4>${user.display_name || user.username}</h4>
                            <p class="user-bio">${user.bio || 'No bio'}</p>
                        </div>
                        <button class="action-btn follow-btn following" 
                                data-user-id="${user.id}">
                            Following
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    displayFriendRequests(requests) {
        // Implement friend requests display
    }

    displayConversation(messages) {
        // Implement conversation display
    }

    showSuccess(message) {
        // Use your existing notification system
        window.notificationSystem?.addNotification('success', { message });
    }

    showError(message) {
        window.notificationSystem?.addNotification('error', { message });
    }
}

// Social API Manager
class SocialAPI {
    constructor() {
        this.apiBase = '/api';
    }

    async request(endpoint, options = {}) {
        const response = await fetch(`${this.apiBase}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    // User Profiles
    async getUserProfile(username) {
        return this.request(`/users/${username}`);
    }

    async updateUserProfile(userId, profileData) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // Follow System
    async followUser(userId, followerId) {
        return this.request(`/users/${userId}/follow`, {
            method: 'POST',
            body: JSON.stringify({ followerId })
        });
    }

    async unfollowUser(userId, followerId) {
        return this.request(`/users/${userId}/unfollow`, {
            method: 'POST',
            body: JSON.stringify({ followerId })
        });
    }

    async getFollowers(userId) {
        return this.request(`/users/${userId}/followers`);
    }

    async getFollowing(userId) {
        return this.request(`/users/${userId}/following`);
    }

    // Friend Requests
    async sendFriendRequest(senderId, receiverId) {
        return this.request('/friend-requests', {
            method: 'POST',
            body: JSON.stringify({ sender_id: senderId, receiver_id: receiverId })
        });
    }

    async getFriendRequests(userId) {
        return this.request(`/users/${userId}/friend-requests`);
    }

    async respondToFriendRequest(requestId, status) {
        return this.request(`/friend-requests/${requestId}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    }

    // Direct Messages
    async sendMessage(senderId, receiverId, messageText) {
        return this.request('/messages', {
            method: 'POST',
            body: JSON.stringify({ 
                sender_id: senderId, 
                receiver_id: receiverId, 
                message_text: messageText 
            })
        });
    }

    async getConversation(userId1, userId2) {
        return this.request(`/users/${userId1}/conversations/${userId2}`);
    }

    async markMessagesAsRead(userId, conversationWithId) {
        return this.request('/messages/read', {
            method: 'PUT',
            body: JSON.stringify({ userId, conversationWithId })
        });
    }
}

// Initialize Social Features
let socialFeatures;

function initializeSocialFeatures() {
    socialFeatures = new SocialFeatures();
    window.socialFeatures = socialFeatures;
}

// Add to your main initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeSocialFeatures();
});