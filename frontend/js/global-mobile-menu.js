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
        const html = await res.text();
        container.innerHTML = html;

        // 1. Bind the Toggle Logic (Open/Close)
        bindInternalToggle();

        // 2. Bind the User Data (Name/Avatar)
        bindInternalUserData();

        // Keep your existing layoutManager calls for compatibility
        if (window.layoutManager && typeof window.layoutManager.bindSidebarData === "function") {
            window.layoutManager.bindSidebarData();
        }
        if (window.layoutManager && typeof window.layoutManager.bindMobileMenuToggle === "function") {
            window.layoutManager.bindMobileMenuToggle();
        }

    } catch (err) {
        console.error("Mobile menu load failed:", err);
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

document.addEventListener("DOMContentLoaded", loadMobileMenu);