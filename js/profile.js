// Profile Page JavaScript
class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        this.setupTabNavigation();
        this.loadTabContent('stories');
    }

    async loadCurrentUser() {
        try {
            const response = await fetch('/api/user/current');
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            
            this.currentUser = await response.json();
            this.renderUserProfile();
        } catch (error) {
            console.error('Error loading user profile:', error);
            this.showError('Failed to load profile data');
        }
    }

    renderUserProfile() {
        const container = document.getElementById('userProfileContainer');
        const user = this.currentUser;

        const avatarUrl = this.getAvatarUrl(user);

        container.innerHTML = `
            <div class="user-profile-card enhanced">
                <div class="profile-cover"></div>
                <div class="avatar-section">
                    <img src="${avatarUrl}" 
                         alt="${user.display_name}'s avatar" 
                         class="profile-avatar"
                         onerror="this.onerror=null; this.src='images/favicon-32x32.png'">
                    <div class="profile-actions">
                        <button class="btn btn-outline" id="editProfileBtn">Edit Profile</button>
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

        // Add event listeners after rendering
        this.setupProfileActions();
    }

    setupProfileActions() {
        // Edit Profile Button
        const editProfileBtn = document.getElementById('editProfileBtn');
        if (editProfileBtn) {
            editProfileBtn.addEventListener('click', () => {
                this.openEditProfileModal();
            });
        }

        // Share Profile Button
        const shareProfileBtn = document.getElementById('shareProfileBtn');
        if (shareProfileBtn) {
            shareProfileBtn.addEventListener('click', () => {
                this.shareProfile();
            });
        }
    }

    openEditProfileModal() {
        // Create edit profile modal
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

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add modal event listeners
        this.setupEditModalEvents();
    }

    setupEditModalEvents() {
        const modal = document.getElementById('editProfileModal');
        const closeBtn = document.getElementById('closeEditModal');
        const cancelBtn = document.getElementById('cancelEdit');
        const saveBtn = document.getElementById('saveProfile');

        // Close modal functions
        const closeModal = () => {
            modal.remove();
        };

        // Close modal events
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Save profile event
        saveBtn.addEventListener('click', async () => {
            await this.saveProfileChanges();
            closeModal();
        });
    }

    async saveProfileChanges() {
        try {
            const formData = {
                display_name: document.getElementById('displayName').value,
                bio: document.getElementById('userBio').value,
                location: document.getElementById('userLocation').value,
                relationship_status: document.getElementById('relationshipStatus').value
            };

            // Update via API (you'll need to implement this endpoint)
            const response = await fetch(`/api/users/${this.currentUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // Update local user data
                this.currentUser = { ...this.currentUser, ...formData };
                this.renderUserProfile();
                
                // Show success message
                this.showNotification('Profile updated successfully!', 'success');
            } else {
                throw new Error('Failed to update profile');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            this.showNotification('Failed to update profile', 'error');
        }
    }

    shareProfile() {
        const profileUrl = window.location.href;
        
        // Check if Web Share API is available
        if (navigator.share) {
            navigator.share({
                title: `${this.currentUser.display_name}'s Profile - Lovculator`,
                text: `Check out ${this.currentUser.display_name}'s profile on Lovculator!`,
                url: profileUrl
            })
            .then(() => console.log('Profile shared successfully'))
            .catch((error) => console.log('Error sharing profile:', error));
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(profileUrl)
                .then(() => {
                    this.showNotification('Profile link copied to clipboard!', 'success');
                })
                .catch(() => {
                    // Final fallback: show URL in alert
                    alert(`Share this profile: ${profileUrl}`);
                });
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="close-notification">&times;</button>
        `;

        // Add styles if not already present
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

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);

        // Close button event
        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.remove();
        });
    }

    getAvatarUrl(user) {
        if (user.avatar_url && user.avatar_url.includes('default-avatar')) {
            return 'images/apple-touch-icon.png';
        }
        
        const faviconOptions = [
            'images/apple-touch-icon.png',
            'images/favicon-32x32.png',
            'images/favicon-16x16.png'
        ];

        return faviconOptions[0];
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
        switch (tabName) {
            case 'stories':
                await this.loadUserStories();
                break;
            case 'followers':
                await this.loadFollowers();
                break;
            case 'following':
                await this.loadFollowing();
                break;
            case 'activity':
                await this.loadActivity();
                break;
        }
    }

    async loadUserStories() {
        try {
            const container = document.getElementById('userStoriesContainer');
            container.innerHTML = '<div class="loading-profile"><div class="loading-spinner"></div><p>Loading stories...</p></div>';

            const response = await fetch(`/api/users/${this.currentUser.username}/stories`);
            if (!response.ok) {
                throw new Error('Failed to load stories');
            }

            const stories = await response.json();
            
            if (stories.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No love stories yet</h3>
                        <p>Share your first love story to get started!</p>
                        <a href="/love-stories" class="btn btn-primary">Share Your Story</a>
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

            document.getElementById('storiesCount').textContent = stories.length;

        } catch (error) {
            console.error('Error loading user stories:', error);
            document.getElementById('userStoriesContainer').innerHTML = `
                <div class="error-state">
                    <p>Failed to load stories. Please try again.</p>
                </div>
            `;
        }
    }

    async loadFollowers() {
        const container = document.getElementById('followersContainer');
        container.innerHTML = `
            <div class="empty-state">
                <h3>No followers yet</h3>
                <p>Share love stories and connect with others to get followers!</p>
            </div>
        `;
    }

    async loadFollowing() {
        const container = document.getElementById('followingContainer');
        container.innerHTML = `
            <div class="empty-state">
                <h3>Not following anyone yet</h3>
                <p>Discover and follow other love story enthusiasts!</p>
            </div>
        `;
    }

    async loadActivity() {
        const container = document.getElementById('userActivityContainer');
        container.innerHTML = `
            <div class="empty-state">
                <h3>No recent activity</h3>
                <p>Your activity will appear here when you start sharing and interacting with love stories.</p>
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('userProfileContainer');
        container.innerHTML = `
            <div class="error-state">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn btn-primary">Try Again</button>
            </div>
        `;
    }
}

// Initialize profile manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});