/* ==========================================================
   FEED.JS — Lovculator Feed Renderer
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // Ensure API_BASE is available
    if (!window.API_BASE) {
        window.API_BASE = window.location.hostname.includes("localhost")
            ? "http://localhost:3001/api"
            : "https://lovculator.com/api";
    }

    // Ensure ASSET_BASE is available
    if (!window.ASSET_BASE) {
        window.ASSET_BASE = window.location.hostname.includes("localhost")
            ? "http://localhost:3001"
            : "https://lovculator.com";
    }

    loadFeed();
});

// Helper: Build safe avatar URL (Matches profile.js logic)
function getAvatarURL(url) {
    if (!url || url === "null" || url === "undefined") {
        return "/images/default-avatar.png";
    }
    // If full URL, return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
    }
    // If relative path (starts with /), return as is (browser handles it) or prepend ASSET_BASE
    if (url.startsWith("/")) {
        return `${window.ASSET_BASE || ''}${url}`;
    }
    // If just filename, prepend uploads path
    return `${window.ASSET_BASE || ''}/uploads/avatars/${url}`;
}

/* =========================================
   CORE: LOAD FEED
   ========================================= */
async function loadFeed() {
    const container = document.getElementById("feedContainer");
    const emptyState = document.getElementById("feedEmptyState");

    if (!container) return;

    // Show loading spinner
    container.innerHTML = `
        <div class="loading-wrapper" style="text-align:center; padding:20px;">
            <div class="spinner"></div>
            <p style="color:#666;">Loading posts...</p>
        </div>`;

    try {
        const response = await fetch(`${window.API_BASE}/posts/feed`, { 
            credentials: "include" 
        });
        
        if (!response.ok) throw new Error("Failed to load feed");
        
        const data = await response.json();

        // Handle empty feed
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
        if (container) container.innerHTML = `
            <div style="text-align:center; padding:30px; color:#ff4b8d;">
                <p>Unable to load feed.</p>
                <button onclick="loadFeed()" class="btn-small" style="margin-top:10px;">Try Again</button>
            </div>`;
    }
}

/* =========================================
   UI: CREATE POST CARD
   ========================================= */
function createPostCard(post) {
    const card = document.createElement("div");
    card.className = "post-card"; // This needs CSS to look good
    
    // Set data attributes for social-features.js
    card.dataset.postId = post.id; 
    card.dataset.id = post.id; 

    const avatar = getAvatarURL(post.avatar_url);
    
    // Safe date handling
    let timeAgo = "Just now";
    if (window.timeSince && post.created_at) {
        timeAgo = window.timeSince(new Date(post.created_at));
    } else if (post.created_at) {
        timeAgo = new Date(post.created_at).toLocaleDateString();
    }

    const isOwner = window.currentUserId && (parseInt(post.user_id) === parseInt(window.currentUserId));

    card.innerHTML = `
        <div class="post-header">
            <div class="post-user-info">
                <a href="/profile.html?user=${encodeURIComponent(post.username)}" class="post-user-link">
                    <img src="${avatar}" class="post-avatar" alt="${post.username}" onerror="this.src='/images/default-avatar.png'" />
                </a>
                <div class="post-user-details">
                    <a href="/profile.html?user=${encodeURIComponent(post.username)}" class="post-username-link">
                        <h4 class="post-username">${post.display_name || post.username}</h4>
                    </a>
                    <span class="post-time">${timeAgo}</span>
                </div>
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

        ${post.image_url ? `
            <div class="post-image-container">
                <img src="${post.image_url.startsWith('http') ? post.image_url : (window.ASSET_BASE + post.image_url)}" 
                     class="post-image" alt="Post content" loading="lazy" />
            </div>` : 
        ""}

        <div class="post-actions">
            <button class="post-action like-btn ${post.is_liked ? 'liked' : ''}" 
                    data-id="${post.id}" 
                    data-post-id="${post.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${post.is_liked ? '#e91e63' : 'none'}" stroke="${post.is_liked ? '#e91e63' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span class="like-count">${post.like_count || 0}</span>
            </button>

            <button class="post-action comment-btn comment-toggle" 
                    data-id="${post.id}" 
                    data-post-id="${post.id}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span class="comment-count">${post.comment_count || 0}</span>
            </button>

            <button class="post-action share-btn share-action-toggle" 
                    data-id="${post.id}" 
                    data-share-url="${window.location.origin}/post/${post.id}"
                    data-share-title="Post by ${post.username}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
            </button>
        </div>

        <div class="comments-section hidden" id="comments-${post.id}">
            <div class="comment-form">
                <input type="text"
                       class="comment-input"
                       placeholder="Add a comment..."
                       data-post-id="${post.id}">
                <button class="comment-submit" data-post-id="${post.id}">Post</button>
            </div>
            <div class="comments-list" id="comments-list-${post.id}"></div>
        </div>
    `;

    return card;
}