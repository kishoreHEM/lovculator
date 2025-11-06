// ==============================================
// 1. UTILITY CLASS: NotificationService
// ==============================================
class NotificationService {
    show(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Basic inline styles (recommend moving to CSS)
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
    showError(message) { this.show(message, 'error'); }
    showSuccess(message) { this.show(message, 'success'); }
}


// ==============================================
// 2. UTILITY CLASS: AnonUserTracker (For "1 like/comment per device")
// ==============================================
class AnonUserTracker {
    constructor() {
        this.STORAGE_KEY = 'lovculator_anon_id';
    }

    // Generates a simple, unique-enough ID 
    generateAnonId() {
        return 'anon-' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }

    getAnonId() {
        let anonId = localStorage.getItem(this.STORAGE_KEY);
        
        if (!anonId) {
            anonId = this.generateAnonId();
            localStorage.setItem(this.STORAGE_KEY, anonId);
            console.log('✨ New anonymous ID created.');
        }
        
        return anonId;
    }
}


// ==============================================
// 3. DATA LAYER: LoveStoriesAPI Manager (Final Version)
// ==============================================
class LoveStoriesAPI {
  constructor(anonTracker) {
    this.apiBase =
      window.location.hostname === "localhost"
        ? "http://localhost:3001/api"
        : "https://lovculator.com/api";

    this.timeout = 10000; // 10 seconds
    this.anonTracker = anonTracker;
  }

  // 🧩 Main API handler (robust, with cookies + timeouts)
  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Generate / get anonymous device ID
    let anonymousId;
    try {
      anonymousId =
        this.anonTracker?.getAnonId?.() ||
        "anonymous_" + Math.random().toString(36).substr(2, 9);
    } catch {
      anonymousId = "anonymous_fallback";
    }

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Anon-ID": anonymousId,
          ...options.headers,
        },
        credentials: "include", // ✅ Send session cookie for logged-in users
        signal: controller.signal,
        body: options.body || null,
      });

      clearTimeout(timeoutId);

      // --- Handle non-OK responses ---
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        // 401 Unauthorized → redirect user to login
        if (response.status === 401) {
          console.warn("⚠️ Unauthorized. Redirecting to login...");
          if (!window.location.pathname.includes("login")) {
            alert("Please log in to continue 💖");
            window.location.href = "/login.html";
          }
          throw new Error("Unauthorized: Please log in.");
        }

        if (response.status === 403 || response.status === 409) {
          // ✅ FIX: Prioritize error or message from server for clearer feedback
          const serverErrorMsg = errorData.error || errorData.message; 
          
          if (serverErrorMsg) {
              throw new Error(serverErrorMsg);
          }
          
          // Fallback message
          throw new Error(
            "Action not allowed on this device (already liked/commented) or unauthorized access."
          );
        }

        throw new Error(
          `HTTP error ${response.status}: ${
            errorData.error || errorData.message || "Unknown error"
          }`
        );
      }

      // --- Return parsed JSON or empty object ---
      return response.status === 204 ? {} : await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error("Request timeout – please check your connection");
      }

      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // 🧡 Fetch all stories
  async getStories(queryString = "") {
    // This method is now effectively deprecated, replaced by request('/stories?...')
    return this.request(`/stories${queryString}`); 
  }

  // 💌 Create a new story
  async createStory(storyData) {
    const required = ["storyTitle", "loveStory", "category", "mood"];
    const missing = required.filter((field) => !storyData[field]);
    if (missing.length > 0)
      throw new Error(`Missing required fields: ${missing.join(", ")}`);

    return this.request("/stories", {
      method: "POST",
      body: JSON.stringify(storyData),
    });
  }

  // ❤️ Toggle like on a story
  async toggleLike(storyId) {
    if (!storyId || isNaN(storyId)) throw new Error("Invalid story ID");
    return this.request(`/stories/${storyId}/like`, { method: "POST" });
  }

  // 💬 Add a comment
  async addComment(storyId, commentData) {
    if (!storyId || isNaN(storyId)) throw new Error("Invalid story ID");
    if (!commentData.text?.trim()) throw new Error("Comment text is required");

    const dataToSend = { text: commentData.text.trim() };
    return this.request(`/stories/${storyId}/comments`, {
      method: "POST",
      body: JSON.stringify(dataToSend),
    });
  }

  // 💭 Get comments
  async getComments(storyId) {
    if (!storyId || isNaN(storyId)) throw new Error("Invalid story ID");
    return this.request(`/stories/${storyId}/comments`);
  }

  // 📤 Track share click
  async trackShareClick(storyId) {
    if (!storyId || isNaN(storyId)) throw new Error("Invalid story ID");
    return this.request(`/stories/${storyId}/share`, { method: "POST" });
  }
  
  // 🗑️ NEW: Delete a story
  async deleteStory(storyId) {
    if (!storyId || isNaN(storyId)) throw new Error("Invalid story ID");
    // Sends the DELETE request to /api/stories/:storyId
    return this.request(`/stories/${storyId}`, { method: "DELETE" }); 
  }
  
  // 🚩 NEW: Report a story
  async reportStory(storyId, reportData) {
    if (!storyId || isNaN(storyId)) throw new Error("Invalid story ID");
    if (!reportData.reason) throw new Error("Report reason is required");
    return this.request(`/stories/${storyId}/report`, { 
        method: "POST",
        body: JSON.stringify(reportData)
    });
  }
} // End of LoveStoriesAPI class



