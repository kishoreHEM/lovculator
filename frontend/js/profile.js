// frontend/js/profile.js — Lovculator with "My Stories" Dashboard 💖

class ProfileManager {
  constructor() {
    this.API_BASE = window.ROOT_API_BASE; 

    this.profileInfoContainer = document.getElementById("profileInfoContainer"); 
    this.storiesContainer = document.getElementById("userStoriesContainer");
    this.currentUser = null;
    
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
      this.attachEditProfileHandlers(); // Added for profile editing
      
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
    
    const followerCount = user.follower_count ?? 0;
    const followingCount = user.following_count ?? 0;
    const displayName = user.username; 
    
    const initials = displayName ? displayName[0].toUpperCase() : '?';
    const joinedDate = new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    this.profileInfoContainer.innerHTML = `
        <div class="profile-header-card">
            <div class="profile-main-info">
                <div class="profile-avatar" style="--initial-bg: #ff4b8d; --initial-color: white;">
                    <span id="initials">${initials}</span>
                </div>
                <div class="profile-details">
                    <h1 id="profileUsername">${displayName}</h1> 
                    
                    <div class="social-stats">
                        <span id="profileFollowers">${followerCount} Followers</span>
                        <span class="separator">·</span>
                        <span id="profileFollowing">${followingCount} Following</span>
                    </div>

                    <p id="profileJoined" class="joined-date">Joined ${joinedDate}</p>
                    
                    <div class="profile-bio-summary">
                        ${user.bio ? `<p class="bio-text">${user.bio}</p>` : `<p class="bio-text empty">No bio set yet.</p>`}
                        ${user.location ? `<span class="location">📍 ${user.location}</span>` : ''}
                    </div>
                </div>
            </div>

            <div class="profile-actions-bar">
                <button id="editProfileBtn" class="btn btn-secondary btn-small">
                    <span class="icon">✏️</span> Edit Profile
                </button>
                
                <button id="logoutBtn" class="btn btn-secondary btn-small">
                    <span class="icon">🚪</span> Logout
                </button>
            </div>
        </div>
    `;
    this.attachLogoutHandler();
    this.attachEditProfileHandlers(); // Ensure this is called here too if the DOM elements exist
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
  // 4️⃣.1 Edit Profile Handlers
  // ------------------------------
  attachEditProfileHandlers() {
      const editBtn = document.getElementById("editProfileBtn");
      const modal = document.getElementById("editProfileModal");
      const closeBtn = modal?.querySelector(".close-btn");
      const form = document.getElementById("editProfileForm");

      if (editBtn) {
          // Open modal
          editBtn.addEventListener("click", () => {
              this.populateEditForm();
              if(modal) modal.style.display = "block";
          });
      }

      if (closeBtn) {
          // Close modal
          closeBtn.addEventListener("click", () => {
              if(modal) modal.style.display = "none";
          });
      }

      // Close on outside click
      window.addEventListener("click", (e) => {
          if (e.target === modal) {
              modal.style.display = "none";
          }
      });

      if (form) {
          // Submit handler
          form.addEventListener("submit", this.handleEditProfile.bind(this));
      }
  }

  // ------------------------------
  // 4️⃣.2 Populate Edit Form
  // ------------------------------
  populateEditForm() {
      if (!this.currentUser) return;

      // Use current user data to fill the form fields
      document.getElementById("editDisplayName").value = this.currentUser.display_name || '';
      document.getElementById("editBio").value = this.currentUser.bio || '';
      document.getElementById("editLocation").value = this.currentUser.location || '';
      document.getElementById("editRelationshipStatus").value = this.currentUser.relationship_status || 'Single';
      
      document.getElementById("editProfileMessage").textContent = "";
  }

  // ------------------------------
  // 4️⃣.3 Handle Edit Profile Submission
  // ------------------------------
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
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedData)
          });

          this.currentUser = { ...this.currentUser, ...updatedUser }; 
          this.renderProfileDetails(this.currentUser); 
          
          messageEl.textContent = "✅ Profile updated successfully!";
          messageEl.style.color = 'green';
          
          setTimeout(() => {
              if(modal) modal.style.display = 'none';
          }, 1500);

      } catch (err) {
          console.error("❌ Profile update failed:", err);
          const errorMsg = err.data?.error || "Failed to save changes. Please try again.";
          messageEl.textContent = `❌ ${errorMsg}`;
          messageEl.style.color = 'red';
      } finally {
          saveBtn.disabled = false;
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

              document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
              document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

              e.target.classList.add('active');
              const targetPane = document.getElementById(`${tabId}-tab`);
              if (targetPane) {
                 targetPane.classList.add('active');
              } else {
                 console.error(`❌ Tab pane element #${tabId}-tab not found in profile.html`);
                 return;
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
                  case 'activity': // CALL TO NEW ACTIVITY METHOD
                      this.loadUserActivity(this.currentUser.id); 
                      break;
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

          const followerIds = followers.map(f => f.id);
          const statusMap = await this.getFollowStatusBatch(followerIds); 

          container.innerHTML = this.renderUserList(followers, statusMap);
          this.attachFollowButtonHandlers(); 

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

          const followingIds = following.map(f => f.id);
          const statusMap = await this.getFollowStatusBatch(followingIds); 

          container.innerHTML = this.renderUserList(following, statusMap);
          this.attachFollowButtonHandlers();
          
      } catch (err) {
          console.error("❌ Error loading following:", err);
          container.innerHTML = `<p style="color:red;">❌ Failed to load following list.</p>`;
      }
  }

  // ------------------------------
  // 9️⃣ Utility: Render User List
  // ------------------------------
  renderUserList(users, statusMap = {}) { 
      const myId = this.currentUser.id; 

      return users.map(user => {
          if (user.id == myId) return ''; 
          
          const isFollowing = statusMap[user.id] || false; 
          
          const btnText = isFollowing ? 'Following' : 'Follow';
          const btnBg = isFollowing ? '#ff4b8d' : '#f0f0f0';
          const btnColor = isFollowing ? 'white' : '#333';
          const initialStatus = isFollowing ? 'following' : 'not-following';

          return `
              <div class="user-list-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
                  <div class="user-info">
                      <span style="font-weight:bold; color:#ff4b8d;">@${user.username}</span>
                      <span style="color:#888; font-size:0.8em;">(${user.email})</span>
                  </div>
                  <button 
                      class="btn btn-small follow-toggle-btn" 
                      data-user-id="${user.id}"
                      data-initial-status="${initialStatus}"
                      title="Click to Follow/Unfollow"
                      style="background:${btnBg}; color:${btnColor}; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;"
                  >
                      ${btnText} 
                  </button>
              </div>
          `;
      }).join('');
  }

  // ------------------------------
  // 🔟 Toggle Follow Status 
  // ------------------------------
  async toggleFollow(targetId, button) {
      if (!this.currentUser) return; 

      button.disabled = true;
      const initialText = button.textContent;
      button.textContent = '...';

      try {
          const response = await this.api.request(`/users/${targetId}/follow`, {
              method: 'POST'
          });

          const isFollowing = response.is_following; 
          this.updateFollowButton(button, isFollowing);
          
          this.updateProfileCounts(isFollowing);

      } catch (err) {
          console.error("❌ Follow/Unfollow failed:", err);
          button.textContent = initialText; 
          alert("Failed to change follow status. Please try again.");
      } finally {
          button.disabled = false;
      }
  }

  // ------------------------------
  // 1️⃣1️⃣ Update Button Appearance
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
  // 1️⃣2️⃣ Attach Listeners to New Buttons
  // ------------------------------
  attachFollowButtonHandlers() {
      document.addEventListener('click', (e) => {
          const button = e.target.closest('.follow-toggle-btn');
          if (button && this.currentUser) {
              const targetId = button.dataset.userId;
              const isRelevantClick = document.getElementById('followers-tab')?.classList.contains('active') || 
                                      document.getElementById('following-tab')?.classList.contains('active');
                                      
              if (isRelevantClick) {
                 this.toggleFollow(targetId, button);
              }
          }
      });
  }

  // ------------------------------
  // 1️⃣3️⃣ Batch Status Check
  // ------------------------------
  async getFollowStatusBatch(userIds) {
      if (!this.currentUser) {
          return userIds.reduce((map, id) => ({ ...map, [id]: false }), {});
      }
      
      const statusMap = {};
      
      try {
          const following = await this.api.request(`/users/${this.currentUser.id}/following`);
          const followingIds = new Set(following.map(user => user.id));

          userIds.forEach(id => {
              statusMap[id] = followingIds.has(parseInt(id));
          });
          
      } catch (err) {
          console.error("❌ Failed to fetch current user's following list for batch check:", err);
          userIds.forEach(id => { statusMap[id] = false; });
      }
      
      return statusMap;
  }
  
  // ------------------------------
  // 1️⃣4️⃣ Update Profile Header Counts
  // ------------------------------
  updateProfileCounts(isFollowing) {
      const followingSpan = document.getElementById('profileFollowing');
      if (followingSpan) {
          let currentCount = parseInt(followingSpan.textContent.split(' ')[0]) || 0;
          if (isFollowing) {
              currentCount += 1;
          } else if (currentCount > 0) {
              currentCount -= 1;
          }
          followingSpan.textContent = `${currentCount} Following`;
          
          this.currentUser.following_count = currentCount;
      }
  }
  
  // ------------------------------
  // 1️⃣5️⃣ Utility: Loading Placeholder
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

  // ------------------------------
  // 1️⃣6️⃣ Load User Activity (CORRECTLY PLACED)
  // ------------------------------
  async loadUserActivity(userId) {
    const container = document.getElementById("userActivityContainer");
    if (!container) return;
    
    this.showLoading("userActivityContainer", "Loading your activity feed...");

    try {
        // Fetch activity from the new backend route
        const activity = await this.api.request(`/users/${userId}/activity`);

        if (!activity.length) {
            container.innerHTML = `<p class="empty-state">No recent activity yet. Share more stories! 🚀</p>`;
            return;
        }

        container.innerHTML = this.renderActivityFeed(activity);

    } catch (err) {
        console.error("❌ Error loading user activity:", err);
        container.innerHTML = `<p style="color:red;">❌ Failed to load activity feed.</p>`;
    }
  }

  // ------------------------------
