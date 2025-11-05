// frontend/js/auth-utils.js
// ✅ Global helper for login check and popup
const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

// Check if a user is logged in
async function isUserLoggedIn() {
  try {
    const res = await fetch(`${API_BASE}/auth/session`, { credentials: "include" });
    const data = await res.json();
    return data.loggedIn ? data.user : null;
  } catch {
    return null;
  }
}

// Show popup asking to log in or sign up
function showLoginRequiredPopup() {
  // If popup already exists, don’t duplicate
  if (document.querySelector(".login-popup")) return;

  const popup = document.createElement("div");
  popup.className = "login-popup";
  popup.innerHTML = `
    <div class="popup-overlay"></div>
    <div class="popup-box">
      <button class="popup-close">&times;</button>
      <h3>💖 Please Log In to Continue</h3>
      <p>You need an account to like, comment, or follow.</p>
      <div class="popup-buttons">
        <a href="/login.html" class="btn btn-login">Log In</a>
        <a href="/signup.html" class="btn btn-signup">Sign Up</a>
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("show"), 10); // trigger animation

  // Close handlers
  popup.querySelector(".popup-overlay").onclick = () => closePopup(popup);
  popup.querySelector(".popup-close").onclick = () => closePopup(popup);

  function closePopup(el) {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }
}

// 🌸 Styles + Animation
const style = document.createElement("style");
style.textContent = `
.login-popup {
  position: fixed; inset: 0;
  display:flex; align-items:center; justify-content:center;
  background: rgba(0,0,0,0.0);
  opacity: 0;
  transition: background 0.3s ease, opacity 0.3s ease;
  z-index: 9999;
}
.login-popup.show {
  background: rgba(0,0,0,0.5);
  opacity: 1;
}
.popup-box {
  position: relative;
  background: #fff;
  padding: 30px;
  border-radius: 14px;
  text-align: center;
  max-width: 320px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  transform: translateY(40px);
  opacity: 0;
  transition: transform 0.35s ease-out, opacity 0.35s ease-out;
}
.login-popup.show .popup-box {
  transform: translateY(0);
  opacity: 1;
}
.popup-buttons {
  display: flex; gap: 10px; justify-content: center; margin-top: 18px;
}
.popup-buttons a {
  padding: 10px 18px;
  border-radius: 8px;
  text-decoration: none;
  color: white;
  font-weight: 600;
  transition: transform 0.2s ease;
}
.popup-buttons a:hover {
  transform: scale(1.05);
}
.btn-login { background: #ff4b8d; }
.btn-signup { background: #4b9eff; }
.popup-close {
  position: absolute;
  top: 8px;
  right: 12px;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: #777;
  transition: color 0.2s ease;
}
.popup-close:hover { color: #ff4b8d; }
`;
document.head.appendChild(style);
