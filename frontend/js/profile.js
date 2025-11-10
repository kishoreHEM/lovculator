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
        this.profileInfoContainer = document.getElementById("profileInfoContainer");
        this.storiesContainer = document.getElementById("userStoriesContainer");
        this.currentUser = null;

        // Assuming LoveStoriesAPI is a defined class in another file
        this.api = new LoveStoriesAPI(); 
        this.init();
    }

// =====================================================
// 1️⃣ Initialize Profile (Fixed for visiting other users)
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
            const meRes = await fetch(`${this.API_BASE}/auth/me`, { credentials: "include" });
            if (meRes.ok) {
                currentUser = await meRes.json();
                this.currentUser = currentUser;
                window.currentUserId = currentUser.id;
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

            this.renderProfileDetails(otherUser, false);
            await this.loadUserStories(otherUser.id);

        } else if (currentUser) {
            // Viewing your own profile
            this.viewedUser = currentUser;
            this.renderProfileDetails(currentUser, true);
            await this.loadUserStories(currentUser.id);
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
// 2️⃣ Render Profile Details
// =====================================================
renderProfileDetails(user, isOwnProfile = true) {
  if (!this.profileInfoContainer) return;

  const followerCount = user.follower_count ?? 0;
  const followingCount = user.following_count ?? 0;
  const displayName = user.display_name || user.username || "User";
  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "Recently";

  const avatar = user.avatar_url
    ? `<img src="${user.avatar_url}" alt="${displayName}" class="profile-avatar-img" />`
    : `<div class="profile-avatar-fallback">${displayName[0]?.toUpperCase() || "?"}</div>`;

  this.profileInfoContainer.innerHTML = `
    <div class="profile-header-card">
      <div class="profile-main-info">
        <div class="profile-avatar">${avatar}</div>
        <div class="profile-details">
          <h3 id="profileUsername">${displayName}</h3>
          <div class="social-stats">
            <span id="profileFollowers">${followerCount} Followers</span>
            <span class="separator">·</span>
            <span id="profileFollowing">${followingCount} Following</span>
          </div>
          <p id="profileJoined" class="joined-date">Joined ${joinedDate}</p>
          <div class="profile-bio-summary">
            ${user.bio ? `<p class="bio-text">${user.bio}</p>` : `<p class="bio-text empty">No bio set yet.</p>`}
            ${user.location ? `<span class="location">📍 ${user.location}</span>` : ""}
          </div>
        </div>
      </div>

      <div class="profile-actions-bar">
        ${
          isOwnProfile
            ? `<button id="editProfileBtn" class="btn btn-secondary btn-small">✏️ Edit Profile</button>
               <button id="logoutBtn" class="btn btn-secondary btn-small">🚪 Logout</button>`
            : `<button id="followProfileBtn" class="btn btn-primary btn-small">+ Follow</button>`
        }
      </div>
    </div>
  `;

  // Reattach events
  if (isOwnProfile) {
    this.attachLogoutHandler();
    this.attachEditProfileHandlers();
  } else {
    this.attachFollowProfileHandler(user.id);
  }
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
    // 3️⃣ Handle Unauthorized User
    // =====================================================

    handleUnauthorized() {
        alert("⚠️ You must log in to view your profile.");
        window.location.href = "/login.html";
    }

    // =====================================================
    // 4️⃣ Logout Handler
    // =====================================================

    attachLogoutHandler() {
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.addEventListener("click", this.handleLogout.bind(this));
    }

    async handleLogout() {
        try {
            // CORRECTED: Template literal for URL
            const logoutRes = await fetch(`${this.API_BASE}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
            if (logoutRes.ok) {
                alert("✅ Logged out successfully!");
                setTimeout(() => (window.location.href = "/login.html"), 300);
            } else alert("Logout failed. Please try again.");
        } catch (err) {
            console.error("Logout error:", err);
            alert("⚠️ Network error during logout.");
        }
    }

// =====================================================
// 5️⃣ Edit Profile Handlers (Fixed)
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
        modal.style.display = "flex"; // make it visible
        setTimeout(() => modal.classList.add("active"), 10); // small delay for smooth fade-in
      }
    });
  }

  // 🔴 Close modal helper
  const closeModal = () => {
    if (modal) {
      modal.classList.remove("active");
      setTimeout(() => (modal.style.display = "none"), 300); // matches transition duration
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
            // CORRECTED: Template literal for URL
            const updatedUser = await this.api.request(`/users/${this.currentUser.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedData),
            });

            this.currentUser = { ...this.currentUser, ...updatedUser };
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
// 6️⃣ Load User’s Stories (Fixed for both self/other)
// =====================================================
async loadUserStories(userIdentifier) {
  if (!this.storiesContainer) return;

  this.showLoading("userStoriesContainer", "Loading love stories...");

  try {
    // ✅ Universal route works for both numeric ID and username
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

    // ✅ Render using LoveStories component
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
    // 7️⃣ Tab Switching
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

                if (!this.currentUser) return;
                switch (tabId) {
                    case "stories":
                        this.loadUserStories(this.currentUser.id);
                        break;
                    case "followers":
                        this.loadFollowers(this.currentUser.id);
                        break;
                    case "following":
                        this.loadFollowing(this.currentUser.id);
                        break;
                    case "activity":
                        this.loadUserActivity(this.currentUser.id);
                        break;
                }
            });
        });
    }

    // =====================================================
    // 8️⃣ Followers & Following
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
        const myId = this.currentUser ? this.currentUser.id : null; // Check for currentUser existence

        return users
            .map((user) => {
                if (user.id == myId) return "";

                const isFollowing = statusMap[user.id] || false;
                const btnText = isFollowing ? "Following" : "+ Follow"; // Quora style uses + Follow
                
                // Use the class 'follow-btn' to match the feed component
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
    // ✅ Correct API call
    const res = await this.api.request(`/users/${targetId}/follow`, { method: "POST" });
    
    // ✅ Update button state
    this.updateFollowButton(button, res.is_following);
    this.updateProfileCounts(res.is_following);

    // ✅ Instantly update visible counts without refresh
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

    async getFollowStatusBatch(ids) {
        if (!this.currentUser) return {};
        
        // Use a cached list if available
        if (!this._followingSet) {
            try {
                // Fetch the list of users the current user is following
                const following = await this.api.request(`/users/${this.currentUser.id}/following`);
                // Cache the list in a Set for fast lookup
                this._followingSet = new Set(following.map((u) => u.id));
            } catch (error) {
                console.error("Failed to load user's following list for batch check:", error);
                this._followingSet = new Set(); // Cache an empty set on failure
            }
        }

        const statusMap = {};
        // The IDs in 'ids' might be strings, so ensure consistency with cached numbers
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
                
                console.log("🔍 Activity Item:", item); // Debug log
                
                if (item.type === "story_like") {
                    icon = "❤️";
                    color = "#ff4b8d";
                    
                    // ✅ FIXED: Safe URL construction
                    if (item.story_id) {
                        linkHtml = `<a href="/stories.html?story=${item.story_id}" class="activity-link">View Story</a>`;
                    } else {
                        // Fallback: Link to general stories page
                        linkHtml = `<a href="/stories.html" class="activity-link">Browse Stories</a>`;
                    }
                    
                } else if (item.type === "new_follower") {
                    icon = "✨";
                    
                    // ✅ FIXED: Safe URL construction
                    if (item.follower_username) {
                        linkHtml = `<a href="/profile.html?user=${encodeURIComponent(item.follower_username)}" class="activity-link">View Profile</a>`;
                    } else if (item.actor_username) {
                        linkHtml = `<a href="/profile.html?user=${encodeURIComponent(item.actor_username)}" class="activity-link">View Profile</a>`;
                    } else {
                        // Extract username from message
                        const usernameMatch = item.message?.match(/@(\w+)/);
                        if (usernameMatch) {
                            linkHtml = `<a href="/profile.html?user=${encodeURIComponent(usernameMatch[1])}" class="activity-link">View Profile</a>`;
                        } else {
                            // Fallback: Link to followers page
                            linkHtml = `<a href="/followers.html" class="activity-link">View Followers</a>`;
                        }
                    }
                } else {
                    // Handle other activity types
                    linkHtml = `<a href="/activity.html" class="activity-link">View Details</a>`;
                }
                
                // ✅ FIXED: Proper HTML structure
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
            // CORRECTED: Template literal for HTML string
            el.innerHTML = `<div class="loading-wrapper" style="text-align:center;padding:40px;">
                <div class="spinner"></div><p style="margin-top:12px;color:#666;">${text}</p>
            </div>`;
    }

}

// =====================================================
// 🌟 Initialize
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    // Check if required global classes are defined before initializing
    if (typeof LoveStoriesAPI === "undefined" || typeof NotificationService === "undefined" || typeof LoveStories === "undefined" || typeof AnonUserTracker === "undefined") {
        console.error("❌ Dependency missing: Required global classes (LoveStoriesAPI, NotificationService, LoveStories, AnonUserTracker) must be loaded before profile.js");
        return;
    }

    new ProfileManager();
});