// ==============================================
// 4. CORE CLASS: LoveStories Manager (Handles data/state and rendering logic)
// ==============================================
class LoveStories {
    constructor(notificationService, anonTracker) {
        this.api = new LoveStoriesAPI(anonTracker);
        this.notifications = notificationService;
        this.stories = []; // This array now holds the currently FILTERED stories from the server
        this.storiesContainer = document.getElementById('storiesContainer');
        this.loadMoreBtn = document.getElementById('loadMoreStories');
        this.init();
    }

    async init() {
        this.bindEvents(); 
        this.setupStoryDelegation(); 
    }

    // Binds the ONE-TIME event delegation listener to the parent container
    setupStoryDelegation() {
        if (!this.storiesContainer) return;

        this.storiesContainer.addEventListener('click', (e) => {
            const storyCard = e.target.closest('.story-card');
            if (!storyCard) return;

            const storyId = parseInt(storyCard.dataset.storyId);
            const target = e.target.closest('button'); 
            
            if (target) {
                if (target.classList.contains('read-more')) {
                    this.toggleReadMore(storyId);
                } else if (target.classList.contains('like-button')) {
                    this.toggleLike(storyId);
                } else if (target.classList.contains('comment-toggle')) {
                    this.toggleComments(storyId);
                } else if (target.classList.contains('comment-submit')) {
                    this.handleAddComment(storyId);
                } else if (target.classList.contains('share-action-toggle')) { // Native Share Logic
                    const { shareUrl, shareTitle, shareText } = target.dataset;
                    this.handleNativeShare(shareUrl, shareTitle, shareText);
                } else if (target.classList.contains('delete-story-button')) {
                    this.handleDeleteStory(storyId); // ⬅️ NEW DELETION LISTENER
                } else if (target.classList.contains('report-story-button')) {
                    this.openReportModal(storyId); // ⬅️ NEW REPORTING LISTENER
                }
            }
        });
        
        // Handle enter key in comment input
        this.storiesContainer.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
                const storyCard = e.target.closest('.story-card');
                if (storyCard) {
                    const storyId = parseInt(storyCard.dataset.storyId);
                    this.handleAddComment(storyId);
                }
            }
        });
    }

    // 🔄 UPDATED: loadStories now accepts filter/search params
    async loadStories(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        
        try {
            // Call the API with the query string (e.g., /stories?category=proposal&search=test)
            this.stories = await this.api.request(`/stories?${queryString}`);
            
            // Dispatch a generic event for external listeners
            document.dispatchEvent(new CustomEvent('storiesLoaded')); 
            
        } catch (error) {
            console.error('Error loading stories:', error);
            this.stories = [];
            document.dispatchEvent(new CustomEvent('storiesLoaded')); 
            throw error; // Re-throw so LoveStoriesPage can catch and display error
        }
    }

    bindEvents() {
        // Mood selection
        document.querySelectorAll('.mood-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.mood-option').forEach(opt => 
                    opt.classList.remove('selected'));
                option.classList.add('selected');
                document.getElementById('selectedMood').value = 
                    option.dataset.mood;
            });
        });
    }

    async addStory(storyData) {
        try {
            const newStory = await this.api.createStory(storyData);
            
            // After adding, we need to refresh the list, triggering a new API call
            if (window.loveStoriesPage) {
                window.loveStoriesPage.applyFiltersAndSort(); // Triggers a full list reload
            } else {
                 // Fallback: If page controller not loaded, unshift and manually rerender
                 this.stories.unshift(newStory);
                 this.renderStories();
            }
            
            window.simpleStats?.trackStory();
            this.notifications.showSuccess('Your love story has been shared with everyone! 🌍');
            document.dispatchEvent(new CustomEvent('storyShared'));
            
            return newStory;
        } catch (error) {
            console.error('Error creating story:', error);
            this.notifications.showError('Failed to share story. ' + error.message);
            throw error;
        }
    }

    // This method is a fallback/helper now; LoveStoriesPage controls rendering
    renderStories() {
        if (!this.storiesContainer) return;
        
        if (window.loveStoriesPage) return; 

        if (this.stories.length === 0) {
            this.storiesContainer.innerHTML = this.getEmptyStateHTML();
            if (this.loadMoreBtn) this.loadMoreBtn.classList.add('hidden');
            return;
        }
        
        const storiesToShow = this.stories.slice(0, 10);
        
        this.storiesContainer.innerHTML = storiesToShow.map(story => 
            this.getStoryHTML(story)).join('');

        if (this.loadMoreBtn) {
            if (this.stories.length > storiesToShow.length) {
                this.loadMoreBtn.classList.remove('hidden');
            } else {
                this.loadMoreBtn.classList.add('hidden');
            }
        }
    }

    getStoryHTML(story) {
        const date = new Date(story.created_at).toLocaleDateString();
        const isLong = story.love_story.length > 200;

        const shareUrl = `https://lovculator.com/stories/${story.id}`; 
        const shareTitle = story.story_title;
        const shareText = `Read this beautiful love story: ${story.story_title}`;
        
        // Conditional check for deletion button
        const isOwner = window.currentUserId && story.user_id === window.currentUserId;

        return `
            <div class="story-card" data-story-id="${story.id}">
                <div class="story-card-header">
                    <div class="story-couple">
                        <h4>${story.anonymous_post ? 'Anonymous Couple' : story.couple_names}</h4>
                        <div class="story-meta">
                            <span>${date}</span>
                            ${story.together_since ? `<span>•</span><span>Together since ${story.together_since}</span>` : ''}
                        </div>
                    </div>
                    <span class="story-category">${this.getCategoryEmoji(story.category)} ${this.formatCategory(story.category)}</span>
                </div>
                
                <h3 class="story-title">${story.story_title}</h3>
                
                <div class="story-content ${isLong ? '' : 'expanded'}">
                    ${isLong ? story.love_story.substring(0, 200) + '...' : story.love_story}
                </div>
                
                ${isLong ? `<button class="read-more">Read More</button>` : ''}
                
                <div class="story-footer">
                    <span class="story-mood">${this.getMoodText(story.mood)}</span>
                    <div class="story-actions">
                        
                        ${isOwner ? `
                            <button class="delete-story-button" title="Delete Story">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        ` : ''}

                        <button class="story-action like-button ${story.user_liked ? 'liked' : ''}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${story.user_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="like-icon">
                                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                            </svg>
                            <span class="like-count">${story.likes_count}</span>
                        </button>
                        
                        <button class="story-action comment-toggle">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="comment-icon">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            <span>${story.comments_count}</span>
                        </button>
                        
                        <button class="story-action share-action-toggle" 
                                data-share-url="${shareUrl}" 
                                data-share-title="${shareTitle}"
                                data-share-text="${shareText}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="share-icon">
                                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                <polyline points="16 6 12 2 8 6"></polyline>
                                <line x1="12" y1="2" x2="12" y2="15"></line>
                            </svg>
                            <span class="share-count">${story.shares_count || 0}</span>
                        </button>

                        <button class="story-action report-story-button" title="Report Inappropriate Content">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flag-icon"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                        </button>
                    </div>
                </div>
                
                ${story.allow_comments ? `
                    <div class="comments-section hidden" id="comments-${story.id}">
                        <div class="comment-form">
                            <input type="text" class="comment-input" placeholder="Add a comment..." 
                                   data-story-id="${story.id}">
                            <button class="comment-submit">Post</button>
                        </div>
                        <div class="comments-list" id="comments-list-${story.id}">
                            </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">💌</div>
                <h3>No stories found</h3>
                <p>Try clearing your search filters or be the first to share one!</p>
                <button class="fab-button" id="emptyStateFab">
                    <span class="fab-icon">+</span>
                </button>
            </div>
        `;
    }
    
    toggleReadMore(storyId) {
        const story = this.stories.find(s => s.id === storyId); 
        if (!story) return;
        
        const storyCard = document.querySelector(`[data-story-id="${storyId}"]`);
        const contentEl = storyCard?.querySelector('.story-content');
        const buttonEl = storyCard?.querySelector('.read-more');

        if (contentEl && buttonEl) {
            if (contentEl.classList.contains('expanded')) {
                contentEl.classList.remove('expanded');
                contentEl.textContent = story.love_story.substring(0, 200) + '...';
                buttonEl.textContent = 'Read More';
            } else {
                contentEl.classList.add('expanded');
                contentEl.textContent = story.love_story;
                buttonEl.textContent = 'Read Less';
            }
        }
    }

    async toggleLike(storyId) {
    try {
        const result = await this.api.toggleLike(storyId); 
        
        const storyIndex = this.stories.findIndex(s => s.id === storyId);
        if (storyIndex !== -1) {
            this.stories[storyIndex].likes_count = result.likes_count; 
            this.stories[storyIndex].user_liked = result.is_liked; 
            
            if (result.is_liked) {
                 this.notifications.showSuccess('Story Liked! ❤️');
                 window.simpleStats?.trackLike();
            } else {
                 this.notifications.showSuccess('Story Unliked. 💔');
            }
        }
        
        if (window.loveStoriesPage) {
            window.loveStoriesPage.renderStories(); 
            window.loveStoriesPage.updateStats();
        } else {
            this.renderStories(); 
        }

        } catch (error) {
            console.error('Error toggling like:', error);
            this.notifications.showError('Failed to update like: ' + error.message);
        }
    }

    toggleComments(storyId) {
        const commentsSection = document.getElementById(`comments-${storyId}`);
        if (commentsSection) {
            commentsSection.classList.toggle('hidden');
            
            if (!commentsSection.classList.contains('hidden')) {
                this.loadComments(storyId);
            }
        }
    }

    async loadComments(storyId) {
    try {
        const comments = await this.api.getComments(storyId);
        const commentsList = document.getElementById(`comments-list-${storyId}`);
        if (commentsList) {
            commentsList.innerHTML = comments.map(comment => `
                <div class="comment">
                    <div class="comment-author">${comment.author_name || 'Anonymous User'}</div>
                    <div class="comment-text">${comment.comment_text}</div>
                    <div class="comment-time">${new Date(comment.created_at).toLocaleDateString()}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading comments:', error);
        this.notifications.showError('Failed to load comments.');
    }
}

    async handleAddComment(storyId) {
    const storyCard = document.querySelector(`[data-story-id="${storyId}"]`);
    if (!storyCard) return;

    const input = storyCard.querySelector('.comment-input');
    const text = input?.value.trim();
    
    if (text) {
        try {
            const result = await this.api.addComment(storyId, { text: text });

            const storyIndex = this.stories.findIndex(s => s.id === storyId);
            if (storyIndex !== -1) {
                this.stories[storyIndex].comments_count = result.comments_count;
            }

            window.simpleStats?.trackComment();
            
            this.loadComments(storyId);
            if (window.loveStoriesPage) {
                window.loveStoriesPage.renderStories();
                window.loveStoriesPage.updateStats();
            } else {
                this.renderStories();
            }
            
            input.value = '';
            this.notifications.showSuccess('Comment added!');
        } catch (error) {
            console.error('Error adding comment:', error);
            this.notifications.showError('Failed to add comment: ' + error.message);
        }
    }
}
    
    updateShareCountUI(storyId, count) {
        const storyCard = document.querySelector(`[data-story-id="${storyId}"]`);
        const countEl = storyCard?.querySelector('.share-count');
        if (countEl) {
            countEl.textContent = count;
        }
    }

    async handleNativeShare(url, title, text) {
        
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
                    this.notifications.showError('Failed to share story.');
                }
            }
        } else {
            this.notifications.showError('Native sharing not supported. Please use a mobile device or copy the URL.');
        }

        if (shareAttempted || !navigator.share) { 
            try {
                const storyId = parseInt(url.split('/').pop()); 
                if (isNaN(storyId)) throw new Error("Could not parse story ID for tracking.");
                
                const result = await this.api.trackShareClick(storyId);

                const storyIndex = this.stories.findIndex(s => s.id === storyId);
                if (storyIndex !== -1) {
                    this.stories[storyIndex].shares_count = result.shares_count;
                }

                this.updateShareCountUI(storyId, result.shares_count);
                window.simpleStats?.trackShare();

            } catch (error) {
                console.error('Error tracking share click:', error);
            }
        }
    }
    
    // 🗑️ NEW: Client-side logic for story deletion
    async handleDeleteStory(storyId) {
        if (!confirm("Are you sure you want to permanently delete this story? This action cannot be undone.")) {
            return;
        }

        try {
            // Call the API endpoint
            await this.api.deleteStory(storyId);
            
            // Remove the story from the frontend list
            const storyIndex = this.stories.findIndex(s => s.id === storyId);
            if (storyIndex !== -1) {
                this.stories.splice(storyIndex, 1);
            }

            // Re-render the page
            if (window.loveStoriesPage) {
                window.loveStoriesPage.renderStories();
                window.loveStoriesPage.updateStats();
            } else {
                this.renderStories();
            }

            this.notifications.showSuccess('Story deleted successfully. 🗑️');
            
        } catch (error) {
            console.error('Error deleting story:', error);
            this.notifications.showError('Failed to delete story: ' + (error.message || 'Check permissions or try again.'));
        }
    }

    // 🚩 NEW: Placeholder for opening the report modal (UI to be built)
    openReportModal(storyId) {
        // NOTE: This will require a new StoryReportModal class or similar UI logic.
        this.notifications.show('Reporting feature is coming soon! Story ID: ' + storyId, 'error');
        console.log(`Open report modal for story ${storyId}`);
        // For now, you could launch a simple prompt for testing:
        /*
        const reason = prompt("Enter a reason for reporting this story:");
        if (reason) {
            this.api.reportStory(storyId, { reason, description: "Via simple prompt" })
                .then(() => this.notifications.showSuccess('Report submitted!'))
                .catch(e => this.notifications.showError('Report failed: ' + e.message));
        }
        */
    }

    loadMoreStories() {
        // Handled by LoveStoriesPage
    }
    
    // Helper methods for category/mood display
    getCategoryEmoji(category) {
        const emojis = { romantic: '💖', proposal: '💍', journey: '🛤️', challenge: '🛡️', special: '🌟', longdistance: '✈️', secondchance: '🔁' };
        return emojis[category] || '💕';
    }
    formatCategory(category) {
        const formats = { romantic: 'Romantic Moment', proposal: 'Marriage Proposal', journey: 'Love Journey', challenge: 'Overcoming Challenges', special: 'Special Memory', longdistance: 'Long Distance Love', secondchance: 'Second Chance' };
        return formats[category] || 'Love Story';
    }
    getMoodText(mood) {
        const texts = { romantic: 'Heartwarming romance', emotional: 'Deep emotions', funny: 'Funny and sweet', inspiring: 'Inspiring journey', dramatic: 'Dramatic love story' };
        return texts[mood] || 'Beautiful story';
    }
}


