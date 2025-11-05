// ✅ frontend/js/auth.js — Clean & Production Ready

// Detect environment (local vs production)
const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api/auth"
  : "https://lovculator.com/api/auth";

console.log(`🌍 Using API Base URL: ${API_BASE}`);

// =======================================
// 🧩 Utility Functions
// =======================================

// Show inline message (error/success)
function showMessage(text, type = "info") {
  const msgBox = document.getElementById("error-message");
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.style.color =
    type === "error" ? "red" : type === "success" ? "green" : "#555";
  msgBox.style.opacity = "1";

  setTimeout(() => {
    msgBox.style.transition = "opacity 0.5s ease-out";
    msgBox.style.opacity = "0";
  }, 4000);
}

// Safe JSON parser (avoids crash if response isn’t JSON)
async function safeParseResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Invalid server response" };
  }
}

// Small button loader toggle
function toggleLoading(btn, isLoading, text = "Please wait...") {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = `<span class="spinner" style="
      display:inline-block;width:14px;height:14px;
      border:2px solid white;border-top:2px solid transparent;
      border-radius:50%;animation:spin 0.8s linear infinite;
      vertical-align:middle;margin-right:6px;"></span>${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || "Submit";
  }
}

// Add simple CSS spinner animation
const style = document.createElement("style");
style.textContent = `
@keyframes spin { from {transform:rotate(0deg);} to {transform:rotate(360deg);} }
`;
document.head.appendChild(style);

// =======================================
// 🚀 AUTH MANAGER (GLOBAL CLASS)
// =======================================
class AuthManager {
  static async signup(username, email, password) {
    const res = await fetch(`${API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async login(usernameOrEmail, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username: usernameOrEmail, password }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async getProfile() {
    const res = await fetch(`${API_BASE}/profile`, {
      method: "GET",
      credentials: "include",
    });
    return safeParseResponse(res);
  }

  static async logout() {
    const res = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include",
    });
    return safeParseResponse(res);
  }
}

// Expose AuthManager globally (for profile.js, etc.)
window.AuthManager = AuthManager;

// =======================================
// 🧠 EVENT HANDLERS (Signup + Login)
// =======================================
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  // --- SIGNUP HANDLER ---
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = signupForm.querySelector(".btn-submit");
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!username || !email || !password) {
        return showMessage("⚠️ Please fill in all fields.", "error");
      }
      if (password.length < 6) {
        return showMessage("⚠️ Password must be at least 6 characters.", "error");
      }

      toggleLoading(btn, true, "Signing Up...");
      try {
        const { res, data } = await AuthManager.signup(username, email, password);
        if (res.ok) {
          showMessage("✅ Signup successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile.html"), 1200);
        } else {
          showMessage(data.error || data.message || "❌ Signup failed.", "error");
          toggleLoading(btn, false);
        }
      } catch (err) {
        console.error("Signup error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
        toggleLoading(btn, false);
      }
    });
  }

  // --- LOGIN HANDLER ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector(".btn-submit");
      const usernameOrEmail = document
        .getElementById("username-or-email")
        .value.trim();
      const password = document.getElementById("password").value.trim();

      if (!usernameOrEmail || !password) {
        return showMessage("⚠️ Please enter both fields.", "error");
      }

      toggleLoading(btn, true, "Logging In...");
      try {
        const { res, data } = await AuthManager.login(usernameOrEmail, password);
        if (res.ok) {
          showMessage("✅ Login successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile.html"), 1200);
        } else {
          showMessage(data.error || data.message || "❌ Invalid credentials.", "error");
          toggleLoading(btn, false);
        }
      } catch (err) {
        console.error("Login error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
        toggleLoading(btn, false);
      }
    });
  }
});
