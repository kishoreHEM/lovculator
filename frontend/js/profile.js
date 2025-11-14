/**
 * frontend/js/profile.js — Lovculator 💖
 * Profile Manager: Handles user profile, stories, followers, following, and activity feed
 */
class ProfileManager {

    constructor() {
        // 🌍 Ensure API base is correctly set for both localhost and production
        this.API_BASE =
            window.API_BASE ||
            (window.location.hostname.includes("localhost")
                ? "http://localhost:3001/api"
                : "https://lovculator.com/api");
        
        // 🟢 Add base URL for assets (without /api)
        this.BASE_URL = window.location.hostname.includes("localhost")
            ? "http://localhost:3001"
            : "https://lovculator.com";
        
        this.profileInfoContainer = document.getElementById("profileInfoContainer");
        this.storiesContainer = document.getElementById("userStoriesContainer");
        this.currentUser = null;
        this.viewedUser = null;
        this.isOwnProfile = false;

        // Assuming LoveStoriesAPI is a defined class in another file
        this.api = new LoveStoriesAPI(); 
        this.init();
    }

    // =====================================================
    // 1️⃣ Initialize Profile (Optimized for avatar loading)
    // =====================================================
    async init() {
        this.showLoading("profileInfoContainer");
        this.showLoading("userStoriesContainer");

        try {
            const params = new URLSearchParams(window.location.search);
            const usernameParam = params.get("user"); // example: profile.html?user=kishore6

            // Step 1️⃣: Check logged-in user session
            let currentUser = null;
            try {
                const meRes = await fetch(`${this.API_BASE}/auth/me`, { 
                    credentials: "include",
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                if (meRes.ok) {
                    currentUser = await meRes.json();
                    this.currentUser = currentUser;
                    window.currentUserId = currentUser.id;
                    window.currentUser = currentUser;
                }
            } catch {
                console.warn("⚠️ No active session found");
            }

            // Step 2️⃣: Determine whose profile to load
            if (usernameParam && (!currentUser || usernameParam !== currentUser.username)) {
                // Viewing someone else's profile
                const userRes = await fetch(`${this.API_BASE}/users/profile/${usernameParam}`);
                if (!userRes.ok) throw new Error("User not found");

                const otherUser = await userRes.json();
                this.viewedUser = otherUser;
                this.isOwnProfile = false;

                this.renderProfileDetails(otherUser, false);
                await this.loadUserStories(otherUser.id);

            } else if (currentUser) {
                // Viewing your own profile - ensure fresh data for avatar
                this.isOwnProfile = true;
                this.viewedUser = currentUser;
                
                // Try to get fresh profile data to ensure avatar is current
                try {
                    const freshUserRes = await fetch(`${this.API_BASE}/users/profile/${currentUser.username}`, {
                        credentials: "include"
                    });
                    if (freshUserRes.ok) {
                        const freshUserData = await freshUserRes.json();
                        this.viewedUser = freshUserData;
                        this.currentUser = freshUserData;
                        window.currentUser = freshUserData;
                    }
                } catch (freshError) {
                    console.warn("⚠️ Using session data for profile:", freshError);
                }

                this.renderProfileDetails(this.viewedUser, true);
                await this.loadUserStories(this.viewedUser.id);
            } else {
                // No session + no username = redirect to login
                this.handleUnauthorized();
                return;
            }

            // Step 3️⃣: Attach handlers after loading
            this.attachTabHandlers();
            this.attachEditProfileHandlers();

        } catch (err) {
            console.error("❌ Profile load error:", err);
            this.profileInfoContainer.innerHTML = `
                <p style="color:red;text-align:center;">❌ Failed to load profile.</p>`;
        }
    }

// =====================================================
// 2️⃣ Render Profile Details (Optimized) - FINAL FIX
// =====================================================
renderProfileDetails(user, isOwnProfile = true) {
    if (!this.profileInfoContainer) return;

    const followerCount = user.follower_count ?? 0;
    const followingCount = user.following_count ?? 0;
    const displayName = user.display_name || user.username || "User";
    const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        })
        : "Recently";

    // Robust avatar URL handling
    const getValidAvatarUrl = (avatar) => {
        if (!avatar || avatar === 'null' || avatar === 'undefined' || avatar.trim() === '') {
            return "/images/default-avatar.png";
        }
        return avatar;
    };

    let avatarUrl = getValidAvatarUrl(user.avatar_url);

    // Clean localhost URLs
    if (avatarUrl && avatarUrl.includes('localhost')) {
        try {
            const url = new URL(avatarUrl, window.location.origin);
            avatarUrl = url.pathname;
        } catch (e) {
            console.error("Failed to parse and clean avatar URL:", e);
        }
    }
    
    // Add cache-buster
    if (avatarUrl && !avatarUrl.includes('?')) {
        avatarUrl = `${avatarUrl}?t=${Date.now()}`;
    } else if (avatarUrl) {
        avatarUrl = `${avatarUrl}&t=${Date.now()}`;
    }

    const bioHTML = user.bio
        ? `<p class="bio-text">${user.bio}</p>`
        : `<p class="bio-text empty">No bio set yet.</p>`;
    const locationHTML = user.location
        ? `<span class="location">📍 ${user.location}</span>`
        : "";

    // Avatar section
    const avatarSection = isOwnProfile
        ? `
            <div class="avatar-upload-section">
                <img id="avatarImage" src="${avatarUrl}" alt="${displayName}" class="profile-avatar-img" />
                <label class="avatar-upload-label">
                    📸 Change Photo
                    <input type="file" id="avatarInput" accept="image/*" hidden />
                </label>
            </div>
        `
        : `
            <div class="avatar-view-section">
                <img id="avatarImage" src="${avatarUrl}" alt="${displayName}" class="profile-avatar-img" />
            </div>
        `;

    // Profile layout
    this.profileInfoContainer.innerHTML = `
        <div class="profile-header-card">
            <div class="profile-cover"></div>

            <div class="profile-main-info">
                <div class="profile-avatar-wrapper">
                    ${avatarSection}
                </div>

                <div class="profile-details">
                    <h3 id="profileUsername">${displayName}</h3>
                    <div class="social-stats">
                        <span id="profileFollowers">${followerCount} Followers</span>
                        <span class="separator">·</span>
                        <span id="profileFollowing">${followingCount} Following</span>
                    </div>
                    <p id="profileJoined" class="joined-date">Joined ${joinedDate}</p>
                    <div class="profile-bio-summary">
                        ${bioHTML}
                        ${locationHTML}
                    </div>
                </div>
            </div>

            <div class="profile-actions-bar">
                ${
                    isOwnProfile
                        ? `
                            <button id="editProfileBtn" class="btn btn-secondary btn-small">✏️ Edit Profile</button>
                            <button id="logoutBtn" class="btn btn-secondary btn-small">🚪 Logout</button>
                        `
                        : `
                            <button id="followProfileBtn" class="btn btn-primary btn-small">
                                ${user.is_following_author ? "Following" : "+ Follow"}
                            </button>
                            <button id="messageUserBtn" class="btn btn-primary btn-small message-user-btn" data-user-id="${user.id}">
                                💌 Message
                            </button>
                        `
                }
            </div>
        </div>
    `;

    if (!isOwnProfile) {
    const messageBtn = document.getElementById('messageUserBtn');
    if (messageBtn) {
        messageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('💌 Profile message button clicked directly');
            console.log('🔍 messagesManager available:', !!window.messagesManager);
            console.log('🔍 messagesManager type:', typeof window.messagesManager);
            
            const userId = messageBtn.dataset.userId;
            if (userId) {
                if (window.messagesManager) {
                    console.log('🚀 Calling openMessagesModal...');
                    window.messagesManager.openMessagesModal(userId);
                } else {
                    console.log('❌ messagesManager is not available');
                    alert('Messaging system is not loaded yet. Please refresh the page.');
                }
            }
        });
    }
}

    // Smooth fade-in effect
    const headerCard = this.profileInfoContainer.querySelector(".profile-header-card");
    if (headerCard) {
        requestAnimationFrame(() => {
            headerCard.classList.add("loaded");
        });
    }

    // Reattach event handlers
    if (isOwnProfile) {
        this.attachLogoutHandler();
        this.attachEditProfileHandlers();
        this.attachAvatarUploadHandler();
    } else {
        this.attachFollowProfileHandler(user.id);
    }

    // Debug code
    console.log('👤 Profile rendered for user:', user.username);
    console.log('📝 Message button should be available for user ID:', user.id);

    // Test if button exists after a short delay
    setTimeout(() => {
        const messageBtn = document.getElementById('messageUserBtn');
        console.log('🔍 Message button found:', messageBtn);
        if (messageBtn) {
            console.log('📋 Message button attributes:', {
                id: messageBtn.id,
                userId: messageBtn.dataset.userId,
                classes: messageBtn.className
            });
        } else {
            console.log('❌ Message button NOT found - this is expected for own profile');
        }
    }, 100);
} // ✅ END OF METHOD - IMPORTANT CLOSING BRACE

