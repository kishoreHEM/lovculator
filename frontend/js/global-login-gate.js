// =======================================================
// 🔐 GLOBAL LOGIN GATE + RESUME FLOW (FINAL VERSION)
// =======================================================

(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.getElementById("loginGateOverlay");
    if (!overlay) {
      console.warn("⚠️ Login gate overlay not found");
      return;
    }

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
  });
})();

// =======================================================
// 🔐 GUEST HEADER LOGIN BUTTON
// =======================================================
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");

  if (!loginBtn) return;

  loginBtn.addEventListener("click", (e) => {
    e.preventDefault(); // 🚫 stop page jump
    if (typeof window.showLoginModal === "function") {
      window.showLoginModal("continue");
    }
  });
});

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
