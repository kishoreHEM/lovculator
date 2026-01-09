// ===============================================================
// SOCIAL-FEATURES.JS — GLOBAL SOCIAL INTERACTIONS HANDLER (WITH ERROR HANDLING)
// ===============================================================

// Ensure API_BASE is available
if (!window.API_BASE) {
    window.API_BASE = window.location.hostname.includes("localhost")
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";
}

// ==============================================
// GLOBAL LOGIN CHECK HELPER (FIXED VERSION)
// ==============================================
window.requireLogin = function(action = "", callback = null) {
  // If user is logged in, execute callback if provided and return true
  if (window.currentUserId) {
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  }

  // User is NOT logged in
  // Store the action for potential resumption after login
  if (callback) {
    window.pendingAuthAction = {
      callback: callback,
      action: action
    };
  }

  // Show login modal
  if (typeof window.showLoginModal === 'function') {
    window.showLoginModal(action);
  } else {
    console.warn('showLoginModal not available for action:', action);
  }

  // Return false to indicate login is required
  return false;
};




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
// 1. LIKE HANDLER (UPDATED FOR POSTS, STORIES, QUESTIONS & ANSWERS)
// ==============================================
async function handleLike(likeBtn) {
    if (!likeBtn) return;

    // 🔐 LOGIN GATE - SIMPLE CHECK
    if (!window.currentUserId) {
        if (window.showLoginModal) {
            window.showLoginModal("like this");
        }
        return;
    }
    
    // Store original state for rollback
    const originalLikedState = likeBtn.classList.contains('liked');
    const likeCountSpan = likeBtn.querySelector(".like-count");
    const originalCount = likeCountSpan?.textContent || 0;
    
    likeBtn.disabled = true;

    try {
        // 1. Robust ID Retrieval
        const id = likeBtn.dataset.id || 
                   likeBtn.dataset.postId || 
                   likeBtn.dataset.answerId || 
                   likeBtn.dataset.questionId || 
                   likeBtn.closest("[data-story-id]")?.dataset.storyId ||
                   likeBtn.closest("[data-post-id]")?.dataset.postId ||
                   likeBtn.closest("[data-answer-id]")?.dataset.answerId || 
                   likeBtn.closest("[data-question-id]")?.dataset.questionId;

        if (!id) {
            console.error("❌ Missing ID for like action");
            return;
        }

        // 2. Determine Context (Story vs Post vs Question vs Answer)
        const isStory = likeBtn.closest(".story-card") || 
                        likeBtn.closest("[data-story-id]") ||
                        window.location.pathname.includes("love-stories");
        
        const isAnswer = likeBtn.dataset.type === 'answer' || 
                         likeBtn.closest(".answer-card") || 
                         likeBtn.closest("[data-answer-id]");
                         
        const isQuestion = likeBtn.dataset.type === 'question' ||
                           likeBtn.closest(".question-container") || 
                           likeBtn.closest("[data-question-id]");

        // 3. Construct Correct URL
        let url;
        let typeLabel = "Post";

        if (isStory) {
            url = `${window.API_BASE}/stories/${id}/like`;
            typeLabel = "Story";
        } else if (isAnswer) {
            url = `${window.API_BASE}/questions/answers/${id}/like`;
            typeLabel = "Answer";
        } else if (isQuestion) {
            url = `${window.API_BASE}/questions/${id}/like`;
            typeLabel = "Question";
        } else {
            url = `${window.API_BASE}/posts/${id}/like`;
        }

        console.log(`📡 Making like request to: ${url}`);
        
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
            } catch (parseError) {
                errorMessage = res.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }
        
        const json = await res.json();
        console.log("✅ Like response:", json);

        // 4. Update UI (Icon & Count)
        const icon = likeBtn.querySelector("svg");
        if (icon) {
            if (json.is_liked) {
                icon.setAttribute("fill", "#e91e63");
                icon.setAttribute("stroke", "#e91e63");
                likeBtn.classList.add("liked");
            } else {
                icon.setAttribute("fill", "none");
                icon.setAttribute("stroke", "currentColor");
                likeBtn.classList.remove("liked");
            }
        }
        
        // Update the count number if returned from server
        if (likeCountSpan && json.like_count !== undefined) {
            likeCountSpan.textContent = json.like_count;
        }

        // 5. Show Notification
        if (json.is_liked) {
            showNotification(`${typeLabel} Liked! ❤️`, 'success');
            if (window.simpleStats?.trackLike) {
                 window.simpleStats.trackLike({ type: typeLabel.toLowerCase(), id });
            }
        } else {
            showNotification(`${typeLabel} Unliked 💔`, 'success');
        }

    } catch (err) {
        console.error("❌ Like error:", err);
        
        // Rollback UI changes
        if (likeBtn.classList.contains("liked") !== originalLikedState) {
            likeBtn.classList.toggle("liked");
            const icon = likeBtn.querySelector("svg");
            if (icon) {
                 if (originalLikedState) {
                    icon.setAttribute("fill", "#e91e63");
                    icon.setAttribute("stroke", "#e91e63");
                 } else {
                    icon.setAttribute("fill", "none");
                    icon.setAttribute("stroke", "currentColor");
                 }
            }
        }
        
        if (likeCountSpan) {
            likeCountSpan.textContent = originalCount;
        }
        
        if (err.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            showNotification('Please log in to like!', 'error');
            if (window.showLoginModal) {
                window.showLoginModal("like this");
            }
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
    // Comment toggling should NOT require login - users should be able to read comments
    const id = commentToggleBtn.dataset.id || 
               commentToggleBtn.dataset.postId || 
               commentToggleBtn.closest("[data-story-id]")?.dataset.storyId ||
               commentToggleBtn.closest("[data-post-id]")?.dataset.postId;

    if (!id) return;

    const section = document.getElementById(`comments-${id}`);
    if (section) {
        section.classList.toggle("hidden");
        if (!section.classList.contains("hidden")) {
            const commentsList = document.getElementById(`comments-list-${id}`);
            if (commentsList && commentsList.children.length === 0) {
                loadComments(id);
            }
        }
    }
}

// ==============================================
// 3. COMMENT SUBMIT HANDLER (UPDATED FOR POSTS, STORIES & ANSWERS)
// ==============================================
async function handleCommentSubmit(commentSubmitBtn) {
    // 🔐 LOGIN GATE - SIMPLE CHECK
    if (!window.currentUserId) {
        if (window.showLoginModal) {
            window.showLoginModal("comment on this");
        }
        return;
    }
    // ✅ Updated to include .answer-card
    const container = commentSubmitBtn.closest('[data-story-id], [data-post-id], [data-id], [data-answer-id], .story-card, .post-card, .answer-card');
    
    if (!container) {
        console.error('No container found for comment');
        showNotification('Unable to find post/story/answer', 'error');
        return;
    }

    // Extract ID from all possible locations
    const id = container.dataset.storyId || 
               container.dataset.postId || 
               container.dataset.answerId || // ✅ Added answerId
               container.dataset.id ||
               commentSubmitBtn.dataset.storyId ||
               commentSubmitBtn.dataset.postId ||
               commentSubmitBtn.dataset.answerId || // ✅ Added answerId
               commentSubmitBtn.dataset.id;
    
    if (!id) {
        console.error('Could not find ID for comment:', container);
        showNotification('Unable to comment on this item', 'error');
        return;
    }

    // Find the input element - check multiple selectors
    const inputSelectors = [
        `input[data-post-id="${id}"]`,
        `input[data-story-id="${id}"]`,
        `input[data-answer-id="${id}"]`, // ✅ Added answer selector
        `#commentInput-${id}`,
        `input.comment-input`,
        container.querySelector('.comment-input')
    ];
    
    let input = null;
    for (const selector of inputSelectors) {
        if (typeof selector === 'string') {
            input = document.querySelector(selector);
        } else {
            input = selector; // Already an element
        }
        if (input) break;
    }
    
    if (!input) {
        // Fallback: find any input in the same form/container
        input = container.querySelector('input[type="text"], textarea');
    }
    
    if (!input) {
        console.error('No input element found for ID:', id, container);
        showNotification('Unable to find comment input', 'error');
        return;
    }

    // Validate input
    const text = input.value.trim();
    if (!text) {
        showNotification('Comment cannot be empty.', 'error');
        input.focus();
        return;
    }

    // Clear input and disable button
    input.value = "";
    commentSubmitBtn.disabled = true;
    const originalText = commentSubmitBtn.textContent;
    commentSubmitBtn.textContent = "Posting...";

    try {
        // Determine Context: Story, Post, or Answer
        const isStory = container.classList.contains('story-card') || 
                        container.hasAttribute('data-story-id') ||
                        window.location.pathname.includes("love-stories");

        // ✅ NEW: Detect Answer Context
        const isAnswer = container.classList.contains('answer-card') || 
                         container.hasAttribute('data-answer-id');

        let url;
        if (isStory) {
            url = `${window.API_BASE}/stories/${id}/comments`;
        } else if (isAnswer) {
            // ✅ ROUTES TO THE NEW ANSWERS ENDPOINT
            url = `${window.API_BASE}/questions/answers/${id}/comments`;
        } else {
            // Default to Post
            url = `${window.API_BASE}/posts/${id}/comments`;
        }

        console.log(`📡 Comment request: ${url}`);

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ 
                text: text,
                content: text,  // Backend uses 'content'
                comment: text
            }),
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) {
            let errorMessage = `Server error (${res.status})`;
            try {
                const errorData = await res.json();
                console.error("Server error details:", errorData);
                
                errorMessage = errorData.message || 
                              errorData.error || 
                              errorData.detail || 
                              errorMessage;
                              
                if (errorData.errors) {
                    errorMessage = Object.values(errorData.errors).join(', ');
                }
            } catch (e) {
                errorMessage = res.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const result = await res.json();
        console.log('✅ Comment added:', result);

        // Update comment count
        const countSelectors = [
            `[data-story-id="${id}"] .comment-count`,
            `[data-post-id="${id}"] .comment-count`,
            `[data-answer-id="${id}"] .comment-count`, // ✅ Check answer count
            `[data-id="${id}"] .comment-count`,
            container.querySelector('.comment-count'),
            container.querySelector('.comment-btn span'),
            container.querySelector('.comment-toggle span')
        ];
        
        for (const selector of countSelectors) {
            const countElement = typeof selector === 'string' 
                ? document.querySelector(selector) 
                : selector;
            
            if (countElement) {
                const currentCount = parseInt(countElement.textContent) || 0;
                countElement.textContent = currentCount + 1;
                break;
            }
        }

        // Reload comments after a short delay
        setTimeout(() => {
            loadComments(id);
        }, 500);

        showNotification('Comment added successfully!', 'success');
        
        // Track analytics
        if (window.simpleStats?.trackComment) {
            const type = isStory ? 'story' : (isAnswer ? 'answer' : 'post');
            window.simpleStats.trackComment({ type, id });
        }

    } catch (err) {
        console.error("❌ Comment error:", err);
        
        if (input) input.value = text;
        
        if (err.name === 'AbortError') {
            showNotification('Request timeout. Please try again.', 'error');
        
        } else if (err.message.includes('400')) {
            showNotification(err.message || 'Invalid comment format.', 'error');
        } else if (err.message.includes('500')) {
            showNotification('Server error. Please try again later.', 'error');
        } else {
            showNotification(err.message || 'Failed to add comment.', 'error');
        }
    } finally {
        commentSubmitBtn.disabled = false;
        commentSubmitBtn.textContent = originalText;
    }
}