// =====================================================
// 🧁 Avatar Upload (with Preview & Upload - Final Corrected)
// =====================================================
attachAvatarUploadHandler() {
    const avatarInput = document.getElementById("avatarInput");
    const avatarImage = document.getElementById("avatarImage");

    if (!avatarInput || !avatarImage || !this.currentUser) return;

    avatarInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("⚠️ Max file size is 2MB.");
            return;
        }

        // 1. Preview instantly (using data URL, which is CSP compliant)
        const reader = new FileReader();
        reader.onload = () => {
            avatarImage.src = reader.result;
        };
        reader.readAsDataURL(file);

        // Upload to server
        const formData = new FormData();
        formData.append("avatar", file);

        try {
            const res = await fetch(`${this.API_BASE}/users/${this.currentUser.id}/avatar`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Upload failed");

            // 2. 🛑 DEFENSIVE STRIPPING: Ensure URL is relative (e.g., /uploads/avatars/...)
            let cleanAvatarURL = data.avatar_url;

            if (cleanAvatarURL && (cleanAvatarURL.includes('localhost') || !cleanAvatarURL.startsWith('/'))) {
                // Use URL object to reliably extract the path, ensuring no host is left
                try {
                    // Prepend window.location.origin to handle cases where backend sends only the path
                    const url = new URL(cleanAvatarURL, window.location.origin);
                    cleanAvatarURL = url.pathname;
                } catch (e) {
                    console.error("URL parsing failed, falling back to original data.");
                    cleanAvatarURL = data.avatar_url;
                }
            }

            // 3. ✅ CACHE BUSTING: Append timestamp to the clean, relative URL
            const newAvatarURL = `${cleanAvatarURL}?t=${Date.now()}`;

            // 4. Update UI and State
            
            // Update UI instantly
            avatarImage.src = newAvatarURL; 
            
            // Update local state objects
            this.currentUser.avatar_url = newAvatarURL;
            this.viewedUser.avatar_url = newAvatarURL;

            // Update global state
            if (window.currentUser) {
                window.currentUser.avatar_url = newAvatarURL;
            }

            // Refresh session data (assuming this method is defined elsewhere)
            await this.refreshUserSession();

            // Bounce animation for visual feedback
            avatarImage.classList.add("avatar-updated");
            setTimeout(() => avatarImage.classList.remove("avatar-updated"), 800);

            // Notify other components
            window.dispatchEvent(new CustomEvent('avatarUpdated', {
                detail: { avatarUrl: newAvatarURL }
            }));

            alert("✅ Profile picture updated!");

        } catch (err) {
            console.error("❌ Avatar upload error:", err);
            
            // Revert to original avatar on error
            const originalAvatar = this.currentUser.avatar_url || "/images/default-avatar.png";
            avatarImage.src = originalAvatar;
            
            alert("❌ Failed to upload avatar. Please try again.");
        }
    });
}

    // =====================================================
    // 🔄 Session Refresh Helper
    // =====================================================
    async refreshUserSession() {
        try {
            const meRes = await fetch(`${this.API_BASE}/auth/me`, {
                credentials: "include",
                headers: { 
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (meRes.ok) {
                const freshUser = await meRes.json();
                this.currentUser = freshUser;
                this.viewedUser = freshUser;
                window.currentUser = freshUser;
                return freshUser;
            }
        } catch (error) {
            console.warn("⚠️ Session refresh failed:", error);
        }
        return this.currentUser;
    }

    // =====================================================
    // 3️⃣ Follow / Unfollow Other User
    // =====================================================
    attachFollowProfileHandler(targetId) {
        const btn = document.getElementById("followProfileBtn");
        if (!btn) return;

        btn.addEventListener("click", async () => {
            btn.disabled = true;
            const initialText = btn.textContent;

            try {
                const res = await this.api.request(`/users/${targetId}/follow`, { method: "POST" });
                btn.textContent = res.is_following ? "Following" : "+ Follow";
                btn.classList.toggle("following", res.is_following);
                
                // Update counts if available in response
                if (res.target_follower_count !== undefined && document.getElementById("profileFollowers")) {
                    document.getElementById("profileFollowers").textContent = `${res.target_follower_count} Followers`;
                }
            } catch (err) {
                console.error("❌ Follow toggle failed:", err);
                alert("Something went wrong. Please try again.");
                btn.textContent = initialText;
            } finally {
                btn.disabled = false;
            }
        });
    }

    // =====================================================
    // 4️⃣ Handle Unauthorized User
    // =====================================================
    handleUnauthorized() {
        alert("⚠️ You must log in to view your profile.");
        window.location.href = "/login.html";
    }

    // =====================================================
    // 5️⃣ Logout Handler
    // =====================================================
    attachLogoutHandler() {
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.addEventListener("click", this.handleLogout.bind(this));
    }

    async handleLogout() {
        try {
            const logoutRes = await fetch(`${this.API_BASE}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
            if (logoutRes.ok) {
                alert("✅ Logged out successfully!");
                setTimeout(() => (window.location.href = "/login.html"), 300);
            } else {
                alert("Logout failed. Please try again.");
            }
        } catch (err) {
            console.error("Logout error:", err);
            alert("⚠️ Network error during logout.");
        }
    }

    // =====================================================
    // 6️⃣ Edit Profile Handlers
    // =====================================================
    attachEditProfileHandlers() {
        const editBtn = document.getElementById("editProfileBtn");
        const modal = document.getElementById("editProfileModal");
        const closeBtn = modal?.querySelector(".close-btn");
        const cancelBtn = document.getElementById("cancelEditBtn");
        const form = document.getElementById("editProfileForm");

        // 🟢 Open modal
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                this.populateEditForm();
                if (modal) {
                    modal.style.display = "flex";
                    setTimeout(() => modal.classList.add("active"), 10);
                }
            });
        }

        // 🔴 Close modal helper
        const closeModal = () => {
            if (modal) {
                modal.classList.remove("active");
                setTimeout(() => (modal.style.display = "none"), 300);
            }
        };

        // Close on X or Cancel
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

        // Close when clicking outside modal dialog
        window.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });

        // 📝 Handle form submit
        if (form) form.addEventListener("submit", this.handleEditProfile.bind(this));
    }

    populateEditForm() {
        if (!this.currentUser) return;

        document.getElementById("editDisplayName").value = this.currentUser.display_name || "";
        document.getElementById("editBio").value = this.currentUser.bio || "";
        document.getElementById("editLocation").value = this.currentUser.location || "";
        document.getElementById("editRelationshipStatus").value =
            this.currentUser.relationship_status || "Single";
        document.getElementById("editProfileMessage").textContent = "";
    }

    async handleEditProfile(e) {
        e.preventDefault();

        const saveBtn = document.getElementById("saveProfileBtn");
        const messageEl = document.getElementById("editProfileMessage");
        const modal = document.getElementById("editProfileModal");
        
        saveBtn.disabled = true;
        messageEl.textContent = "Saving...";

        const formData = new FormData(e.target);
        const updatedData = Object.fromEntries(formData.entries());

        try {
            const updatedUser = await this.api.request(`/users/${this.currentUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData),
            });

            this.currentUser = { ...this.currentUser, ...updatedUser };
            this.viewedUser = { ...this.viewedUser, ...updatedUser };
            this.renderProfileDetails(this.currentUser);

            messageEl.textContent = "✅ Profile updated successfully!";
            messageEl.style.color = "green";

            setTimeout(() => {
                if (modal) modal.style.display = "none";
            }, 1500);
        } catch (err) {
            console.error("❌ Profile update failed:", err);
            const errorMsg = err.data?.error || "Failed to save changes. Please try again.";
            messageEl.textContent = `❌ ${errorMsg}`;
            messageEl.style.color = "red";
        } finally {
            saveBtn.disabled = false;
        }
    }

    // =====================================================
    // 7️⃣ Load User's Stories
    // =====================================================
    async loadUserStories(userIdentifier) {
        if (!this.storiesContainer) return;

        this.showLoading("userStoriesContainer", "Loading love stories...");

        try {
            const stories = await this.api.request(`/users/${userIdentifier}/stories`);

            if (!stories.length) {
                this.storiesContainer.innerHTML = `
                    <div class="empty-state">
                        <p>💌 No love stories shared yet.</p>
                        ${
                            this.isOwnProfile
                                ? `<a href="/index.html" class="btn btn-primary">Share your first story!</a>`
                                : `<p>Check back later for updates 💞</p>`
                        }
                    </div>`;
                return;
            }

            const tempLoveStories = new LoveStories(new NotificationService(), new AnonUserTracker());
            this.storiesContainer.innerHTML = stories
                .map((story) => tempLoveStories.getStoryHTML(story))
                .join("");

        } catch (err) {
            console.error("❌ Error loading user stories:", err);
            this.storiesContainer.innerHTML = `
                <p style="color:red;text-align:center;">❌ Could not load user's stories.</p>`;
        }
    }

    // =====================================================
    // 8️⃣ Tab Switching
    // =====================================================
    attachTabHandlers() {
    document.querySelectorAll(".profile-tabs .tab-btn").forEach((button) => {
        button.addEventListener("click", (e) => {
            const tabId = e.target.dataset.tab;
            document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));

            e.target.classList.add("active");
            const targetPane = document.getElementById(`${tabId}-tab`);
            if (targetPane) targetPane.classList.add("active");

            // 🟢 CRITICAL FIX: Use viewedUser instead of currentUser
            if (!this.viewedUser) return;
            
            const userIdToLoad = this.viewedUser.id;
            
            switch (tabId) {
                case "stories":
                    this.loadUserStories(userIdToLoad);
                    break;
                case "followers":
                    this.loadFollowers(userIdToLoad);
                    break;
                case "following":
                    this.loadFollowing(userIdToLoad);
                    break;
                case "activity":
                    this.loadUserActivity(userIdToLoad);
                    break;
            }
        });
    });
}

    // =====================================================
    // 9️⃣ Followers & Following
    // =====================================================
    async loadFollowers(userId) {
        const container = document.getElementById("followersContainer");

        if (!container) return;

        this.showLoading("followersContainer", "Loading Followers...");
        try {
            const followers = await this.api.request(`/users/${userId}/followers`);
            if (!followers.length) {
                container.innerHTML = `<p class="empty-state">No users are following you yet. 🥺</p>`;
                return;
            }
            const ids = followers.map((f) => f.id);
            const statusMap = await this.getFollowStatusBatch(ids);
            container.innerHTML = this.renderUserList(followers, statusMap);
            this.attachFollowButtonHandlers();
        } catch (err) {
            console.error("❌ Error loading followers:", err);
            container.innerHTML = `<p style="color:red;">❌ Failed to load followers.</p>`;
        }
    }

    async loadFollowing(userId) {
        const container = document.getElementById("followingContainer");

        if (!container) return;

        this.showLoading("followingContainer", "Loading Following...");
        try {
            const following = await this.api.request(`/users/${userId}/following`);
            if (!following.length) {
                container.innerHTML = `<p class="empty-state">You are not following anyone yet. 🔍</p>`;
                return;
            }
            const ids = following.map((f) => f.id);
            const statusMap = await this.getFollowStatusBatch(ids);
            container.innerHTML = this.renderUserList(following, statusMap);
            this.attachFollowButtonHandlers();
        } catch (err) {
            console.error("❌ Error loading following:", err);
            container.innerHTML = `<p style="color:red;">❌ Failed to load following.</p>`;
        }
    }

    renderUserList(users, statusMap = {}) {
        const myId = this.currentUser ? this.currentUser.id : null;

        return users
            .map((user) => {
                if (user.id == myId) return "";

                const isFollowing = statusMap[user.id] || false;
                const btnText = isFollowing ? "Following" : "+ Follow";
                const btnClass = isFollowing ? "following" : "";

                return `<div class="user-card" data-user-id="${user.id}">
                    <a href="/profile.html?user=${encodeURIComponent(user.username)}">
                         <img src="${user.avatar_url || '/images/default-avatar.png'}" alt="${user.username}" class="user-avatar" />
                    </a>
                    <div class="user-info">
                        <h4>${user.display_name || user.username}</h4>
                        <p class="user-bio">${user.bio || ''}</p>
                    </div>
                    <div class="user-actions">
                        <button class="follow-btn follow-toggle-btn ${btnClass}" data-user-id="${user.id}">
                            ${btnText}
                        </button>
                    </div>
                </div>`;
            })
            .join("");
    }

    attachFollowButtonHandlers() {
        document.removeEventListener("click", this.followClickHandler);

        this.followClickHandler = (e) => {
            const button = e.target.closest(".follow-toggle-btn");

            if (button && this.currentUser) {
                const targetId = button.dataset.userId;
                const isRelevant =
                    document.getElementById("followers-tab")?.classList.contains("active") ||
                    document.getElementById("following-tab")?.classList.contains("active");

                if (isRelevant) this.toggleFollow(targetId, button);
            }
        };

        document.addEventListener("click", this.followClickHandler);
    }

    async toggleFollow(targetId, button) {
        button.disabled = true;
        const initial = button.textContent;
        button.textContent = "...";

        try {
            const res = await this.api.request(`/users/${targetId}/follow`, { method: "POST" });
            
            this.updateFollowButton(button, res.is_following);
            this.updateProfileCounts(res.is_following);

            if (document.getElementById("profileFollowers") && res.target_follower_count !== undefined) {
                document.getElementById("profileFollowers").textContent = `${res.target_follower_count} Followers`;
            }
            if (document.getElementById("profileFollowing") && res.follower_following_count !== undefined) {
                document.getElementById("profileFollowing").textContent = `${res.follower_following_count} Following`;
            }

        } catch (err) {
            console.error("❌ Follow toggle failed:", err);
            button.textContent = initial;
        } finally {
            button.disabled = false;
        }
    }

    updateFollowButton(button, isFollowing) {
        button.textContent = isFollowing ? "Following" : "Follow";
        button.classList.toggle("following", isFollowing);
    }

    updateProfileCounts(isFollowing) {
        // Optional: Update local counts if needed
    }

    async getFollowStatusBatch(ids) {
        if (!this.currentUser) return {};
        
        if (!this._followingSet) {
            try {
                const following = await this.api.request(`/users/${this.currentUser.id}/following`);
                this._followingSet = new Set(following.map((u) => u.id));
            } catch (error) {
                console.error("Failed to load user's following list for batch check:", error);
                this._followingSet = new Set();
            }
        }

        const statusMap = {};
        ids.forEach((id) => (statusMap[id] = this._followingSet.has(parseInt(id))));
        
        return statusMap;
    }

    // =====================================================
    // 🔟 Activity Feed
    // =====================================================
    async loadUserActivity(userId) {
        const container = document.getElementById("userActivityContainer");

        if (!container) return;

        this.showLoading("userActivityContainer", "Loading your activity feed...");
        try {
            const activity = await this.api.request(`/users/${userId}/activity`);
            if (!activity.length) {
                container.innerHTML = `<p class="empty-state">No recent activity yet. 🚀</p>`;
                return;
            }
            container.innerHTML = this.renderActivityFeed(activity);
        } catch (err) {
            console.error("❌ Error loading user activity:", err);
            container.innerHTML = `<p style="color:red;">❌ Failed to load activity feed.</p>`;
        }
    }

    renderActivityFeed(activity) {
        return `<div class="activity-list">
            ${activity
                .map((item) => {
                    const date = new Date(item.date).toLocaleString();
                    let icon = "🔔", linkHtml = "", color = "#333";
                    
                    if (item.type === "story_like") {
                        icon = "❤️";
                        color = "#ff4b8d";
                        
                        if (item.story_id) {
                            linkHtml = `<a href="/stories.html?story=${item.story_id}" class="activity-link">View Story</a>`;
                        } else {
                            linkHtml = `<a href="/stories.html" class="activity-link">Browse Stories</a>`;
                        }
                        
                    } else if (item.type === "new_follower") {
                        icon = "✨";
                        
                        if (item.follower_username) {
                            linkHtml = `<a href="/profile.html?user=${encodeURIComponent(item.follower_username)}" class="activity-link">View Profile</a>`;
                        } else if (item.actor_username) {
                            linkHtml = `<a href="/profile.html?user=${encodeURIComponent(item.actor_username)}" class="activity-link">View Profile</a>`;
                        } else {
                            const usernameMatch = item.message?.match(/@(\w+)/);
                            if (usernameMatch) {
                                linkHtml = `<a href="/profile.html?user=${encodeURIComponent(usernameMatch[1])}" class="activity-link">View Profile</a>`;
                            } else {
                                linkHtml = `<a href="/followers.html" class="activity-link">View Followers</a>`;
                            }
                        }
                    } else {
                        linkHtml = `<a href="/activity.html" class="activity-link">View Details</a>`;
                    }
                    
                    return `
                        <div class="activity-item" style="border-left: 3px solid ${color};">
                            <div class="activity-message">
                                <span class="activity-icon">${icon}</span>
                                <span class="activity-text">${item.message}</span>
                            </div>
                            <div class="activity-meta">
                                ${linkHtml} • <span class="activity-date">${date}</span>
                            </div>
                        </div>
                    `;
                })
                .join("")}
        </div>`;
    }

    // =====================================================
    // 🧩 Utility
    // =====================================================
    showLoading(id, text = "Loading...") {
        const el = document.getElementById(id);
        if (el)
            el.innerHTML = `<div class="loading-wrapper" style="text-align:center;padding:40px;">
                <div class="spinner"></div><p style="margin-top:12px;color:#666;">${text}</p>
            </div>`;
    }
}

// =====================================================
// 🌟 Initialize
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    if (typeof LoveStoriesAPI === "undefined" || typeof NotificationService === "undefined" || typeof LoveStories === "undefined" || typeof AnonUserTracker === "undefined") {
        console.error("❌ Dependency missing: Required global classes (LoveStoriesAPI, NotificationService, LoveStories, AnonUserTracker) must be loaded before profile.js");
        return;
    }

    new ProfileManager();
});

// Global avatar update handler for cross-component synchronization
window.addEventListener('avatarUpdated', (event) => {
    const { avatarUrl } = event.detail;
    console.log('✅ Avatar updated globally:', avatarUrl);
});

// Global handler for Message button clicks on profiles
document.addEventListener(
    "click",
    (e) => {
        const btn = e.target.closest("#messageUserBtn, .message-user-btn");
        if (btn) {
            console.log("💌 Global handler → Message button clicked");
            const userId = btn.dataset.userId;
            if (userId) {
                window.messagesManager?.openMessagesModal(userId);
            }
        }
    },
    true // capture mode
);
