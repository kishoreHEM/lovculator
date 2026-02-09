// global-header.js

/**
 * CONFIGURATION
 */
const HEADER_CONFIG = {
  authHeader: '/components/header.html',
  guestHeader: '/components/guest-header.html',
  mobileBreakpoint: 768
};


// Ensure API_BASE is available
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

function registerServiceWorkerOnce() {
  if (!('serviceWorker' in navigator)) return;
  if (window.__lovculatorSwRegistered) return;
  window.__lovculatorSwRegistered = true;
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      console.log('✅ Service Worker registered:', reg.scope);
    })
    .catch(err => {
      console.log('ℹ️ Service Worker registration failed:', err);
    });
}

function initUserHoverCards() {
  if (!window.__lovculatorIsLoggedIn) return;
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;

  const cache = new Map();
  let activeTarget = null;
  let hideTimer = null;
  let showTimer = null;

  let card = document.getElementById('userHoverCard');
  if (!card) {
    card = document.createElement('div');
    card.id = 'userHoverCard';
    card.className = 'user-hover-card hidden';
    document.body.appendChild(card);
  }

  const formatNumber = (n) => {
    if (n === null || n === undefined) return '0';
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(Number(n));
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const escapeHtml = (text) => {
    if (typeof text !== 'string') return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const extractUsername = (el) => {
    if (!el) return '';
    const datasetUsername = el.getAttribute('data-user-username');
    if (datasetUsername) return datasetUsername;
    const link = el.closest('a[href^="/profile/"]') || (el.tagName === 'A' && el.getAttribute('href')?.startsWith('/profile/') ? el : null);
    if (!link) return '';
    const href = link.getAttribute('href') || '';
    return decodeURIComponent(href.replace('/profile/', '').split('/')[0] || '');
  };

  const positionCard = (target) => {
    const rect = target.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const margin = 10;
    const topSpace = rect.top;
    const bottomSpace = window.innerHeight - rect.bottom;
    let top = rect.bottom + margin + window.scrollY;
    if (bottomSpace < cardRect.height && topSpace > cardRect.height + margin) {
      top = rect.top - cardRect.height - margin + window.scrollY;
    }
    let left = rect.left + window.scrollX;
    const maxLeft = window.scrollX + window.innerWidth - cardRect.width - margin;
    if (left > maxLeft) left = maxLeft;
    if (left < margin) left = margin;
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  };

  const renderCard = (user) => {
    const profileLink = `/profile/${encodeURIComponent(user.username)}`;
    const name = escapeHtml(user.display_name || user.username || 'User');
    const bio = escapeHtml(user.bio || '');
    const location = escapeHtml(user.location || '');
    const work = escapeHtml(user.work_education || '');
    const joined = formatDate(user.created_at);
    const questionsCount = Number(user.questions_count || 0);
    const storiesCount = Number(user.stories_count || 0);

    card.innerHTML = `
      <div class="hover-card-header">
        <a href="${profileLink}" class="hover-card-avatar">
          <img src="${user.avatar_url || '/images/default-avatar.png'}" alt="${name}" onerror="this.src='/images/default-avatar.png'">
        </a>
        <div class="hover-card-title">
          <a href="${profileLink}" class="hover-card-name">${name}</a>
          ${bio ? `<div class="hover-card-bio">${bio}</div>` : ''}
        </div>
        ${
          user.id
            ? `<button class="follow-author-btn ${user.is_following_author ? 'following' : ''}" data-user-id="${user.id}">
                ${user.is_following_author ? 'Following' : '+ Follow'}
               </button>`
            : ''
        }
      </div>
      <div class="hover-card-meta">
        ${work ? `<div class="hover-card-row">🎓 <span>${work}</span></div>` : ''}
        ${location ? `<div class="hover-card-row">📍 <span>${location}</span></div>` : ''}
        ${joined ? `<div class="hover-card-row">🗓️ <span>Joined ${joined}</span></div>` : ''}
        ${questionsCount ? `<div class="hover-card-row">❓ <span>${formatNumber(questionsCount)} Questions</span></div>` : ''}
        ${storiesCount ? `<div class="hover-card-row">💖 <span>${formatNumber(storiesCount)} Stories</span></div>` : ''}
      </div>
      <div class="hover-card-stats">
        <div><strong>${formatNumber(user.follower_count)}</strong><span>Followers</span></div>
        <div><strong>${formatNumber(user.answers_count)}</strong><span>Answers</span></div>
        <div><strong>${formatNumber(user.views_count)}</strong><span>Views</span></div>
      </div>
    `;
  };

  const showCard = async (target, username) => {
    if (!username) return;
    card.classList.remove('hidden');
    card.classList.add('loading');
    card.innerHTML = `<div class="hover-card-loading">Loading...</div>`;
    positionCard(target);

    if (cache.has(username)) {
      renderCard(cache.get(username));
      card.classList.remove('loading');
      positionCard(target);
      return;
    }

    try {
      const res = await fetch(`${window.API_BASE}/users/hover/${encodeURIComponent(username)}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      cache.set(username, data);
      renderCard(data);
      card.classList.remove('loading');
      positionCard(target);
    } catch (e) {
      card.innerHTML = `<div class="hover-card-loading">Unable to load user</div>`;
      card.classList.remove('loading');
    }
  };

  const hideCard = () => {
    card.classList.add('hidden');
    card.classList.remove('loading');
    activeTarget = null;
  };

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('a[href^="/profile/"], [data-user-username]');
    if (!target) return;
    const username = extractUsername(target);
    if (!username) return;
    if (activeTarget === target) return;

    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    activeTarget = target;
    showTimer = setTimeout(() => showCard(target, username), 150);
  });

  document.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget;
    if (card.contains(related)) return;
    if (activeTarget && activeTarget.contains(related)) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(hideCard, 150);
  });

  card.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
  });
  card.addEventListener('mouseleave', () => {
    hideTimer = setTimeout(hideCard, 150);
  });

  window.addEventListener('scroll', () => {
    if (!activeTarget || card.classList.contains('hidden')) return;
    positionCard(activeTarget);
  }, { passive: true });
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

  const avatarBtn = container.querySelector(".user-avatar-btn"); // Adjust selector to match your header avatar button
  const sidebar = document.getElementById("mobileSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const closeBtn = document.getElementById("mobileMenuClose");

  if (avatarBtn) {
    avatarBtn.addEventListener("click", (e) => {
        const sidebar = document.getElementById("mobileSidebar");
        const overlay = document.getElementById("sidebarOverlay");

        // ✅ THE FIX: Check if sidebar exists before touching classList
        if (sidebar && overlay) {
            if (window.innerWidth <= 991) {
                e.preventDefault();
                sidebar.classList.add("active");
                overlay.classList.add("active");
                document.body.style.overflow = "hidden";
            }
        } else {
            console.warn("Sidebar not loaded yet. Retrying...");
        }
    });

  

  // Close logic
  const closeSidebar = () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  };

  if (closeBtn) closeBtn.onclick = closeSidebar;
  if (overlay) overlay.onclick = closeSidebar;
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

  // --- F. Logout (Mobile Sidebar) ---
  const mobileLogout = document.getElementById("mobileLogoutBtn");
  if (mobileLogout && !mobileLogout.dataset.bound) {
    mobileLogout.dataset.bound = "true";
    mobileLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const res = await fetch(`${window.API_BASE}/auth/logout`, {
          method: "POST",
          credentials: "include"
        });
        if (res.ok) {
          window.location.href = "/login";
        } else {
          console.warn("Logout failed");
        }
      } catch (err) {
        console.error("Logout error:", err);
      }
    });
  }

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

  let isLoggedIn = false;

  try {
    const me = await fetch(`${window.API_BASE}/auth/me`, {
      credentials: "include",
      cache: "no-store"
    });
    isLoggedIn = me.ok;
  } catch (e) {
    isLoggedIn = false;
  }

  const headerPath = isLoggedIn
    ? HEADER_CONFIG.authHeader
    : HEADER_CONFIG.guestHeader;

  window.__lovculatorIsLoggedIn = isLoggedIn;

  try {
    const res = await fetch(headerPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    container.innerHTML = await res.text();

    // ⚠️ IMPORTANT: only run these for logged-in users
    if (isLoggedIn) {
      initHeaderInteractions(container);
      updateHeaderUserProfile(container);
      initLayoutManagerIntegration();

      // Messages only for logged-in users
      setTimeout(updateMessageDropdown, 1000);
    }

  } catch (err) {
    console.error("Header load failed:", err);
  }
}

document.addEventListener("click", (e) => {
  const profileLink = e.target.closest('a[href^="/profile/"]');
  if (profileLink && !window.__lovculatorIsLoggedIn) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.showLoginModal === "function") {
      window.showLoginModal("continue");
    }
    return;
  }

  const loginBtn = e.target.closest("#loginBtn");
  if (!loginBtn) return;

  e.preventDefault();
  e.stopPropagation();

  if (typeof window.showLoginModal === "function") {
    window.showLoginModal("continue");
  }
});

document.addEventListener("mouseover", (e) => {
  if (window.__lovculatorIsLoggedIn) return;
  const target = e.target.closest('a[href^="/profile/"]');
  if (!target) return;
  target.setAttribute('title', 'Login to view profile');
});


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

document.addEventListener("DOMContentLoaded", () => {
  registerServiceWorkerOnce();
  initUserHoverCards();
  loadGlobalHeader();
});
