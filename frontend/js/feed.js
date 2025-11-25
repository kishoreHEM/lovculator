/* ==========================================================
   FEED.JS — Lovculator Real-time Feed System (FINAL CLEAN)
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    loadFeed();
    initializeWebSocketEvents();
});

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
        console.error("Error loading feed:", err);
    }
}

/* 🟢 NEW FUNCTION: Toggle Follow (Unified Logic for Post Authors) */
async function toggleFollow(authorId, buttonElement) {
    // You should ensure window.currentUserId is set on page load by your auth scripts
    if (!window.currentUserId) {
        alert("Please log in to follow users!");
        window.location.href = '/login.html';
        return;
    }
    
    if (!authorId || !buttonElement) return;
    
    const isFollowing = buttonElement.classList.contains('following');
    const method = isFollowing ? 'DELETE' : 'POST';
    const initialText = buttonElement.textContent;
    
    buttonElement.disabled = true;
    buttonElement.textContent = '...';

    try {
        // Assume API endpoint is /api/users/:id/follow
        const response = await fetch(`/api/users/${authorId}/follow`, {
            method: method,
            credentials: "include"
        });

        if (response.ok) {
            // Update UI based on the new status
            const newStatus = !isFollowing;
            buttonElement.classList.toggle('following', newStatus);
            buttonElement.textContent = newStatus ? 'Following' : '+ Follow';
        } else {
            buttonElement.textContent = initialText;
            alert('Failed to update follow status.');
        }
    } catch (err) {
        console.error("Follow action failed:", err);
        buttonElement.textContent = initialText;
        alert("Network error or failed to process follow request.");
    } finally {
        buttonElement.disabled = false;
    }
}


/* CREATE POST CARD */
function createPostCard(post) {
    const card = document.createElement("div");
    card.className = "post-card";
    card.dataset.postId = post.id;

    const timeAgo = timeSince(new Date(post.created_at));

    // --- DERIVED VARIABLES ---
    // Assuming these properties are available from the API response
    const isOwner = post.is_owner; 
    const isFollowing = post.is_following_author; 
    const shareUrl = `${window.location.origin}/post.html?id=${post.id}`;
    const shareTitle = post.content ? post.content.substring(0, 50) + '...' : 'Lovculator Post';
    const shareText = post.content || '';
    // -------------------------

    card.innerHTML = `
        <div class="post-header">
            <img src="${post.avatar_url || "/images/default-avatar.png"}" class="post-avatar" />
            <div class="post-user">
                <h4>${post.display_name || post.username}</h4>
                <span class="post-time">${timeAgo}</span>
            </div>
            
            ${!isOwner ? `
                <button class="follow-author-btn ${isFollowing ? 'following' : ''}" data-author-id="${post.author_id}">
                    ${isFollowing ? 'Following' : '+ Follow'}
                </button>
            ` : ''}
            
        </div>

        <div class="post-content">
            <p>${post.content || ""}</p>
        </div>

        ${post.image_url ? `<img src="${post.image_url}" class="post-image" />` : ""}

        <div class="post-actions">
            <button class="post-action like-btn ${post.user_liked ? 'liked' : ''}" data-id="${post.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${post.user_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="like-icon">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                </svg>
                <span>Like</span>
            </button>
            
            <button class="post-action comment-btn" data-id="${post.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="comment-icon">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                </svg>
                <span>Comment</span>
            </button>
            
            <button class="post-action share-btn share-action-toggle" 
                    data-id="${post.id}"
                    data-share-url="${shareUrl}" 
                    data-share-title="${shareTitle}"
                    data-share-text="${shareText}">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="share-icon">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                <span>Share</span>
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

    // Existing event listeners remain attached:
    card.querySelector(".like-btn").addEventListener("click", () =>
        toggleLike(post.id, card)
    );

    card.querySelector(".comment-btn").addEventListener("click", () =>
        openComments(post.id)
    );

    card.querySelector(".comment-submit-btn").addEventListener("click", (e) =>
        submitComment(e.target.dataset.post)
    );

    card.querySelector(".share-btn").addEventListener("click", () =>
        sharePost(post.id)
    );

    // 🟢 Attach listener for the new follow button
    const followBtn = card.querySelector(".follow-author-btn");
    if (followBtn) {
        // Pass the author ID and the button element itself
        followBtn.addEventListener("click", (e) => toggleFollow(e.target.dataset.authorId, e.target));
    }

    return card;
}

/* LIKE / UNLIKE POST */
async function toggleLike(postId, card) {
    try {
        const response = await fetch(`/api/posts/${postId}/like`, {
            method: "POST",
            credentials: "include"
        });

        const data = await response.json();
        if (!response.ok) return;

        const countElement = card.querySelector(".like-count");
        countElement.textContent = data.like_count;

    } catch (err) {
        console.error("Like failed:", err);
    }
}

/* OPEN INLINE COMMENTS */
function openComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    section.classList.toggle("hidden");
    if (!section.classList.contains("hidden")) loadComments(postId);
}

/* LOAD COMMENTS */
async function loadComments(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}/comments`, { credentials: "include" });
        const data = await response.json();

        const list = document.getElementById(`commentsList-${postId}`);
        list.innerHTML = "";

        data.comments.forEach(c => {
            const item = document.createElement("div");
            item.className = "comment-item";
            item.innerHTML = `
                <img src="${c.avatar_url || '/images/default-avatar.png'}" class="comment-avatar" />
                <div class="comment-body">
                    <h5>${c.display_name || c.username}</h5>
                    <p>${c.content}</p>
                    <span class="comment-time">${timeSince(new Date(c.created_at))}</span>
                </div>`;
            list.appendChild(item);
        });

    } catch (err) {
        console.error("Load Comments Error:", err);
    }
}

/* ADD COMMENT */
async function submitComment(postId) {
    const input = document.getElementById(`commentInput-${postId}`);
    const content = input.value.trim();
    if (!content) return;

    try {
        await fetch(`/api/posts/${postId}/comments`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
        });

        input.value = "";
        loadComments(postId);

    } catch (err) {
        console.error("Comment failed:", err);
    }
}

/* SHARE POST */
function sharePost(postId) {
    navigator.clipboard.writeText(`${window.location.origin}/post.html?id=${postId}`);
    alert("Post link copied!");
}

/* WEBSOCKET REALTIME EVENTS */
function initializeWebSocketEvents() {
    if (!window.socket) return;

    window.socket.addEventListener("message", (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.type === "COMMENT_ADDED") {
            loadComments(data.postId);
            const card = document.querySelector(`.post-card[data-post-id="${data.postId}"]`);
            if (card) card.querySelector(".comment-count").textContent = data.commentCount;
        }

        if (data.type === "LIKE_UPDATED") updatePostLikeUI(data);
    });
}

/* UPDATE LIKE UI */
function updatePostLikeUI(data) {
    const postCard = document.querySelector(`.post-card button.like-btn[data-id="${data.postId}"]`);
    if (!postCard) return;

    const countEl = postCard.querySelector(".like-count");
    countEl.textContent = data.like_count;
}

/* TIME AGO */
function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = [
        { label: "d", seconds: 86400 },
        { label: "h", seconds: 3600 },
        { label: "m", seconds: 60 }
    ];
    for (const i of intervals) {
        const count = Math.floor(seconds / i.seconds);
        if (count > 0) return `${count}${i.label}`;
    }
    return "Just now";
}