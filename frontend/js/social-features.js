// ===============================================================
// SOCIAL-FEATURES.JS — GLOBAL SOCIAL INTERACTIONS HANDLER (WITH ERROR HANDLING)
// ===============================================================

// Ensure API_BASE is available
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

// Global event delegation for ALL social interactions
document.addEventListener("click", async (e) => {
    // Like button
    if (e.target.closest(".like-button, .story-action.like-button, .like-btn, .post-action.like-btn, .like-icon")) {
        await handleLike(e.target.closest(".like-button, .story-action.like-button, .like-btn, .post-action.like-btn"));
    }
    
    // Comment toggle button
    if (e.target.closest(".comment-toggle, .comment-btn")) {
        handleCommentToggle(e.target.closest(".comment-toggle, .comment-btn"));
    }
    
    // Comment submit button
    if (e.target.closest(".comment-submit, .comment-submit-btn")) {
        await handleCommentSubmit(e.target.closest(".comment-submit, .comment-submit-btn"));
    }
    
    // Follow button
    if (e.target.closest(".follow-btn, .follow-author-btn")) {
        await handleFollow(e.target.closest(".follow-btn, .follow-author-btn"));
    }
    
    // Share button
    if (e.target.closest(".share-action-toggle, .share-btn")) {
        await handleShare(e.target.closest(".share-action-toggle, .share-btn"));
    }
    
    // Delete story button
    if (e.target.closest(".delete-story-button")) {
        await handleDelete(e.target.closest(".delete-story-button"));
    }
    
    // Report button
    if (e.target.closest(".report-story-button")) {
        handleReport(e.target.closest(".report-story-button"));
    }
    
    // Read More button
    if (e.target.closest(".read-more")) {
        handleReadMore(e.target.closest(".read-more"));
    }
});

// Handle Enter key in comment inputs
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
        e.preventDefault();
        const commentInput = e.target;
        const storyId = commentInput.dataset.storyId || commentInput.dataset.postId;
        if (storyId) {
            handleAddComment(storyId, commentInput);
        }
    }
});

