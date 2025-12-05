// Setup API Base
const API_BASE = window.location.hostname.includes("localhost")
    ? "http://localhost:3001/api"
    : "https://lovculator.com/api";

// Load friends on page load
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    loadFriends();
});

/* ============================================================
   Tab Switching
============================================================ */
function initTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const selected = tab.getAttribute("data-tab");

            document.querySelectorAll(".user-list").forEach(list => list.style.display = "none");
            document.getElementById(selected + "-list").style.display = "block";
        });
    });
}

/* ============================================================
   Load All Sections
============================================================ */
function loadFriends() {
    loadSection("followers", "/follow/followers");
    loadSection("following", "/follow/following");
    loadSection("suggestions", "/follow/suggestions");
}

/* ============================================================
   Load Section
============================================================ */
async function loadSection(section, endpoint) {
    const container = document.getElementById(section + "-list");
    container.innerHTML = `<p>Loading...</p>`;

    try {
        const res = await fetch(API_BASE + endpoint, { credentials: "include" });

        if (!res.ok) throw new Error("API failed");

        const users = await res.json();

        if (!Array.isArray(users) || users.length === 0) {
            container.innerHTML = `<div class="empty-state">No ${section} found.</div>`;
            return;
        }

        container.innerHTML = users.map(user => userCardHTML(user, section)).join("");
        attachFollowHandlers();

    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style="color:red;">Failed to load ${section}</p>`;
    }
}

/* ============================================================
   Generate User Card HTML
============================================================ */
function userCardHTML(user, section) {
    const avatar = user.avatar_url || "/images/default-avatar.png";
    const name = user.display_name || "Unknown User";
    const username = user.username || "user";

    const isFollowing = section === "following";

    return `
        <div class="user-card" data-user-id="${user.id}">
            <div class="user-info">
                <img src="${avatar}" class="user-avatar" />
                <div class="user-details">
                    <span class="user-name">${name}</span>
                    <span class="user-username">@${username}</span>
                </div>
            </div>

            <button class="${isFollowing ? "unfollow-btn" : "follow-btn"}">
                ${isFollowing ? "Unfollow" : "Follow"}
            </button>
        </div>
    `;
}

/* ============================================================
   Follow / Unfollow Toggle
============================================================ */
function attachFollowHandlers() {
    document.querySelectorAll(".follow-btn, .unfollow-btn").forEach(button => {
        button.addEventListener("click", async function () {
            const userCard = this.closest(".user-card");
            const targetUserId = userCard.dataset.userId;

            try {
                await fetch(`${API_BASE}/follow/toggle/${targetUserId}`, {
                    method: "POST",
                    credentials: "include",
                });

                // Reload all 3 sections
                loadFriends();

            } catch (err) {
                console.error(err);
                alert("Failed to update follow status");
            }
        });
    });
}
