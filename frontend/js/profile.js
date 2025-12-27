/**
 * frontend/js/profile.js — Lovculator (OPTIMIZED VERSION)
 * - Modern layout with cover photo + sidebar
 * - Complete follow system with proper state management
 * - All features consolidated with no duplicates
 * - Clean, maintainable code
 */

(() => {
  // -------------------------
  // Configuration & helpers
  // -------------------------
  const API_BASE =
    window.API_BASE ||
    (window.location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api");

  const ASSET_BASE =
    window.ASSET_BASE ||
    (window.location.hostname.includes("localhost")
      ? "http://localhost:3001"
      : "https://lovculator.com");

  // Improved safeJson with better error handling
  async function safeJson(res) {
    try {
      const text = await res.text();
      if (!text) return {};
      return JSON.parse(text);
    } catch (e) {
      console.warn("Failed to parse JSON:", e);
      return { error: `Invalid response: ${res.status}` };
    }
  }

  function getAvatarUrl(url) {
    if (!url || url === "null" || url === "undefined") return "/images/default-avatar.png";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${ASSET_BASE}${url}`;
    return `${ASSET_BASE}/uploads/avatars/${url}`;
  }

  function showNotification(message, type = "success") {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: type === "error" ? "#ff6b6b" : "#4CAF50",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "8px",
      zIndex: 9999,
      boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
      opacity: "0",
      transition: "opacity .25s, transform .25s",
      transform: "translateY(-6px)",
    });
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // -------------------------
  // ProfileManager class
  // -------------------------
  class ProfileManager {
    constructor() {
      this.apiBase = API_BASE;
      this.assetBase = ASSET_BASE;

      this.profileInfoContainer = document.getElementById("profileInfoContainer");
      this.storiesContainer = document.getElementById("userStoriesContainer");
      this.followersContainer = document.getElementById("followersContainer");
      this.followingContainer = document.getElementById("followingContainer");
      this.activityContainer = document.getElementById("userActivityContainer");

      this.currentUser = null;
      this.viewedUser = null;
      this.isOwnProfile = false;
      this._followingSet = null;

      this.followClickHandler = null;

      this.init();
    }

    // -------------------------
    // Core initialization
    // -------------------------
    async init() {
      try {
        this.showLoading("profileInfoContainer");
        this.showLoading("userStoriesContainer");

        // 1. Load session
        await this.loadCurrentSession();

        // 2. Determine which user to show
        let usernameParam = this.extractUsernameFromURL();

        // 3. Fetch appropriate profile
        if (usernameParam && (!this.currentUser || usernameParam !== this.currentUser.username)) {
          const other = await this.fetchUserByUsername(usernameParam);
          if (!other) return this.handleNotFound();
          this.viewedUser = other;
          this.isOwnProfile = this.currentUser && this.currentUser.id === other.id;
        } else if (this.currentUser) {
          const fresh = await this.fetchUserById(this.currentUser.id);
          this.viewedUser = fresh || this.currentUser;
          this.isOwnProfile = true;
        } else {
          return this.handleUnauthorized();
        }

        // 4. Render the modern layout
        this.renderProfileLayout(this.viewedUser, this.isOwnProfile);
        await this.loadUserStories(this.viewedUser.id);

        // 5. Attach event handlers
        this.attachTabHandlers();
        
        if (this.isOwnProfile) {
          this.attachEditProfileHandlers();
          this.attachAvatarUploadHandler();
          this.attachLogoutHandler();
        } else {
          // Hide edit button if present
          const editBtn = document.getElementById("editProfileBtn");
          if (editBtn) editBtn.style.display = 'none';
        }
        
        // Always attach follow handlers (for followers/following lists)
        
        this.attachGlobalMessageButtonHandler();

      } catch (err) {
        console.error("❌ Profile initialization failed:", err);
        this.showError("profileInfoContainer", "Failed to load profile.");
      }
    }

    // -------------------------
    // User & Session Management
    // -------------------------
    extractUsernameFromURL() {
      const params = new URLSearchParams(window.location.search);
      let usernameParam = params.get("user");
      
      if (!usernameParam) {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const profileIndex = pathParts.indexOf('profile');
        if (profileIndex !== -1 && pathParts[profileIndex + 1]) {
          usernameParam = decodeURIComponent(pathParts[profileIndex + 1]);
        }
      }
      return usernameParam;
    }

    async loadCurrentSession() {
      try {
        const res = await fetch(`${this.apiBase}/auth/me`, {
          credentials: "include",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        if (!res.ok) return;
        
        const data = await safeJson(res);
        if (data.user) {
          this.currentUser = data.user;
          window.currentUser = data.user;
          window.currentUserId = data.user.id;
        } else if (data.id) {
          this.currentUser = data;
          window.currentUser = data;
          window.currentUserId = data.id;
        }
      } catch (err) {
        console.warn("⚠️ Could not fetch session:", err);
      }
    }

    async fetchUserByUsername(username) {
      try {
        const res = await fetch(`${this.apiBase}/users/profile/${encodeURIComponent(username)}`, {
          credentials: "include",
        });
        if (!res.ok) return null;
        
        const data = await safeJson(res);
        return data.user || data;
      } catch (err) {
        console.error("❌ fetchUserByUsername error:", err);
        return null;
      }
    }

    async fetchUserById(id) {
      try {
        const res = await fetch(`${this.apiBase}/users/${id}`, { credentials: "include" });
        if (!res.ok) return null;
        
        const data = await safeJson(res);
        return data.user || data;
      } catch (err) {
        console.warn("fetchUserById failed:", err);
        return null;
      }
    }

    // -------------------------
    // Modern Profile Layout Rendering
    // -------------------------
    renderProfileLayout(user, isOwnProfile = false) {
      if (!this.profileInfoContainer) return;

      const displayName = user.display_name || user.username || "User";
      const usernameHandle = user.username ? `${user.username}` : "";
      const avatarUrl = getAvatarUrl(user.avatar_url || user.avatar || user.profile_image);
      const followerCount = user.follower_count ?? user.followers_count ?? 0;
      const followingCount = user.following_count ?? user.following ?? 0;
      
      const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : "Recently";

      const dobDisplay = user.date_of_birth 
        ? new Date(user.date_of_birth).toLocaleDateString("en-US", { month: "long", day: "numeric" }) 
        : "";

      // Header with cover photo
const headerHTML = `
  <div class="profile-cover">
    <div class="profile-header-user">
      <div class="profile-avatar-wrapper">
        <img id="avatarImage" 
             src="${avatarUrl}" 
             class="profile-avatar-large" 
             alt="${displayName}"
             width="160" 
             height="160"
             loading="lazy"
             onerror="this.onerror=null; this.src='/images/default-avatar.png'">
        ${isOwnProfile ? `
        <label class="avatar-upload-label" for="avatarInput" title="Change Avatar" aria-label="Change profile picture">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z">
            </path>
          </svg>
          <input type="file" id="avatarInput" accept="image/*" hidden />
        </label>` : ""}
      </div>
      <div class="profile-header-text">
        <h1>${displayName}</h1>
        <div class="username">@${usernameHandle}</div>
      </div>
      <div class="profile-header-actions">
        ${this.renderActionButtons(user, isOwnProfile)}
      </div>
    </div>
  </div>`;

      // Sidebar with user info
      const sidebarHTML = `
        <aside class="profile-sidebar">
            <div class="profile-intro-card">
                <div class="intro-header">About</div>
                ${user.bio ? `<div class="intro-bio">${user.bio}</div>` : 
                  (isOwnProfile ? `<div class="intro-bio empty">Add a bio to introduce yourself...</div>` : "")}
                
                <div class="intro-details-list">
                    ${user.work_and_education ? `<div class="intro-item"><span class="intro-icon">💼</span><span>${user.work_and_education}</span></div>` : ""}
                    ${user.location ? `<div class="intro-item"><span class="intro-icon">🏠</span><span>Lives in <strong>${user.location}</strong></span></div>` : ""}
                    ${user.relationship_status ? `<div class="intro-item"><span class="intro-icon">❤️</span><span>${user.relationship_status}</span></div>` : ""}
                    ${user.gender ? `<div class="intro-item"><span class="intro-icon">👤</span><span>${user.gender}</span></div>` : ""}
                    ${dobDisplay ? `<div class="intro-item"><span class="intro-icon">🎂</span><span>Born ${dobDisplay}</span></div>` : ""}
                    <div class="intro-item"><span class="intro-icon">📅</span><span>Joined ${joinedDate}</span></div>

                    <div class="intro-item" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; justify-content: space-around;">
                        <div style="text-align:center"><strong style="font-size:1.1rem; color:#222;" id="profileFollowers">${followerCount}</strong><br><span style="font-size:0.8rem; color:#777">Followers</span></div>
                        <div style="text-align:center"><strong style="font-size:1.1rem; color:#222;">${followingCount}</strong><br><span style="font-size:0.8rem; color:#777">Following</span></div>
                    </div>
                </div>
            </div>
        </aside>`;

      // Main container
      this.profileInfoContainer.innerHTML = `
        ${headerHTML}
        <div class="profile-grid-container">
            ${sidebarHTML}
            <div class="profile-content-area" id="injectedTabsContainer"></div>
        </div>
      `;

      // Move existing tabs to the new layout
      const existingTabs = document.querySelector('.profile-tabs-wrapper');
      const newContainer = document.getElementById('injectedTabsContainer');
      if (existingTabs && newContainer) {
        newContainer.appendChild(existingTabs);
        existingTabs.style.display = 'block'; 
      }

      // Re-attach handlers for dynamic elements
      if (isOwnProfile) {
        this.attachEditProfileHandlers();
        this.attachLogoutHandler();
      }
    }

    renderActionButtons(user, isOwnProfile) {
      if (isOwnProfile) {
        return `
          <button id="editProfileBtn" class="btn btn-secondary btn-small">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Edit Profile
          </button>
          <button id="profileCardLogoutBtn" class="btn btn-secondary btn-small profile-logout-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>`;
      } else {
        const isFollowing = user.is_following_author || false;
        return `
          <button id="followProfileBtn" class="btn btn-primary btn-small follow-btn follow-toggle-btn ${isFollowing ? "following" : ""}" 
                  data-user-id="${user.id}"
                  data-user-name="${user.display_name || user.username || 'User'}">
            ${isFollowing ? `
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Following` : `
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
              Follow`}
          </button>
          <button id="messageUserBtn" class="btn btn-secondary btn-small message-user-btn" data-user-id="${user.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            Message
          </button>`;
      }
    }

    // -------------------------
    // Follow System (FIXED VERSION)
    // -------------------------
    async loadFollowers(userId) {
      if (!this.followersContainer) return;
      this.showLoading("followersContainer", "Loading followers...");
      
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/followers`, { 
          credentials: "include" 
        });
        
        if (!res.ok) {
          throw new Error(`Failed to load followers: ${res.status}`);
        }
        
        const data = await safeJson(res);
        const followers = Array.isArray(data) ? data : (data.followers || data.data || []);
        
        if (!followers.length) {
          this.followersContainer.innerHTML = `<p class="empty-state">No followers yet.</p>`;
          return;
        }
        
        const ids = followers.map(f => f.id || f.user_id).filter(id => id);
        const statusMap = await this.getFollowStatusBatch(ids);
        this.followersContainer.innerHTML = this.renderUserList(followers, statusMap);
        
      } catch (err) {
        console.error("Load followers error:", err);
        this.showError("followersContainer", "Failed to load followers.");
      }
    }

    async loadFollowing(userId) {
      if (!this.followingContainer) return;
      this.showLoading("followingContainer", "Loading following...");
      
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/following`, { 
          credentials: "include" 
        });
        
        if (!res.ok) {
          throw new Error(`Failed to load following: ${res.status}`);
        }
        
        const data = await safeJson(res);
        const following = Array.isArray(data) ? data : (data.following || data.data || []);
        
        if (!following.length) {
          this.followingContainer.innerHTML = `<p class="empty-state">Not following anyone yet.</p>`;
          return;
        }
        
        const ids = following.map(f => f.id || f.user_id).filter(id => id);
        const statusMap = await this.getFollowStatusBatch(ids);
        this.followingContainer.innerHTML = this.renderUserList(following, statusMap);
        
      } catch (err) {
        console.error("Load following error:", err);
        this.showError("followingContainer", "Failed to load following.");
      }
    }

    renderUserList(users, statusMap = {}) {
      const myId = this.currentUser ? this.currentUser.id : null;
      
      return users.map(user => {
        const uid = user.id || user.user_id;
        if (!uid) return "";
        if (uid === myId) return ""; // Skip self
        
        const isFollowing = !!statusMap[uid];
        const avatar = getAvatarUrl(user.avatar_url || user.avatar || "/images/default-avatar.png");
        const name = user.display_name || user.username || "User";
        const username = user.username || "";
        const bio = user.bio || "";
        
        return `
          <div class="user-card" data-user-id="${uid}">
            <a href="/profile/${encodeURIComponent(username)}">
              <img src="${avatar}" alt="${name}" class="user-avatar" onerror="this.onerror=null; this.src='/images/default-avatar.png'">
            </a>
            <div class="user-info">
              <h4>${name}</h4>
              <p class="user-bio">${bio}</p>
            </div>
            <div class="user-actions">
              <button class="follow-author-btn follow-toggle-btn ${isFollowing ? "following" : ""}" 
                      data-user-id="${uid}"
                      data-user-name="${name}">
                ${isFollowing ? "Following" : "+ Follow"}
              </button>
            </div>
          </div>`;
      }).join("");
    }

    async getFollowStatusBatch(ids = []) {
      const out = {};
      if (!this.currentUser || !ids.length) return out;
      
      try {
        if (!this._followingSet) {
          const res = await fetch(`${this.apiBase}/users/${this.currentUser.id}/following`, { 
            credentials: "include" 
          });
          
          if (res.ok) {
            const data = await safeJson(res);
            const list = Array.isArray(data) ? data : (data.following || data.data || []);
            this._followingSet = new Set(list.map(u => Number(u.id || u.user_id)));
          } else {
            this._followingSet = new Set();
          }
        }
        
        ids.forEach(id => {
          out[id] = this._followingSet.has(Number(id));
        });
      } catch (err) {
        console.warn("Batch follow status load failed:", err);
        this._followingSet = new Set();
      }
      
      return out;
    }

    attachFollowButtonHandlers() {
  if (this.followClickHandler) {
    document.removeEventListener("click", this.followClickHandler, true);
  }

  this.followClickHandler = (e) => {
    const btn = e.target.closest(".follow-toggle-btn, .follow-btn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const targetId = btn.dataset.userId;
    if (!targetId) return;

    // prevent self follow
    if (this.currentUser && String(this.currentUser.id) === String(targetId)) {
      showNotification("You cannot follow yourself", "info");
      return;
    }

    this.toggleFollow(targetId, btn);
  };

  document.addEventListener("click", this.followClickHandler, true);
}


async toggleFollow(targetId, buttonEl) {
  if (!this.currentUser || !window.currentUserId) {
    showNotification("Please log in to follow users", "error");
    setTimeout(() => (window.location.href = "/login"), 1200);
    return;
  }

  // Prevent self-follow
  if (String(this.currentUser.id) === String(targetId)) {
    showNotification("You cannot follow yourself", "info");
    return;
  }

  const originalText = buttonEl.textContent;
  const originalClass = buttonEl.className;
  const userName = buttonEl.dataset.userName || "user";

  // Optimistic UI
  const isNowFollowing = !buttonEl.classList.contains("following");
  buttonEl.classList.toggle("following", isNowFollowing);
  buttonEl.textContent = isNowFollowing ? "Following" : "+ Follow";
  buttonEl.disabled = true;

  try {
    const res = await fetch(
      `${this.apiBase}/users/${targetId}/follow`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      }
    );

    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err?.error || `HTTP ${res.status}`);
    }

    const data = await safeJson(res);
    const is_following = data.is_following ?? isNowFollowing;

    // Sync ALL buttons for this user
    document
      .querySelectorAll(`[data-user-id="${targetId}"]`)
      .forEach((btn) => {
        btn.classList.toggle("following", is_following);
        btn.textContent = is_following ? "Following" : "+ Follow";
      });

    // Update local cache
    if (this._followingSet) {
      is_following
        ? this._followingSet.add(Number(targetId))
        : this._followingSet.delete(Number(targetId));
    }

    // Update target user's follower count