// ==============================================
// 5. LOAD COMMENTS (FIXED FOR POSTS, STORIES & ANSWERS)
// ==============================================
async function loadComments(id) {
    // Determine context: Story, Post, or Answer
    // ✅ Updated selector to look for answer IDs as well
    const container = document.querySelector(`[data-story-id="${id}"], [data-post-id="${id}"], [data-id="${id}"], [data-answer-id="${id}"]`);
    
    const isStory = container?.classList.contains('story-card') || 
                    container?.hasAttribute('data-story-id') ||
                    window.location.pathname.includes("love-stories");
    
    // ✅ ADDED: Detect Answer Context
    const isAnswer = container?.classList.contains('answer-card') || 
                     container?.hasAttribute('data-answer-id');
    
    const commentsList = document.getElementById(`comments-list-${id}`);
    
    if (!commentsList) {
        console.error('No comments list found for ID:', id);
        return;
    }

    commentsList.innerHTML = '<p style="text-align:center; padding: 10px;">Loading comments...</p>';

    try {
        // ✅ UPDATED: URL Selection Logic
        let url;
        if (isStory) {
            url = `${window.API_BASE}/stories/${id}/comments`;
        } else if (isAnswer) {
            // Backend: router.get("/answers/:id/comments")
            url = `${window.API_BASE}/questions/answers/${id}/comments`;
        } else {
            // Default to Post
            url = `${window.API_BASE}/posts/${id}/comments`;
        }

        console.log(`📡 Loading comments from: ${url}`);

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
        }
        
        const typeLabel = isStory ? 'story' : (isAnswer ? 'answer' : 'post');
        console.log(`Loaded ${comments.length} comments for ${typeLabel} ${id}`);

        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<p class="empty-state-comment">Be the first to comment! 💬</p>';
            return;
        }

        commentsList.innerHTML = comments.map(comment => {
            // Extract comment data
            const authorName = comment.author_name || 
                              comment.username || 
                              comment.user?.username || 
                              comment.author?.username ||
                              comment.user?.display_name ||
                              comment.author?.display_name ||
                              'Anonymous User';
            
            const avatar = getAvatarURL(
                comment.author_avatar_url || 
                comment.avatar_url || 
                comment.user?.avatar_url || 
                comment.author?.avatar_url
            );
            
            const commentDate = comment.created_at || comment.commented_at;
            const date = commentDate ? timeSince(new Date(commentDate)) : 'Recently';
            const text = comment.comment_text || comment.text || comment.content || comment.body || '';

            return `
                <div class="comment">
                    <img src="${avatar}" 
                         alt="${authorName}" 
                         class="comment-avatar" 
                         onerror="this.src='/images/default-avatar.png'" />
                    <div class="comment-content-wrapper">
                        <div class="comment-author-info">
                            <span class="comment-author-name">${authorName}</span>
                            <span class="comment-time">${date}</span>
                        </div>
                        <p class="comment-text">${text}</p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("❌ Error loading comments:", err);
        if (err.name === 'AbortError') {
            commentsList.innerHTML = '<p style="color:orange; text-align:center; padding: 20px;">Request timeout</p>';
        } else {
            commentsList.innerHTML = `
                <p style="color:red; text-align:center; padding: 20px;">
                    Failed to load comments<br>
                    <small>${err.message || 'Try again later'}</small>
                </p>
            `;
        }
    }
}

// ==============================================
// 6. FOLLOW HANDLER (ROBUST VERSION)
// ==============================================
async function handleFollow(followBtn) {
    // 🔐 LOGIN GATE - SIMPLE CHECK
    if (!window.currentUserId) {
        if (window.showLoginModal) {
            window.showLoginModal("follow this user");
        }
        return;
    }

    // ✅ ROBUST ID LOOKUP: Checks button first, then searches parents
    // This ensures it works inside Answer Cards, Question Headers, etc.
    const userId = followBtn.dataset.userId || 
                   followBtn.dataset.authorId || 
                   followBtn.closest('[data-user-id]')?.dataset.userId ||
                   followBtn.closest('[data-author-id]')?.dataset.authorId;
    
    if (!userId) {
        console.error("❌ Could not find user ID for follow action.");
        showNotification("Unable to follow user: missing user ID.", "error");
        return;
    }
    
    // Prevent self-follow
    if (parseInt(userId) === parseInt(window.currentUserId)) {
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

        // Add timeout to prevent hanging
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
        
        // Update ALL follow buttons for this user on the page
        // (Useful if the same user appears in multiple Answers or Comments)
        document.querySelectorAll(`[data-user-id="${userId}"], [data-author-id="${userId}"]`)
            .forEach(btn => {
                // Ensure we only update actual follow buttons, not container divs
                if(btn.classList.contains('follow-btn') || btn.classList.contains('follow-author-btn')) {
                    btn.classList.toggle('following', result.is_following);
                    btn.textContent = result.is_following ? 'Following' : '+ Follow';
                }
            });

        if (result.is_following) {
            showNotification(`You're now following this user!`, 'success');
        } else {
            showNotification(`Unfollowed user.`, 'success');
        }

    } catch (error) {
        console.error("❌ Follow toggle failed:", error);
        
        // Revert optimistic update on error
        followBtn.className = originalClass;
        followBtn.textContent = originalText;
        
        if (error.name === 'AbortError') {
            showNotification('Request timeout. Please check your connection.', 'error');
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            showNotification('Please log in to follow users.', 'error');
            
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

