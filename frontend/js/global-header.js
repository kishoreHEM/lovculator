// global-header.js

/**
 * CONFIGURATION
 */
const HEADER_CONFIG = {
  htmlPath: '/components/header.html',
  mobileBreakpoint: 768
};

// Ensure API_BASE is available
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

/**
 * 1. Initialize Header Interactions
 */
function initHeaderInteractions(container) {
  // --- A. Mobile Sticky Scroll Logic ---
  const bottomNav = container.querySelector(".header-center");
  if (bottomNav) {
    let lastScrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      if (window.innerWidth > HEADER_CONFIG.mobileBreakpoint) return;
      const currentScroll = window.scrollY;
      if (currentScroll > lastScrollY && currentScroll > 50) {
        bottomNav.style.transform = "translateY(100%)";
      } else {
        bottomNav.style.transform = "translateY(0)";
      }
      lastScrollY = currentScroll;
    });
  }

  // --- B. Avatar Dropdown Logic ---
  function setupDropdown(triggerSelector, menuSelector) {
    const trigger = container.querySelector(triggerSelector);
    const menu = container.querySelector(menuSelector);

    if (trigger && menu && !trigger.dataset.bound) {
      trigger.dataset.bound = "true";
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        container.querySelectorAll('.user-dropdown.show').forEach(d => {
            if (d !== menu) d.classList.remove('show');
        });
        menu.classList.toggle("show");
      });
      document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
          menu.classList.remove("show");
        }
      });
    }
  }

  setupDropdown('.mobile-avatar-trigger', '.mobile-dropdown');
  setupDropdown('.desktop-avatar-trigger', '.desktop-dropdown');

  // --- C. Active Tab Highlighting ---
  const navItems = container.querySelectorAll(".nav-item");
  const currentPath = window.location.pathname;
  navItems.forEach(item => {
    if (item.tagName === 'A') {
      const href = item.getAttribute("href");
      if (href === currentPath || (href !== "/" && currentPath.startsWith(href))) {
        navItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      }
    }
  });

  // --- D. Notification & Message Buttons ---
  function bindActionButtons(desktopId, mobileId, panelId) {
    const dBtn = container.querySelector(desktopId);
    const mBtn = container.querySelector(mobileId);
    const panel = container.querySelector(panelId);

    const toggleHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const allPanels = container.querySelectorAll('.dropdown-panel.show');
      allPanels.forEach(p => { if (p !== panel) p.classList.remove('show'); });
      const avatars = container.querySelectorAll('.user-dropdown.show');
      avatars.forEach(a => a.classList.remove('show'));

      if (panel) panel.classList.toggle('show');
    };

    if (dBtn) dBtn.addEventListener("click", toggleHandler);
    if (mBtn) mBtn.addEventListener("click", toggleHandler);

    document.addEventListener("click", (e) => {
      if (panel && panel.classList.contains('show')) {
        const clickedButton = (dBtn && dBtn.contains(e.target)) || (mBtn && mBtn.contains(e.target));
        const clickedPanel = panel.contains(e.target);
        if (!clickedButton && !clickedPanel) {
          panel.classList.remove('show');
        }
      }
    });
  }

  bindActionButtons('#deskNotifBtn', '#mobNotifBtn', '#notificationPanel');
  bindActionButtons('#deskMsgBtn', '#mobMsgBtn', '#messagePanel');



  // --- E. Fix Body Padding ---
  const headerEl = container.querySelector('.main-header');
  if (headerEl) {
    const adjustPadding = () => {
      document.body.style.paddingTop = headerEl.offsetHeight + 'px';
      document.body.style.paddingBottom = (window.innerWidth <= 768) ? '70px' : '0px';
    };
    adjustPadding();
    window.addEventListener('resize', adjustPadding);
  }
}

/**
 * ✅ 2. NEW: Fetch User Info & Update Avatar
 */
