// global-mobile-menu.js

async function updateSidebarUserData() {
    try {
        // 1. Fetch current user from your auth endpoint
        const response = await fetch(`${window.API_BASE}/auth/me`, { credentials: 'include' });
        
        if (response.ok) {
            const data = await response.json();
            const user = data.user || data; // Handle different API response shapes

            // 2. Find the elements in the sidebar
            const avatarImg = document.getElementById("sidebarAvatarMobile");
            const nameTxt = document.getElementById("sidebarUserNameMobile");

            // 3. Update the values
            if (user) {
                if (avatarImg) {
                    // Use your getAvatarURL helper if you have it, or fallback
                    avatarImg.src = user.avatar_url || user.profile_image_url || "/images/default-avatar.png";
                }
                if (nameTxt) {
                    nameTxt.textContent = user.display_name || user.username || "User";
                }
            }
        }
    } catch (err) {
        console.error("Failed to update sidebar user data:", err);
    }
}

async function loadMobileMenu() {
    const container = document.getElementById("global-mobile-menu");
    if (!container) return;

    try {
        const res = await fetch("/components/mobile-menu.html", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load mobile menu");

        container.innerHTML = await res.text();

        // Highlight active link based on current path
        const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
        const navLinks = container.querySelectorAll(".sidebar-nav a");
        navLinks.forEach(link => {
            const linkPath = (link.getAttribute("href") || "").replace(/\/$/, "") || "/";
            if (linkPath === currentPath) {
                link.classList.add("active");
            }
        });

        // Check login status
        let isLoggedIn = false;
        try {
            const me = await fetch(`${window.API_BASE}/auth/me`, {
                credentials: 'include',
                cache: 'no-store'
            });
            isLoggedIn = me.ok;
        } catch (e) {
            isLoggedIn = false;
        }

        bindInternalToggle();

        if (isLoggedIn) {
            const logoutBtn = document.getElementById("mobileLogoutBtn");
            if (logoutBtn) logoutBtn.style.display = "flex";
            bindInternalUserData();
            bindInternalLogout();
            bindInternalMessageBadge();
            subscribeMobileMessagesRealtime();
        } else {
            const userNameEl = document.getElementById("sidebarUserNameMobile");
            if (userNameEl) userNameEl.textContent = "Lovculator";
            
            // For guests, clicking personal/community links shows login modal
            const protectedSelectors = ["#navFriends", "#navMyAnswers", "#navMyQuestions", "#navMessages", "#navProfile", "#navSettings"];
            protectedSelectors.forEach(sel => {
                const el = container.querySelector(sel);
                if (el) {
                    el.addEventListener("click", (e) => {
                        e.preventDefault();
                        if (typeof window.showLoginModal === "function") {
                            window.showLoginModal("continue");
                        } else {
                            window.location.href = "/login";
                        }
                    });
                }
            });
        }

        if (window.layoutManager?.bindSidebarData) {
            window.layoutManager.bindSidebarData();
        }
        if (window.layoutManager?.bindMobileMenuToggle) {
            window.layoutManager.bindMobileMenuToggle();
        }

    } catch (err) {
        console.error("Sidebar menu load failed:", err);
    }
}


// Function to handle opening and closing
function bindInternalToggle() {
    const sidebar = document.getElementById("mobileSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const closeBtn = document.getElementById("mobileMenuClose");
    
    // We look for the avatar in the header to trigger the sidebar
    const headerAvatar = document.querySelector(".user-avatar-btn, #headerAvatarMobile");

    const openSidebar = (e) => {
        if (window.innerWidth <= 991) {
            e.preventDefault();
            sidebar?.classList.add("active");
            overlay?.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    };

    const closeSidebar = () => {
        sidebar?.classList.remove("active");
        overlay?.classList.remove("active");
        document.body.style.overflow = "";
    };

    headerAvatar?.addEventListener("click", openSidebar);
    closeBtn?.addEventListener("click", closeSidebar);
    overlay?.addEventListener("click", closeSidebar);
}

// Function to pull real user data (Uses your social-features.js helper)
async function bindInternalUserData() {
    try {
        const res = await fetch(`${window.API_BASE}/auth/me`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const user = data.user || data;

        const sidebarImg = document.getElementById("sidebarAvatarMobile");
        const sidebarName = document.getElementById("sidebarUserNameMobile");

        if (user) {
            if (sidebarImg) {
                // Uses getAvatarURL from your social-features.js
                sidebarImg.src = typeof window.getAvatarURL === "function" 
                    ? window.getAvatarURL(user.avatar_url) 
                    : (user.avatar_url || "/images/default-avatar.png");
            }
            if (sidebarName) {
                sidebarName.textContent = user.display_name || user.username || "User";
            }
        }
    } catch (err) {
        console.log("Not logged in or API error", err);
    }
}

function bindInternalLogout() {
    const logoutBtn = document.getElementById("mobileLogoutBtn");
    if (!logoutBtn || logoutBtn.dataset.bound) return;
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", async (e) => {
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

async function bindInternalMessageBadge() {
    const badge = document.querySelector(".mobile-messages-badge");
    if (!badge) return;
    try {
        const res = await fetch(`${window.API_BASE}/messages/unread-count`, {
            credentials: "include",
            cache: "no-store"
        });
        const data = res.ok ? await res.json() : { count: 0 };
        const count = Number(data.count || 0);
        updateMobileMessagesBadge(count);
    } catch (err) {
        badge.style.display = "none";
    }
}

function updateMobileMessagesBadge(count) {
    const badge = document.querySelector(".mobile-messages-badge");
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.style.display = "inline-flex";
    } else {
        badge.style.display = "none";
    }
}

function subscribeMobileMessagesRealtime() {
    if (!window.wsManager) return;
    window.wsManager.subscribe("NEW_MESSAGE", () => {
        const badge = document.querySelector(".mobile-messages-badge");
        if (!badge) return;
        const current = parseInt(badge.textContent, 10);
        const next = Number.isFinite(current) ? current + 1 : 1;
        updateMobileMessagesBadge(next);
    });
}

document.addEventListener("DOMContentLoaded", loadMobileMenu);
