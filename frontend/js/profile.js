// frontend/js/profile.js — Backend-Ready Version (CORRECTED)
class ProfileManager {
  constructor() {
    this.API_BASE = window.location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api";

    this.container = document.getElementById("userProfileContainer");
    this.currentUser = null; // Store user data here
    this.init();
  }

  async init() {
    this.showLoading("Loading your profile...");

    try {
      // 1️⃣ Check active session (CORRECTION: Use /auth/me as per REST standard)
      const res = await fetch(`${this.API_BASE}/auth/me`, {
        credentials: "include",
      });
      
      // Check for UNAUTHORIZED status first (res.ok is false for 4xx codes)
      if (!res.ok) {
        this.handleUnauthorized();
        return;
      }
      
      // Assuming a successful (200 OK) response means the user object is returned
      const user = await res.json();
      this.currentUser = user; 

      // 2️⃣ Display basic profile
      this.fadeTransition(this.getProfileHTML(user), () => {
        // 3️⃣ Attach the logout handler immediately after the HTML is rendered
        this.attachLogoutHandler();
      });

    } catch (err) {
      console.error("Profile load error:", err);
      this.fadeTransition(`<p style="color:red;text-align:center;">❌ Failed to load profile. Please try again later.</p>`);
    }
  }
  
  // Helper to structure the main profile view HTML
  getProfileHTML(user) {
      return `
        <div class="user-profile-card enhanced" style="text-align:center;animation:fadeIn 0.5s;">
          <h2>💖 Welcome, ${user.username}</h2>
          <p><strong>Email:</strong> ${user.email || "Not available"}</p>
          <p style="color:#666;margin:10px 0;">This is your Lovculator profile.</p>
          <div style="margin-top:20px;">
            <button id="logoutBtn" class="btn" style="background:#ff4b8d;color:#fff;padding:10px 18px;border:none;border-radius:8px;cursor:pointer;">🚪 Logout</button>
          </div>
        </div>
      `;
  }

  // Helper to handle the unauthorized state
  handleUnauthorized() {
    this.fadeTransition(`
      <div class="not-logged-in" style="text-align:center;">
        <p>⚠️ You must log in to view your profile.</p>
        <a href="/login.html" class="btn" style="background:#ff4b8d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Go to Login</a>
      </div>
    `);
  }

  // Helper to attach the logout click event
  attachLogoutHandler() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        // Use an arrow function to maintain 'this' context for class methods
      logoutBtn.addEventListener("click", this.handleLogout.bind(this)); 
    }
  }

  // New method to encapsulate logout logic
  async handleLogout() {
    const logoutRes = await fetch(`${this.API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    
    // Server should return 204 No Content (logoutRes.ok is true for 204)
    if (logoutRes.ok) {
      this.fadeTransition(`
        <div style="text-align:center;">
          <p>✅ Logged out successfully!</p>
          <a href="/login.html" class="btn" style="background:#ff4b8d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Go to Login</a>
        </div>
      `);
      // Add a brief delay before redirecting
      setTimeout(() => (window.location.href = "/login.html"), 800);
    } else {
        // Handle explicit logout failure message
        console.error("Logout failed on server.");
        alert("Logout failed. Please try again or clear browser data.");
    }
  }

  // 🌀 Loading spinner
  showLoading(text = "Loading...") {
    this.container.innerHTML = `
      <div class="loading-wrapper" style="text-align:center;margin-top:60px;animation:fadeIn 0.5s;">
        <div class="spinner" style="width:40px;height:40px;border:4px solid #ddd;border-top-color:#ff4b8d;border-radius:50%;margin:0 auto;animation:spin 1s linear infinite;"></div>
        <p style="margin-top:12px;color:#666;">${text}</p>
      </div>
    `;
  }

  // ✨ Smooth fade transitions
  fadeTransition(newHTML, callback = () => {}) {
    this.container.style.opacity = "0";
    this.container.style.transition = "opacity 0.2s ease-out"; 
    setTimeout(() => {
      this.container.innerHTML = newHTML;
      this.container.style.transition = "opacity 0.5s ease-in";
      this.container.style.opacity = "1";
      callback(); // Execute callback after content is in DOM
    }, 200);
  }
}

// Global setup
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the class instance
  const manager = new ProfileManager();

  // Global animations
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin { from {transform:rotate(0deg);} to {transform:rotate(360deg);} }
    @keyframes fadeIn { from {opacity:0;transform:translateY(10px);} to {opacity:1;transform:translateY(0);} }
  `;
  document.head.appendChild(style);
});