// ==============================================
// 5. UI CLASS: StoryModal (Handles the story submission form)
// ==============================================
class StoryModal {
    constructor(loveStoriesInstance, notificationService) {
        this.loveStories = loveStoriesInstance;
        this.notifications = notificationService;
        this.storyFab = document.getElementById('storyFab');
        this.storyModal = document.getElementById('storyModal');
        this.closeModal = document.getElementById('closeModal');
        this.storyForm = document.getElementById('storyForm');
        this.successMessage = document.getElementById('successMessage');
        this.successOk = document.getElementById('successOk');
        this.loveStory = document.getElementById('loveStory');
        this.charCounter = document.getElementById('charCounter');
        
        this.init();
    }

    init() {
        if (!this.storyFab || !this.storyModal) return;

        this.storyFab.addEventListener('click', (e) => this.openModal(e));
        this.closeModal.addEventListener('click', () => this.closeModalFunc());
        this.storyModal.addEventListener('click', (e) => {
            if (e.target === this.storyModal) this.closeModalFunc();
        });

        if (this.loveStory && this.charCounter) {
            this.loveStory.addEventListener('input', () => this.updateCharCounter());
        }

        if (this.storyForm) {
            this.storyForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.successOk) {
            this.successOk.addEventListener('click', () => this.closeSuccessMessage());
        }

        if (this.successMessage) {
            this.successMessage.addEventListener('click', (e) => {
                if (e.target === this.successMessage) this.closeSuccessMessage();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModalFunc();
                this.closeSuccessMessage();
            }
        });
    }

