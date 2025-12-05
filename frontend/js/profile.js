/**
 * frontend/js/profile.js — Lovculator (FINAL CLEAN, FULL-FEATURE)
 * - Self-contained profile manager
 * - Restores loadFollowers, loadFollowing, loadUserActivity, renderUserList, etc.
 * - Defensive (handles different API response shapes)
 * - Uses fetch + window.API_BASE / window.ASSET_BASE
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

  function safeJson(res) {
    return res.text().then((text) => {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    });
  }

  function getAvatarUrl(url) {
    if (!url || url === "null" || url === "undefined") return "/images/default-avatar.png";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${ASSET_BASE}${url}`;
    // fallback treat as filename
    return `${ASSET_BASE}/uploads/avatars/${url}`;
  }

  function showNotification(message, type = "success") {
    // keep simple: toast
    const el = document.createElement("div");
    el.className = `profile-toast ${type}`;
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

      this.currentUser = null; // logged-in user
      this.viewedUser = null; // whose profile is being shown
      this.isOwnProfile = false;

      // caching follow status for batch checks
      this._followingSet = null;

      // bind methods used as handlers
      this.handleFollowBtnClick = this.handleFollowBtnClick.bind(this);
      this.followClickHandler = null;

      this.init();
    }

    // -------------------------
    // init
    // -------------------------
    async init() {
      try {
        this.showLoading("profileInfoContainer");
        this.showLoading("userStoriesContainer");

        // load session (if any)
        await this.loadCurrentSession();

        const params = new URLSearchParams(window.location.search);
        const usernameParam = params.get("user");

        if (usernameParam && (!this.currentUser || usernameParam !== this.currentUser.username)) {
          // viewing another user's profile
          const other = await this.fetchUserByUsername(usernameParam);
          if (!other) return this.handleNotFound();
          this.viewedUser = other;
          this.isOwnProfile = this.currentUser && this.currentUser.id === other.id;
        } else if (this.currentUser) {
          // viewing own profile
          // fetch fresh profile for current user (use username if available)
          const fresh = await this.fetchUserById(this.currentUser.id);
          this.viewedUser = fresh || this.currentUser;
          this.isOwnProfile = true;
        } else {
          // not logged in and no username specified
          // redirect to login (or show message)
          // We'll show an unauthorized message
          return this.handleUnauthorized();
        }

        this.renderProfileDetails(this.viewedUser, this.isOwnProfile);
        await this.loadUserStories(this.viewedUser.id);

        // attach tabs, edit handlers, follow handlers
        this.attachTabHandlers();
        this.attachEditProfileHandlers();
        this.attachAvatarUploadHandler();
        this.attachGlobalMessageButtonHandler();
        
        // Explicitly attach logout handler here to ensure it catches elements rendered
        this.attachLogoutHandler();

      } catch (err) {
        console.error("❌ Profile init failed:", err);
        if (this.profileInfoContainer) {
          this.profileInfoContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load profile.</p>`;
        }
      }
    }

    // -------------------------
    // Session & user fetch helpers
    // -------------------------
    async loadCurrentSession() {
      try {
        const res = await fetch(`${this.apiBase}/auth/me`, {
          credentials: "include",
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        if (!res.ok) return;
        const data = await safeJson(res);
        // backend can respond { success:true, user: {...} } or user object directly
        if (data) {
          if (data.user) {
            this.currentUser = data.user;
            window.currentUser = data.user;
            window.currentUserId = data.user.id;
          } else if (data.id) {
            this.currentUser = data;
            window.currentUser = data;
            window.currentUserId = data.id;
          } else if (data.data && data.data.user) {
            this.currentUser = data.data.user;
            window.currentUser = data.data.user;
            window.currentUserId = data.data.user.id;
          }
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
        if (!res.ok) {
          console.warn("User fetch by username failed:", res.status);
          return null;
        }
        const data = await safeJson(res);
        // Try to cope with nested shapes
        if (data.user) return data.user;
        if (data.data && data.data.user) return data.data.user;
        if (Array.isArray(data) && data.length) return data[0];
        return data;
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
        if (data.user) return data.user;
        return data;
      } catch (err) {
        console.warn("fetchUserById failed:", err);
        return null;
      }
    }

    // -------------------------
    // Rendering Profile Details (FINAL WITH SVG ICONS)
    // -------------------------
    renderProfileDetails(user, isOwnProfile = false) {
      if (!this.profileInfoContainer) return;

      const followerCount = user.follower_count ?? user.followers_count ?? 0;
      const followingCount = user.following_count ?? user.following ?? 0;

      const displayName = user.display_name || user.username || "User";

      const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })
        : "Recently";

      const avatarUrl = getAvatarUrl(
        user.avatar_url || user.avatar || user.profile_image
      );

      const bioHTML = user.bio
        ? `<p class="bio-text">${user.bio}</p>`
        : `<p class="bio-text empty">No bio set yet.</p>`;

      const locationHTML = user.location
        ? `<span class="location">📍 ${user.location}</span>`
        : "";

      const avatarSection = isOwnProfile
        ? `
          <div class="avatar-upload-section">
            <img id="avatarImage" src="${avatarUrl}" alt="${displayName}" class="profile-avatar-img" />
            <label class="avatar-upload-label">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="upload-icon">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Change Photo
      <input type="file" id="avatarInput" accept="image/*" hidden />
    </label>
          </div>
        `
        : `
          <div class="avatar-view-section">
            <img id="avatarImage" src="${avatarUrl}" alt="${displayName}" class="profile-avatar-img" />
          </div>
        `;

      // -------------------------
      // MAIN PROFILE UI
      // -------------------------
      // Note: We use class 'profile-logout-btn' to avoid ID collision with header
      this.profileInfoContainer.innerHTML = `
        <div class="profile-header-card">

          <div class="profile-main-info">
            <div class="profile-avatar-wrapper">${avatarSection}</div>

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
                <button id="editProfileBtn" class="btn btn-secondary btn-small">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414
                      a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                  Edit Profile
                </button>

                <button id="profileCardLogoutBtn" class="btn btn-secondary btn-small profile-logout-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none"
                    viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6
                      a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Logout
                </button>
                `
                : `
                <button id="followProfileBtn"
                  class="btn btn-primary btn-small ${user.is_following_author ? "following" : ""}"
                  data-user-id="${user.id}">
                  
                  ${
                    user.is_following_author
                      ? `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round"
                            d="M5 13l4 4L19 7"/>
                        </svg>
                        Following
                      `
                      : `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round"
                            d="M18 9v3m0 0v3m0-3h3m-3 0h-3
                            m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3
                            20a6 6 0 0112 0v1H3v-1z"/>
                        </svg>
                        Follow
                      `
                  }
                </button>

                <button
                  id="messageUserBtn"
                  class="btn btn-primary btn-small message-user-btn"
                  data-user-id="${user.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8
                      M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5
                      a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                  Message
                </button>
                `
            }
          </div>
        </div>
      `;

      // Reattach dynamic handlers
      if (isOwnProfile) {
        // We re-run this to catch the new button in the DOM
        this.attachLogoutHandler();
      } else {
        const followBtn = document.getElementById("followProfileBtn");
        if (followBtn)
          followBtn.addEventListener("click", () =>
            this.toggleFollow(user.id, followBtn)
          );
      }

      document
        .getElementById("profileUsername")
        ?.setAttribute("data-username", user.username || "");
    }

    // -------------------------
    // Avatar upload
    // -------------------------
    attachAvatarUploadHandler() {
      const avatarInput = document.getElementById("avatarInput");
      const avatarImage = document.getElementById("avatarImage");

      if (!avatarInput || !avatarImage || !this.currentUser) return;

      avatarInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          showNotification("Max file size 4MB", "error");
          return;
        }

        // preview
        const reader = new FileReader();
        reader.onload = () => (avatarImage.src = reader.result);
        reader.readAsDataURL(file);

        // upload
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

          const data = await res.json();
          const newUrl = data.avatar_url || data.avatar || "/";
          const finalUrl = newUrl.startsWith("/") ? `${this.assetBase}${newUrl}` : newUrl;

          avatarImage.src = finalUrl + `?t=${Date.now()}`;

          // update global UI
          document.getElementById("userAvatar")?.setAttribute("src", avatarImage.src);
          document.getElementById("sidebarAvatar")?.setAttribute("src", avatarImage.src);
          showNotification("Avatar updated");

          // refresh session
          await this.refreshSession();
        } catch (err) {
          console.error("Avatar upload failed:", err);
          showNotification("Failed to upload avatar", "error");
        }
      });
    }

    async refreshSession() {
      try {
        const res = await fetch(`${this.apiBase}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
        const data = await safeJson(res);
        if (data.user) this.currentUser = data.user;
        else if (data.id) this.currentUser = data;
        window.currentUser = this.currentUser;
        window.currentUserId = this.currentUser?.id ?? window.currentUserId;
      } catch (err) {
        console.warn("Session refresh error:", err);
      }
    }

    // -------------------------
    // Edit profile modal
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

    closeProfileModal() {
      const modal = document.getElementById("editProfileModal");
      if (!modal) return;
      modal.classList.remove("active");
      setTimeout(() => (modal.style.display = "none"), 300);
    }

    populateEditForm() {
      if (!this.currentUser) return;
      document.getElementById("editDisplayName").value = this.currentUser.display_name || this.currentUser.username || "";
      document.getElementById("editBio").value = this.currentUser.bio || "";
      document.getElementById("editLocation").value = this.currentUser.location || "";
      document.getElementById("editRelationshipStatus").value = this.currentUser.relationship_status || "Single";
      document.getElementById("editGender").value = this.currentUser.gender || "";
      document.getElementById("editDOB").value = this.currentUser.date_of_birth || "";
      document.getElementById("editWork").value = this.currentUser.work_and_education || "";
      document.getElementById("editProfileMessage").textContent = "";
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
        // build payload
        const payload = {};
        for (const [k, v] of fd.entries()) {
          payload[k] = v;
        }
        // remove avatar if present
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
        // merge and rerender
        this.currentUser = { ...(this.currentUser || {}), ...updated };
        this.viewedUser = { ...(this.viewedUser || {}), ...updated };
        this.renderProfileDetails(this.viewedUser, this.isOwnProfile);
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
    // Logout (FINAL FIXED VERSION)
    // -------------------------
    attachLogoutHandler() {
      // FIX: Select ALL logout buttons (Header ID, Profile Card ID, classes, links)
      // This handles the conflict where header ID usually wins
      const logoutButtons = document.querySelectorAll(
        "#logoutBtn, #profileCardLogoutBtn, .profile-logout-btn, a[href='/logout'], a[href='/logout.html']"
      );
      
      if (!logoutButtons || logoutButtons.length === 0) return;

      logoutButtons.forEach(btn => {
        // Clone to remove old listeners if re-running
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener("click", async (e) => {
          // 🛑 CRITICAL: Prevent <a> tag from navigating to 404
          e.preventDefault(); 
          e.stopPropagation();

          console.log("🔄 Logging out...");

          // 1️⃣ Prevent refresh loops / WebSocket reconnection
          window.isLoggingOut = true;

          try {
            // 2️⃣ Send logout request (fire & forget is fine)
            await fetch(`${this.apiBase}/auth/logout`, {
              method: "POST",
              credentials: "include",
              cache: "no-store"
            });

            // 3️⃣ Cleanup in browser
            localStorage.clear();
            sessionStorage.clear();

            // 4️⃣ Aggressive cookie cleanup
            ["", window.location.hostname, "." + window.location.hostname].forEach(domain => {
              document.cookie = `connect.sid=; Path=/; Max-Age=0; ${domain ? `Domain=${domain};` : ""}`;
            });

            // 5️⃣ Shut down global websocket safely
            if (window.messagesManager?.disconnect) {
              console.log("🔌 Closing websocket...");
              window.messagesManager.disconnect();
            }

            // 6️⃣ Prevent history back showing profile cached page
            window.history.pushState(null, null, "/login.html");
            window.history.replaceState(null, null, "/login.html");

            // 7️⃣ Redirect with cache busting so browser reloads clean
            const cb = Date.now();
            window.location.replace(`/login.html?logout=${cb}`);

          } catch (err) {
            console.error("❌ Logout error", err);
            window.location.replace(`/login.html?fail=${Date.now()}`);
          }
        });
      });
    }

    // -------------------------
    // Tabs
    // -------------------------
    attachTabHandlers() {
      const tabButtons = document.querySelectorAll(".profile-tabs .tab-btn");
      if (!tabButtons || tabButtons.length === 0) return;

      tabButtons.forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const tab = e.currentTarget.dataset.tab;
          tabButtons.forEach((b) => b.classList.remove("active"));
          e.currentTarget.classList.add("active");

          document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));
          const pane = document.getElementById(`${tab}-tab`);
          if (pane) pane.classList.add("active");

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
    // Stories loader (simple)
    // -------------------------
    async loadUserStories(userId) {
      if (!this.storiesContainer) return;
      this.showLoading("userStoriesContainer", "Loading love stories...");
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/stories`, { credentials: "include" });
        if (!res.ok) {
          this.storiesContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load stories.</p>`;
          return;
        }
        const data = await safeJson(res);
        let stories = [];
        if (Array.isArray(data)) stories = data;
        else if (data.stories) stories = data.stories;
        else if (data.data) stories = data.data;
        else if (data.items) stories = data.items;
        else if (data.rows) stories = data.rows;

        if (!stories || stories.length === 0) {
          this.storiesContainer.innerHTML = `<div class="empty-state"><p>💌 No love stories yet.</p></div>`;
          return;
        }

        // reuse existing story HTML template if social-features provided getStoryHTML (not guaranteed)
        // Build a simple card if not found
        const html = stories.map((s) => this.renderStoryCard(s)).join("");
        this.storiesContainer.innerHTML = html;
      } catch (err) {
        console.error("Load stories error:", err);
        this.storiesContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load stories.</p>`;
      }
    }

    renderStoryCard(story) {
      // defensive
      const id = story.id || story.story_id || story._id;
      const title = story.story_title || story.title || "";
      const content = story.love_story || story.content || story.body || "";
      const date = story.created_at ? new Date(story.created_at).toLocaleDateString() : "";
      const authorName = story.author_display_name || story.display_name || story.author_username || story.username || "User";
      const authorUsername = story.author_username || story.username || "";
      const avatar = getAvatarUrl(story.author_avatar_url || story.avatar || story.author_avatar || "/images/default-avatar.png");
      const commentsCount = story.comments_count || story.comment_count || 0;
      const likesCount = story.likes_count || story.like_count || 0;
      const isLong = content.length > 220;
      const preview = isLong ? content.substring(0, 220) + "..." : content;

      return `
        <div class="story-card" data-story-id="${id}">
          <div class="story-card-header">
            <div class="story-user-info">
              <a href="/profile.html?user=${encodeURIComponent(authorUsername)}" class="story-user-link">
                <img src="${avatar}" alt="${authorName}" class="story-avatar" onerror="this.src='/images/default-avatar.png'">
              </a>
              <div class="story-user-details">
                <a href="/profile.html?user=${encodeURIComponent(authorUsername)}" class="story-username-link">
                  <h4 class="story-username">${authorName}</h4>
                </a>
                <span class="story-date">${date}</span>
              </div>
            </div>
            ${!story.anonymous_post && story.author_id && (!window.currentUserId || window.currentUserId !== story.author_id)
              ? `<button class="follow-btn ${story.is_following_author ? "following" : ""}" data-user-id="${story.author_id}">${story.is_following_author ? "Following" : "+ Follow"}</button>`
              : ""}
          </div>

          <h3 class="story-title">${title}</h3>
          <div class="story-content">${preview}</div>
          ${isLong ? `<button class="read-more">Read More</button>` : ""}
          <div class="story-footer">
            <div class="story-actions">
              <button class="story-action like-button" data-id="${id}">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="story-icon">
    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
  <span class="like-count">${likesCount}</span>
</button>

<button class="story-action comment-toggle" data-id="${id}">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="story-icon">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
  <span>${commentsCount}</span>
</button>

<button class="story-action share-action-toggle" data-share-url="${location.origin}/stories/${id}" data-share-title="${title}" data-share-text="${title}">
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" class="story-icon">
    <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
</button>
            </div>
          </div>

          <div class="comments-section hidden" id="comments-${id}">
            <div class="comment-form">
              <input type="text" class="comment-input" placeholder="Add a comment..." data-story-id="${id}">
              <button class="comment-submit">Post</button>
            </div>
            <div class="comments-list" id="comments-list-${id}"></div>
          </div>
        </div>
      `;
    }

    // -------------------------
    // Followers / Following
    // -------------------------
    async loadFollowers(userId) {
      if (!this.followersContainer) return;
      this.showLoading("followersContainer", "Loading followers...");
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/followers`, { credentials: "include" });
        if (!res.ok) {
          this.followersContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load followers.</p>`;
          return;
        }
        const data = await safeJson(res);
        const followers = Array.isArray(data) ? data : data.followers || data.items || data.data || [];
        if (!followers || followers.length === 0) {
          this.followersContainer.innerHTML = `<p class="empty-state">No followers yet.</p>`;
          return;
        }
        const ids = followers.map((f) => f.id || f.user_id);
        const statusMap = await this.getFollowStatusBatch(ids);
        this.followersContainer.innerHTML = this.renderUserList(followers, statusMap);
        this.attachFollowButtonHandlers();
      } catch (err) {
        console.error("Load followers error:", err);
        this.followersContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load followers.</p>`;
      }
    }

    async loadFollowing(userId) {
      if (!this.followingContainer) return;
      this.showLoading("followingContainer", "Loading following...");
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/following`, { credentials: "include" });
        if (!res.ok) {
          this.followingContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load following.</p>`;
          return;
        }
        const data = await safeJson(res);
        const following = Array.isArray(data) ? data : data.following || data.items || data.data || [];
        if (!following || following.length === 0) {
          this.followingContainer.innerHTML = `<p class="empty-state">Not following anyone yet.</p>`;
          return;
        }
        const ids = following.map((f) => f.id || f.user_id);
        const statusMap = await this.getFollowStatusBatch(ids);
        this.followingContainer.innerHTML = this.renderUserList(following, statusMap);
        this.attachFollowButtonHandlers();
      } catch (err) {
        console.error("Load following error:", err);
        this.followingContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load following.</p>`;
      }
    }

    renderUserList(users, statusMap = {}) {
      const myId = this.currentUser ? this.currentUser.id : null;
      return users
        .map((user) => {
          const uid = user.id || user.user_id || user.user?.id;
          if (!uid) return "";
          if (uid === myId) return ""; // skip self
          const isFollowing = !!statusMap[uid];
          const avatar = getAvatarUrl(user.avatar_url || user.profile_image || user.avatar || "/images/default-avatar.png");
          const name = user.display_name || user.username || user.user?.display_name || "User";
          const username = user.username || user.user?.username || name;
          const bio = user.bio || user.user?.bio || "";
          return `
            <div class="user-card" data-user-id="${uid}">
              <a href="/profile.html?user=${encodeURIComponent(username)}">
                <img src="${avatar}" alt="${name}" class="user-avatar" onerror="this.src='/images/default-avatar.png'">
              </a>
              <div class="user-info">
                <h4>${name}</h4>
                <p class="user-bio">${bio}</p>
              </div>
              <div class="user-actions">
                <button class="follow-btn follow-toggle-btn ${isFollowing ? "following" : ""}" data-user-id="${uid}">
                  ${isFollowing ? "Following" : "+ Follow"}
                </button>
              </div>
            </div>
          `;
        })
        .join("");
    }

    attachFollowButtonHandlers() {
      // Remove previous handler if exist
      if (this.followClickHandler) {
        document.removeEventListener("click", this.followClickHandler);
      }

      this.followClickHandler = (e) => {
        const btn = e.target.closest(".follow-toggle-btn, .follow-btn");
        if (!btn) return;
        const id = btn.dataset.userId || btn.getAttribute("data-user-id");
        if (!id) {
          console.error("Follow button missing data-user-id");
          return;
        }
        this.toggleFollow(id, btn);
      };

      document.addEventListener("click", this.followClickHandler);
    }

    async toggleFollow(targetId, buttonEl) {
      if (!window.currentUserId) {
        showNotification("Please log in to follow", "error");
        setTimeout(() => (window.location.href = "/login.html"), 800);
        return;
      }

      const originalText = buttonEl.textContent;
      const originalClassName = buttonEl.className;
      buttonEl.disabled = true;
      // optimistic UI
      const isNowFollowing = !buttonEl.classList.contains("following");
      buttonEl.classList.toggle("following", isNowFollowing);
      buttonEl.textContent = isNowFollowing ? "Following" : "+ Follow";

      try {
        const res = await fetch(`${this.apiBase}/users/${targetId}/follow`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          const err = await safeJson(res);
          throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const is_following = data.is_following ?? data.following ?? isNowFollowing;
        // update UI universally
        document.querySelectorAll(`[data-user-id="${targetId}"], [data-author-id="${targetId}"]`).forEach((b) => {
          b.classList.toggle("following", is_following);
          b.textContent = is_following ? "Following" : "+ Follow";
        });

        // update profile counts if returned
        if (data.target_follower_count && document.getElementById("profileFollowers")) {
          document.getElementById("profileFollowers").textContent = `${data.target_follower_count} Followers`;
        }
        showNotification(is_following ? "Followed" : "Unfollowed");
      } catch (err) {
        console.error("Follow toggle error:", err);
        buttonEl.className = originalClassName;
        buttonEl.textContent = originalText;
        showNotification("Failed to update follow", "error");
      } finally {
        buttonEl.disabled = false;
      }
    }

    async getFollowStatusBatch(ids = []) {
      const out = {};
      if (!this.currentUser) return out;
      try {
        if (!this._followingSet) {
          const res = await fetch(`${this.apiBase}/users/${this.currentUser.id}/following`, { credentials: "include" });
          if (!res.ok) {
            this._followingSet = new Set();
          } else {
            const data = await safeJson(res);
            const list = Array.isArray(data) ? data : data.following || data.data || [];
            this._followingSet = new Set(list.map((u) => Number(u.id || u.user_id)).filter(Boolean));
          }
        }
      } catch (err) {
        console.warn("Batch follow status load failed:", err);
        this._followingSet = new Set();
      }
      ids.forEach((id) => (out[id] = this._followingSet.has(Number(id))));
      return out;
    }

    // -------------------------
    // Activity feed
    // -------------------------
    async loadUserActivity(userId) {
      if (!this.activityContainer) return;
      this.showLoading("userActivityContainer", "Loading activity...");
      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/activity`, { credentials: "include" });
        if (!res.ok) {
          this.activityContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load activity.</p>`;
          return;
        }
        const data = await safeJson(res);
        const items = Array.isArray(data) ? data : data.items || data.activity || data.data || [];
        if (!items || items.length === 0) {
          this.activityContainer.innerHTML = `<p class="empty-state">No recent activity</p>`;
          return;
        }
        this.activityContainer.innerHTML = items
          .map((it) => {
            const date = it.date ? new Date(it.date).toLocaleString() : it.created_at ? new Date(it.created_at).toLocaleString() : "";
            const message = it.message || it.text || it.summary || "";
            let link = "";
            if (it.type === "story_like" && it.story_id) link = `<a href="/stories.html?story=${it.story_id}" class="activity-link">View Story</a>`;
            else if (it.type === "new_follower" && it.actor_username) link = `<a href="/profile.html?user=${encodeURIComponent(it.actor_username)}" class="activity-link">View</a>`;
            else link = `<a href="/activity.html" class="activity-link">Details</a>`;
            return `<div class="activity-item"><div class="activity-message">${message}</div><div class="activity-meta">${link} • <span>${date}</span></div></div>`;
          })
          .join("");
      } catch (err) {
        console.error("Load activity error:", err);
        this.activityContainer.innerHTML = `<p style="color:red;text-align:center;">Failed to load activity.</p>`;
      }
    }

    // -------------------------
    // Utility: show loading states
    // -------------------------
    showLoading(id, text = "Loading...") {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = `<div class="loading-wrapper" style="text-align:center;padding:28px;"><div class="spinner"></div><p style="color:#666;margin-top:10px;">${text}</p></div>`;
    }

    // -------------------------
    // Follow profile btn (banner) specific
    // -------------------------
    async toggleFollowProfile(targetUserId, btn) {
      return this.toggleFollow(targetUserId, btn);
    }

    // attach handler for follow toggles created at top of page
    handleFollowBtnClick(e) {
      const btn = e.target.closest(".follow-btn");
      if (!btn) return;
      const uid = btn.dataset.userId;
      if (!uid) return;
      this.toggleFollow(uid, btn);
    }

    // -------------------------
    // Global message button handler
    // -------------------------
    attachGlobalMessageButtonHandler() {
      document.addEventListener(
        "click",
        (e) => {
          const btn = e.target.closest("#messageUserBtn, .message-user-btn");
          if (!btn) return;
          e.preventDefault();
          const userId = btn.dataset.userId;
          if (!userId) return;
          if (window.messagesManager && typeof window.messagesManager.openMessagesModal === "function") {
            window.messagesManager.openMessagesModal(Number(userId));
          } else {
            // fallback to messages page
            window.location.href = `/messages.html?user=${encodeURIComponent(userId)}`;
          }
        },
        true
      );
    }

    // -------------------------
    // Not found / unauthorized
    // -------------------------
    handleNotFound() {
      if (this.profileInfoContainer) {
        this.profileInfoContainer.innerHTML = `<p style="text-align:center;color:#666;">User not found.</p>`;
      }
    }

    handleUnauthorized() {
      // if not logged in, either redirect or show a helpful message
      showNotification("Please login to view this page", "error");
      setTimeout(() => (window.location.href = "/login.html"), 900);
    }

    // -------------------------
    // Global helpers to be used elsewhere
    // -------------------------
    attachAvatarUpdateListener() {
      window.addEventListener("avatarUpdated", (evt) => {
        const url = evt?.detail?.avatarUrl;
        if (!url) return;
        document.getElementById("userAvatar")?.setAttribute("src", url);
        document.getElementById("sidebarAvatar")?.setAttribute("src", url);
      });
    }
  }

  // -------------------------
  // Initialize on DOM ready
  // -------------------------
  document.addEventListener("DOMContentLoaded", () => {
    try {
      window.profileManager = new ProfileManager();
      console.log("✅ profileManager initialized");
    } catch (err) {
      console.error("❌ Failed to initialize profileManager:", err);
    }
  });

  // expose minimal API for debugging / tests
  window._profileManager = {
    getInstance: () => window.profileManager,
  };
})();