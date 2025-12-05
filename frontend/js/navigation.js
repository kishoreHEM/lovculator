/**
 * frontend/js/navigation.js — Lovculator
 * Updated: Sidebar is now the Mobile Menu 📱
 * Features: Auto-injects Hamburger, Targets Sidebar, Active Link Highlighting
 */

document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("💖 Initializing Lovculator Sidebar Navigation...");

    // 1️⃣ AUTO-GENERATE UI ELEMENTS IF MISSING
    // ----------------------------------------
    
    // Inject Hamburger Menu Button if not present
    let menuToggle = document.querySelector(".menu-toggle");
    if (!menuToggle) {
      const headerLeft = document.querySelector(".header-left");
      if (headerLeft) {
        menuToggle = document.createElement("button");
        menuToggle.className = "menu-toggle header-icon";
        menuToggle.setAttribute("aria-label", "Toggle Menu");
        menuToggle.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
               viewBox="0 0 24 24" fill="none" stroke="currentColor" 
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>`;
        // Insert before the logo
        headerLeft.insertBefore(menuToggle, headerLeft.firstChild);
      }
    }

    // Inject Overlay if not present
    let overlay = document.querySelector(".mobile-menu-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "mobile-menu-overlay";
      document.body.appendChild(overlay);
    }

    // 2️⃣ SELECTORS & SETUP
    // ----------------------------------------
    
    // Target the MAIN SIDEBAR as the menu
    const navMenu = document.querySelector(".main-sidebar"); 
    
    // Select both sidebar items AND header icons for highlighting
    const navLinks = document.querySelectorAll(".sidebar-item, .nav-icon-item");
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";

    // 3️⃣ ACTIVE LINK HIGHLIGHTING
    // ----------------------------------------
    navLinks.forEach(link => {
      try {
        const linkUrl = new URL(link.href, window.location.origin);
        const linkPath = linkUrl.pathname.replace(/\/$/, "") || "/";
        
        // Exact match or active parent section
        if (linkPath === currentPath) {
          link.classList.add("active");
        } else {
          link.classList.remove("active");
        }
      } catch (err) {
        // Ignore invalid links (e.g. href="#")
      }
    });

    // 4️⃣ MOBILE MENU LOGIC
    // ----------------------------------------
    if (menuToggle && navMenu) {
      
      const toggleMenu = (e) => {
        e?.stopPropagation(); // Prevent immediate closing click
        const isOpen = navMenu.classList.toggle("active");
        menuToggle.classList.toggle("active", isOpen);
        overlay.classList.toggle("active", isOpen);
        
        // Lock body scroll only on mobile when menu is open
        if (window.innerWidth <= 1024) {
          document.body.style.overflow = isOpen ? "hidden" : "";
        }
        
        console.log(isOpen ? "📱 Sidebar opened" : "📱 Sidebar closed");
      };

      const closeMenu = () => {
        navMenu.classList.remove("active");
        menuToggle.classList.remove("active");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
      };

      // Toggle click
      menuToggle.addEventListener("click", toggleMenu);

      // Close on Overlay click
      overlay.addEventListener("click", closeMenu);

      // Close when clicking a link (if on mobile)
      navLinks.forEach(link => {
        link.addEventListener("click", () => {
          if (window.innerWidth <= 1024) {
            closeMenu();
          }
        });
      });

      // Close on Escape key
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && navMenu.classList.contains("active")) {
          closeMenu();
        }
      });

      // Auto-close if resized to desktop
      window.addEventListener("resize", () => {
        if (window.innerWidth > 1024 && navMenu.classList.contains("active")) {
          closeMenu();
        }
      });
    } else {
      console.warn("⚠️ Lovculator Nav: Sidebar or Toggle button not found.");
    }

    console.log("✅ Sidebar Navigation system ready!");

  } catch (error) {
    console.error("💥 CRITICAL: Navigation failed to initialize:", error);
  }
});