    openModal(e) {
        if (e) e.preventDefault();
        this.storyModal.classList.remove('hidden');
        this.storyModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('coupleNames')?.focus(), 100);
        this.previousActiveElement = document.activeElement;
        this.resetMoodSelection();
    }

    closeModalFunc() {
        this.storyModal.classList.add('hidden');
        this.storyModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (this.previousActiveElement) this.previousActiveElement.focus();
    }

    updateCharCounter() {
        const count = this.loveStory.value.length;
        this.charCounter.textContent = count;
        
        if (count > 900) {
            this.charCounter.classList.add('warning');
        } else {
            this.charCounter.classList.remove('warning');
        }
        
        if (count > 1000) {
            this.loveStory.value = this.loveStory.value.substring(0, 1000);
            this.charCounter.textContent = '1000';
            this.charCounter.classList.add('warning');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const submitBtn = this.storyForm.querySelector('.submit-story-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        submitBtn.disabled = true;

        const formData = {
            coupleNames: document.getElementById('coupleNames').value,
            storyTitle: document.getElementById('storyTitle').value,
            togetherSince: document.getElementById('togetherSince').value,
            loveStory: this.loveStory.value,
            category: document.getElementById('storyCategory').value,
            mood: document.getElementById('selectedMood').value,
            allowComments: document.getElementById('allowComments').checked,
            anonymousPost: document.getElementById('anonymousPost').checked
        };

        try {
            await this.loveStories.addStory(formData);
            
            this.closeModalFunc();
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Error submitting story:', error);
            this.notifications.showError('Failed to share story. ' + error.message);
        } finally {
            this.resetForm();
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    showSuccessMessage() {
        if (this.successMessage) {
            this.successMessage.classList.remove('hidden');
            this.successMessage.setAttribute('aria-hidden', 'false');
        }
    }

    closeSuccessMessage() {
        if (this.successMessage) {
            this.successMessage.classList.add('hidden');
            this.successMessage.setAttribute('aria-hidden', 'true');
        }
    }

    resetForm() {
        if (this.storyForm) this.storyForm.reset();
        if (this.charCounter) {
            this.charCounter.textContent = '0';
            this.charCounter.classList.remove('warning');
        }
    }

    resetMoodSelection() {
        document.querySelectorAll('.mood-option').forEach(opt => 
            opt.classList.remove('selected'));
        const firstMood = document.querySelector('.mood-option');
        if (firstMood) {
            firstMood.classList.add('selected');
            document.getElementById('selectedMood').value = firstMood.dataset.mood || 'romantic';
        }
    }
}


// ==============================================
// 6. PAGE CLASS: LoveStoriesPage (Handles list view, filtering, sorting, stats)
// ==============================================
class LoveStoriesPage {
    constructor(loveStoriesInstance) {
        this.loveStories = loveStoriesInstance; 
        this.currentCategory = 'all'; 
        this.currentSearch = ''; 
        this.currentSort = 'newest';
        this.currentPage = 1;
        this.storiesPerPage = 10;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.applyFiltersAndSort();
    }

    bindEvents() {
        const searchInput = document.getElementById('storySearchInput');
        const filterSelect = document.getElementById('categoryFilterSelect');
        const applyBtn = document.getElementById('applyFiltersBtn');

        if (applyBtn) {
            applyBtn.addEventListener('click', this.applyFiltersAndSort.bind(this));
        }

        if (filterSelect) {
            filterSelect.addEventListener('change', this.applyFiltersAndSort.bind(this));
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyFiltersAndSort();
                }
            });
        }

        document.getElementById('sortStories')?.addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.renderStories(); 
        });

        document.getElementById('loadMoreStories')?.addEventListener('click', () => {
            this.loadMoreStories();
        });
    }

    async applyFiltersAndSort() {
        const searchInput = document.getElementById('storySearchInput');
        const filterSelect = document.getElementById('categoryFilterSelect');
        const loadMoreBtn = document.getElementById('loadMoreStories');

        this.currentSearch = searchInput ? searchInput.value.trim() : '';
        this.currentCategory = filterSelect ? filterSelect.value : 'all';
        this.currentPage = 1;

        const apiParams = {};
        if (this.currentSearch) {
            apiParams.search = this.currentSearch;
        }
        if (this.currentCategory && this.currentCategory !== 'all') {
            apiParams.category = this.currentCategory;
        }

        this.isLoading = true;
        loadMoreBtn?.classList.add('hidden');
        this.loveStories.storiesContainer.innerHTML = '<div class="loading-indicator">Loading stories...</div>';

        try {
            await this.loveStories.loadStories(apiParams);
            
            this.isLoading = false;
            this.updateStats(); 
            this.renderStories(); 
            
        } catch (error) {
            this.isLoading = false;
            this.loveStories.notifications.showError('Failed to load stories with the current filters.');
            this.loveStories.storiesContainer.innerHTML = this.loveStories.getEmptyStateHTML();
        }
    }

    sortStories(stories, sortBy) {
        switch (sortBy) {
            case 'newest':
                return [...stories].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            case 'oldest':
                return [...stories].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            case 'popular':
                return [...stories].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
            case 'comments':
                return [...stories].sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
            default:
                return stories;
        }
    }

    renderStories() {
        const container = document.getElementById('storiesContainer');
        const loadMoreBtn = document.getElementById('loadMoreStories');
        
        if (!container) return;

        const storiesToRenderFrom = this.loveStories.stories;
        const sortedStories = this.sortStories(storiesToRenderFrom, this.currentSort);

        if (sortedStories.length === 0 && !this.isLoading) {
            container.innerHTML = this.loveStories.getEmptyStateHTML();
            loadMoreBtn?.classList.add('hidden');
            return;
        }

        const storiesToShow = sortedStories.slice(0, this.currentPage * this.storiesPerPage);
        
        container.innerHTML = storiesToShow.map(story => 
            this.loveStories.getStoryHTML(story)
        ).join('');
        
        if (loadMoreBtn) {
            if (sortedStories.length > storiesToShow.length) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }
    }

    loadMoreStories() {
        this.currentPage++;
        this.renderStories();
    }

    updateStats() {
        const stories = this.loveStories.stories; 
        
        const totalStories = stories.length; 
        const totalLikes = stories.reduce((sum, story) => sum + (story.likes_count || 0), 0);
        const totalComments = stories.reduce((sum, story) => sum + (story.comments_count || 0), 0);

        if(document.getElementById('totalStories')) {
            document.getElementById('totalStories').textContent = totalStories;
        }
        if(document.getElementById('totalLikes')) {
            document.getElementById('totalLikes').textContent = totalLikes;
        }
        if(document.getElementById('totalComments')) {
            document.getElementById('totalComments').textContent = totalComments;
        }
    }
}


