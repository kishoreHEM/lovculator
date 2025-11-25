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
            <button class="post-action like-btn ${post.is_liked ? "liked" : ""}" data-id="${post.id}">
                ❤️ <span class="like-count">${post.like_count}</span>
            </button>

            <button class="post-action comment-btn" data-id="${post.id}">
                💬 <span class="comment-count">${post.comment_count}</span>
            </button>

            <button class="post-action share-btn" data-id="${post.id}">
                🔗 Share
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
