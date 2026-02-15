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
      .login-gate-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px}
      .login-gate-overlay.hidden{display:none !important}
      .login-gate-modal{background:#fff;border-radius:20px;max-width:520px;width:100%;padding:24px 24px 20px;position:relative;box-shadow:0 25px 60px rgba(0,0,0,.25)}
      .login-gate-close{position:absolute;top:14px;right:14px;border:none;background:#f1f3f5;border-radius:999px;width:44px;height:44px;font-size:34px;line-height:1;cursor:pointer;color:#6b7280}
      .login-gate-header h3{margin:0 0 8px;font-size:48px}
      #loginGateTitle{margin:0 0 6px;font-size:52px;font-weight:800;color:#111827;text-align:center}
      #loginGateSubtitle{margin:0 0 16px;text-align:center;color:#6b7280;font-size:19px}
      .login-gate-benefits{list-style:none;padding:0;margin:0 0 18px}
      .login-gate-benefits li{font-size:18px;color:#2f3337;margin:10px 0}
      .login-gate-actions{display:flex;flex-direction:column;gap:12px}
      .login-gate-actions a,.login-gate-actions button{display:block;text-align:center;text-decoration:none;border:none;border-radius:16px;padding:14px 16px;font-weight:700;font-size:18px;cursor:pointer}
      .login-gate-actions .btn-primary{background:#f34a8b;color:#fff}
      .login-gate-actions .btn-secondary{background:#eceef1;color:#2d3136}
      .login-gate-footer{margin-top:14px;text-align:center;color:#8b9096}
      @media (max-width:768px){#loginGateTitle{font-size:40px}.login-gate-modal{border-radius:16px}}
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
        <button class="login-gate-close" aria-label="Close login modal">&times;</button>
        <div class="login-gate-header">
          <h2 id="loginGateTitle">Login to continue</h2>
          <p id="loginGateSubtitle">Create a free account to continue</p>
        </div>
        <ul class="login-gate-benefits">
          <li>❤️ Like & save answers</li>
          <li>💬 Comment & share your thoughts</li>
          <li>👥 Follow people & stories</li>
        </ul>
        <div class="login-gate-actions">
          <a href="/signup" class="btn-primary">Create free account</a>
          <button id="openLoginPageBtn" type="button" class="btn-secondary">Already have an account?</button>
        </div>
        <p class="login-gate-footer">No spam. No ads. Just real conversations.</p>
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
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    };

    // =========================
    // 🔴 CLOSE LOGIN MODAL
    // =========================
    window.closeLoginModal = function () {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
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
