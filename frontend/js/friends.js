// Setup API Base
const API_BASE = window.location.hostname.includes("localhost")
    ? "http://localhost:3001/api"
    : "https://lovculator.com/api";

// Init
document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    loadFriends();
});

/* ============================================================
   Tabs
============================================================ */
function initTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const selected = tab.dataset.tab;
            document.querySelectorAll(".user-list").forEach(list => {
                list.style.display = "none";
            });
            document.getElementById(`${selected}-list`).style.display = "block";
        });
    });
}

/* ============================================================
   Load all sections
============================================================ */
function loadFriends() {
    loadSection("followers", "/follow/followers");
    loadSection("following", "/follow/following");
    loadSection("suggestions", "/follow/suggestions");
}

/* ============================================================
   Load section
============================================================ */
async function loadSection(section, endpoint) {
    const container = document.getElementById(`${section}-list`);
    container.innerHTML = `<p>Loading...</p>`;

    try {
        const res = await fetch(API_BASE + endpoint, { credentials: "include" });
        if (!res.ok) throw new Error("API failed");

        const users = await res.json();

        if (!users.length) {
            container.innerHTML = `<div class="empty-state">No ${section} found.</div>`;
            return;
        }

        container.innerHTML = users
    .map(user => userCardHTML(user, section))
    .join("");


    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style="color:red;">Failed to load ${section}</p>`;
    }
}

/* ============================================================
   User card
============================================================ */
function userCardHTML(user, section) {
    const avatar = user.avatar_url || "/images/default-avatar.png";
    const isFollowing = user.is_following === true;

    return `
        <div class="user-card"
             data-user-id="${user.id}"
             data-section="${section}">
             
            <div class="user-info">
                <img src="${avatar}" class="user-avatar">
                <div class="user-details">
                    <span class="user-name">${user.display_name || "Unknown"}</span>
                    <span class="user-username">@${user.username}</span>
                </div>
            </div>

            <button class="follow-author-btn" data-following="${isFollowing}">
                ${isFollowing ? "Unfollow" : "Follow"}
            </button>
        </div>
    `;
}

/* ============================================================
   Follow / Unfollow (EVENT DELEGATION)
============================================================ */
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".follow-author-btn");
    if (!btn) return;

    const card = btn.closest(".user-card");
    const userId = card.dataset.userId;
    const fromSection = card.dataset.section;

    if (btn.disabled) return;
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/follow/toggle/${userId}`, {
            method: "POST",
            credentials: "include"
        });

        if (!res.ok) throw new Error("Toggle failed");

        const data = await res.json();

        // Update button UI
        btn.dataset.following = data.following;
        btn.textContent = data.following ? "Unfollow" : "Follow";

        /* ==========================================
           🚀 MOVE CARD LOGIC
        ========================================== */
        if (data.following && fromSection === "suggestions") {
            const followingList = document.getElementById("following-list");

            // Update card state
            card.dataset.section = "following";

            // Move card
            followingList.prepend(card);
        }

        // Optional: unfollow from following → move back to suggestions
        if (!data.following && fromSection === "following") {
            const suggestionsList = document.getElementById("suggestions-list");

            card.dataset.section = "suggestions";
            btn.textContent = "Follow";

            suggestionsList.prepend(card);
        }

    } catch (err) {
        console.error(err);
        alert("Failed to update follow status");
    } finally {
        btn.disabled = false;
    }
});

