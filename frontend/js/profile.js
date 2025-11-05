// frontend/js/profile.js — Lovculator with "My Stories" Dashboard 💖

class ProfileManager {
  constructor() {
    this.API_BASE = window.location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api";

    this.container = document.getElementById("userProfileContainer");
    this.storiesContainer = document.getElementById("userStoriesContainer");
    this.currentUser = null;

    this.init();
  }

  // ------------------------------
  // 1️⃣ Initialize Profile
  // ------------------------------
  async init() {
    this.showLoading("Loading your profile...");

    try {
      const res = await fetch(`${this.API_BASE}/auth/me`, { credentials: "include" });

      if (!res.ok) {
        this.handleUnauthorized();
        return;
      }

      const user = await res.json();
      this.currentUser = user;

      this.fadeTransition(this.getProfileHTML(user), async () => {
        this.attachLogoutHandler();
        await this.loadUserStories(user.id);
      });

    } catch (err) {
      console.error("❌ Profile load error:", err);
      this.fadeTransition(`<p style="color:red;text-align:center;">❌ Failed to load profile.</p>`);
    }
  }

  // ------------------------------
  // 2️⃣ Generate Profile HTML
  // ------------------------------
  getProfileHTML(user) {
    return `
      <div class="user-profile-card" style="text-align:center;animation:fadeIn 0.5s;">
        <h2>💖 Welcome, ${user.username}</h2>
        <p><strong>Email:</strong> ${user.email || "Not available"}</p>
        <p style="color:#666;margin:10px 0;">View your stories and activity below.</p>
        <div style="margin-top:20px;">
          <button id="logoutBtn" class="btn"
            style="background:#ff4b8d;color:#fff;padding:10px 18px;border:none;border-radius:8px;cursor:pointer;">
            🚪 Logout
          </button>
        </div>
      </div>
    `;
  }

  // ------------------------------
  // 3️⃣ Handle Unauthorized User
  // ------------------------------
  handleUnauthorized() {
    this.fadeTransition(`
      <div class="not-logged-in" style="text-align:center;">
        <p>⚠️ You must log in to view your profile.</p>
        <a href="/login.html" class="btn"
          style="background:#ff4b8d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">
          Go to Login
        </a>
      </div>
    `);
  }

  // ------------------------------
  // 4️⃣ Logout
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
        this.fadeTransition(`
          <div style="text-align:center;">
            <p>✅ Logged out successfully!</p>
            <a href="/login.html" class="btn"
              style="background:#ff4b8d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">
              Go to Login
            </a>
          </div>
        `);
        setTimeout(() => (window.location.href = "/login.html"), 800);
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

    this.storiesContainer.innerHTML = `
      <div style="text-align:center;margin-top:20px;">
        <div class="spinner" style="width:30px;height:30px;border:3px solid #ddd;border-top-color:#ff4b8d;border-radius:50%;margin:auto;animation:spin 1s linear infinite;"></div>
        <p style="color:#888;">Loading your stories...</p>
      </div>
    `;

    try {
      const res = await fetch(`${this.API_BASE}/stories?userId=${userId}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch user stories");

      const stories = await res.json();

      if (!stories.length) {
        this.storiesContainer.innerHTML = `
          <p style="text-align:center;color:#777;margin-top:20px;">
            💌 You haven’t shared any love stories yet.<br>
            <a href="/love-stories" style="color:#ff4b8d;text-decoration:none;">Share one now!</a>
          </p>
        `;
        return;
      }

      // Render stories dynamically
      this.storiesContainer.innerHTML = stories.map((story) => `
        <div class="story-card" style="border:1px solid #eee;border-radius:10px;padding:15px;margin:10px;box-shadow:0 2px 8px rgba(0,0,0,0.05);animation:fadeIn 0.3s;">
          <h3 style="color:#ff4b8d;">${story.story_title}</h3>
          <p style="color:#444;margin:8px 0;">${story.love_story.substring(0, 100)}...</p>
          <p style="font-size:13px;color:#888;">
            <strong>${story.category || "Love"}</strong> | ❤️ ${story.likes_count || 0} likes | 🗓️ ${new Date(story.created_at).toLocaleDateString()}
          </p>
        </div>
      `).join("");

    } catch (err) {
      console.error("❌ Error loading user stories:", err);
      this.storiesContainer.innerHTML = `
        <p style="text-align:center;color:red;">
          ❌ Could not load your stories. Please try again later.
        </p>
      `;
    }
  }

  // ------------------------------
  // 6️⃣ Utility: Loading + Transition
  // ------------------------------
  showLoading(text = "Loading...") {
    this.container.innerHTML = `
      <div class="loading-wrapper" style="text-align:center;margin-top:60px;animation:fadeIn 0.5s;">
        <div class="spinner" style="width:40px;height:40px;border:4px solid #ddd;border-top-color:#ff4b8d;border-radius:50%;margin:0 auto;animation:spin 1s linear infinite;"></div>
        <p style="margin-top:12px;color:#666;">${text}</p>
      </div>
    `;
  }

  fadeTransition(newHTML, callback = () => {}) {
    this.container.style.opacity = "0";
    this.container.style.transition = "opacity 0.2s ease-out";
    setTimeout(() => {
      this.container.innerHTML = newHTML;
      this.container.style.transition = "opacity 0.5s ease-in";
      this.container.style.opacity = "1";
      callback();
    }, 200);
  }
}

// 🌟 Initialize ProfileManager
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("userProfileContainer");
  if (!container) {
    console.error("❌ userProfileContainer not found in DOM.");
    return;
  }

  new ProfileManager();

  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin { from {transform:rotate(0deg);} to {transform:rotate(360deg);} }
    @keyframes fadeIn { from {opacity:0;transform:translateY(10px);} to {opacity:1;transform:translateY(0);} }
  `;
  document.head.appendChild(style);
});
