/**
 * frontend/js/settings.js — Lovculator (FINAL)
 * - Profile settings (real save)
 * - Avatar upload (real)
 * - Password change (real)
 * - Clean API fallback
 * - No stub logic
 */

(() => {
  // ===============================
  // API BASE (safe fallback)
  // ===============================
  const API_BASE =
    window.API_BASE ||
    (location.hostname.includes("localhost")
      ? "http://localhost:3001/api"
      : "https://lovculator.com/api");

  // ===============================
  // DOM ELEMENTS
  // ===============================
  const sidebarItems = document.querySelectorAll(".settings-sidebar li");
  const sections = document.querySelectorAll(".settings-section");

  const profileForm = document.getElementById("profileForm");
  const passwordForm = document.getElementById("passwordForm");

  const avatarInput = document.getElementById("avatarInput");
  const avatarPreview = document.getElementById("avatarPreview");

  let currentUser = null;

  // ===============================
  // UTILS
  // ===============================
  function showToast(msg, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;

    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      background: type === "error" ? "#e74c3c" : "#2ecc71",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "8px",
      zIndex: 9999,
      boxShadow: "0 8px 24px rgba(0,0,0,.15)",
    });

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

  // ===============================
  // LOAD SESSION
  // ===============================
  async function loadSession() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Not logged in");

      const data = await safeJson(res);
      currentUser = data.user || data;

      populateProfileForm(currentUser);
      populateAvatar(currentUser);

    } catch (err) {
      document.body.innerHTML = `
    <div style="text-align:center;padding:60px">
      <h2>🔒 Login Required</h2>
      <p>Please login to access your settings</p>
      <a href="/login" class="btn btn-primary">Login</a>
    </div>
  `;
}
  }

  // ===============================
  // SIDEBAR NAV
  // ===============================
  sidebarItems.forEach(item => {
    item.addEventListener("click", () => {
      sidebarItems.forEach(i => i.classList.remove("active"));
      sections.forEach(s => s.classList.remove("active"));

      item.classList.add("active");
      document.getElementById(item.dataset.section)?.classList.add("active");

      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ===============================
  // PROFILE FORM
  // ===============================
  function populateProfileForm(user) {
    if (!profileForm) return;

    profileForm.display_name.value = user.display_name || "";
    profileForm.bio.value = user.bio || "";
    profileForm.location.value = user.location || "";
    profileForm.relationship_status.value = user.relationship_status || "Single";
  }

  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = profileForm.querySelector("button[type='submit']");
    const originalText = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
      const formData = new FormData(profileForm);
      const payload = Object.fromEntries(formData.entries());

      const res = await fetch(`${API_BASE}/users/${currentUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err.error || "Update failed");
      }

      showToast("Profile updated successfully");
      btn.textContent = "Saved ✔";

    } catch (err) {
      console.error(err);
      showToast("Failed to update profile", "error");
      btn.textContent = "Failed ❌";
    } finally {
      btn.disabled = false;
      setTimeout(() => (btn.textContent = originalText), 2000);
    }
  });

  // ===============================
  // AVATAR UPLOAD
  // ===============================
  function populateAvatar(user) {
    if (!avatarPreview) return;
    avatarPreview.src =
      user.avatar_url ||
      user.avatar ||
      "/images/default-avatar.png";
  }

  avatarInput?.addEventListener("change", async () => {
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

      const res = await fetch(`${API_BASE}/users/${currentUser.id}/avatar`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      avatarPreview.src = data.avatar_url + `?t=${Date.now()}`;

      showToast("Avatar updated");

      // Update global avatars
      document.querySelectorAll(".user-avatar, .nav-user-avatar").forEach(img => {
        img.src = avatarPreview.src;
      });

    } catch (err) {
      console.error(err);
      showToast("Avatar upload failed", "error");
    }
  });

  // ===============================
  // PASSWORD CHANGE
  // ===============================
  passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(passwordForm);
    const payload = Object.fromEntries(fd.entries());

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

      if (!res.ok) throw new Error("Password update failed");

      showToast("Password updated successfully");
      passwordForm.reset();

    } catch (err) {
      console.error(err);
      showToast("Failed to update password", "error");
    }
  });

  // ===============================
  // INIT
  // ===============================
  document.addEventListener("DOMContentLoaded", loadSession);
})();
