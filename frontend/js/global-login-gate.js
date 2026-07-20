// =======================================================
// 🔐 GLOBAL LOGIN GATE + RESUME FLOW (FINAL VERSION)
// =======================================================

(() => {
  let gateInitialized = false;

  function ensureLoginGateStyles() {
    if (document.getElementById("global-login-gate-styles")) return;
    const style = document.createElement("style");
    style.id = "global-login-gate-styles";
    style.textContent = `
      .login-gate-overlay {
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); 
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; 
        z-index: 99999; padding: 20px;
        opacity: 0; visibility: hidden; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .login-gate-overlay.hidden {
        display: none !important;
      }
      .login-gate-overlay.visible {
        opacity: 1; visibility: visible;
      }
      .login-gate-modal {
        background: #ffffff;
        border-radius: 28px;
        max-width: 440px; width: 100%;
        padding: 40px 32px;
        position: relative;
        box-shadow: 0 25px 60px -12px rgba(255, 75, 141, 0.15), 0 0 0 1px rgba(0,0,0,0.03);
        transform: scale(0.95) translateY(10px);
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
      }
      .login-gate-overlay.visible .login-gate-modal {
        transform: scale(1) translateY(0);
      }
      /* Subtle gradient blob inside modal */
      .login-gate-modal::before {
        content: ''; position: absolute; top: -50%; left: -20%; width: 140%; height: 100px;
        background: radial-gradient(ellipse at bottom, rgba(255, 75, 141, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
        pointer-events: none;
      }
      .login-gate-close {
        position: absolute; top: 16px; right: 16px; border: none; background: #F8FAFF;
        border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: #64748B; transition: all 0.2s; z-index: 10;
      }
      .login-gate-close:hover {
        background: #F1F5F9; color: #0F172A; transform: rotate(90deg);
      }
      .login-gate-header { text-align: center; margin-bottom: 32px; position: relative; z-index: 1; }
      .login-gate-icon { font-size: 42px; margin-bottom: 16px; display: inline-block; animation: pulse-heart 2s infinite ease-in-out; }
      @keyframes pulse-heart { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
      #loginGateTitle { margin: 0 0 8px; font-size: 32px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px; line-height: 1.2; }
      #loginGateSubtitle { margin: 0; color: #64748B; font-size: 15px; font-weight: 500; }
      .login-gate-benefits { list-style: none; padding: 0; margin: 0 0 32px; display: flex; flex-direction: column; gap: 16px; }
      .login-gate-benefits li { display: flex; align-items: center; gap: 14px; font-size: 15px; font-weight: 600; color: #334155; }
      .login-gate-emoji-wrap { 
        width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
      }
      .login-gate-benefits li:nth-child(1) .login-gate-emoji-wrap { background: #FFF1F6; }
      .login-gate-benefits li:nth-child(2) .login-gate-emoji-wrap { background: #F0F9FF; }
      .login-gate-benefits li:nth-child(3) .login-gate-emoji-wrap { background: #F8FAFF; }
      
      .login-gate-actions { display: flex; flex-direction: column; gap: 12px; }
      .login-gate-actions a, .login-gate-actions button {
        display: flex; align-items: center; justify-content: center; text-decoration: none; border: none;
        border-radius: 16px; padding: 16px; font-weight: 800; font-size: 16px; cursor: pointer; transition: all 0.2s;
      }
      .login-gate-actions .btn-primary {
        background: linear-gradient(135deg, #FF4B8D 0%, #FF6AA5 100%); color: #fff;
        box-shadow: 0 10px 25px -5px rgba(255, 75, 141, 0.4);
      }
      .login-gate-actions .btn-primary:hover {
        transform: translateY(-2px); box-shadow: 0 15px 30px -5px rgba(255, 75, 141, 0.5);
      }
      .login-gate-actions .btn-secondary {
        background: #F8FAFF; color: #334155; border: 1px solid #E2E8F0;
      }
      .login-gate-actions .btn-secondary:hover {
        background: #F1F5F9; color: #0F172A;
      }
      .login-gate-footer { margin-top: 24px; text-align: center; color: #94A3B8; font-size: 13px; font-weight: 500; }
      @media (max-width: 480px) {
        .login-gate-modal { padding: 32px 24px; }
        #loginGateTitle { font-size: 28px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLoginGateOverlay() {
    let overlay = document.getElementById("loginGateOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "loginGateOverlay";
    overlay.className = "login-gate-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="login-gate-modal" role="dialog" aria-modal="true">
        <button class="login-gate-close" aria-label="Close login modal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <div class="login-gate-header">
          <span class="login-gate-icon">💗</span>
          <h2 id="loginGateTitle">Login to continue</h2>
          <p id="loginGateSubtitle">Create a free account to continue</p>
        </div>
        <ul class="login-gate-benefits">
          <li>
            <div class="login-gate-emoji-wrap">❤️</div>
            Like & save your favorite answers
          </li>
          <li>
            <div class="login-gate-emoji-wrap">💬</div>
            Join the conversation & share thoughts
          </li>
          <li>
            <div class="login-gate-emoji-wrap">👥</div>
            Follow amazing people & stories
          </li>
        </ul>
        <div class="login-gate-actions">
          <a href="/signup" class="btn-primary">Create free account</a>
          <button id="openLoginPageBtn" type="button" class="btn-secondary">Already have an account?</button>
        </div>
        <p class="login-gate-footer">No spam. No ads. Just real advice.</p>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function initLoginGate() {
    if (gateInitialized) return;
    gateInitialized = true;

    ensureLoginGateStyles();
    const overlay = ensureLoginGateOverlay();

    const closeBtn = overlay.querySelector(".login-gate-close");
    const title = document.getElementById("loginGateTitle");
    const subtitle = document.getElementById("loginGateSubtitle");
    const loginPageBtn = overlay.querySelector("#openLoginPageBtn");

    // =========================
    // 🟢 OPEN LOGIN MODAL
    // =========================
    window.showLoginModal = function (action = "") {
      if (title && subtitle) {
        title.textContent = action ? `Login to ${action}` : "Join Lovculator";
        subtitle.textContent = "Create a free account to continue";
      }

      overlay.classList.remove("hidden");
      // Force reflow to ensure CSS transition runs
      void overlay.offsetWidth;
      overlay.classList.add("visible");
      
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };

    // =========================
    // 🔴 CLOSE LOGIN MODAL
    // =========================
    window.closeLoginModal = function () {
      overlay.classList.remove("visible");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      
      setTimeout(() => {
        if (!overlay.classList.contains("visible")) {
          overlay.classList.add("hidden");
        }
      }, 300);
    };

    closeBtn?.addEventListener("click", window.closeLoginModal);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) window.closeLoginModal();
    });

    // =================================================
    // 🔁 "ALREADY HAVE AN ACCOUNT?" → LOGIN PAGE
    // =================================================
    if (loginPageBtn) {
      loginPageBtn.addEventListener("click", () => {
        // Save resume info
        sessionStorage.setItem("resumeAfterLogin", "1");
        sessionStorage.setItem("resumeUrl", window.location.href);

        // Close modal & redirect
        window.closeLoginModal();
        window.location.href = "/login";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLoginGate, { once: true });
  } else {
    initLoginGate();
  }
})();

// =======================================================
// 🔐 GUEST HEADER LOGIN BUTTON
// =======================================================
function bindGuestLoginButton() {
  const loginBtn = document.getElementById("loginBtn");

  if (!loginBtn || loginBtn.dataset.loginGateBound === "true") return;
  loginBtn.dataset.loginGateBound = "true";

  loginBtn.addEventListener("click", (e) => {
    e.preventDefault(); // 🚫 stop page jump
    if (typeof window.showLoginModal === "function") {
      window.showLoginModal("continue");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindGuestLoginButton, { once: true });
} else {
  bindGuestLoginButton();
}

// =======================================================
// 🔁 RESUME PENDING ACTION AFTER LOGIN
// =======================================================
window.resumePendingAction = function () {
  if (typeof window.pendingAction === "function") {
    const action = window.pendingAction;
    window.pendingAction = null;

    // Small delay to ensure session is ready
    setTimeout(() => {
      action();
    }, 300);
  }
};
