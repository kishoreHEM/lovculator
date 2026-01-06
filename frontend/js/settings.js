/**
 * frontend/js/settings.js — Lovculator (FINAL)
 * ✔ Profile completion meter works
 * ✔ Avatar upload works
 * ✔ Profile update works
 * ✔ Password update works
 * ✔ No forced redirect
 */

(() => {
  /* ======================================================
     API BASE
  ====================================================== */
  const API_BASE =
    window.API_BASE ||
    (location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api");

  /* ======================================================
     DOM ELEMENTS
  ====================================================== */
  const sidebarButtons = document.querySelectorAll(".settings-nav .nav-btn");
  const sections = document.querySelectorAll(".settings-section");

  const profileForm = document.getElementById("profileForm");
  const passwordForm = document.getElementById("passwordForm");

  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("settingsAvatarPreview");

  const completionFill = document.getElementById("completionFill");
  const completionPercent = document.getElementById("completionPercent");
  const completionHint = document.getElementById("completionHint");

  let currentUser = null;

  /* ======================================================
     UTILITIES
  ====================================================== */
  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position:fixed;top:20px;right:20px;
      background:${type === "error" ? "#e74c3c" : "#2ecc71"};
      color:#fff;padding:10px 16px;border-radius:8px;
      z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.15);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async function safeJson(res) {
    try {
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  /* ======================================================
     PROFILE COMPLETION
  ====================================================== */
  function updateProfileCompletion(percent = 0) {
    if (!completionFill || !completionPercent) return;

    completionFill.style.width = `${percent}%`;
    completionPercent.textContent = `${percent}%`;

    if (percent === 100) {
      completionHint.textContent = "🎉 Profile complete! You’re all set.";
    } else if (percent >= 70) {
      completionHint.textContent = "Almost there! Complete remaining fields.";
    } else {
      completionHint.textContent =
        "Complete your profile to get better matches.";
    }
  }

  /* ======================================================
     LOAD SESSION
  ====================================================== */
  async function loadSession() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) return;

      const data = await safeJson(res);
      currentUser = data.user || data;

      populateProfileForm(currentUser);
      populateAvatar(currentUser);

      updateProfileCompletion(currentUser.profile_completion || 0);

    } catch (err) {
      console.warn("⚠️ Session load failed:", err);
    }
  }

  /* ======================================================
     SIDEBAR NAVIGATION
  ====================================================== */
  sidebarButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sidebarButtons.forEach(b => b.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));

      btn.classList.add("active");
      document
        .getElementById(btn.dataset.target)
        ?.classList.add("active");

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ======================================================
     POPULATE PROFILE FORM
  ====================================================== */
  function populateProfileForm(user) {
    if (!profileForm || !user) return;

    profileForm.display_name.value = user.display_name || "";
    profileForm.bio.value = user.bio || "";
    profileForm.location.value = user.location || "";
    profileForm.work_education.value = user.work_education || "";
    profileForm.relationship_status.value =
      user.relationship_status || "Single";
    profileForm.gender.value = user.gender || "";
    profileForm.date_of_birth.value =
      user.date_of_birth ? user.date_of_birth.split("T")[0] : "";
  }

  /* ======================================================
     PROFILE UPDATE
  ====================================================== */
  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return showToast("Session not ready", "error");

    const btn = profileForm.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const payload = Object.fromEntries(
        new FormData(profileForm).entries()
      );

      const res = await fetch(`${API_BASE}/users/${currentUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Update failed");

      const data = await safeJson(res);
      showToast("Profile updated");

      if (data.profile_completion !== undefined) {
        updateProfileCompletion(data.profile_completion);
      }

    } catch (err) {
      console.error(err);
      showToast("Failed to update profile", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Changes";
    }
  });

  /* ======================================================
     AVATAR UPLOAD
  ====================================================== */
  function populateAvatar(user) {
    if (!avatarPreview || !user) return;
    avatarPreview.src =
      user.avatar_url || "/images/default-avatar.png";
  }

  avatarInput?.addEventListener("change", async () => {
    if (!currentUser) return;

    const file = avatarInput.files[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      showToast("Max avatar size is 4MB", "error");
      return;
    }

    avatarPreview.src = URL.createObjectURL(file);

    try {
      const fd = new FormData();
      fd.append("avatar", file);

      const res = await fetch(
        `${API_BASE}/users/${currentUser.id}/avatar`,
        {
          method: "POST",
          credentials: "include",
          body: fd,
        }
      );

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      avatarPreview.src = data.avatar_url + `?t=${Date.now()}`;

      showToast("Avatar updated");

      document
        .querySelectorAll(".user-avatar, .nav-user-avatar")
        .forEach(img => (img.src = avatarPreview.src));

    } catch (err) {
      console.error(err);
      showToast("Avatar upload failed", "error");
    }
  });

  /* ======================================================
     PASSWORD CHANGE
  ====================================================== */
  passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = Object.fromEntries(
      new FormData(passwordForm).entries()
    );

    if (payload.new_password !== payload.confirm_password) {
      showToast("Passwords do not match", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error();

      showToast("Password updated");
      passwordForm.reset();

    } catch {
      showToast("Failed to update password", "error");
    }
  });

  /* ======================================================
     INIT
  ====================================================== */
  document.addEventListener("DOMContentLoaded", loadSession);
})();