// ==============================================
// 7. UTILITY CLASS: ThemeManager (New for Dark Mode)
// ==============================================
class ThemeManager {
    constructor() {
        this.storageKey = 'lovculator_theme';
        this.toggle = document.getElementById('darkModeToggle');
        this.init();
    }

    init() {
        const savedTheme = localStorage.getItem(this.storageKey);
        
        let initialDarkMode = false;
        
        if (savedTheme === 'dark') {
            initialDarkMode = true;
        } else if (savedTheme === null && window.matchMedia) {
            // Check system preference if no preference is saved
            initialDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        // Apply the initial theme
        if (initialDarkMode) {
            document.body.classList.add('dark-mode');
            if (this.toggle) {
                this.toggle.checked = true;
            }
        }
        
        // Bind the event listener
        if (this.toggle) {
            this.toggle.addEventListener('change', this.toggleTheme.bind(this));
        }
    }

    toggleTheme() {
        if (document.body.classList.toggle('dark-mode')) {
            // Theme switched to dark
            localStorage.setItem(this.storageKey, 'dark');
        } else {
            // Theme switched to light
            localStorage.setItem(this.storageKey, 'light');
        }
    }
}


// ==============================================
// 8. GLOBAL INITIALIZATION (CORRECTED)
// ==============================================
let loveStories, storyModal, notificationService, anonTracker, loveStoriesPage, themeManager;

function initializeLoveStories() {
    try {
        const storiesContainer = document.getElementById('storiesContainer');
        const storyFab = document.getElementById('storyFab');
        
        // Core Utilities - Initialize FIRST
        notificationService = new NotificationService();
        anonTracker = new AnonUserTracker(); 
        
        // Theme Manager - Initialize before all else to apply theme quickly
        if (document.getElementById('darkModeToggle')) {
            themeManager = new ThemeManager();
            window.themeManager = themeManager;
        }
        
        // Data/State Manager
        loveStories = new LoveStories(notificationService, anonTracker); 
        
        // UI Components
        if (storiesContainer) {
            loveStoriesPage = new LoveStoriesPage(loveStories); 
            window.loveStoriesPage = loveStoriesPage; 
        }

        if (storyFab) {
            storyModal = new StoryModal(loveStories, notificationService); 
        }
        
        window.loveStories = loveStories; 
        
    } catch (error) {
        console.error('❌ Error initializing Lovculator system:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoveStories);
} else {
    initializeLoveStories();
}