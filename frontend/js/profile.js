/**
 * frontend/js/profile.js — Lovculator
 * Quora-Inspired Profile Manager
 * Clean, compact, content-focused profile layout with full tab support
 * Brand color: #ff4b8d
 */

(() => {
  // -------------------------
  // Configuration & Helpers
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

  function escapeHtml(text) {
    if (typeof text !== "string") return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatRelativeTime(dateString) {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay > 30) {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } else if (diffDay > 0) {
      return `${diffDay}d ago`;
    } else if (diffHour > 0) {
      return `${diffHour}h ago`;
    } else if (diffMin > 0) {
      return `${diffMin}m ago`;
    } else {
      return "just now";
    }
  }

  function showNotification(message, type = "success") {
    const existing = document.querySelector(".profile-toast-notice");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.className = "profile-toast-notice";
    Object.assign(el.style, {
      position: "fixed",
      top: "24px",
      right: "24px",
      background: type === "error" ? "#e53935" : type === "info" ? "#1976d2" : "#2e7d32",
      color: "#ffffff",
      padding: "10px 18px",
      borderRadius: "8px",
      zIndex: "99999",
      boxShadow: "0 6px 20px rgba(0,0,0,0.16)",
      fontWeight: "600",
      fontSize: "0.88rem",
      opacity: "0",
      transition: "opacity 0.22s ease, transform 0.22s ease",
      transform: "translateY(-6px)",
      display: "flex",
      alignItems: "center",
      gap: "8px",
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
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  // -------------------------
  // ProfileManager Class
  // -------------------------
  class ProfileManager {
    constructor() {
      this.apiBase = API_BASE;
      this.assetBase = ASSET_BASE;

      this.profileInfoContainer = document.getElementById("profileInfoContainer");
      this.profileTabsNav = document.getElementById("profileTabsNav");
      this.profileGrid = document.getElementById("profileGrid");
      this.profileSidebar = document.getElementById("profileSidebar");

      this.storiesContainer = document.getElementById("userStoriesContainer");
      this.questionsContainer = document.getElementById("userQuestionsContainer");
      this.answersContainer = document.getElementById("userAnswersContainer");
      this.followersContainer = document.getElementById("followersContainer");
      this.followingContainer = document.getElementById("followingContainer");
      this.activityContainer = document.getElementById("userActivityContainer");

      this.currentUser = null;
      this.viewedUser = null;
      this.isOwnProfile = false;
      this._followingSet = null;
      this.currentTab = "stories";

      this.init();
    }

    // -------------------------
    // Initialization
    // -------------------------
    async init() {
      try {
        // 1. Load active session
        await this.loadCurrentSession();

        // 2. Identify username from URL
        const usernameParam = this.extractUsernameFromURL();

        // 3. Fetch user profile
        if (usernameParam && (!this.currentUser || usernameParam.toLowerCase() !== this.currentUser.username?.toLowerCase())) {
          const profile = await this.fetchUserByUsername(usernameParam);
          if (!profile) return this.handleNotFound();
          this.viewedUser = profile;
          this.isOwnProfile = Boolean(this.currentUser && Number(this.currentUser.id) === Number(profile.id));
        } else if (this.currentUser) {
          const fresh = await this.fetchUserById(this.currentUser.id);
          this.viewedUser = fresh || this.currentUser;
          this.isOwnProfile = true;
        } else {
          return this.handleUnauthorized();
        }

        // Set document title
        const name = this.viewedUser.display_name || this.viewedUser.username || "User";
        document.title = `${name} (@${this.viewedUser.username}) • Lovculator Profile`;

        // 4. Render Layout & Sidebar
        this.renderProfileLayout(this.viewedUser, this.isOwnProfile);

        // 5. Determine active tab from URL (e.g. ?tab=questions)
        const urlParams = new URLSearchParams(window.location.search);
        const requestedTab = urlParams.get("tab");
        if (requestedTab && document.querySelector(`.profile-tab[data-tab="${requestedTab}"]`)) {
          this.currentTab = requestedTab;
        } else {
          this.currentTab = "stories";
        }

        // 6. Switch to active tab
        this.switchTab(this.currentTab);

        // 7. Attach event listeners
        this.attachTabHandlers();
        this.attachFollowButtonHandlers();
        this.attachGlobalMessageButtonHandler();

        if (this.isOwnProfile) {
          this.attachEditProfileHandlers();
          this.attachAvatarUploadHandler();
          this.attachLogoutHandler();
        }

      } catch (err) {
        console.error("❌ Profile initialization error:", err);
        this.showError("profileInfoContainer", "Failed to load profile. Please refresh.");
      }
    }

    // -------------------------
    // URL & Session Methods
    // -------------------------
    extractUsernameFromURL() {
      const params = new URLSearchParams(window.location.search);
      let usernameParam = params.get("user") || params.get("u");

      if (!usernameParam) {
        const pathParts = window.location.pathname.split("/").filter(Boolean);
        const profileIndex = pathParts.indexOf("profile");
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
        console.warn("⚠️ Session load warning:", err);
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
    // Render Layout & Sidebar
    // -------------------------
    renderProfileLayout(user, isOwnProfile = false) {
      const displayName = escapeHtml(user.display_name || user.username || "User");
      const usernameHandle = user.username ? `@${escapeHtml(user.username)}` : "@lovculator";
      const avatarUrl = getAvatarUrl(user.avatar_url || user.avatar || user.profile_image);
      const followerCount = Number(user.follower_count ?? user.followers_count ?? 0);
      const followingCount = Number(user.following_count ?? user.following ?? 0);
      const storiesCount = Number(user.stories_count ?? 0);
      const questionsCount = Number(user.questions_count ?? 0);
      const answersCount = Number(user.answers_count ?? 0);

      const joinedDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : "Recently";

      const dobDisplay = user.date_of_birth
        ? new Date(user.date_of_birth).toLocaleDateString("en-US", { month: "long", day: "numeric" })
        : "";

      // 1. Header Card HTML
      const headerHTML = `
        <header class="profile-header-card" aria-label="User profile summary">
          <div class="profile-header-top">
            <div class="profile-header-main">
              <div class="profile-avatar-box">
                <img id="avatarImage" 
                     src="${avatarUrl}" 
                     class="profile-avatar-img" 
                     alt="${displayName}"
                     width="100" 
                     height="100"
                     onerror="this.onerror=null; this.src='/images/default-avatar.png'">
                ${
                  isOwnProfile
                    ? `
                  <label class="profile-avatar-upload-btn" for="avatarInput" title="Change Avatar" aria-label="Change profile picture">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                    </svg>
                    <input type="file" id="avatarInput" accept="image/*" hidden />
                  </label>`
                    : ""
                }
              </div>

              <div class="profile-info-section">
                <h1 class="profile-display-name">${displayName}</h1>
                <div class="profile-username-handle">${usernameHandle}</div>
                ${
                  user.bio
                    ? `<div class="profile-bio-text">${escapeHtml(user.bio)}</div>`
                    : isOwnProfile
                    ? `<div class="profile-bio-text empty">Add a bio to introduce yourself to the community...</div>`
                    : ""
                }
                
                <div class="profile-follow-stats">
                  <span class="profile-follow-stat-link" data-jump-tab="followers">
                    <strong id="headerFollowersCount">${followerCount}</strong> Followers
                  </span>
                  <span class="profile-stat-dot">•</span>
                  <span class="profile-follow-stat-link" data-jump-tab="following">
                    <strong id="headerFollowingCount">${followingCount}</strong> Following
                  </span>
                </div>
              </div>
            </div>

            <div class="profile-header-actions">
              ${this.renderActionButtons(user, isOwnProfile)}
            </div>
          </div>
        </header>
      `;

      if (this.profileInfoContainer) {
        this.profileInfoContainer.innerHTML = headerHTML;
      }

      // 2. Show Tabs Bar and Update Counts
      if (this.profileTabsNav) {
        this.profileTabsNav.style.display = "flex";
        const stCountEl = document.getElementById("tabStoriesCount");
        const qCountEl = document.getElementById("tabQuestionsCount");
        const aCountEl = document.getElementById("tabAnswersCount");
        const foCountEl = document.getElementById("tabFollowersCount");
        const fngCountEl = document.getElementById("tabFollowingCount");

        if (stCountEl) stCountEl.textContent = storiesCount;
        if (qCountEl) qCountEl.textContent = questionsCount;
        if (aCountEl) aCountEl.textContent = answersCount;
        if (foCountEl) foCountEl.textContent = followerCount;
        if (fngCountEl) fngCountEl.textContent = followingCount;
      }

      // 3. Show Grid Layout
      if (this.profileGrid) {
        this.profileGrid.style.display = "grid";
      }

      // 4. Render Right Sidebar
      if (this.profileSidebar) {
        this.profileSidebar.innerHTML = `
          <!-- About / Credentials Card -->
          <div class="sidebar-card">
            <h2 class="sidebar-title">About</h2>
            <div class="sidebar-details-list">
              ${user.location ? `
                <div class="sidebar-detail-item">
                  <span class="sidebar-detail-icon">🏠</span>
                  <span class="sidebar-detail-text">Lives in <strong>${escapeHtml(user.location)}</strong></span>
                </div>
              ` : ""}
              ${user.work_education ? `
                <div class="sidebar-detail-item">
                  <span class="sidebar-detail-icon">💼</span>
                  <span class="sidebar-detail-text">${escapeHtml(user.work_education)}</span>
                </div>
              ` : ""}
              ${user.relationship_status ? `
                <div class="sidebar-detail-item">
                  <span class="sidebar-detail-icon">❤️</span>
                  <span class="sidebar-detail-text">${escapeHtml(user.relationship_status)}</span>
                </div>
              ` : ""}
              ${user.gender ? `
                <div class="sidebar-detail-item">
                  <span class="sidebar-detail-icon">👤</span>
                  <span class="sidebar-detail-text">${escapeHtml(user.gender)}</span>
                </div>
              ` : ""}
              ${dobDisplay ? `
                <div class="sidebar-detail-item">
                  <span class="sidebar-detail-icon">🎂</span>
                  <span class="sidebar-detail-text">Born ${dobDisplay}</span>
                </div>
              ` : ""}
              <div class="sidebar-detail-item">
                <span class="sidebar-detail-icon">📅</span>
                <span class="sidebar-detail-text">Joined ${joinedDate}</span>
              </div>
            </div>
          </div>

          <!-- Statistics Card -->
          <div class="sidebar-card">
            <h2 class="sidebar-title">Profile Statistics</h2>
            <div class="sidebar-stats-grid">
              <div class="sidebar-stat-box" data-jump-tab="stories" style="cursor: pointer;">
                <span class="sidebar-stat-number" id="sideStoriesCount">${storiesCount}</span>
                <span class="sidebar-stat-label">Stories</span>
              </div>
              <div class="sidebar-stat-box" data-jump-tab="questions" style="cursor: pointer;">
                <span class="sidebar-stat-number" id="sideQuestionsCount">${questionsCount}</span>
                <span class="sidebar-stat-label">Questions</span>
              </div>
              <div class="sidebar-stat-box" data-jump-tab="answers" style="cursor: pointer;">
                <span class="sidebar-stat-number" id="sideAnswersCount">${answersCount}</span>
                <span class="sidebar-stat-label">Answers</span>
              </div>
              <div class="sidebar-stat-box" data-jump-tab="followers" style="cursor: pointer;">
                <span class="sidebar-stat-number" id="sideFollowersCount">${followerCount}</span>
                <span class="sidebar-stat-label">Followers</span>
              </div>
            </div>
          </div>

          <!-- Community Card -->
          <div class="sidebar-card">
            <h2 class="sidebar-title">Explore Lovculator</h2>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <a href="/questions" class="sidebar-link-item">
                <span>💬</span>
                <span>Relationship Q&amp;A</span>
              </a>
              <a href="/stories" class="sidebar-link-item">
                <span>💌</span>
                <span>Love Stories</span>
              </a>
              <a href="/" class="sidebar-link-item">
                <span>💖</span>
                <span>Love Calculator</span>
              </a>
            </div>
          </div>
        `;
      }

      // Wire Jump-to-tab clicks
      document.querySelectorAll("[data-jump-tab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.jumpTab;
          if (tab) this.switchTab(tab);
        });
      });
    }

    renderActionButtons(user, isOwnProfile) {
      if (isOwnProfile) {
        return `
          <button type="button" id="editProfileBtn" class="btn-profile-action btn-profile-secondary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            <span>Edit Profile</span>
          </button>
          <button type="button" id="profileCardLogoutBtn" class="btn-profile-action btn-profile-logout" title="Sign out of account">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Logout</span>
          </button>
        `;
      } else {
        const isFollowing = Boolean(user.is_following_author);
        return `
          <button type="button" id="followProfileBtn" 
                  class="btn-profile-action ${isFollowing ? "btn-profile-following" : "btn-profile-primary"} follow-toggle-btn"
                  data-user-id="${user.id}"
                  data-user-name="${escapeHtml(user.display_name || user.username || "User")}">
            <span>${isFollowing ? "Following" : "+ Follow"}</span>
          </button>
          <button type="button" id="messageUserBtn" class="btn-profile-action btn-profile-secondary message-user-btn" data-user-id="${user.id}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span>Message</span>
          </button>
        `;
      }
    }

    // -------------------------
    // Tab Switching System
    // -------------------------
    attachTabHandlers() {
      const tabButtons = document.querySelectorAll(".profile-tabs-bar .profile-tab");
      tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.dataset.tab;
          if (tab) this.switchTab(tab);
        });
      });
    }

    switchTab(tabName) {
      if (!tabName) return;
      this.currentTab = tabName;

      // Update Tab Buttons UI
      document.querySelectorAll(".profile-tabs-bar .profile-tab").forEach((btn) => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      // Update Tab Panes UI
      document.querySelectorAll(".profile-tab-pane").forEach((pane) => {
        pane.classList.remove("active");
      });
      const activePane = document.getElementById(`${tabName}-tab`);
      if (activePane) {
        activePane.classList.add("active");
      }

      // Update URL query parameter without full reload
      const url = new URL(window.location);
      url.searchParams.set("tab", tabName);
      window.history.replaceState({}, "", url);

      // Load Content for Tab
      if (!this.viewedUser) return;
      const userId = this.viewedUser.id;

      switch (tabName) {
        case "stories":
          this.loadUserStories(userId);
          break;
        case "questions":
          this.loadUserQuestions(userId);
          break;
        case "answers":
          this.loadUserAnswers(userId);
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
          this.loadUserStories(userId);
          break;
      }
    }

    // -------------------------
    // Content Loaders
    // -------------------------

    // 1. Love Stories
    async loadUserStories(userId) {
      if (!this.storiesContainer) return;
      this.showLoading("userStoriesContainer", "Loading stories...");

      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/stories`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load stories");

        const data = await safeJson(res);
        const stories = Array.isArray(data) ? data : (data.stories || data.data || []);

        const countEl = document.getElementById("tabStoriesCount");
        if (countEl) countEl.textContent = stories.length;
        const sideCountEl = document.getElementById("sideStoriesCount");
        if (sideCountEl) sideCountEl.textContent = stories.length;

        if (!stories.length) {
          this.storiesContainer.innerHTML = `
            <div class="profile-empty-state">
              <div class="profile-empty-icon">💌</div>
              <h3 class="profile-empty-title">No love stories yet</h3>
              <p class="profile-empty-desc">${
                this.isOwnProfile
                  ? "Share your relationship story, confession, or romance journey with the community."
                  : "This user hasn't published any love stories yet."
              }</p>
              ${this.isOwnProfile ? '<a href="/stories" class="btn-profile-action btn-profile-primary" style="margin-top: 14px;">Write a Story</a>' : ""}
            </div>
          `;
          return;
        }

        this.storiesContainer.innerHTML = stories.map((s) => this.renderStoryCard(s)).join("");
      } catch (err) {
        console.error("Load stories error:", err);
        this.showError("userStoriesContainer", "Failed to load stories.");
      }
    }

    renderStoryCard(story) {
      const id = story.id || story.story_id;
      const title = escapeHtml(story.story_title || story.title || "Untitled Story");
      const content = story.love_story || story.content || "";
      const date = formatRelativeTime(story.created_at);
      const author = escapeHtml(story.author_display_name || story.username || this.viewedUser.display_name || "Author");
      const avatar = getAvatarUrl(story.author_avatar_url || this.viewedUser.avatar_url);
      const preview = escapeHtml(content.length > 240 ? content.substring(0, 240) + "..." : content);
      const category = escapeHtml(story.category || "Relationship");
      const likesCount = Number(story.likes_count || 0);
      const commentsCount = Number(story.comments_count || 0);
      const slug = this.slugify(title);

      const imageUrl = story.image_url ? (story.image_url.startsWith("http") ? story.image_url : `${this.assetBase}${story.image_url}`) : "";

      return `
        <article class="profile-card profile-story-card" data-story-id="${id}">
          <div class="story-header">
            <div class="story-author-meta">
              <img src="${avatar}" alt="${author}" class="story-author-avatar" onerror="this.src='/images/default-avatar.png'">
              <div class="story-author-text">
                <span class="story-author-name">${author}</span>
                <span class="story-date">${date}</span>
              </div>
            </div>
            <span class="story-category-tag">${category}</span>
          </div>

          <a href="/stories/${slug}" class="profile-story-title">${title}</a>

          ${imageUrl ? `
            <div class="profile-story-image-wrap">
              <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.parentElement.remove()">
            </div>
          ` : ""}

          <div class="profile-story-snippet">${preview}</div>

          <div class="profile-story-footer">
            <div class="profile-story-actions-left">
              <span class="story-stat-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span>${likesCount}</span>
              </span>
              <span class="story-stat-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span>${commentsCount}</span>
              </span>
            </div>

            <a href="/stories/${slug}" class="read-full-story-link">Read Full Story &rarr;</a>
          </div>
        </article>
      `;
    }

    // 2. Questions
    async loadUserQuestions(userId) {
      if (!this.questionsContainer) return;
      this.showLoading("userQuestionsContainer", "Loading questions...");

      try {
        const url = this.isOwnProfile
          ? `${this.apiBase}/questions/my/questions`
          : `${this.apiBase}/questions/user/${userId}`;

        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load questions");

        const data = await safeJson(res);
        const questions = Array.isArray(data) ? data : (data.questions || []);

        const countEl = document.getElementById("tabQuestionsCount");
        if (countEl) countEl.textContent = questions.length;
        const sideCountEl = document.getElementById("sideQuestionsCount");
        if (sideCountEl) sideCountEl.textContent = questions.length;

        if (!questions.length) {
          this.questionsContainer.innerHTML = `
            <div class="profile-empty-state">
              <div class="profile-empty-icon">❓</div>
              <h3 class="profile-empty-title">No questions asked yet</h3>
              <p class="profile-empty-desc">${
                this.isOwnProfile
                  ? "Ask relationship questions to get advice and real stories from the community."
                  : "This user hasn't asked any relationship questions yet."
              }</p>
              ${this.isOwnProfile ? '<a href="/questions" class="btn-profile-action btn-profile-primary" style="margin-top: 14px;">Ask a Question</a>' : ""}
            </div>
          `;
          return;
        }

        this.questionsContainer.innerHTML = questions.map((q) => this.renderQuestionCard(q)).join("");
      } catch (err) {
        console.error("Load questions error:", err);
        this.showError("userQuestionsContainer", "Failed to load questions.");
      }
    }

    renderQuestionCard(q) {
      const title = escapeHtml(q.question);
      const slug = escapeHtml(q.slug || q.id);
      const date = formatRelativeTime(q.created_at);
      const category = escapeHtml((q.category || "General").replace(/^\w/, (m) => m.toUpperCase()));
      const description = escapeHtml(q.description || "");
      const answersCount = Number(q.answers_count || 0);
      const viewsCount = Number(q.views_count || 0);
      const likesCount = Number(q.likes_count || 0);

      return `
        <article class="profile-card profile-question-card" data-question-id="${q.id}">
          <div class="question-meta-row">
            <span class="story-category-tag">${category}</span>
            <span>•</span>
            <span>${date}</span>
          </div>

          <a href="/question/${slug}" class="profile-question-title">${title}</a>

          ${description ? `<p class="profile-question-desc">${description}</p>` : ""}

          <div class="profile-question-footer">
            <a href="/question/${slug}" style="color: var(--lov-pink); text-decoration: none;">
              <strong>${answersCount}</strong> answers
            </a>
            <span><strong>${viewsCount}</strong> views</span>
            <span><strong>${likesCount}</strong> likes</span>
          </div>
        </article>
      `;
    }

    // 3. Answers
    async loadUserAnswers(userId) {
      if (!this.answersContainer) return;
      this.showLoading("userAnswersContainer", "Loading answers...");

      try {
        const url = this.isOwnProfile
          ? `${this.apiBase}/questions/my/answers`
          : `${this.apiBase}/questions/user/${userId}/answers`;

        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load answers");

        const data = await safeJson(res);
        const answers = Array.isArray(data) ? data : (data.answers || []);

        const countEl = document.getElementById("tabAnswersCount");
        if (countEl) countEl.textContent = answers.length;
        const sideCountEl = document.getElementById("sideAnswersCount");
        if (sideCountEl) sideCountEl.textContent = answers.length;

        if (!answers.length) {
          this.answersContainer.innerHTML = `
            <div class="profile-empty-state">
              <div class="profile-empty-icon">💬</div>
              <h3 class="profile-empty-title">No answers given yet</h3>
              <p class="profile-empty-desc">${
                this.isOwnProfile
                  ? "Share your advice and perspectives on relationship discussions to help others."
                  : "This user hasn't written any answers yet."
              }</p>
              ${this.isOwnProfile ? '<a href="/questions" class="btn-profile-action btn-profile-primary" style="margin-top: 14px;">Browse Questions</a>' : ""}
            </div>
          `;
          return;
        }

        this.answersContainer.innerHTML = answers.map((a) => this.renderAnswerCard(a)).join("");
      } catch (err) {
        console.error("Load answers error:", err);
        this.showError("userAnswersContainer", "Failed to load answers.");
      }
    }

    renderAnswerCard(a) {
      const qTitle = escapeHtml(a.question || "Relationship Question");
      const slug = escapeHtml(a.slug || a.question_id);
      const answerText = escapeHtml(a.answer || "");
      const date = formatRelativeTime(a.created_at);
      const likesCount = Number(a.likes_count || 0);
      const commentsCount = Number(a.comments_count || 0);

      return `
        <article class="profile-card profile-answer-card">
          <div class="answer-meta-row">
            <span>Answered ${date}</span>
          </div>

          <a href="/question/${slug}" class="profile-answer-q-title">
            Question: "${qTitle}"
          </a>

          <div class="profile-answer-text">${answerText}</div>

          <div class="profile-answer-footer">
            <span><strong>${likesCount}</strong> likes</span>
            <span><strong>${commentsCount}</strong> comments</span>
            <a href="/question/${slug}" style="color: var(--lov-pink); text-decoration: none; margin-left: auto;">
              View Discussion &rarr;
            </a>
          </div>
        </article>
      `;
    }

    // 4. Followers
    async loadFollowers(userId) {
      if (!this.followersContainer) return;
      this.showLoading("followersContainer", "Loading followers...");

      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/followers`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load followers");

        const data = await safeJson(res);
        const followers = Array.isArray(data) ? data : (data.followers || data.data || []);

        const countEl = document.getElementById("tabFollowersCount");
        if (countEl) countEl.textContent = followers.length;

        if (!followers.length) {
          this.followersContainer.innerHTML = `
            <div class="profile-empty-state">
              <div class="profile-empty-icon">👥</div>
              <h3 class="profile-empty-title">No followers yet</h3>
              <p class="profile-empty-desc">${
                this.isOwnProfile
                  ? "Share stories and participate in Q&A discussions to grow your community."
                  : "This user does not have any followers yet."
              }</p>
            </div>
          `;
          return;
        }

        const ids = followers.map((f) => f.id || f.user_id).filter(Boolean);
        const statusMap = await this.getFollowStatusBatch(ids);
        this.followersContainer.innerHTML = this.renderUserList(followers, statusMap);
      } catch (err) {
        console.error("Load followers error:", err);
        this.showError("followersContainer", "Failed to load followers.");
      }
    }

    // 5. Following
    async loadFollowing(userId) {
      if (!this.followingContainer) return;
      this.showLoading("followingContainer", "Loading following...");

      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/following`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load following");

        const data = await safeJson(res);
        const following = Array.isArray(data) ? data : (data.following || data.data || []);

        const countEl = document.getElementById("tabFollowingCount");
        if (countEl) countEl.textContent = following.length;

        if (!following.length) {
          this.followingContainer.innerHTML = `
            <div class="profile-empty-state">
              <div class="profile-empty-icon">👥</div>
              <h3 class="profile-empty-title">Not following anyone yet</h3>
              <p class="profile-empty-desc">${
                this.isOwnProfile
                  ? "Follow creators, writers, and community members to see their posts in your feed."
                  : "This user is not following anyone yet."
              }</p>
            </div>
          `;
          return;
        }

        const ids = following.map((f) => f.id || f.user_id).filter(Boolean);
        const statusMap = await this.getFollowStatusBatch(ids);
        this.followingContainer.innerHTML = this.renderUserList(following, statusMap);
      } catch (err) {
        console.error("Load following error:", err);
        this.showError("followingContainer", "Failed to load following list.");
      }
    }

    renderUserList(users, statusMap = {}) {
      const myId = this.currentUser ? Number(this.currentUser.id) : null;

      return users
        .map((user) => {
          const uid = Number(user.id || user.user_id);
          if (!uid) return "";
          const isSelf = myId && uid === myId;
          const isFollowing = Boolean(statusMap[uid]);
          const avatar = getAvatarUrl(user.avatar_url || user.avatar);
          const name = escapeHtml(user.display_name || user.username || "User");
          const username = escapeHtml(user.username || "");
          const bio = escapeHtml(user.bio || "");

          return `
            <div class="profile-user-card" data-user-id="${uid}">
              <div class="profile-user-info-wrap">
                <a href="/profile/${encodeURIComponent(username)}">
                  <img src="${avatar}" alt="${name}" class="profile-user-avatar" onerror="this.src='/images/default-avatar.png'">
                </a>
                <div class="profile-user-text">
                  <a href="/profile/${encodeURIComponent(username)}" class="profile-user-name">${name}</a>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">@${username}</div>
                  ${bio ? `<p class="profile-user-bio">${bio}</p>` : ""}
                </div>
              </div>

              ${
                isSelf
                  ? ""
                  : `
                <button type="button" 
                        class="btn-profile-action ${isFollowing ? "btn-profile-following" : "btn-profile-primary"} follow-toggle-btn"
                        data-user-id="${uid}"
                        data-user-name="${name}">
                  <span>${isFollowing ? "Following" : "+ Follow"}</span>
                </button>
              `
              }
            </div>
          `;
        })
        .join("");
    }

    async getFollowStatusBatch(ids = []) {
      const out = {};
      if (!this.currentUser || !ids.length) return out;

      try {
        if (!this._followingSet) {
          const res = await fetch(`${this.apiBase}/users/${this.currentUser.id}/following`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await safeJson(res);
            const list = Array.isArray(data) ? data : (data.following || data.data || []);
            this._followingSet = new Set(list.map((u) => Number(u.id || u.user_id)));
          } else {
            this._followingSet = new Set();
          }
        }

        ids.forEach((id) => {
          out[id] = this._followingSet.has(Number(id));
        });
      } catch (err) {
        console.warn("Batch follow status load error:", err);
        this._followingSet = new Set();
      }

      return out;
    }

    // 6. Activity
    async loadUserActivity(userId) {
      if (!this.activityContainer) return;
      this.showLoading("userActivityContainer", "Loading activity...");

      try {
        const res = await fetch(`${this.apiBase}/users/${userId}/activity`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load activity");

        const data = await safeJson(res);
        const items = Array.isArray(data) ? data : (data.items || data.activity || data.data || []);

        if (!items.length) {
          this.activityContainer.innerHTML = `
            <div class="profile-empty-state">
              <div class="profile-empty-icon">⚡</div>
              <h3 class="profile-empty-title">No recent activity</h3>
              <p class="profile-empty-desc">Recent likes, followers, and contributions will show up here.</p>
            </div>
          `;
          return;
        }

        this.activityContainer.innerHTML = items
          .map((item) => {
            const timeAgo = formatRelativeTime(item.date || item.created_at);
            const message = escapeHtml(item.message || item.text || "Recent community update");
            const type = item.type || "activity";
            const icon = type === "story_like" ? "💖" : type === "new_follower" ? "👤" : "⚡";

            return `
              <div class="profile-activity-item">
                <div class="activity-icon-badge">${icon}</div>
                <div class="activity-item-content">
                  <div class="activity-item-message">${message}</div>
                  <div class="activity-item-time">${timeAgo}</div>
                </div>
              </div>
            `;
          })
          .join("");
      } catch (err) {
        console.error("Load activity error:", err);
        this.showError("userActivityContainer", "Failed to load activity.");
      }
    }

    // -------------------------
    // Follow Toggle System
    // -------------------------
    attachFollowButtonHandlers() {
      document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".follow-toggle-btn");
        if (!btn) return;

        e.preventDefault();
        e.stopPropagation();

        const targetId = btn.dataset.userId;
        if (!targetId) return;

        if (!this.currentUser || !window.currentUserId) {
          showNotification("Please log in to follow members", "info");
          setTimeout(() => (window.location.href = "/login"), 1000);
          return;
        }

        if (Number(this.currentUser.id) === Number(targetId)) {
          showNotification("You cannot follow yourself", "info");
          return;
        }

        const isCurrentlyFollowing = btn.classList.contains("btn-profile-following") || btn.classList.contains("following");
        const nextState = !isCurrentlyFollowing;
        const targetName = btn.dataset.userName || "member";

        // Optimistic UI update
        btn.classList.toggle("btn-profile-following", nextState);
        btn.classList.toggle("btn-profile-primary", !nextState);
        btn.classList.toggle("following", nextState);
        btn.querySelector("span")?.textContent ? (btn.querySelector("span").textContent = nextState ? "Following" : "+ Follow") : (btn.textContent = nextState ? "Following" : "+ Follow");
        btn.disabled = true;

        try {
          const res = await fetch(`${this.apiBase}/users/${targetId}/follow`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            const err = await safeJson(res);
            throw new Error(err?.error || `HTTP ${res.status}`);
          }

          const data = await safeJson(res);
          const confirmedFollowing = data.is_following ?? nextState;

          // Sync all buttons with targetId
          document.querySelectorAll(`[data-user-id="${targetId}"]`).forEach((b) => {
            b.classList.toggle("btn-profile-following", confirmedFollowing);
            b.classList.toggle("btn-profile-primary", !confirmedFollowing);
            b.classList.toggle("following", confirmedFollowing);
            const label = b.querySelector("span");
            if (label) label.textContent = confirmedFollowing ? "Following" : "+ Follow";
          });

          // Sync local follow cache
          if (this._followingSet) {
            confirmedFollowing ? this._followingSet.add(Number(targetId)) : this._followingSet.delete(Number(targetId));
          }

          // Update header follower count if we just followed the viewed profile
          if (this.viewedUser && Number(this.viewedUser.id) === Number(targetId)) {
            const delta = confirmedFollowing ? 1 : -1;
            const current = Number(this.viewedUser.follower_count || 0) + delta;
            this.viewedUser.follower_count = Math.max(0, current);

            const hEl = document.getElementById("headerFollowersCount");
            if (hEl) hEl.textContent = this.viewedUser.follower_count;
            const sEl = document.getElementById("sideFollowersCount");
            if (sEl) sEl.textContent = this.viewedUser.follower_count;
            const tEl = document.getElementById("tabFollowersCount");
            if (tEl) tEl.textContent = this.viewedUser.follower_count;
          }

          showNotification(confirmedFollowing ? `You are now following ${targetName}` : `You unfollowed ${targetName}`);
        } catch (err) {
          console.error("Toggle follow error:", err);
          // Revert optimistic UI
          btn.classList.toggle("btn-profile-following", isCurrentlyFollowing);
          btn.classList.toggle("btn-profile-primary", !isCurrentlyFollowing);
          btn.classList.toggle("following", isCurrentlyFollowing);
          const label = btn.querySelector("span");
          if (label) label.textContent = isCurrentlyFollowing ? "Following" : "+ Follow";
          showNotification("Failed to update follow status", "error");
        } finally {
          btn.disabled = false;
        }
      });
    }

    // -------------------------
    // Edit Profile Modal
    // -------------------------
    attachEditProfileHandlers() {
      const editBtn = document.getElementById("editProfileBtn");
      const modal = document.getElementById("editProfileModal");
      const closeBtn = document.getElementById("closeModalBtn");
      const cancelBtn = document.getElementById("cancelEditBtn");
      const form = document.getElementById("editProfileForm");

      if (editBtn) {
        editBtn.addEventListener("click", () => {
          this.populateEditForm();
          if (modal) {
            modal.classList.add("active");
            modal.style.display = "flex";
          }
        });
      }

      const closeModal = () => {
        if (modal) {
          modal.classList.remove("active");
          setTimeout(() => (modal.style.display = "none"), 200);
        }
      };

      if (closeBtn) closeBtn.addEventListener("click", closeModal);
      if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
      if (modal) {
        window.addEventListener("click", (e) => {
          if (e.target === modal) closeModal();
        });
      }

      if (form) {
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const saveBtn = document.getElementById("saveProfileBtn");
          const msgEl = document.getElementById("editProfileMessage");

          if (saveBtn) saveBtn.disabled = true;
          if (msgEl) {
            msgEl.textContent = "Saving...";
            msgEl.style.color = "#666";
          }

          try {
            const fd = new FormData(form);
            const payload = {};
            for (const [k, v] of fd.entries()) payload[k] = v;

            const res = await fetch(`${this.apiBase}/users/${this.currentUser.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              credentials: "include",
            });

            if (!res.ok) {
              const err = await safeJson(res);
              throw new Error(err?.error || `HTTP ${res.status}`);
            }

            const updatedData = await res.json();
            const updatedUser = updatedData.user || updatedData;
            this.currentUser = { ...this.currentUser, ...updatedUser };
            this.viewedUser = { ...this.viewedUser, ...updatedUser };

            this.renderProfileLayout(this.viewedUser, true);
            showNotification("Profile updated successfully");

            if (msgEl) {
              msgEl.textContent = "Saved ✔";
              msgEl.style.color = "green";
            }

            setTimeout(closeModal, 600);
          } catch (err) {
            console.error("Save profile error:", err);
            if (msgEl) {
              msgEl.textContent = err.message || "Failed to save profile.";
              msgEl.style.color = "red";
            }
            showNotification("Failed to update profile", "error");
          } finally {
            if (saveBtn) saveBtn.disabled = false;
          }
        });
      }
    }

    populateEditForm() {
      if (!this.currentUser) return;
      const user = this.currentUser;

      const nameInput = document.getElementById("editDisplayName");
      const bioInput = document.getElementById("editBio");
      const locInput = document.getElementById("editLocation");
      const workInput = document.getElementById("editWork");
      const relInput = document.getElementById("editRelationshipStatus");
      const genderInput = document.getElementById("editGender");
      const dobInput = document.getElementById("editDOB");
      const msg = document.getElementById("editProfileMessage");

      if (nameInput) nameInput.value = user.display_name || user.username || "";
      if (bioInput) bioInput.value = user.bio || "";
      if (locInput) locInput.value = user.location || "";
      if (workInput) workInput.value = user.work_education || "";
      if (relInput) relInput.value = user.relationship_status || "";
      if (genderInput) genderInput.value = user.gender || "";

      if (dobInput && user.date_of_birth) {
        try {
          const d = new Date(user.date_of_birth);
          dobInput.value = d.toISOString().split("T")[0];
        } catch {
          dobInput.value = "";
        }
      } else if (dobInput) {
        dobInput.value = "";
      }

      if (msg) msg.textContent = "";
    }

    // -------------------------
    // Avatar Upload
    // -------------------------
    attachAvatarUploadHandler() {
      document.body.addEventListener("change", async (e) => {
        if (e.target && e.target.id === "avatarInput") {
          const file = e.target.files[0];
          if (!file) return;

          if (file.size > 4 * 1024 * 1024) {
            showNotification("Avatar must be under 4MB", "error");
            return;
          }

          const img = document.getElementById("avatarImage");
          if (img) img.src = URL.createObjectURL(file);

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
              throw new Error(err?.error || `HTTP ${res.status}`);
            }

            const data = await safeJson(res);
            const newUrl = data.avatar_url || data.avatar;
            const finalUrl = getAvatarUrl(newUrl);

            if (img) img.src = `${finalUrl}?t=${Date.now()}`;

            // Update header / navbar avatars
            document.querySelectorAll(".user-avatar, .nav-user-avatar").forEach((el) => {
              if (el.src?.includes("avatar")) el.src = `${finalUrl}?t=${Date.now()}`;
            });

            showNotification("Profile avatar updated");
            await this.loadCurrentSession();
          } catch (err) {
            console.error("Avatar upload failed:", err);
            showNotification("Failed to upload avatar", "error");
          }
        }
      });
    }

    // -------------------------
    // Logout Handler
    // -------------------------
    attachLogoutHandler() {
      const logoutBtn = document.getElementById("profileCardLogoutBtn");
      if (!logoutBtn) return;

      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        logoutBtn.disabled = true;

        try {
          await fetch(`${this.apiBase}/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace(`/login?logout=${Date.now()}`);
        } catch {
          window.location.replace("/login");
        }
      });
    }

    // -------------------------
    // Global Message Button
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
      });
    }

    // -------------------------
    // Helpers
    // -------------------------
    slugify(text = "") {
      return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 180);
    }

    showLoading(containerId, text = "Loading...") {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = `
        <div style="text-align: center; padding: 36px 20px; color: #65676b;">
          <div style="width: 28px; height: 28px; border: 3px solid rgba(255,75,141,0.2); border-top-color: #ff4b8d; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 10px;"></div>
          <p style="margin: 0; font-size: 0.88rem; font-weight: 500;">${text}</p>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      `;
    }

    showError(containerId, message) {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = `
        <div style="text-align: center; padding: 32px 20px; color: #e53935; font-size: 0.9rem;">
          <p style="margin: 0;">${message}</p>
        </div>
      `;
    }

    handleNotFound() {
      if (this.profileInfoContainer) {
        this.profileInfoContainer.innerHTML = `
          <div class="profile-header-card" style="text-align: center; padding: 48px 24px;">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">👤</div>
            <h2 style="font-size: 1.3rem; margin: 0 0 8px;">User Not Found</h2>
            <p style="color: var(--text-secondary); margin: 0 0 20px;">The profile you're looking for doesn't exist or may have been deleted.</p>
            <a href="/" class="btn-profile-action btn-profile-primary">Back to Home</a>
          </div>
        `;
      }
    }

    handleUnauthorized() {
      showNotification("Please log in to view this profile", "info");
      setTimeout(() => (window.location.href = "/login"), 800);
    }
  }

  // -------------------------
  // Auto Initialize
  // -------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const onProfilePage =
      document.getElementById("profileInfoContainer") ||
      window.location.pathname.startsWith("/profile");

    if (onProfilePage) {
      window.profileManager = new ProfileManager();
    }
  });
})();
