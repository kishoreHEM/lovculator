// js/profile.js - Profile Page JavaScript
class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.socialAPI = null;
        this.authManager = window.authManager; // Assume authManager is loaded globally
        this.path = window.location.pathname;
        this.init();
    }

    async init() {
        // ===============================================
        // 🚨 SECURITY CRITICAL: AUTHENTICATION CHECK 🚨
        // ===============================================
        
        let userFromSession = await this.authManager.checkSession();
        let usernameInPath = this.path.startsWith('/profile/') ? this.path.split('/').pop() : null;
        
        // 1. If accessing /profile (current user) and NOT logged in, redirect to login.
        if ((this.path === '/profile' || this.path === '/profile/') && !userFromSession) {
            console.log("User not logged in. Redirecting to login.");
            alert("You must be logged in to view your profile.");
            window.location.href = '/login'; 
            return; 
        }

        // 2. Determine which profile to load
        let usernameToLoad;
        if (userFromSession && !usernameInPath) {
             // Logged-in user viewing /profile -> load own profile
            usernameToLoad = userFromSession.username;
        } else if (usernameInPath) {
            // Viewing /profile/:username -> load specified profile (may or may not be self, may or may not be logged in)
            usernameToLoad = usernameInPath;
        } else {
             // Fallback if path is weird and no session exists (shouldn't happen with the redirect above)
            this.showError('Profile link is invalid.');
            return;
        }
        
        // Load the full profile data based on username
        await this.loadUserProfileData(usernameToLoad, userFromSession);
        
        // If data loaded successfully, proceed with initialization
        if (this.currentUser) {
            await this.initializeSocialAPI();
            this.setupTabNavigation();
            this.loadTabContent('stories');
            this.setupEditButtonVisibility(userFromSession);
        }
        // ===============================================
    }
    
    // Check if the current viewer is the owner of the profile being displayed
    setupEditButtonVisibility(sessionUser) {
        const editProfileBtn = document.getElementById('editProfileBtn');
        if (editProfileBtn) {
            const isOwner = sessionUser && sessionUser.username === this.currentUser.username;
            editProfileBtn.style.display = isOwner ? 'block' : 'none';
        }
    }

    async loadUserProfileData(username, sessionUser) {
        try {
            // Decide which endpoint to hit: /api/user/current (fastest, requires session) 
            // or /api/users/:username (slower, public)
            const isSelf = sessionUser && sessionUser.username === username;
            const endpoint = isSelf ? '/api/user/current' : `/api/users/${username}`;

            const response = await fetch(endpoint);
            
            if (!response.ok) {
                // If fetching current user fails (e.g., session expired), redirect to login
                if (response.status === 401 && isSelf) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error(response.status === 404 ? 'User not found' : `Failed to load profile (${response.status})`);
            }
            
            this.currentUser = await response.json();
            this.renderUserProfile();
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showError(error.message);
        }
    }


    // --- Existing methods start here ---

    async initializeSocialAPI() {
        if (window.socialAPI) {
            this.socialAPI = window.socialAPI;
        } else {
            this.socialAPI = this.createFallbackAPI();
        }
    }

    createFallbackAPI() {
        // Ensures only the current logged-in user can update their profile
        const currentUserId = this.authManager.isAuthenticated() ? this.authManager.getCurrentUser().id : null;
        
        return {
            async updateUserProfile(userId, profileData) {
                if (!currentUserId || userId !== currentUserId) {
                    throw new Error('Unauthorized action. User ID mismatch.');
                }
                
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(profileData)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                return await response.json();
            },

            async getFollowers(userId) {
                // NOTE: APIs updated to use username, but keeping userId for compatibility here
                const response = await fetch(`/api/users/${this.currentUser.username}/followers/count`);
                if (!response.ok) throw new Error('Failed to fetch followers');
                return await response.json(); // Returns {count: N}
            },

            async getFollowing(userId) {
                const response = await fetch(`/api/users/${this.currentUser.username}/following/count`);
                if (!response.ok) throw new Error('Failed to fetch following');
                return await response.json(); // Returns {count: N}
            }
        };
    }
    
    // loadCurrentUser method removed, replaced by loadUserProfileData for better path handling

    renderUserProfile() {
        const container = document.getElementById('userProfileContainer');
        if (!container) {
            console.error('Profile container not found');
            return;
        }

        const user = this.currentUser;
        const avatarUrl = this.getAvatarUrl(user);

        // Check if the current viewer is the owner
        const isOwner = this.authManager.isAuthenticated() && this.authManager.getCurrentUser().username === user.username;
        const editButtonHtml = isOwner ? 
            '<button class="btn btn-outline" id="editProfileBtn">Edit Profile</button>' : 
            ''; // Placeholder for follow button if not owner
        
        container.innerHTML = `
            <div class="user-profile-card enhanced">
                <div class="profile-cover" style="background-image: url('${user.cover_photo_url || '/images/default-cover.jpg'}');"></div>
                <div class="avatar-section">
                    <img src="${avatarUrl}" 
                         alt="${user.display_name}'s avatar" 
                         class="profile-avatar"
                         onerror="this.onerror=null; this.src='/images/favicon-32x32.png'">
                    <div class="profile-actions">
                        ${editButtonHtml}
                        <button class="btn btn-primary" id="shareProfileBtn">Share Profile</button>
                    </div>
                </div>
                <div class="profile-info">
                    <h2>${user.display_name || user.username}</h2>
                    <p class="username">@${user.username}</p>
                    <p class="user-bio">${user.bio || 'No bio yet'}</p>
                    <div class="profile-details">
                        <span class="detail">📍 ${user.location || 'Location not set'}</span>
                        <span class="detail">💖 ${user.relationship_status || 'Relationship status not set'}</span>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat">
                        <span class="number" id="storiesCount">0</span>
                        <span class="label">Love Stories</span>
                    </div>
                    <div class="stat">
                        <span class="number">${user.follower_count || 0}</span>
                        <span class="label">Followers</span>
                    </div>
                    <div class="stat">
                        <span class="number">${user.following_count || 0}</span>
                        <span class="label">Following</span>
                    </div>
                </div>
            </div>
        `;

        this.setupProfileActions();
    }

    setupProfileActions() {
        // Event listener setup for the newly rendered buttons
        const editProfileBtn = document.getElementById('editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                this.openEditProfileModal();
            });
        }

        const shareProfileBtn = document.getElementById('shareProfileBtn');
        if (shareProfileBtn) {
            shareProfileBtn.addEventListener('click', () => {
                this.shareProfile();
            });
        }
    }

    openEditProfileModal() {
        // Ensure only owner can open modal
        if (!this.authManager.isAuthenticated() || this.authManager.getCurrentUser().username !== this.currentUser.username) {
            this.showNotification('You can only edit your own profile.', 'error');
            return;
        }
        
        // ... (rest of openEditProfileModal remains the same)
        const modalHTML = `
            <div class="modal-overlay" id="editProfileModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Profile</h3>
                        <button class="close-modal" id="closeEditModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="editProfileForm">
                            <div class="form-group">
                                <label for="displayName">Display Name</label>
                                <input type="text" id="displayName" value="${this.currentUser.display_name || ''}" placeholder="Enter your display name">
                            </div>
                            <div class="form-group">
                                <label for="userBio">Bio</label>
                                <textarea id="userBio" placeholder="Tell us about yourself">${this.currentUser.bio || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="userLocation">Location</label>
                                <input type="text" id="userLocation" value="${this.currentUser.location || ''}" placeholder="Where are you from?">
                            </div>
                            <div class="form-group">
                                <label for="relationshipStatus">Relationship Status</label>
                                <select id="relationshipStatus">
                                    <option value="">Select status</option>
                                    <option value="Single" ${this.currentUser.relationship_status === 'Single' ? 'selected' : ''}>Single</option>
                                    <option value="In a relationship" ${this.currentUser.relationship_status === 'In a relationship' ? 'selected' : ''}>In a relationship</option>
                                    <option value="Engaged" ${this.currentUser.relationship_status === 'Engaged' ? 'selected' : ''}>Engaged</option>
                                    <option value="Married" ${this.currentUser.relationship_status === 'Married' ? 'selected' : ''}>Married</option>
                                    <option value="It's complicated" ${this.currentUser.relationship_status === 'It\'s complicated' ? 'selected' : ''}>It's complicated</option>
                                </select>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline" id="cancelEdit">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveProfile">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.setupEditModalEvents();
    }

    setupEditModalEvents() {
        const modal = document.getElementById('editProfileModal');
        const closeBtn = document.getElementById('closeEditModal');
        const cancelBtn = document.getElementById('cancelEdit');
        const saveBtn = document.getElementById('saveProfile');

        if (!modal || !closeBtn || !cancelBtn || !saveBtn) return;

        const closeModal = () => modal.remove();

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        saveBtn.addEventListener('click', async () => {
            const success = await this.saveProfileChanges();
            if (success) closeModal();
        });
    }

    async saveProfileChanges() {
        try {
            // Ensure owner check is done again before API call
            if (!this.socialAPI || !this.currentUser || !this.authManager.isAuthenticated() || 
                this.authManager.getCurrentUser().id !== this.currentUser.id) {
                throw new Error('Authorization failed: Cannot save profile');
            }

            const formData = {
                display_name: document.getElementById('displayName').value,
                bio: document.getElementById('userBio').value,
                location: document.getElementById('userLocation').value,
                relationship_status: document.getElementById('relationshipStatus').value
            };

            const updatedProfileData = await this.socialAPI.updateUserProfile(this.currentUser.id, formData);

            this.currentUser = { 
                ...this.currentUser, 
                ...updatedProfileData 
            };
            
            this.renderUserProfile();
            
            this.showNotification('Profile updated successfully!', 'success');
            return true;

        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification(`Failed to update profile: ${error.message}`, 'error');
            return false;
        }
    }

    shareProfile() {
        const profileUrl = window.location.href;
        
        if (navigator.share) {
            navigator.share({
                title: `${this.currentUser.display_name}'s Profile - Lovculator`,
                text: `Check out ${this.currentUser.display_name}'s profile on Lovculator!`,
                url: profileUrl
            });
        } else {
            navigator.clipboard.writeText(profileUrl)
                .then(() => this.showNotification('Profile link copied to clipboard!', 'success'))
                .catch(() => alert(`Share this profile: ${profileUrl}`));
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="close-notification">&times;</button>
        `;

        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                .notification-success { background: #4CAF50; }
                .notification-error { background: #f44336; }
                .notification-info { background: #2196F3; }
                .close-notification {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        setTimeout(() => notification.remove(), 3000);

        const closeBtn = notification.querySelector('.close-notification');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => notification.remove());
        }
    }

    getAvatarUrl(user) {
        // Use user.avatar_url if available, otherwise fallback to the default
        return user.avatar_url || '/images/apple-touch-icon.png';
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                button.classList.add('active');
                const tabName = button.getAttribute('data-tab');
                const tabPane = document.getElementById(`${tabName}-tab`);
                if (tabPane) {
                    tabPane.classList.add('active');
                    this.loadTabContent(tabName);
                }
            });
        });
    }

    async loadTabContent(tabName) {
        // Ensure currentUser is loaded before attempting content load
        if (!this.currentUser) return; 
        
        switch (tabName) {
            case 'stories': await this.loadUserStories(); break;
            case 'followers': await this.loadFollowers(); break;
            case 'following': await this.loadFollowing(); break;
            case 'activity': await this.loadActivity(); break;
        }
    }

    async loadUserStories() {
        try {
            const container = document.getElementById('userStoriesContainer');
            if (!container) return;

            container.innerHTML = '<div class="loading-profile"><div class="loading-spinner"></div><p>Loading stories...</p></div>';

            // Use the username from the loaded profile
            const response = await fetch(`/api/users/${this.currentUser.username}/stories`);
            if (!response.ok) throw new Error('Failed to load stories');

            const stories = await response.json();
            
            if (stories.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No love stories yet</h3>
                        <p>Share your first love story to get started!</p>
                        <a href="/record" class="btn btn-primary">Share Your Story</a>
                    </div>
                `;
                return;
            }

            container.innerHTML = stories.map(story => `
                <div class="story-card">
                    <h3>${story.story_title}</h3>
                    <p class="story-couple">${story.couple_names}</p>
                    <p class="story-preview">${story.love_story.substring(0, 150)}...</p>
                    <div class="story-meta">
                        <span class="story-category">${story.category}</span>
                        <span class="story-mood">${story.mood}</span>
                    </div>
                    <div class="story-stats">
                        <span>❤️ ${story.likes_count || 0} likes</span>
                        <span>💬 ${story.comments_count || 0} comments</span>
                    </div>
                </div>
            `).join('');

            const storiesCountElement = document.getElementById('storiesCount');
            if (storiesCountElement) storiesCountElement.textContent = stories.length;

        } catch (error) {
            console.error('Error loading user stories:', error);
            const container = document.getElementById('userStoriesContainer');
            if (container) {
                container.innerHTML = `<div class="error-state"><p>Failed to load stories. Please try again.</p></div>`;
            }
        }
    }

    async loadFollowers() {
        const container = document.getElementById('followersContainer');
        if (!container) return;
        
        // This relies on the follower_count being fetched in loadUserProfileData
        const count = this.currentUser.follower_count || 0;
        
        container.innerHTML = count > 0 ? 
            `<div class="info-state"><h3>${count} Followers</h3><p>We need to build the API for listing actual followers!</p></div>` :
            `<div class="empty-state"><h3>No followers yet</h3><p>Share love stories and connect with others to get followers!</p></div>`;
    }

    async loadFollowing() {
        const container = document.getElementById('followingContainer');
        if (!container) return;
        
        // This relies on the following_count being fetched in loadUserProfileData
        const count = this.currentUser.following_count || 0;

        container.innerHTML = count > 0 ? 
            `<div class="info-state"><h3>Following ${count} Users</h3><p>We need to build the API for listing who you follow!</p></div>` :
            `<div class="empty-state"><h3>Not following anyone yet</h3><p>Discover and follow other love story enthusiasts!</p></div>`;
    }

    async loadActivity() {
        const container = document.getElementById('userActivityContainer');
        if (!container) return;
        container.innerHTML = `<div class="empty-state"><h3>No recent activity</h3><p>Your activity will appear here when you start sharing and interacting with love stories.</p></div>`;
    }

    showError(message) {
        const container = document.getElementById('userProfileContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="error-state">
                <h3>Error Loading Profile</h3>
                <p>${message}</p>
                <button onclick="location.href='/'" class="btn btn-primary">Go Home</button>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check if AuthManager is loaded before ProfileManager initializes
    if (typeof authManager === 'undefined') {
        console.error("AuthManager is required but not found. Ensure js/auth.js is loaded before js/profile.js.");
        // Redirecting forcefully if the core auth logic is missing
        if (window.location.pathname === '/profile') {
             alert("Security Error: Authentication logic missing. Redirecting.");
             window.location.href = '/login';
        }
        return;
    }
    new ProfileManager();
});