// ==============================================
// 1. LIKE HANDLER (IMPROVED ERROR HANDLING)
// ==============================================
async function handleLike(likeBtn) {
    if (!likeBtn) return;
    
    const id = likeBtn.dataset.id || 
               likeBtn.dataset.postId || 
               likeBtn.closest("[data-story-id]")?.dataset.storyId ||
               likeBtn.closest("[data-post-id]")?.dataset.postId;

    if (!id) {
        console.error("❌ Missing story/post ID for like");
        return;
    }

    // Store original state for rollback
    const originalLikedState = likeBtn.classList.contains('liked');
    const originalCount = likeBtn.querySelector(".like-count")?.textContent || 0;
    
    likeBtn.disabled = true;

    try {
        const isStory = likeBtn.closest(".story-card") || window.location.pathname.includes("love-stories");
        const url = isStory
            ? `${window.API_BASE}/stories/${id}/like`
            : `${window.API_BASE}/posts/${id}/like`;

        console.log(`📡 Making like request to: ${url}`);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, { 
            method: "POST", 
            credentials: "include",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            let errorMessage = `HTTP ${res.status}: Failed to like`;
            try {
                const errorData = await res.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
                console.error("❌ Server error response:", errorData);
            } catch (parseError) {
                // If response isn't JSON, use status text
                errorMessage = res.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const json = await res.json();
        console.log("✅ Like response:", json);

        // Update UI
        likeBtn.classList.toggle("liked", json.is_liked);

        const countSpan = likeBtn.querySelector(".like-count");
        if (countSpan) {
            countSpan.textContent = json.like_count || json.likes_count || 0;
        }

        // Show notification
        if (json.is_liked) {
            showNotification('Story Liked! ❤️', 'success');
            window.simpleStats?.trackLike?.();
        } else {
            showNotification('Story Unliked 💔', 'success');
        }

    } catch (err) {
        console.error("❌ Like error:", err);
        
        // Rollback UI changes
        likeBtn.classList.toggle("liked", originalLikedState);
        const countSpan = likeBtn.querySelector(".like-count");
        if (countSpan) {
            countSpan.textContent = originalCount;
        }
        
        if (err.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            showNotification('Please log in to like!', 'error');
            setTimeout(() => (window.location.href = '/login.html'), 1200);
        } else if (err.message?.includes('500')) {
            showNotification('Server error. Please try again later.', 'error');
        } else {
            showNotification(err.message || 'Failed to update like.', 'error');
        }
    } finally {
        likeBtn.disabled = false;
    }
}

// ==============================================
// 2. COMMENT TOGGLE HANDLER
// ==============================================
function handleCommentToggle(commentToggleBtn) {
    const id = commentToggleBtn.dataset.id || 
               commentToggleBtn.dataset.postId || 
               commentToggleBtn.closest("[data-story-id]")?.dataset.storyId ||
               commentToggleBtn.closest("[data-post-id]")?.dataset.postId;
    
    if (!id) return;

    const section = document.getElementById(`comments-${id}`);
    if (section) {
        section.classList.toggle("hidden");
        
        // Load comments if showing for the first time
        if (!section.classList.contains("hidden")) {
            const commentsList = document.getElementById(`comments-list-${id}`);
            if (commentsList && commentsList.children.length === 0) {
                loadComments(id);
            }
        }
    }
}

// ==============================================
// 3. COMMENT SUBMIT HANDLER
// ==============================================
async function handleCommentSubmit(commentSubmitBtn) {
    const id = commentSubmitBtn.dataset.post || 
               commentSubmitBtn.dataset.storyId || 
               commentSubmitBtn.closest("[data-story-id]")?.dataset.storyId ||
               commentSubmitBtn.closest("[data-post-id]")?.dataset.postId;
    
    if (!id) return;

    const input = document.querySelector(`input[data-post-id="${id}"], input[data-story-id="${id}"], #commentInput-${id}`);
    
    if (!input?.value.trim()) {
        showNotification('Comment cannot be empty.', 'error');
        return;
    }

    const text = input.value.trim();
    input.value = "";
    commentSubmitBtn.disabled = true;

    try {
        const isStory = commentSubmitBtn.closest(".story-card") || window.location.pathname.includes("love-stories");
        const url = isStory
            ? `${window.API_BASE}/stories/${id}/comments`
            : `${window.API_BASE}/posts/${id}/comments`;

        console.log(`📡 Making comment request to: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ text }),
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
            let errorMessage = `HTTP ${res.status}: Failed to add comment`;
            try {
                const errorData = await res.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (parseError) {
                errorMessage = res.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await res.json();

        // Reload comments
        await loadComments(id);

        // Update comment count
        const countSpan = document.querySelector(`[data-story-id="${id}"] .comment-toggle span`) ||
                         document.querySelector(`[data-post-id="${id}"] .comment-count`);
        if (countSpan) {
            countSpan.textContent = result.comments_count || result.comment_count || 0;
        }

        showNotification('Comment added!', 'success');
        window.simpleStats?.trackComment?.();

    } catch (err) {
        console.error("Comment error:", err);
        if (err.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            showNotification('Please log in to comment!', 'error');
            setTimeout(() => (window.location.href = '/login.html'), 1200);
        } else if (err.message?.includes('500')) {
            showNotification('Server error. Please try again later.', 'error');
        } else {
            showNotification(err.message || 'Failed to add comment.', 'error');
        }
    } finally {
        commentSubmitBtn.disabled = false;
    }
}

// ==============================================
// 4. ADD COMMENT VIA ENTER KEY
// ==============================================
async function handleAddComment(storyId, inputElement) {
    if (!window.currentUserId) {
        showNotification('Please log in to comment!', 'error');
        return;
    }

    const text = inputElement.value.trim();
    if (!text) {
        showNotification('Comment cannot be empty.', 'error');
        return;
    }

    const submitButton = inputElement.nextElementSibling || 
                        inputElement.closest('.comment-form')?.querySelector('.comment-submit');
    
    if (submitButton) submitButton.disabled = true;

    try {
        const isStory = window.location.pathname.includes("love-stories");
        const url = isStory
            ? `${window.API_BASE}/stories/${storyId}/comments`
            : `${window.API_BASE}/posts/${storyId}/comments`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ text }),
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
            let errorMessage = `HTTP ${res.status}: Failed to add comment`;
            try {
                const errorData = await res.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (parseError) {
                errorMessage = res.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await res.json();
        console.log('Add comment response:', result);

        // Reload comments - wait a moment for the server to process
        setTimeout(() => {
            loadComments(storyId);
        }, 300);

        // Update comment count
        const countSpan = document.querySelector(`[data-story-id="${storyId}"] .comment-toggle span`) ||
                         document.querySelector(`[data-post-id="${storyId}"] .comment-count`);
        if (countSpan) {
            countSpan.textContent = result.comments_count || result.comment_count || 0;
        }

        inputElement.value = '';
        showNotification('Comment added!', 'success');
        window.simpleStats?.trackComment?.();

    } catch (err) {
        console.error("❌ Error adding comment:", err);
        if (err.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            showNotification('Please log in to comment!', 'error');
            setTimeout(() => (window.location.href = '/login.html'), 1200);
        } else if (err.message?.includes('500')) {
            showNotification('Server error. Please try again later.', 'error');
        } else {
            showNotification(err.message || 'Failed to add comment.', 'error');
        }
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

// ==============================================
// 5. LOAD COMMENTS (IMPROVED - FIXED NAME/AVATAR DISPLAY)
// ==============================================
async function loadComments(id) {
    const isStory = window.location.pathname.includes("love-stories");
    const commentsList = document.getElementById(`comments-list-${id}`);
    
    if (!commentsList) return;

    commentsList.innerHTML = '<p style="text-align:center; padding: 10px;">Loading comments...</p>';

    try {
        const url = isStory
            ? `${window.API_BASE}/stories/${id}/comments`
            : `${window.API_BASE}/posts/${id}/comments`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, { 
            credentials: "include",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            let errorMessage = `HTTP ${res.status}: Failed to load comments`;
            try {
                const errorData = await res.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (parseError) {
                errorMessage = res.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const data = await res.json();
        
        // Handle different response formats
        let comments = [];
        
        if (Array.isArray(data)) {
            comments = data;
        } else if (data && Array.isArray(data.comments)) {
            comments = data.comments;
        } else if (data && data.data && Array.isArray(data.data)) {
            comments = data.data;
        } else if (data && data.items && Array.isArray(data.items)) {
            comments = data.items;
        }
        
        console.log('Comments API response:', data);
        console.log('Parsed comments:', comments);

        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<p class="empty-state-comment">Be the first to comment! 💬</p>';
            return;
        }

        commentsList.innerHTML = comments.map(comment => {
            // Extract comment data - check for different possible field names
            const authorName = comment.author_name || 
                              comment.username || 
                              comment.user?.username || 
                              comment.author?.username ||
                              comment.user?.display_name ||
                              comment.author?.display_name ||
                              'Anonymous User';
            
            const avatar = comment.author_avatar_url || 
                          comment.avatar_url || 
                          comment.user?.avatar_url || 
                          comment.author?.avatar_url ||
                          comment.user?.avatar ||
                          comment.author?.avatar ||
                          '/images/default-avatar.png';
            
            const commentDate = comment.created_at || comment.commented_at || comment.date;
            const date = commentDate ? new Date(commentDate).toLocaleDateString() : 'Recently';
            const text = comment.comment_text || comment.text || comment.content || comment.body || '';

            return `
                <div class="comment" style="display: flex; align-items: flex-start; padding: 12px; border-bottom: 1px solid #eee; margin-bottom: 8px;">
                    <img src="${avatar}" 
                         alt="${authorName}" 
                         class="comment-avatar" 
                         style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px; object-fit: cover;" 
                         onerror="this.src='/images/default-avatar.png'" />
                    <div class="comment-content-wrapper" style="flex: 1;">
                        <div class="comment-author-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span class="comment-author-name" style="font-weight: bold; font-size: 14px; color: #333;">
                                ${authorName}
                            </span>
                            <span class="comment-time" style="font-size: 12px; color: #888;">
                                ${date}
                            </span>
                        </div>
                        <p class="comment-text" style="margin: 0; font-size: 14px; line-height: 1.4; color: #333;">
                            ${text}
                        </p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("❌ Error loading comments:", err);
        if (err.name === 'AbortError') {
            commentsList.innerHTML = '<p style="color:orange; text-align:center; padding: 20px;">Request timeout. Please check your connection.</p>';
        } else {
            commentsList.innerHTML = `
                <p style="color:red; text-align:center; padding: 20px;">
                    Failed to load comments.<br>
                    <small>${err.message || 'Please try again later.'}</small>
                </p>
            `;
        }
    }
}

// ==============================================
// 6. FOLLOW HANDLER
// ==============================================
async function handleFollow(followBtn) {
    if (!window.currentUserId) {
        showNotification("Please log in to follow users.", "error");
        return;
    }

    const userId = followBtn.dataset.userId || followBtn.dataset.authorId;
    
    if (!userId) {
        console.error("❌ Could not find user ID for follow action.");
        showNotification("Unable to follow user: missing user ID.", "error");
        return;
    }
    
    if (parseInt(userId) === window.currentUserId) {
        showNotification("You cannot follow yourself.", "error");
        return;
    }
    
    followBtn.disabled = true;
    const originalText = followBtn.textContent;
    const originalClass = followBtn.className;

    try {
        const isCurrentlyFollowing = followBtn.classList.contains('following');
        
        // Optimistic UI update
        followBtn.classList.toggle('following', !isCurrentlyFollowing);
        followBtn.textContent = !isCurrentlyFollowing ? 'Following' : '+ Follow';

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${window.API_BASE}/users/${userId}/follow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: Failed to update follow status`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (parseError) {
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        
        // Update UI based on API response
        followBtn.classList.toggle('following', result.is_following);
        followBtn.textContent = result.is_following ? 'Following' : '+ Follow';

        // Update all follow buttons for this user
        document.querySelectorAll(`[data-user-id="${userId}"], [data-author-id="${userId}"]`)
            .forEach(btn => {
                btn.classList.toggle('following', result.is_following);
                btn.textContent = result.is_following ? 'Following' : '+ Follow';
            });

        if (result.is_following) {
            showNotification(`You're now following this user!`, 'success');
        } else {
            showNotification(`Unfollowed user.`, 'success');
        }

    } catch (error) {
        console.error("❌ Follow toggle failed:", error);
        
        // Revert optimistic update
        followBtn.className = originalClass;
        followBtn.textContent = originalText;
        
        if (error.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showNotification('Please log in to follow users.', 'error');
            setTimeout(() => (window.location.href = '/login.html'), 1500);
        } else if (error.message.includes('500')) {
            showNotification('Server error. Please try again later.', 'error');
        } else {
            showNotification(error.message || "Failed to update follow status.", 'error');
        }
    } finally {
        followBtn.disabled = false;
    }
}

// ==============================================
// 7. SHARE HANDLER
// ==============================================
async function handleShare(shareBtn) {
    const url = shareBtn.dataset.shareUrl || `${window.location.origin}/post/${shareBtn.dataset.id}`;
    const title = shareBtn.dataset.shareTitle || `Post on Lovculator`;
    const text = shareBtn.dataset.shareText || "Check this out on Lovculator!";

    let shareAttempted = false;

    if (navigator.share) {
        shareAttempted = true;
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url,
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error sharing:', error);
                showNotification('Failed to share.', 'error');
                return;
            }
        }
    } else {
        // Fallback: Copy to clipboard
        try {
            await navigator.clipboard.writeText(url);
            showNotification('Link copied to clipboard! 📋', 'success');
        } catch (err) {
            console.error('Failed to copy link', err);
            showNotification('Native sharing not supported. Please copy the URL manually.', 'error');
        }
    }

    // Track share if it's a story
    if (shareAttempted || !navigator.share) {
        try {
            const storyId = parseInt(url.split('/').pop());
            if (!isNaN(storyId)) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(`${window.API_BASE}/stories/${storyId}/share`, {
                    method: "POST",
                    credentials: "include",
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const result = await response.json();
                    
                    // Update share count
                    const countEl = document.querySelector(`[data-story-id="${storyId}"] .share-count`);
                    if (countEl) {
                        countEl.textContent = result.shares_count || 0;
                    }
                    
                    window.simpleStats?.trackShare?.();
                }
            }
        } catch (error) {
            console.error('Error tracking share:', error);
        }
    }
}

