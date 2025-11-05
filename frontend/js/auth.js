// frontend/js/auth.js — final version (CORRECTED for robustness)

const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

console.log(`🌍 Using API Base URL: ${API_BASE}`);

// Helper for inline messages
function showMessage(text, type = "info") {
  const msgBox = document.getElementById("error-message");
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.style.color =
    type === "error" ? "red" : type === "success" ? "green" : "#555";
  msgBox.style.opacity = "1";
  
  // Set explicit visibility for 50ms before fade-out starts
  setTimeout(() => {
    msgBox.style.transition = "opacity 0.5s ease-out";
    msgBox.style.opacity = "0";
  }, 4000); 
}

// Function to safely parse JSON response
async function safeParseResponse(res) {
    const responseText = await res.text();
    let data = {};
    try {
        // Attempt to parse the text as JSON
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        // If parsing fails, use a fallback error message
        data = { error: "Server returned an unreadable response." };
    }
    return data;
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  // ======================
  // 📝 SIGNUP HANDLER
  // ======================
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!username || !email || !password) {
        showMessage("⚠️ Please fill in all fields.", "error");
        return;
      }
      if (password.length < 6) { // Added minimal client-side validation
         showMessage("⚠️ Password must be at least 6 characters.", "error");
         return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, email, password }),
        });

        // Use the safe parsing function
        const data = await safeParseResponse(res);
        
        if (res.ok) {
          showMessage("✅ Signup successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile.html"), 1200);
        } else {
          // Look for 'error' or 'message' from the backend
          const errorMessage = data.error || data.message || "❌ Signup failed due to server issue.";
          showMessage(errorMessage, "error");
        }
      } catch (err) {
        console.error("Signup error:", err);
        showMessage("🚫 Network error or Server unreachable.", "error");
      }
    });
  }

  // ======================
  // 🔐 LOGIN HANDLER
  // ======================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const usernameOrEmail = document
        .getElementById("username-or-email")
        .value.trim();
      const password = document.getElementById("password").value.trim();

      if (!usernameOrEmail || !password) {
        showMessage("⚠️ Please enter both fields.", "error");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: usernameOrEmail, // Server logic handles whether this is username or email
            password,
          }),
        });

        // =================================================================
// 🎨 UTILITY FUNCTIONS
// =================================================================

// Helper for inline messages (Refined transition logic)
function showMessage(text, type = "info") {
  const msgBox = document.getElementById("error-message");
  if (!msgBox) return;
  
  // 1. Set new content and style
  msgBox.textContent = text;
  msgBox.style.color =
    type === "error" ? "red" : type === "success" ? "green" : "#555";
  msgBox.style.transition = "opacity 0.1s ease-in"; // Set quick fade-in
  msgBox.style.opacity = "1";
  
  // 2. Set timeout for fade-out
  setTimeout(() => {
    msgBox.style.transition = "opacity 0.5s ease-out"; // Set slower fade-out
    msgBox.style.opacity = "0";
  }, 4000); 
}

// Function to safely parse JSON response (CRITICAL for error handling)
async function safeParseResponse(res) {
    const responseText = await res.text();
    let data = {};
    try {
        // Attempt to parse the text as JSON
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        // If parsing fails, use a fallback error message
        data = { error: "Server returned an unreadable response." };
    }
    return data;
}

// Add temporary loading animation to button
function toggleLoading(btn, isLoading, text = "Processing...") {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = `<span class="spinner" style="
        display:inline-block;
        width:14px; height:14px;
        border:2px solid white;
        border-top:2px solid transparent;
        border-radius:50%;
        animation: spin 0.8s linear infinite;
        vertical-align:middle;
        margin-right:6px;"></span> ${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || "Submit";
  }
}

// =================================================================
// 🚀 EVENT HANDLERS
// =================================================================

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

      // Basic client-side validation
      if (!username || !email || !password) {
        showMessage("⚠️ Please fill in all fields.", "error");
        return;
      }
      if (password.length < 6) { // Added password length validation
         showMessage("⚠️ Password must be at least 6 characters.", "error");
         return;
      }
      
      toggleLoading(btn, true, "Signing Up..."); // Start loading ONLY after validation

      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, email, password }),
        });

        const data = await safeParseResponse(res); // Use robust parser
        
        if (res.ok) {
          showMessage("✅ Signup successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile.html"), 1200);
        } else {
          const errorMessage = data.error || data.message || "❌ Signup failed. Please check your inputs.";
          showMessage(errorMessage, "error");
          toggleLoading(btn, false);
        }
      } catch (err) {
        console.error("Signup error:", err);
        showMessage("🚫 Network error or Server unreachable.", "error");
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
        showMessage("⚠️ Please enter both fields.", "error");
        return;
      }
      
      toggleLoading(btn, true, "Logging In..."); // Start loading ONLY after validation

      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: usernameOrEmail,
            password,
          }),
        });

        const data = await safeParseResponse(res); // Use robust parser
        
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
        showMessage("🚫 Network error or Server unreachable.", "error");
        toggleLoading(btn, false);
      }
    });
  }
});

// Small CSS spinner animation (Keep this outside DOMContentLoaded)
const style = document.createElement("style");
style.textContent = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`;
document.head.appendChild(style);

        // Use the safe parsing function
        const data = await safeParseResponse(res);
        
        if (res.ok) {
          showMessage("✅ Login successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile.html"), 1200);
        } else {
          const errorMessage = data.error || data.message || "❌ Invalid credentials.";
          showMessage(errorMessage, "error");
        }
      } catch (err) {
        console.error("Login error:", err);
        showMessage("🚫 Network error or Server unreachable.", "error");
      }
    });
  }
});