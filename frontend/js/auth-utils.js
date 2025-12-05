// frontend/js/auth-utils.js
// ✅ Global authentication and logout utilities
const API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

// Global logout flag
let isLoggingOut = false;

// ============================================
// 🔐 AUTHENTICATION UTILITIES
// ============================================

// Check if a user is logged in
async function isUserLoggedIn() {
  try {
    const res = await fetch(`${API_BASE}/auth/session`, { 
      credentials: "include",
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    const data = await res.json();
    return data.loggedIn ? data.user : null;
  } catch {
    return null;
  }
}

// Check current session with cache prevention
async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    });
    
    if (!res.ok) {
      // If on protected page and session invalid, redirect
      const protectedPages = ['/profile.html', '/messages.html', '/admin-analytics.html'];
      const currentPage = window.location.pathname;
      
      if (protectedPages.some(page => currentPage.includes(page))) {
        console.log("🛡️ Session invalid on protected page, redirecting...");
        setTimeout(() => {
          window.location.replace('/login.html?session_expired=true');
        }, 100);
      }
      return null;
    }
    
    const data = await res.json();
    return data.user || data;
  } catch (err) {
    console.warn("⚠️ Session check failed:", err);
    return null;
  }
}

// Show popup asking to log in or sign up
function showLoginRequiredPopup() {
  // If popup already exists, don't duplicate
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
  setTimeout(() => popup.classList.add("show"), 10);

  // Close handlers
  popup.querySelector(".popup-overlay").onclick = () => closePopup(popup);
  popup.querySelector(".popup-close").onclick = () => closePopup(popup);

  function closePopup(el) {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }
}

// ============================================
// 🚀 LOGOUT UTILITIES (Consolidated)
// ============================================

/**
 * 🔥 NUCLEAR LOGOUT - Complete cache clearing and back button prevention
 * Use this for profile page and other protected areas
 */
async function nuclearLogout() {
  if (isLoggingOut) return;
  isLoggingOut = true;
  
  console.log("💣 NUCLEAR LOGOUT INITIATED");
  
  try {
    // 1. Set global logout flag
    window.isLoggingOut = true;
    
    // 2. IMMEDIATELY clear ALL frontend state
    window.currentUser = null;
    window.currentUserId = null;
    window.localUser = null;
    
    // 3. Clear ALL storage with timestamp
    const timestamp = Date.now();
    localStorage.clear();
    sessionStorage.clear();
    
    // Store logout timestamp to detect back button attempts
    sessionStorage.setItem('__logout_timestamp', timestamp.toString());
    
    // 4. Clear cookies aggressively
    clearAllCookies();
    
    // 5. Send logout request (fire and forget)
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    }).catch(() => { /* Ignore errors */ });
    
    // 6. STOP ALL JavaScript timers
    stopAllTimers();
    
    // 7. Disconnect WebSocket if exists
    disconnectWebSocket();
    
    // 8. PREVENT BACK BUTTON - Manipulate history
    preventBackButton();
    
    // 9. Create cache-busting URL
    const cacheBuster = `logout_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    const redirectUrl = `/login.html?logout=true&cb=${cacheBuster}&t=${timestamp}`;
    
    // 10. Execute multiple redirect strategies
    executeRedirect(redirectUrl);
    
  } catch (err) {
    console.error("❌ Nuclear logout error:", err);
    // Ultimate fallback
    window.location.href = `/login.html?logout_error=${Date.now()}`;
  }
}

/**
 * 🚀 FORCE LOGOUT - Standard logout with cache prevention
 * Use for most pages
 */
async function forceLogout() {
  if (isLoggingOut) return;
  isLoggingOut = true;
  
  console.log("🔒 FORCE LOGOUT INITIATED");
  
  try {
    window.isLoggingOut = true;
    
    // Clear frontend state
    window.currentUser = null;
    window.currentUserId = null;
    localStorage.clear();
    sessionStorage.clear();
    
    // Store logout timestamp
    sessionStorage.setItem('__logout_timestamp', Date.now().toString());
    
    // Call logout endpoint
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      cache: 'no-store'
    }).catch(() => {});
    
    // Redirect with cache prevention
    const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const redirectUrl = `/login.html?logout=true&uid=${uniqueId}`;
    
    // Replace history to prevent back button
    window.history.replaceState(null, '', redirectUrl);
    
    // Force redirect
    window.location.replace(redirectUrl);
    
  } catch (err) {
    console.error("❌ Force logout error:", err);
    window.location.href = `/login.html?error=${Date.now()}`;
  }
}

/**
 * 🎯 SIMPLE LOGOUT - Quick logout for non-critical pages
 */
function simpleLogout() {
  if (isLoggingOut) return;
  
  console.log("🎯 SIMPLE LOGOUT");
  
  const cacheBuster = Date.now();
  
  // Send logout request
  fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  }).catch(() => {});
  
  // Redirect
  window.location.href = `/login.html?simple_logout=${cacheBuster}`;
}

// ============================================
// 🛠️ HELPER FUNCTIONS
// ============================================

function clearAllCookies() {
  const cookies = document.cookie.split(";");
  
  cookies.forEach(cookie => {
    const name = cookie.split("=")[0].trim();
    
    // Clear with various domain/path combinations
    const domains = [
      '',
      window.location.hostname,
      `.${window.location.hostname}`
    ];
    
    const paths = ['/', '/api', '/auth'];
    
    domains.forEach(domain => {
      paths.forEach(path => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};` +
                         (domain ? ` domain=${domain};` : '');
      });
    });
  });
}

