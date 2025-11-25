/* ==========================================================
   FEED.JS — Lovculator Real-time Feed System (FINAL WHATSAPP STYLE)
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadFeed();
    if (typeof initializeWebSocketEvents === "function") {
        initializeWebSocketEvents();
    }
});

// Build safe avatar URL
function getAvatarURL(url) {
    if (!url || url === "null" || url === "undefined") {
        return "/images/default-avatar.png";
    }

    if (url.includes("localhost") || url.startsWith("http")) {
        try {
            const parsed = new URL(url, window.location.origin);
            url = parsed.pathname;
        } catch (err) {}
    }

    return `${url}?t=${Date.now()}`; 
}

/* LOAD FEED POSTS */
async function loadFeed() {
    const container = document.getElementById("feedContainer");
    const emptyState = document.getElementById("feedEmptyState");

    try {
        const response = await fetch("/api/posts/feed", { credentials: "include" });
        const data = await response.json();

        if (!data.posts || data.posts.length === 0) {
            emptyState.classList.remove("hidden");
            return;
        }

        container.innerHTML = "";
        emptyState.classList.add("hidden");

        data.posts.forEach(post => container.appendChild(createPostCard(post)));

    } catch (err) {
        console.error("❌ Feed Load Error:", err);
    }
}

/* FOLLOW / UNFOLLOW */
async function toggleFollow(authorId, button) {
    if (!window.currentUserId) {
        alert("Please login to follow users!");
        window.location.href = "/login.html";
        return;
    }

    const isFollowing = button.classList.contains("following");
    button.disabled = true;
    button.textContent = "...";

    try {
        const response = await fetch(`/api/users/${authorId}/follow`, {
            method: isFollowing ? "DELETE" : "POST",
            credentials: "include"
        });

        const result = await response.json();

        button.classList.toggle("following", result.is_following);
        button.textContent = result.is_following ? "Following" : "+ Follow";

        // 🔥 Update all follow buttons globally
        updateGlobalFollowButtons(authorId, result.is_following);

    } catch (err) {
        console.error("❌ Follow toggle failed:", err);
    } finally {
        button.disabled = false;
    }
}

/* Update all follow buttons across the feed */
function updateGlobalFollowButtons(authorId, status) {
    document.querySelectorAll(`button.follow-author-btn[data-author-id="${authorId}"]`)
        .forEach(btn => {
            btn.classList.toggle("following", status);
            btn.textContent = status ? "Following" : "+ Follow";
        });
}

/* CREATE FEED POST CARD */
function createPostCard(post) {
    const card = document.createElement("div");
    card.className = "post-card";
    card.dataset.postId = post.id;

    const avatar = getAvatarURL(post.avatar_url);
    const timeAgo = timeSince(new Date(post.created_at));

    card.innerHTML = `
        <div class="post-header">
            <img src="${avatar}" class="post-avatar" />

            <div class="post-user">
                <h4 class="post-name">${post.display_name || post.username}</h4>
                <span class="post-time">${timeAgo}</span>
            </div>

            ${
              post.is_owner
                ? ""
                : `<button class="follow-author-btn ${post.is_following ? "following" : ""}" data-author-id="${post.user_id}">
                        ${post.is_following ? "Following" : "+ Follow"}
                   </button>`
            }
        </div>

        <div class="post-content">
            <p>${post.content || ""}</p>
        </div>

        ${post.image_url ? `<img src="${post.image_url}" class="post-image" />` : ""}

        <div class="post-actions">
            <!-- ❤️ Like Button -->
<button class="post-action like-btn ${post.is_liked ? 'liked' : ''}" data-id="${post.id}" aria-label="Like">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.is_liked ? '#e91e63' : 'none'}" stroke="${post.is_liked ? '#e91e63' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
    <span class="like-count">${post.like_count}</span>
</button>

<!-- 💬 Comment Button -->
<button class="post-action comment-btn" data-id="${post.id}" aria-label="Comment">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
    <span class="comment-count">${post.comment_count}</span>
</button>

<!-- 🔗 Share Button -->
<button class="post-action share-btn" data-id="${post.id}" aria-label="Share">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
    <span class="share-label">Share</span>
</button>
        </div>

        <div class="comments-section hidden" id="comments-${post.id}">
            <div class="comments-list" id="commentsList-${post.id}"></div>
            <div class="comment-input-row">
                <input id="commentInput-${post.id}" class="comment-input" placeholder="Add a comment..." />
                <button class="comment-submit-btn" data-post="${post.id}">Post</button>
            </div>
        </div>
    `;

    // LISTENERS
    card.querySelector(".like-btn").addEventListener("click", () => toggleLike(post.id, card));
    card.querySelector(".comment-btn").addEventListener("click", () => openComments(post.id));
    card.querySelector(".comment-submit-btn").addEventListener("click", e => submitComment(e.target.dataset.post));
    card.querySelector(".share-btn").addEventListener("click", () => sharePost(post.id));

    const followBtn = card.querySelector(".follow-author-btn");
    if (followBtn) followBtn.addEventListener("click", e => toggleFollow(e.target.dataset.authorId, e.target));

    return card;
}

/* TIME AGO */
function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = [
        { s: 86400, label: "d" },
        { s: 3600, label: "h" },
        { s: 60, label: "m" }
    ];

    for (const i of intervals) {
        const count = Math.floor(seconds / i.s);
        if (count > 0) return `${count}${i.label}`;
    }

    return "Just now";
}