async function updateHeaderUserProfile(container) {
    try {
        const res = await fetch(`${window.API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) return; // User not logged in

        const data = await res.json();
        const user = data.user || data;

        if (user) {
            // Update Avatar Images (Both Mobile & Desktop)
            const avatarImages = container.querySelectorAll(".user-avatar-img");
            const avatarUrl = user.avatar_url || "/images/default-avatar.png";
            
            avatarImages.forEach(img => {
                img.src = avatarUrl;
            });

            // Optional: Update sidebar avatar if it exists on the page
            const sidebarAvatar = document.getElementById("sidebarAvatar");
            if (sidebarAvatar) sidebarAvatar.src = avatarUrl;
            
            const sidebarName = document.getElementById("sidebarUserName");
            if (sidebarName) sidebarName.textContent = user.display_name || user.username;
        }
    } catch (err) {
        console.error("Failed to update header profile:", err);
    }
}


/**
 * Updates the Message Dropdown with actual unread messages
 * Shows: Sender Avatar, Name, and truncated message text.
 */
async function updateMessageDropdown() {
    const panel = document.querySelector("#messagePanel .dropdown-content");
    const badge = document.getElementById("messageBadge"); // The red counter badge
    
    if (!panel) return;

    try {
        // Fetch unread messages from your API
        // Ensure your backend returns: { id, sender_name, sender_avatar, message_text, created_at }
        const res = await fetch(`${window.API_BASE}/messages/unread`, { 
            credentials: 'include' 
        });

        if (!res.ok) throw new Error("Failed to load messages");

        const messages = await res.json();
        
        // Update Badge Count
        if (badge) {
            const count = messages.length;
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }

        // 1. Handle Empty State
        if (messages.length === 0) {
            panel.innerHTML = `<div class="dropdown-empty">No new messages</div>`;
            return;
        }

        // 2. Render Messages List
        panel.innerHTML = messages.map(msg => {
            const avatar = msg.sender_avatar || msg.avatar_url || '/images/default-avatar.png';
            const name = msg.sender_name || msg.username || 'User';
            const text = msg.message_text || msg.content || 'Sent an attachment';
            const link = `/messages?chat=${msg.sender_id || msg.user_id}`; // Link to specific chat

            return `
                <a href="${link}" class="dropdown-item message-item">
                    <img src="${avatar}" class="msg-avatar" onerror="this.src='/images/default-avatar.png'">
                    <div class="msg-info">
                        <span class="msg-sender">${escapeHtml(name)}</span>
                        <span class="msg-text">${escapeHtml(text)}</span>
                    </div>
                </a>
            `;
        }).join('');

    } catch (err) {
        console.warn("Message load error:", err);
        panel.innerHTML = `<div class="dropdown-empty">No new messages</div>`;
    }
}

// Helper to prevent broken HTML
function escapeHtml(unsafe) {
    return (unsafe || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Call this when the page loads (or inside loadGlobalHeader)
document.addEventListener('DOMContentLoaded', () => {
    // Slight delay to ensure header HTML is injected first
    setTimeout(updateMessageDropdown, 1000);
});
/**
 * 3. Main Load Function
 */
async function loadGlobalHeader() {
  const container = document.getElementById("global-header");
  if (!container) return;

  try {
    const res = await fetch(HEADER_CONFIG.htmlPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    // --- RUN INTERACTIONS ---
    initHeaderInteractions(container);
    
    // ✅ FETCH AND UPDATE AVATAR IMMEDIATELY
    updateHeaderUserProfile(container); 

    initLayoutManagerIntegration(); 

  } catch (err) {
    console.error("Header load failed:", err);
  }
}

function initLayoutManagerIntegration() {
    if (window.layoutManager) {
        if (typeof window.layoutManager.rebindHeaderEvents === "function") {
            window.layoutManager.rebindHeaderEvents();
        }
        if (typeof window.layoutManager.refreshNotificationBadge === "function") {
            window.layoutManager.refreshNotificationBadge();
        }
        if (typeof window.layoutManager.refreshMessageBadge === "function") {
            window.layoutManager.refreshMessageBadge();
        }
    }
}

document.addEventListener("DOMContentLoaded", loadGlobalHeader);