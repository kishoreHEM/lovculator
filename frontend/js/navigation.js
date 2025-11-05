// ===============================
// 🚀 Lovculator Navigation System
// Safe, Responsive & Auto Highlight
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("💖 Initializing Lovculator Navigation...");

    // Elements
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    const overlay = document.querySelector(".mobile-menu-overlay");
    const navLinks = document.querySelectorAll(".nav-menu .nav-link");
    const currentPath = window.location.pathname.replace(/\/$/, "");

    // ===============================
    // 🌈 ACTIVE LINK HIGHLIGHTING
    // ===============================
    navLinks.forEach(link => {
      const linkPath = new URL(link.href).pathname.replace(/\/$/, "");
      if (linkPath === currentPath) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // ===============================
    // 📱 MOBILE MENU BEHAVIOR
    // ===============================
    if (menuToggle && navMenu) {
      const toggleMenu = () => {
        const isOpen = navMenu.classList.toggle("active");
        menuToggle.classList.toggle("active", isOpen);
        if (overlay) overlay.classList.toggle("active", isOpen);
        document.body.style.overflow = isOpen ? "hidden" : "";
        console.log(isOpen ? "📱 Menu opened" : "📱 Menu closed");
      };

      menuToggle.addEventListener("click", toggleMenu);

      // Close when overlay clicked
      if (overlay) {
        overlay.addEventListener("click", () => {
          navMenu.classList.remove("active");
          menuToggle.classList.remove("active");
          overlay.classList.remove("active");
          document.body.style.overflow = "";
          console.log("📱 Closed via overlay");
        });
      }

      // Close when link clicked (on mobile)
      navLinks.forEach(link => {
        link.addEventListener("click", () => {
          if (window.innerWidth <= 768) {
            navMenu.classList.remove("active");
            menuToggle.classList.remove("active");
            if (overlay) overlay.classList.remove("active");
            document.body.style.overflow = "";
            console.log("📱 Closed after link click");
          }
        });
      });

      // ESC key to close
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && navMenu.classList.contains("active")) {
          navMenu.classList.remove("active");
          menuToggle.classList.remove("active");
          if (overlay) overlay.classList.remove("active");
          document.body.style.overflow = "";
          console.log("⎋ Menu closed with Escape");
        }
      });

      // Auto-close if window resized to desktop
      window.addEventListener("resize", () => {
        if (window.innerWidth > 768 && navMenu.classList.contains("active")) {
          navMenu.classList.remove("active");
          menuToggle.classList.remove("active");
          if (overlay) overlay.classList.remove("active");
          document.body.style.overflow = "";
          console.log("🖥️ Switched to desktop view – menu closed");
        }
      });
    }

    console.log("✅ Navigation system ready!");
  } catch (error) {
    console.error("💥 CRITICAL: Navigation failed to initialize:", error);
  }
});
