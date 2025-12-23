// global-header.js

/**
 * CONFIGURATION
 */
const HEADER_CONFIG = {
  htmlPath: '/components/header.html',
  mobileBreakpoint: 768
};

/**
 * 1. Initialize Header Interactions
 * Handles Sticky Nav, Avatars, Active Tabs, and Button Clicks
 */
function initHeaderInteractions(container) {

  // ==========================================
  // A. Mobile Sticky Scroll Logic (Hide on Scroll)
  // ==========================================
  const bottomNav = container.querySelector(".header-center");

  if (bottomNav) {
    let lastScrollY = window.scrollY;
    
    window.addEventListener("scroll", () => {
      // Only run on Mobile
      if (window.innerWidth > HEADER_CONFIG.mobileBreakpoint) return;

      const currentScroll = window.scrollY;
      
      // Scroll Down > 50px? Hide. Scroll Up? Show.
      if (currentScroll > lastScrollY && currentScroll > 50) {
        bottomNav.style.transform = "translateY(100%)"; // Slide down (hide)
      } else {
        bottomNav.style.transform = "translateY(0)"; // Slide up (show)
      }
      lastScrollY = currentScroll;
    });
  }

  // ==========================================
  // B. Avatar Dropdown Logic (Dual Avatars)
  // ==========================================
  function setupDropdown(triggerSelector, menuSelector) {
    const trigger = container.querySelector(triggerSelector);
    const menu = container.querySelector(menuSelector);

    if (trigger && menu && !trigger.dataset.bound) {
      trigger.dataset.bound = "true";

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        
        // Close other dropdowns first
        container.querySelectorAll('.user-dropdown.show').forEach(d => {
            if (d !== menu) d.classList.remove('show');
        });

        menu.classList.toggle("show");
      });

      // Close on outside click
      document.addEventListener("click", (e) => {
        if (!trigger.contains(e.target) && !menu.contains(e.target)) {
          menu.classList.remove("show");
        }
      });
    }
  }

  setupDropdown('.mobile-avatar-trigger', '.mobile-dropdown');
  setupDropdown('.desktop-avatar-trigger', '.desktop-dropdown');

  // ==========================================
  // C. Active Tab Highlighting
  // ==========================================
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

  // ==========================================
  // D. Notification & Message Handling (FIXED)
  // ==========================================
  function bindActionButtons(desktopId, mobileId, panelId) {
    const dBtn = container.querySelector(desktopId);
    const mBtn = container.querySelector(mobileId);
    const panel = container.querySelector(panelId);

    const toggleHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 1. Close ALL other open panels first (Exclusive behavior)
      const allPanels = container.querySelectorAll('.dropdown-panel.show');
      allPanels.forEach(p => {
        if (p !== panel) p.classList.remove('show');
      });
      // Close Avatar dropdown too
      const avatars = container.querySelectorAll('.user-dropdown.show');
      avatars.forEach(a => a.classList.remove('show'));

      // 2. Toggle THIS panel
      if (panel) {
        panel.classList.toggle('show');
      } else {
        console.warn(`Panel ${panelId} not found in DOM`);
      }
    };

    if (dBtn) dBtn.addEventListener("click", toggleHandler);
    if (mBtn) mBtn.addEventListener("click", toggleHandler);

    // 3. Close when clicking outside
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

  // 👇👇👇 THESE ARE THE LINES YOU WERE MISSING 👇👇👇
  // This actually connects the buttons to the HTML panels
  bindActionButtons('#deskNotifBtn', '#mobNotifBtn', '#notificationPanel');
  bindActionButtons('#deskMsgBtn', '#mobMsgBtn', '#messagePanel');
  // 👆👆👆

  // ==========================================
  // E. Fix Body Padding
  // ==========================================
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
 * 2. Main Load Function
 */
async function loadGlobalHeader() {
  const container = document.getElementById("global-header");
  if (!container) return;

  try {
    // Attempt 1: Normal Fetch
    const res = await fetch(HEADER_CONFIG.htmlPath, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    container.innerHTML = html;

    // --- RUN INTERACTION LOGIC ---
    initHeaderInteractions(container);
    initLayoutManagerIntegration(); 

  } catch (err) {
    console.error("Header load failed, trying fallback:", err);
    
    // Attempt 2: Fallback
    try {
      const alt = `${location.protocol}//${location.host}${HEADER_CONFIG.htmlPath}`;
      const r2 = await fetch(alt, { cache: "no-store" });
      if (r2.ok) {
        container.innerHTML = await r2.text();
        initHeaderInteractions(container);
        initLayoutManagerIntegration();
      }
    } catch (e2) {
      console.error("Fallback failed:", e2);
    }
  }
}

/**
 * 3. Layout Manager Integration Helper
 */
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