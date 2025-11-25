// ✅ Correct Global API Base Definition (Use window.ROOT_API_BASE)

window.ROOT_API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

// API_BASE specific to this file uses the root path:
const AUTH_API_BASE = `${window.ROOT_API_BASE}/auth`;

console.log(`🌍 Using Root API Base URL: ${window.ROOT_API_BASE}`);

// =======================================
// 🧩 Utility Functions
// =======================================
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

async function safeParseResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Invalid server response" };
  }
}

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

const style = document.createElement("style");
style.textContent = `
@keyframes spin { from {transform:rotate(0deg);} to {transform:rotate(360deg);} }
`;
document.head.appendChild(style);

// =======================================
// 🚀 AUTH MANAGER CLASS (Single, Unified Declaration)
// =======================================
class AuthManager {
  // All methods must now use AUTH_API_BASE
  static async signup(username, email, password) {
    const res = await fetch(`${AUTH_API_BASE}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async login(email, password) {
    const res = await fetch(`${AUTH_API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async getProfile() {
  const res = await fetch(`${AUTH_API_BASE}/me`, {
    method: "GET",
    credentials: "include",
  });
  return safeParseResponse(res).then((data) => ({ res, data }));
}


  static async logout() {
    const res = await fetch(`${AUTH_API_BASE}/logout`, {
      method: "POST",
      credentials: "include",
    });
    return safeParseResponse(res);
  }
  
  // --- NEW: Forgot Password Method ---
  static async forgotPassword(email) {
    const res = await fetch(`${AUTH_API_BASE}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  // --- NEW: Reset Password Method ---
  static async resetPassword(token, newPassword) {
    const res = await fetch(`${AUTH_API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }
}

window.AuthManager = AuthManager;

// =======================================
// 🧠 EVENT HANDLERS (All Unified)
// =======================================
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const forgotPasswordForm = document.getElementById("forgot-password-form"); // NEW
  const resetPasswordForm = document.getElementById("reset-password-form");   // NEW

  // --- SIGNUP HANDLER ---
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = signupForm.querySelector(".btn-submit");
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!username || !email || !password)
        return showMessage("⚠️ Please fill in all fields.", "error");
      if (password.length < 6)
        return showMessage("⚠️ Password must be at least 6 characters.", "error");

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
      const usernameOrEmail = document.getElementById("username-or-email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!usernameOrEmail || !password)
        return showMessage("⚠️ Please enter both fields.", "error");

      toggleLoading(btn, true, "Logging In...");

      try {
        const { res, data } = await AuthManager.login(usernameOrEmail, password);
        if (res.ok) {
          showMessage("✅ Login successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile.html"), 1200);
        } else {
          const errorMessage = data.error || data.message || "❌ Invalid credentials.";
          showMessage(errorMessage, "error");
          toggleLoading(btn, false);
        }
      } catch (err) {
        console.error("Login error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
        toggleLoading(btn, false);
      }
    });
  }
  
  // --- NEW: FORGOT PASSWORD HANDLER ---
  if (forgotPasswordForm) {
      forgotPasswordForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = forgotPasswordForm.querySelector(".btn-submit");
          const email = document.getElementById("email").value.trim();

          toggleLoading(btn, true, "Sending...");

          try {
              // Crucial: Server handles the 'email exists' check; client just shows success message
              await AuthManager.forgotPassword(email); 
              showMessage(
                  "✅ If that email exists, a password reset link has been sent!", 
                  "success"
              );
              toggleLoading(btn, false);
          } catch (err) {
              console.error("Forgot Password error:", err);
              showMessage("🚫 Network error or server unreachable.", "error");
              toggleLoading(btn, false);
          }
      });
  }

  // --- NEW: RESET PASSWORD HANDLER ---
  if (resetPasswordForm) {
      resetPasswordForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const btn = resetPasswordForm.querySelector(".btn-submit");
          const token = document.getElementById("reset-token").value;
          const newPassword = document.getElementById("new-password").value;
          const confirmPassword = document.getElementById("confirm-password").value;

          if (newPassword.length < 6) return showMessage("⚠️ Password must be at least 6 characters.", "error");
          if (newPassword !== confirmPassword) return showMessage("⚠️ Passwords do not match.", "error");
          
          toggleLoading(btn, true, "Resetting...");

          try {
              const { res, data } = await AuthManager.resetPassword(token, newPassword);
              if (res.ok) {
                  showMessage("✅ Password reset successful! Redirecting to login...", "success");
                  setTimeout(() => (window.location.href = "/login.html"), 1500);
              } else {
                  // This is where invalid/expired token errors show up
                  showMessage(data.error || "❌ Reset failed. The link may have expired.", "error");
                  toggleLoading(btn, false);
              }
          } catch (err) {
              console.error("Reset Password error:", err);
              showMessage("🚫 Network error or server unreachable.", "error");
              toggleLoading(btn, false);
          }
      });
  }
});