// frontend/js/profile.js — Lovculator with "My Stories" Dashboard 💖

class ProfileManager {
  constructor() {
    // 🔑 Use the correct global variable for API Base (Assumes fix in auth.js)
    this.API_BASE = window.ROOT_API_BASE; 

    this.profileInfoContainer = document.getElementById("profileInfoContainer"); 
    this.storiesContainer = document.getElementById("userStoriesContainer");
    this.currentUser = null;
    
    // Assumes LoveStoriesAPI is globally available from love-stories.js
    this.api = new LoveStoriesAPI(); 
    
    this.init();
  }

  // ------------------------------
  // 1️⃣ Initialize Profile
  // ------------------------------
  async init() {
    this.showLoading("profileInfoContainer");
    this.showLoading("userStoriesContainer");

    try {
      // NOTE: Using window.ROOT_API_BASE + /auth/me for correct path
      const res = await fetch(`${this.API_BASE}/auth/me`, { credentials: "include" });

      if (!res.ok) {
        this.handleUnauthorized();
        return;
      }

      const user = await res.json();
      this.currentUser = user;

      this.renderProfileDetails(user);
      await this.loadUserStories(user.id);
      
      this.attachTabHandlers(); 
      
    } catch (err) {
      console.error("❌ Profile load error:", err);
      this.profileInfoContainer.innerHTML = `<p style="color:red;text-align:center;">❌ Failed to load profile.</p>`;
    }
  }

  // ------------------------------
  // 2️⃣ Render Profile Details
  // ------------------------------
  renderProfileDetails(user) {
    if (!this.profileInfoContainer) return;
    
    const initials = user.username ? user.username[0].toUpperCase() : '?';
    const joinedDate = new Date(user.created_at).toLocaleDateString();

    this.profileInfoContainer.innerHTML = `
        <div class="profile-info">
            <div class="profile-avatar">
                <span id="initials">${initials}</span>
            </div>
            <div class="profile-details">
                <h1 id="profileUsername">${user.username}</h1>
                <p id="profileEmail">${user.email}</p>
                <p id="profileJoined">Joined: ${joinedDate}</p>
                <div class="profile-actions">
                    <button id="logoutBtn" class="btn btn-secondary">🚪 Logout</button>
                    <a href="record.html" class="btn btn-primary">📊 View Records</a>
                </div>
            </div>
        </div>
    `;
    this.attachLogoutHandler();
  }

  // ------------------------------
  // 3️⃣ Handle Unauthorized User
  // ------------------------------
  handleUnauthorized() {
    alert("⚠️ You must log in to view your profile.");
    window.location.href = "/login.html";
  }