if (data.target_follower_count !== undefined) {
  const followersEl = document.getElementById("profileFollowers");
  if (followersEl) {
    followersEl.textContent = `${data.target_follower_count} Followers`;
  }
}

// Update current user's following count (only on own profile)
if (data.current_user_following_count !== undefined && this.isOwnProfile) {
  const followingEl = document.getElementById("profileFollowing");
  if (followingEl) {
    followingEl.textContent = `${data.current_user_following_count} Following`;
  }
}


    // Refresh visible lists
    this.refreshFollowLists();

    showNotification(
      is_following
        ? `You are now following ${userName}`
        : `You unfollowed ${userName}`
    );

  } catch (err) {
    console.error("Follow toggle failed:", err);

    // Revert UI
    buttonEl.className = originalClass;
    buttonEl.textContent = originalText;

    showNotification("Failed to update follow status", "error");
  } finally {
    buttonEl.disabled = false;
  }
}


refreshFollowLists() {
  const activeTab = document.querySelector(".tab-btn.active");
  if (!activeTab || !this.viewedUser) return;

  const userId = this.viewedUser.id;
  const tab = activeTab.dataset.tab;

  if (tab === "followers") this.loadFollowers(userId);
  if (tab === "following") this.loadFollowing(userId);
}


    // -------------------------
    // Tab System
    // -------------------------
    attachTabHandlers() {
      const tabButtons = document.querySelectorAll(".profile-tabs .tab-btn");
      if (!tabButtons || tabButtons.length === 0) return;

      tabButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const tab = e.currentTarget.dataset.tab;
          
          // Update active tab
          tabButtons.forEach((b) => b.classList.remove("active"));
          e.currentTarget.classList.add("active");

          // Show active pane
          document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
          const pane = document.getElementById(`${tab}-tab`);
          if (pane) pane.classList.add("active");

          // Load content for active tab
          if (!this.viewedUser) return;
          const userId = this.viewedUser.id;

          switch (tab) {
            case "stories":
              this.loadUserStories(userId);
              break;
            case "followers":
              this.loadFollowers(userId);
              break;
            case "following":
              this.loadFollowing(userId);
              break;
            case "activity":
              this.loadUserActivity(userId);
              break;
            default:
              break;
          }
        });
      });
    }

    // -------------------------
    // Content Loaders
    // -------------------------
    async loadUserStories(userId) {
      if (!this.storiesContainer) return;
      this.showLoading("userStoriesContainer", "Loading love stories...");
      
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/stories`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load stories");
        
        const data = await safeJson(res);
        const stories = Array.isArray(data) ? data : (data.stories || data.data || []);
        
        if (!stories.length) {
          this.storiesContainer.innerHTML = `<div class="empty-state"><p>💌 No love stories yet.</p></div>`;
          return;
        }
        
        // Use loveStories module if available, otherwise use simple render
        if (window.loveStories && window.loveStories.getStoryHTML) {
          this.storiesContainer.innerHTML = stories.map(s => window.loveStories.getStoryHTML(s)).join("");
        } else {
          this.storiesContainer.innerHTML = stories.map(s => this.renderSimpleStoryCard(s)).join("");
        }
        
      } catch (err) {
        console.error("Load stories error:", err);
        this.showError("userStoriesContainer", "Failed to load stories.");
      }
    }

    renderSimpleStoryCard(story) {
      const id = story.id || story.story_id;
      const title = story.story_title || story.title || "Untitled";
      const content = story.love_story || story.content || "";
      const date = story.created_at ? new Date(story.created_at).toLocaleDateString() : "";
      const author = story.author_display_name || story.username || "User";
      const avatar = getAvatarUrl(story.author_avatar_url || "/images/default-avatar.png");
      const preview = content.length > 300 ? content.substring(0, 300) + "..." : content;
      
      return `
        <div class="story-card" data-story-id="${id}">
          <div class="story-card-header">
            <div class="story-user-info">
              <img src="${avatar}" alt="${author}" class="story-avatar">
              <div class="story-user-details">
                <h4 class="story-username">${author}</h4>
                <span class="story-date">${date}</span>
              </div>
            </div>
          </div>
          <h3 class="story-title">${title}</h3>
          <div class="story-content">${preview}</div>
          <div class="story-footer">
            <a href="/stories/${id}" class="read-more">Read Full Story</a>
          </div>
        </div>`;
    }

    async loadUserActivity(userId) {
  if (!this.activityContainer) return;
  this.showLoading("userActivityContainer", "Loading activity...");
  
  try {
    const res = await fetch(`${this.apiBase}/users/${userId}/activity`, { 
      credentials: "include" 
    });
    
    if (!res.ok) {
      throw new Error(`Failed to load activity: ${res.status}`);
    }
    
    const data = await safeJson(res);
    const items = Array.isArray(data) ? data : (data.items || data.activity || data.data || []);
    
    if (!items.length) {
      this.activityContainer.innerHTML = `
        <div class="empty-state">
          <p>📭 No recent activity</p>
          <p class="empty-state-subtext">Your activity feed will appear here.</p>
        </div>`;
      return;
    }
    
    this.activityContainer.innerHTML = items.map(item => {
      const date = item.date ? new Date(item.date).toLocaleString() : 
                 item.created_at ? new Date(item.created_at).toLocaleString() : "";
      
      // Format date to be more readable
      const formattedDate = this.formatRelativeTime(item.date || item.created_at);
      
      // Extract message with better formatting
      let message = item.message || item.text || item.summary || "";
      let link = "";
      let linkText = "";
      let profileLink = "";
      
      // Handle different activity types
      switch(item.type) {
        case "story_like":
        case "story_created":
        case "story_comment":
          if (item.story_id) {
            link = `/love-stories?story=${item.story_id}`;
            linkText = item.type === "story_comment" ? "View Comment" : "View Story";
          }
          break;
          
        case "new_follower":
        case "followed_user":
          if (item.actor_username || item.follower_username) {
            const username = item.actor_username || item.follower_username;
            const displayName = item.actor_display_name || item.follower_display_name || username;
            
            // Make the username in message clickable
            if (message.includes(username)) {
              message = message.replace(
                username, 
                `<a href="/profile/${encodeURIComponent(username)}" class="activity-profile-link">${username}</a>`
              );
            } else if (message.includes(displayName)) {
              message = message.replace(
                displayName,
                `<a href="/profile/${encodeURIComponent(username || displayName)}" class="activity-profile-link">${displayName}</a>`
              );
            } else {
              // Add profile link at the end if not in message
              profileLink = `<a href="/profile/${encodeURIComponent(username)}" class="activity-profile-link">${username}</a>`;
            }
            
            link = `/profile/${encodeURIComponent(username)}`;
            linkText = "View Profile";
          }
          break;
          
        case "comment_like":
        case "reply":
          if (item.story_id) {
            link = `/stories/${item.story_id}#comment-${item.comment_id || ''}`;
            linkText = "View Comment";
          }
          break;
          
        default:
          link = "/activity";
          linkText = "Details";
      }
      
      // If there's an actor, add their avatar
      const actorAvatar = item.actor_avatar_url || item.actor_avatar || 
                         item.follower_avatar_url || item.follower_avatar;
      const avatarUrl = getAvatarUrl(actorAvatar);
      
      return `
        <div class="activity-item" data-activity-type="${item.type || 'unknown'}">
          ${actorAvatar ? `
            <div class="activity-avatar">
              <img src="${avatarUrl}" alt="${item.actor_username || 'User'}" 
                   class="activity-avatar-img" 
                   onerror="this.onerror=null; this.src='/images/default-avatar.png'">
            </div>` : ''}
          <div class="activity-content">
            <div class="activity-message">
              ${message}
              ${profileLink ? ` ${profileLink}` : ''}
            </div>
            <div class="activity-meta">
              ${link ? `<a href="${link}" class="activity-link">${linkText}</a> • ` : ''}
              <span class="activity-time" title="${date}">${formattedDate}</span>
            </div>
          </div>
        </div>`;
    }).join("");
    
    // Add click handlers for profile links inside activity messages
    this.attachActivityProfileLinks();
    
  } catch (err) {
    console.error("Load activity error:", err);
    this.showError("userActivityContainer", "Failed to load activity.");
  }
}