// ==============================================
// 8. READ MORE HANDLER
// ==============================================
function handleReadMore(readMoreBtn) {
    const storyCard = readMoreBtn.closest('.story-card');
    if (!storyCard) return;
    
    const contentEl = storyCard.querySelector('.story-content');
    if (!contentEl) return;

    const isExpanded = contentEl.classList.contains('expanded');
    
    if (isExpanded) {
        contentEl.classList.remove('expanded');
        const fullText = contentEl.dataset.fullText;
        if (fullText && fullText.length > 200) {
            contentEl.textContent = fullText.substring(0, 200) + '...';
        }
        readMoreBtn.textContent = 'Read More';
    } else {
        contentEl.classList.add('expanded');
        const fullText = contentEl.dataset.fullText || contentEl.textContent;
        contentEl.textContent = fullText;
        contentEl.dataset.fullText = fullText;
        readMoreBtn.textContent = 'Read Less';
    }
}

// ==============================================
// 9. DELETE HANDLER
// ==============================================
async function handleDelete(deleteBtn) {
    const storyCard = deleteBtn.closest('.story-card');
    if (!storyCard) return;
    
    const storyId = storyCard.dataset.storyId;
    
    if (!confirm("Are you sure you want to permanently delete this story? This action cannot be undone.")) {
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${window.API_BASE}/stories/${storyId}`, {
            method: "DELETE",
            credentials: "include",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: Failed to delete story`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (parseError) {
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        // Remove from UI
        storyCard.remove();
        
        // Update stats if on stories page
        if (window.loveStoriesPage) {
            window.loveStoriesPage.updateStats();
        }

        showNotification('Story deleted successfully. 🗑️', 'success');
        
    } catch (error) {
        console.error('Error deleting story:', error);
        if (error.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (error.message?.includes('500')) {
            showNotification('Server error. Please try again later.', 'error');
        } else {
            showNotification(error.message || 'Failed to delete story.', 'error');
        }
    }
}

// ==============================================
// 10. REPORT HANDLER
// ==============================================
function handleReport(reportBtn) {
    const storyCard = reportBtn.closest('.story-card');
    if (!storyCard) return;
    
    const storyId = storyCard.dataset.storyId;
    showNotification('Reporting feature is coming soon! Story ID: ' + storyId, 'error');
}

// ==============================================
// 11. NOTIFICATION HELPER
// ==============================================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: ${type === 'error' ? '#ff6b6b' : '#4CAF50'};
        color: white; padding: 15px 20px; border-radius: 8px;
        z-index: 3000; opacity: 0; transition: opacity 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.style.opacity = '1', 10);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300); 
    }, 3000);
}

