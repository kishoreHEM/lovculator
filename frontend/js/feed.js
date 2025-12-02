/* ==========================================================
   FEED.JS — Lovculator Feed Renderer (NO SOCIAL LOGIC)
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadFeed();
});

// Helper: Build safe avatar URL
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

/* =========================================
   CORE: LOAD FEED
   ========================================= */
async function loadFeed() {
    const container = document.getElementById("feedContainer");
    const emptyState = document.getElementById("feedEmptyState");

    if (!container) return;

    try {
        const response = await fetch(`${window.API_BASE}/posts/feed`, { 
            credentials: "include" 
        });
        
        if (!response.ok) throw new Error("Failed to load feed");
        
        const data = await response.json();

        if (!data.posts || data.posts.length === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            container.innerHTML = "";
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        container.innerHTML = "";

        // Render posts
        data.posts.forEach(post => {
            const card = createPostCard(post);
            container.appendChild(card);
        });

    } catch (err) {
        console.error("❌ Feed Load Error:", err);
        if (container) container.innerHTML = `<p style="text-align:center; padding:20px; color:red;">Failed to load feed. Check connection.</p>`;
    }
}

/* =========================================
   UI: CREATE POST CARD
   ========================================= */
function createPostCard(post) {
    const card = document.createElement("div");
    card.className = "post-card";
    
    // Set data attributes
    card.dataset.postId = post.id; 

    const avatar = getAvatarURL(post.avatar_url);
    const timeAgo = window.timeSince ? window.timeSince(new Date(post.created_at)) : new Date(post.created_at).toLocaleDateString();
    const isOwner = window.currentUserId && (post.user_id == window.currentUserId);

    card.innerHTML = `
        <div class="post-header">
            <a href="/profile.html?user=${post.username}" class="profile-link">
                <img src="${avatar}" class="post-avatar" alt="${post.username}" />
            </a>

            <div class="post-user">
                <a href="/profile.html?user=${post.username}" class="profile-link">
                    <h4 class="post-name">${post.display_name || post.username}</h4>
                </a>
                <span class="post-time">${timeAgo}</span>
            </div>

            ${!isOwner ? `
               <button class="follow-author-btn ${post.is_following ? "following" : ""}" 
                       data-author-id="${post.user_id}">
                    ${post.is_following ? "Following" : "+ Follow"}
               </button>
            ` : ''}
        </div>

        <div class="post-content">
            <p>${post.content || ""}</p>
        </div>

        ${post.image_url ? `<img src="${post.image_url}" class="post-image" alt="Post content" />` : ""}

        <div class="post-actions">
            <button class="post-action like-btn ${post.is_liked ? 'liked' : ''}" 
                    data-id="${post.id}" 
                    aria-label="Like">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.is_liked ? '#e91e63' : 'none'}" stroke="${post.is_liked ? '#e91e63' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span class="like-count">${post.like_count || 0}</span>
            </button>

            <button class="post-action comment-btn" 
                    data-id="${post.id}" 
                    aria-label="Comment">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span class="comment-count">${post.comment_count || 0}</span>
            </button>

            <button class="post-action share-btn" 
                    data-id="${post.id}" 
                    aria-label="Share">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <div class="comments-list" id="comments-list-${post.id}"></div>
            <div class="comment-input-row">
                <input id="commentInput-${post.id}" 
                       class="comment-input" 
                       data-post-id="${post.id}"
                       placeholder="Add a comment..." />
                <button class="comment-submit-btn" data-post="${post.id}">Post</button>
            </div>
        </div>
    `;

    return card;
}