// Helper method to format relative time (e.g., "2 hours ago")
formatRelativeTime(dateString) {
  if (!dateString) return "Recently";
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffDay > 7) {
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric",
      year: diffDay > 365 ? "numeric" : undefined
    });
  } else if (diffDay > 0) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else if (diffHour > 0) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffMin > 0) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else {
    return "Just now";
  }
}

// Attach click handlers to profile links in activity
attachActivityProfileLinks() {
  const profileLinks = this.activityContainer?.querySelectorAll('.activity-profile-link');
  if (!profileLinks) return;
  
  profileLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) {
        window.location.href = href;
      }
    });
  });
}

    // -------------------------
    // Profile Editing
    // -------------------------
    attachEditProfileHandlers() {
      const editBtn = document.getElementById("editProfileBtn");
      const modal = document.getElementById("editProfileModal");
      const closeModalBtn = document.getElementById("closeModalBtn");
      const cancelBtn = document.getElementById("cancelEditBtn");
      const form = document.getElementById("editProfileForm");

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          this.populateEditForm();
          if (modal) {
            modal.style.display = "flex";
            setTimeout(() => modal.classList.add("active"), 10);
          }
        });
      }

      if (closeModalBtn) closeModalBtn.addEventListener("click", this.closeProfileModal.bind(this));
      if (cancelBtn) cancelBtn.addEventListener("click", this.closeProfileModal.bind(this));
      if (form) form.addEventListener("submit", this.handleEditProfileSubmit.bind(this));
      
      window.addEventListener("click", (e) => {
        if (e.target === modal) this.closeProfileModal();
      });
    }

    populateEditForm() {
      if (!this.currentUser) return;
      
      document.getElementById("editDisplayName").value = this.currentUser.display_name || this.currentUser.username || "";
      document.getElementById("editBio").value = this.currentUser.bio || "";
      document.getElementById("editLocation").value = this.currentUser.location || "";
      document.getElementById("editRelationshipStatus").value = this.currentUser.relationship_status || "Single";
      document.getElementById("editGender").value = this.currentUser.gender || "";
      document.getElementById("editWork").value = this.currentUser.work_and_education || "";
      
      if (this.currentUser.date_of_birth) {
        try {
          const d = new Date(this.currentUser.date_of_birth);
          document.getElementById("editDOB").value = d.toISOString().split('T')[0];
        } catch (e) {
          document.getElementById("editDOB").value = "";
        }
      } else {
        document.getElementById("editDOB").value = "";
      }
      
      const msg = document.getElementById("editProfileMessage");
      if (msg) msg.textContent = "";
    }

    closeProfileModal() {
      const modal = document.getElementById("editProfileModal");
      if (!modal) return;
      modal.classList.remove("active");
      setTimeout(() => (modal.style.display = "none"), 300);
    }

    async handleEditProfileSubmit(e) {
      e.preventDefault();
      const saveBtn = document.getElementById("saveProfileBtn");
      const messageEl = document.getElementById("editProfileMessage");
      
      if (saveBtn) saveBtn.disabled = true;
      if (messageEl) {
        messageEl.textContent = "Saving...";
        messageEl.style.color = "#333";
      }

      try {
        const form = e.target;
        const fd = new FormData(form);
        const payload = {};
        for (const [k, v] of fd.entries()) payload[k] = v;
        delete payload.avatar;

        const res = await fetch(`${this.apiBase}/users/${this.currentUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "include",
        });
        
        if (!res.ok) {
          const err = await safeJson(res);
          throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
        }
        
        const updated = await res.json();
        this.currentUser = { ...this.currentUser, ...updated };
        this.viewedUser = { ...this.viewedUser, ...updated };
        this.renderProfileLayout(this.viewedUser, this.isOwnProfile);
        
        showNotification("Profile updated");
        if (messageEl) {
          messageEl.textContent = "Saved ✔";
          messageEl.style.color = "green";
        }
        
        setTimeout(() => this.closeProfileModal(), 800);
        
      } catch (err) {
        console.error("Save profile failed:", err);
        if (messageEl) {
          messageEl.textContent = "Failed to save changes";
          messageEl.style.color = "red";
        }
        showNotification("Failed to save profile", "error");
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    }

    // -------------------------
    // Avatar Upload
    // -------------------------
    attachAvatarUploadHandler() {
      document.body.addEventListener('change', async (e) => {
        if (e.target && e.target.id === 'avatarInput') {
          const file = e.target.files[0];
          if (!file) return;
          
          // Validate file size
          if (file.size > 4 * 1024 * 1024) {
            showNotification("Max file size 4MB", "error");
            return;
          }

          // Preview
          const img = document.getElementById('avatarImage');
          if (img) img.src = URL.createObjectURL(file);
          
          // Upload
          try {
            const fd = new FormData();
            fd.append("avatar", file);
            
            const res = await fetch(`${this.apiBase}/users/${this.currentUser.id}/avatar`, {
              method: "POST",
              body: fd,
              credentials: "include",
            });

            if (!res.ok) {
              const err = await safeJson(res);
              throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
            }

            const data = await safeJson(res);
            const newUrl = data.avatar_url || data.avatar || "/";
            const finalUrl = newUrl.startsWith("/") ? `${this.assetBase}${newUrl}` : newUrl;
            
            if (img) img.src = finalUrl + `?t=${Date.now()}`;
            
            // Update global UI
            document.querySelectorAll('.user-avatar, .nav-user-avatar').forEach(el => {
              if (el.src.includes('avatar')) el.src = finalUrl + `?t=${Date.now()}`;
            });
            
            showNotification("Avatar updated");
            
            // Refresh session
            await this.refreshSession();
            
          } catch (err) {
            console.error("Avatar upload failed:", err);
            showNotification("Failed to upload avatar", "error");
          }
        }
      });
    }

    async refreshSession() {
      try {
        const res = await fetch(`${this.apiBase}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
        
        const data = await safeJson(res);
        if (data.user) {
          this.currentUser = data.user;
          window.currentUser = data.user;
        }
      } catch (err) {
        console.warn("Session refresh error:", err);
      }
    }

    // -------------------------
    // Logout (Fixed Version)
    // -------------------------
    attachLogoutHandler() {
      const logoutButtons = document.querySelectorAll(
        "#profileCardLogoutBtn, .profile-logout-btn, " +
        "#logoutBtn, a[href*='logout'], button[onclick*='logout']"
      );
      
      if (!logoutButtons || logoutButtons.length === 0) return;

      logoutButtons.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          console.log("🔄 Logging out...");

          newBtn.disabled = true;
          newBtn.innerHTML = '<span>Logging out...</span>';

          try {
            const logoutUrl = `${this.apiBase}/auth/logout`;
            console.log("Calling logout endpoint:", logoutUrl);
            
            const response = await fetch(logoutUrl, {
              method: "POST",
              credentials: "include",
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            });

            console.log("Logout response status:", response.status);
            
            localStorage.clear();
            sessionStorage.clear();
            
            document.cookie.split(";").forEach(cookie => {
              const eqPos = cookie.indexOf("=");
              const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
              document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
            });

            window.location.replace(`/login?logout=${Date.now()}`);
            
          } catch (err) {
            console.error("❌ Logout error", err);
            
            try {
              localStorage.clear();
              sessionStorage.clear();
              window.location.replace('/');
            } catch (redirectErr) {
              window.location.reload(true);
            }
          } finally {
            setTimeout(() => {
              newBtn.disabled = false;
              newBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
            }, 3000);
          }
        });
      });
    }

    // -------------------------
    // Message System
    // -------------------------
    attachGlobalMessageButtonHandler() {
      document.addEventListener("click", (e) => {
        const btn = e.target.closest("#messageUserBtn, .message-user-btn");
        if (!btn) return;
        
        e.preventDefault();
        const userId = btn.dataset.userId;
        if (!userId) return;
        
        if (window.messagesManager && typeof window.messagesManager.openMessagesModal === "function") {
          window.messagesManager.openMessagesModal(Number(userId));
        } else {
          window.location.href = `/messages?user=${encodeURIComponent(userId)}`;
        }
      }, true);
    }

    // -------------------------
    // Utility Methods
    // -------------------------
    showLoading(id, text = "Loading...") {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `
        <div class="loading-wrapper" style="text-align:center;padding:28px;">
          <div class="spinner"></div>
          <p style="color:#666;margin-top:10px;">${text}</p>
        </div>`;
    }

    showError(id, message) {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<p style="color:red;text-align:center;">${message}</p>`;
    }

    handleNotFound() {
      if (this.profileInfoContainer) {
        this.profileInfoContainer.innerHTML = `<p style="text-align:center;color:#666;">User not found.</p>`;
      }
    }

    handleUnauthorized() {
      showNotification("Please login to view this page", "error");
      setTimeout(() => (window.location.href = "/login"), 900);
    }
  }

  // -------------------------  
  // Initialize
  // -------------------------
  document.addEventListener("DOMContentLoaded", () => {
    try {
      window.profileManager = new ProfileManager();
      console.log("✅ profileManager initialized");
    } catch (err) {
      console.error("❌ Failed to initialize profileManager:", err);
    }
  });
})();