// ==============================================
// 12. TIME AGO HELPER
// ==============================================
function timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = [
        { s: 31536000, label: "y" },
        { s: 2592000, label: "mo" },
        { s: 604800, label: "w" },
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

// ==============================================
// 13. GET AVATAR URL HELPER (FIXED - PROPER URL VALIDATION)
// ==============================================
function getAvatarURL(url) {
    // If no URL or invalid, return default
    if (!url || url === "null" || url === "undefined" || url === "" || url.includes('undefined')) {
        return "/images/default-avatar.png";
    }
    
    // If it's already a full URL, use it as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // If it's a relative path, prepend ASSET_BASE
    if (url.startsWith('/')) {
        return `${window.ASSET_BASE || ''}${url}`;
    }
    
    // If it's just a filename, prepend with assets path
    if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp')) {
        return `${window.ASSET_BASE || ''}/uploads/avatars/${url}`;
    }
    
    // Default fallback
    return "/images/default-avatar.png";
}
// Make functions globally available
window.loadComments = loadComments;
window.showNotification = showNotification;
window.timeSince = timeSince;
window.getAvatarURL = getAvatarURL;

// Get current user ID on load
document.addEventListener('DOMContentLoaded', () => {
    if (!window.currentUserId) {
        fetch(`${window.API_BASE}/auth/me`, { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                window.currentUserId = data?.id || data?.user?.id || null;
                console.log('Current User ID:', window.currentUserId);
            })
            .catch(() => {
                window.currentUserId = null;
                console.log('No user logged in');
            });
    }
});

// Debug: Check if API is accessible
console.log('Social Features initialized. API_BASE:', window.API_BASE);