  // ------------------------------
  // 4️⃣ Logout Handler
  // ------------------------------
  attachLogoutHandler() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", this.handleLogout.bind(this));
    }
  }

  async handleLogout() {
    try {
      const logoutRes = await fetch(`${this.API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (logoutRes.ok) {
        alert("✅ Logged out successfully!");
        setTimeout(() => (window.location.href = "/login.html"), 200);
      } else {
        alert("Logout failed. Please try again.");
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert("⚠️ Network error during logout.");
    }
  }

  // ------------------------------
  // 5️⃣ Load User’s Stories
  // ------------------------------
  async loadUserStories(userId) {
    if (!this.storiesContainer) return;

    this.storiesContainer.innerHTML = `<div class="loading-wrapper"><div class="spinner"></div><p>Loading your stories...</p></div>`;

    try {
      const stories = await this.api.request(`/stories?userId=${userId}`); 
      
      if (!stories.length) {
        this.storiesContainer.innerHTML = `
          <div class="empty-state">
            <p>💌 You haven’t shared any love stories yet.<br></p>
            <a href="/love-stories.html" class="btn btn-primary">Share one now!</a>
          </div>
        `;
        return;
      }

      // Reusing LoveStories rendering logic
      const tempLoveStories = new LoveStories(new NotificationService(), new AnonUserTracker());

      this.storiesContainer.innerHTML = stories.map((story) => 
        tempLoveStories.getStoryHTML(story)
      ).join("");

    } catch (err) {
      console.error("❌ Error loading user stories:", err);
      this.storiesContainer.innerHTML = `<p style="text-align:center;color:red;">❌ Could not load your stories. Check your network.</p>`;
    }
  }
  
  // ------------------------------
  // 6️⃣ Handle Tab Switching
  // ------------------------------
  attachTabHandlers() {
      document.querySelectorAll('.profile-tabs .tab-btn').forEach(button => {
          button.addEventListener('click', (e) => {
              const tabId = e.target.dataset.tab;

              // Deactivate all buttons and panes
              document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
              document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

              // Activate selected button and pane
              e.target.classList.add('active');
              // ❌ FIX: Safely access classList to prevent "null" error
              const targetPane = document.getElementById(`${tabId}-tab`);
              if (targetPane) {
                 targetPane.classList.add('active');
              } else {
                 console.error(`❌ Tab pane element #${tabId}-tab not found in profile.html`);
                 return; // Stop if the pane is missing
              }

              if (!this.currentUser) return; 

              switch(tabId) {
                  case 'stories':
                      this.loadUserStories(this.currentUser.id);
                      break;
                  case 'followers':
                      this.loadFollowers(this.currentUser.id);
                      break;
                  case 'following':
                      this.loadFollowing(this.currentUser.id);
                      break;
                  // 'activity' tab left for future implementation
              }
          });
      });
  }

  // ------------------------------
  // 7️⃣ Load Followers
  // ------------------------------
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

          container.innerHTML = this.renderUserList(followers);
          this.attachFollowButtonHandlers(); // 🔑 NEW: Attach handlers after rendering

      } catch (err) {
          console.error("❌ Error loading followers:", err);
          container.innerHTML = `<p style="color:red;">❌ Failed to load followers list.</p>`;
      }
  }

  // ------------------------------
  // 8️⃣ Load Following
  // ------------------------------
  async loadFollowing(userId) {
      const container = document.getElementById("followingContainer");
      if (!container) return;
      
      this.showLoading("followingContainer", "Loading Following...");

      try {
          const following = await this.api.request(`/users/${userId}/following`);

          if (!following.length) {
              container.innerHTML = `<p class="empty-state">You are not following any users yet. 🔍</p>`;
              return;
          }

          container.innerHTML = this.renderUserList(following);
          this.attachFollowButtonHandlers(); // 🔑 NEW: Attach handlers after rendering
          
      } catch (err) {
          console.error("❌ Error loading following:", err);
          container.innerHTML = `<p style="color:red;">❌ Failed to load following list.</p>`;
      }
  }

  // ------------------------------
  // 9️⃣ Utility: Render User List (UPDATED with Follow Button)
  // ------------------------------
  renderUserList(users) {
      const myId = this.currentUser.id; 

      return users.map(user => {
          if (user.id == myId) return ''; 

          // 💡 Initial button state logic would go here if we fetch the relationship status
          // For now, it starts as '...' and is set by attachFollowButtonHandlers' first run
          
          return `
              <div class="user-list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                  <div class="user-info">
                      <span style="font-weight:bold; color:#ff4b8d;">@${user.username}</span>
                      <span style="color:#888; font-size:0.8em;">(${user.email})</span>
                  </div>
                  <button 
                      class="btn btn-small follow-toggle-btn" 
                      data-user-id="${user.id}"
                      data-initial-status="unknown"
                      title="Click to Follow/Unfollow"
                      style="background:#f0f0f0; color:#333; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;"
                  >
                      Follow 
                  </button>
              </div>
          `;
      }).join('');
  }

  // ------------------------------
  // 🔟 Toggle Follow Status (MOVED INTO CLASS)
  // ------------------------------
  async toggleFollow(targetId, button) {
      if (!this.currentUser) return; // Must be logged in

      button.disabled = true;
      const initialText = button.textContent;
      button.textContent = '...';

      try {
          // Calls POST /api/users/:targetId/follow
          const response = await this.api.request(`/users/${targetId}/follow`, {
              method: 'POST'
          });

          const isFollowing = response.is_following; 
          this.updateFollowButton(button, isFollowing);
          
      } catch (err) {
          console.error("❌ Follow/Unfollow failed:", err);
          button.textContent = initialText; 
          alert("Failed to change follow status. Please try again.");
      } finally {
          button.disabled = false;
      }
  }

  // ------------------------------
  // 1️⃣1️⃣ Update Button Appearance (MOVED INTO CLASS)
  // ------------------------------
  updateFollowButton(button, isFollowing) {
      if (isFollowing) {
          button.textContent = 'Following';
          button.style.backgroundColor = '#ff4b8d';
          button.style.color = 'white';
          button.dataset.initialStatus = 'following';
      } else {
          button.textContent = 'Follow';
          button.style.backgroundColor = '#f0f0f0';
          button.style.color = '#333';
          button.dataset.initialStatus = 'not-following';
      }
  }

  // ------------------------------
  // 1️⃣2️⃣ Attach Listeners to New Buttons (MOVED INTO CLASS)
  // ------------------------------
  attachFollowButtonHandlers() {
      // Use document as the container listener for simplicity across both tabs
      document.addEventListener('click', (e) => {
          const button = e.target.closest('.follow-toggle-btn');
          if (button && this.currentUser) {
              const targetId = button.dataset.userId;
              this.toggleFollow(targetId, button);
          }
      });
  }

  // ------------------------------
  // 1️⃣3️⃣ Utility: Loading Placeholder
  // ------------------------------
  showLoading(elementId, text = "Loading...") {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `
          <div class="loading-wrapper" style="text-align:center;padding:40px;">
            <div class="spinner"></div>
            <p style="margin-top:12px;color:#666;">${text}</p>
          </div>
        `;
    }
  }
}

// 🌟 Initialize ProfileManager
document.addEventListener("DOMContentLoaded", () => {
  // 🔑 Removed global const declaration and rely on window.ROOT_API_BASE
  if (typeof LoveStoriesAPI === 'undefined' || typeof NotificationService === 'undefined') {
      console.error("❌ Dependency missing: love-stories.js must be loaded before profile.js");
      return; 
  }
  new ProfileManager();
});