// 1️⃣7️⃣ Render Activity Feed (UPDATED to handle Likes)
// ------------------------------
renderActivityFeed(activity) {
    return `
        <div class="activity-list">
            ${activity.map(item => {
                const date = new Date(item.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric', 
                    minute: 'numeric' 
                });
                
                let linkHTML = '';
                let icon = '🔔';
                let messageStyle = '';

                // Add links and icons based on activity type
                if (item.type === 'story_like') {
                    // Link to the story page if a story ID is present
                    linkHTML = `<a href="/love-stories.html?storyId=${item.related_story_id}" style="color:#ff4b8d; font-weight: 500;">(View Story)</a>`;
                    icon = '❤️';
                    messageStyle = 'color: #ff4b8d;';
                } else if (item.type === 'new_follower') {
                    // Link to the user's profile
                    linkHTML = `<a href="/profile.html?user=${item.actor_username}" style="color:#666;">(View Profile)</a>`;
                    icon = '✨';
                    messageStyle = 'color:#333;';
                }

                return `
                    <div class="activity-item" style="padding:15px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                        <p style="flex-grow: 1;">
                            <span style="font-size: 1.2em; margin-right: 8px;">${icon}</span>
                            <span style="font-weight:bold; ${messageStyle}">${item.message}</span>
                            <br>
                            <span style="color:#888; font-size:0.85em; margin-left: 20px;">
                                ${linkHTML}
                            </span>
                        </p>
                        <span style="font-size:0.75em; color:#bbb; flex-shrink: 0; margin-left: 10px; text-align: right;">
                            ${date}
                        </span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
} // End of ProfileManager Class

// 🌟 Initialize ProfileManager
document.addEventListener("DOMContentLoaded", () => {
  if (typeof LoveStoriesAPI === 'undefined' || typeof NotificationService === 'undefined') {
      console.error("❌ Dependency missing: love-stories.js must be loaded before profile.js");
      return; 
  }
  new ProfileManager();
});