function stopAllTimers() {
  // Get the highest timer ID
  const maxTimerId = setTimeout(() => {}, 0);
  
  // Clear all timeouts and intervals
  for (let i = maxTimerId; i >= 0; i--) {
    clearTimeout(i);
    clearInterval(i);
  }
}

function disconnectWebSocket() {
  // Disconnect global WebSocket
  if (window.globalSocket && typeof window.globalSocket.close === 'function') {
    try {
      window.globalSocket.close(1000, "User logged out");
    } catch (e) {}
  }
  
  // Disconnect messages WebSocket
  if (window.messagesManager && typeof window.messagesManager.disconnect === 'function') {
    try {
      window.messagesManager.disconnect();
    } catch (e) {}
  }
}

function preventBackButton() {
  // Replace current history entry with login page
  window.history.pushState(null, null, '/login.html');
  window.history.replaceState(null, null, '/login.html');
  
  // Set up back button blocker
  window.addEventListener('popstate', function backButtonBlocker(event) {
    console.log("🚫 Back button blocked");
    
    // Go forward instead of back
    window.history.go(1);
    
    // Redirect to login
    setTimeout(() => {
      window.location.replace('/login.html?back_blocked=true');
    }, 10);
    
    // Remove this listener after use
    window.removeEventListener('popstate', backButtonBlocker);
  }, { once: true });
}

function executeRedirect(redirectUrl) {
  // Strategy 1: Meta refresh (works without JavaScript)
  const meta = document.createElement('meta');
  meta.httpEquiv = 'refresh';
  meta.content = `0; url=${redirectUrl}`;
  document.head.appendChild(meta);
  
  // Strategy 2: location.replace() (removes from history)
  setTimeout(() => {
    window.location.replace(redirectUrl);
  }, 10);
  
  // Strategy 3: location.href as fallback
  setTimeout(() => {
    if (window.location.pathname !== '/login.html') {
      window.location.href = redirectUrl;
    }
  }, 50);
  
  // Strategy 4: Final nuclear option
  setTimeout(() => {
    if (window.location.pathname !== '/login.html') {
      window.location.href = `/login.html?force=${Date.now()}`;
    }
  }, 200);
}

/**
 * 🛡️ SESSION VALIDATION - Check session on protected pages
 */
function validateSession() {
  // Check if we recently logged out
  const logoutTime = sessionStorage.getItem('__logout_timestamp');
  const currentTime = Date.now();
  
  if (logoutTime && (currentTime - parseInt(logoutTime)) < 60000) { // 1 minute
    console.log("🛡️ Recent logout detected");
    
    // Clear the timestamp
    sessionStorage.removeItem('__logout_timestamp');
    
    // If on protected page, redirect
    const protectedPages = ['/profile.html', '/messages.html'];
    const currentPath = window.location.pathname;
    
    if (protectedPages.some(page => currentPath.includes(page))) {
      window.location.replace('/login.html?recent_logout=true');
      return false;
    }
  }
  
  return true;
}

// ============================================
// 📋 INITIALIZATION & EXPORTS
// ============================================

// Initialize session validation
(function initAuthUtils() {
  // Validate session on page load
  setTimeout(() => {
    validateSession();
  }, 100);
  
  // Validate when page becomes visible (user returns via back button)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      setTimeout(() => {
        validateSession();
      }, 300);
    }
  });
  
  console.log("✅ Auth utilities initialized");
})();

// Export functions to window for global access
window.isUserLoggedIn = isUserLoggedIn;
window.checkSession = checkSession;
window.showLoginRequiredPopup = showLoginRequiredPopup;
window.nuclearLogout = nuclearLogout;
window.forceLogout = forceLogout;
window.simpleLogout = simpleLogout;
window.validateSession = validateSession;

// For convenience, also export as globalLogout alias
window.globalLogout = nuclearLogout;

// ============================================
// 🎨 STYLES
// ============================================

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

/* Logout spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`;
document.head.appendChild(style);

// ============================================
// 📤 MODULE EXPORTS
// ============================================

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isUserLoggedIn,
    checkSession,
    showLoginRequiredPopup,
    nuclearLogout,
    forceLogout,
    simpleLogout,
    validateSession
  };
}