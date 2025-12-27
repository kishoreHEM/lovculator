// ==============================================
// 🌍 Global Base URLs
// ==============================================

// 1. API Base
window.API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

// 2. ASSET Base
window.ASSET_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001" 
  : "https://lovculator.com"; 


// ==============================================
// 🔧 Utilities
// ==============================================

function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   
    .replace(/\s+/g, "-")       
    .replace(/-+/g, "-");       
}

// ✅ SECURITY: Prevent XSS attacks
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==============================================
// 1. DATA LAYER: LoveStoriesAPI Manager
// ==============================================
class LoveStoriesAPI {
  constructor() {
    this.apiBase = window.API_BASE;
    this.timeout = 10000;
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const headers = { ...options.headers };
    
    // Only set Content-Type to JSON if we are NOT sending a file (FormData)
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: options.method || "GET",
        headers: headers,
        credentials: "include",
        signal: controller.signal,
        body: options.body || null,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
      }

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

  async getStories(queryString = "") {
    return this.request(`/stories${queryString}`); 
  }

  async createStory(storyData) {
    const body = storyData instanceof FormData ? storyData : JSON.stringify(storyData);
    return this.request("/stories", {
      method: "POST",
      body: body,
    });
  }

  async deleteStory(storyId) {
    return this.request(`/stories/${storyId}`, { method: "DELETE" }); 
  }

  // ✅ NEW: Added method to handle likes
  async toggleLike(storyId) {
    return this.request(`/stories/${storyId}/like`, { method: "POST" });
  }
}

// ==============================================
// 2. CORE CLASS: LoveStories Manager
// ==============================================
class LoveStories {
    constructor() {
        this.api = new LoveStoriesAPI();
        this.stories = [];
        this.storiesContainer = document.getElementById('storiesContainer');
        this.loadMoreBtn = document.getElementById('loadMoreStories');
        this.init();
    }

    async init() {
        this.bindEvents();
    }

    async loadStories(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        try {
            const response = await this.api.request(`/stories?${queryString}`);
            this.stories = Array.isArray(response) ? response : (response.stories || []);
            document.dispatchEvent(new CustomEvent('storiesLoaded'));
        } catch (error) {
            this.stories = [];
            document.dispatchEvent(new CustomEvent('storiesLoaded'));
            throw error;
        }
    }

    bindEvents() {
        // Mood Filter Options
        const moodOptions = document.querySelectorAll('.mood-option');
        moodOptions.forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.mood-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                document.getElementById('selectedMood').value = option.dataset.mood;
            });
        });

        // ✅ NEW: Event Delegation for dynamic buttons (Likes, Delete)
        if (this.storiesContainer) {
            this.storiesContainer.addEventListener('click', (e) => {
                
                // 1. Handle Like Click
                const likeBtn = e.target.closest('.like-button');
                if (likeBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleLike(likeBtn);
                }

                // 2. Handle Delete Click
                const deleteBtn = e.target.closest('.delete-story-button');
                if (deleteBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const storyId = deleteBtn.dataset.id;
                    if(confirm("Are you sure you want to delete this story?")) {
                        this.handleDelete(storyId, deleteBtn);
                    }
                }
            });
        }
    }

    // ✅ NEW: Handle Real-time Like Updates
    async handleLike(btn) {
        const storyId = btn.dataset.id;
        const countSpan = btn.querySelector('.like-count');
        const svg = btn.querySelector('svg');
        
        // Check current state
        const isLiked = btn.classList.contains('liked');
        let currentCount = parseInt(countSpan.textContent || '0');

        // 1. Optimistic UI Update (Instant feedback)
        if (isLiked) {
            // Unlike
            btn.classList.remove('liked');
            countSpan.textContent = Math.max(0, currentCount - 1);
            // SVG styling for unliked
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
        } else {
            // Like
            btn.classList.add('liked');
            countSpan.textContent = currentCount + 1;
            // SVG styling for liked
            svg.setAttribute('fill', '#ff4b8d');
            svg.setAttribute('stroke', '#ff4b8d');
        }

        // 2. Send request to server
        try {
            const response = await this.api.toggleLike(storyId);
            
            // Sync with actual server count to be safe
            if (response && response.likes_count !== undefined) {
                countSpan.textContent = response.likes_count;
            }
        } catch (error) {
            console.error("Like failed:", error);
            // Revert changes if server fails
            btn.classList.toggle('liked');
            countSpan.textContent = currentCount; 
            
            // Revert SVG
            if (isLiked) {
                 svg.setAttribute('fill', '#ff4b8d');
                 svg.setAttribute('stroke', '#ff4b8d');
            } else {
                 svg.setAttribute('fill', 'none');
                 svg.setAttribute('stroke', 'currentColor');
            }

            if (window.showNotification) window.showNotification("Failed to like story", "error");
        }
    }

    // ✅ NEW: Handle Delete
    async handleDelete(storyId, btn) {
        try {
            await this.api.deleteStory(storyId);
            // Remove card from UI
            const card = btn.closest('.story-card');
            if(card) card.remove();
            
            // Update local array
            this.stories = this.stories.filter(s => s.id != storyId);
            
            if (window.showNotification) window.showNotification("Story deleted successfully", "success");
        } catch (error) {
            console.error("Delete failed:", error);
            if (window.showNotification) window.showNotification("Failed to delete story", "error");
        }
    }

    async addStory(storyData) {
        try {
            const newStory = await this.api.createStory(storyData);
            
            if (window.loveStoriesPage) {
                window.loveStoriesPage.applyFiltersAndSort();
            } else {
                 this.stories.unshift(newStory);
                 this.renderStories();
            }
            
            if (window.showNotification) {
                window.showNotification('Your love story has been shared! 🌍', 'success');
            }
            
            document.dispatchEvent(new CustomEvent('storyShared'));
            return newStory;
        } catch (error) {
            console.error('Error creating story:', error);
            if (window.showNotification) {
                window.showNotification('Failed to share story. ' + error.message, 'error');
            }
            throw error;
        }
    }

    renderStories() {
        if (!this.storiesContainer) return;
        if (window.loveStoriesPage) return; 

        if (this.stories.length === 0) {
            this.storiesContainer.innerHTML = this.getEmptyStateHTML();
            if (this.loadMoreBtn) this.loadMoreBtn.classList.add('hidden');
            return;
        }
        
        const storiesToShow = this.stories.slice(0, 10);
        this.storiesContainer.innerHTML = storiesToShow.map(story => this.getStoryHTML(story)).join('');

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
        const isLong = story.love_story && story.love_story.length > 300;

        // Security: Escape inputs
        const safeTitle = escapeHtml(story.story_title || "Untitled Story");
        const safeStory = escapeHtml(story.love_story || "");
        const safeAuthor = escapeHtml(story.anonymous_post ? "Anonymous User" : (story.author_display_name || story.author_username || "User"));
        const safeCouple = escapeHtml(story.couple_names || "");
        const safeCategory = escapeHtml(story.category || "");
        
        // Simple capitalization for mood
        const moodText = story.mood ? story.mood.charAt(0).toUpperCase() + story.mood.slice(1) : 'Beautiful Story';

        // Generate URL Slug
        const slug = slugify(story.story_title || 'story');
        const storyUrl = `/stories/${story.id}-${slug}`;

        let displayText = safeStory;
        if (isLong) {
            displayText = safeStory.substring(0, 300) + '...';
        }

        let imageHtml = '';
        if (story.image_url) {
            const imgUrl = story.image_url.startsWith('http') ? story.image_url : window.ASSET_BASE + story.image_url;
            imageHtml = `
            <div class="story-image-container" style="margin-bottom: 15px; border-radius: 8px; overflow: hidden;">
                <img src="${imgUrl}" alt="Story Image" 
                     onerror="this.style.display='none'" 
                     style="width: 100%; height: auto; display: block; max-height: 500px; object-fit: cover;">
            </div>`;
        }

        let coupleHtml = safeCouple ? `<div class="story-meta-row" style="margin-bottom: 5px; color: #666; font-weight: 500;">❤️ <strong>Couple:</strong> ${safeCouple}</div>` : '';
        let categoryHtml = safeCategory ? `<div class="story-meta-row" style="margin-bottom: 15px; display: inline-block; background: #fff0f5; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; color: #ff4b8d; font-weight: 600;">${safeCategory.charAt(0).toUpperCase() + safeCategory.slice(1)}</div>` : '';

        const authorAvatar = story.author_avatar_url || "/images/default-avatar.png"; 
        const isOwner = window.currentUserId && (parseInt(story.user_id) === parseInt(window.currentUserId));
        const canFollow = !story.anonymous_post && !isOwner && story.author_id;

        return `
        <div class="story-card" data-story-id="${story.id}" style="padding: 10px; background: white; border-radius: 0px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 1px;">
            <div class="story-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div class="story-user-info" style="display: flex; align-items: center; gap: 10px;">
                    <a href="/profile/${encodeURIComponent(story.author_username)}" class="story-user-link">
                        <img src="${authorAvatar}" alt="${safeAuthor}" onerror="this.src='/images/default-avatar.png'" class="story-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />
                    </a>
                    <div class="story-user-details">
                        <a href="/profile/${encodeURIComponent(story.author_username)}" class="story-username-link" style="text-decoration: none; color: inherit;">
                            <h4 class="story-username" style="margin: 0; font-size: 0.95rem;">${safeAuthor}</h4>
                        </a>
                        <span class="story-date" style="font-size: 0.8rem; color: #999;">${date}</span>
                    </div>
                </div>

                ${canFollow ? `
                    <button class="follow-author-btn ${story.is_following_author ? 'following' : ''}" 
                          data-user-id="${story.author_id}"
                          data-story-id="${story.id}">
                          ${story.is_following_author ? 'Following' : '+ Follow'}
                    </button>
                ` : ''}
            </div>
            
            ${imageHtml}
            
            <a href="${storyUrl}" style="text-decoration: none; color: inherit;">
                <h3 class="story-title" style="margin-top: 0; margin-bottom: 10px; font-size: 1.4rem; color: #333; cursor: pointer;">
                    ${safeTitle}
                </h3>
            </a>

            ${coupleHtml}
            ${categoryHtml}
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
            
            <div class="story-content ${isLong ? '' : 'expanded'}"
                 style="line-height: 1.6; color: #444; font-size: 1rem;">
                ${displayText}
            </div>

            ${isLong ? `
                <a href="${storyUrl}" class="read-more" style="color:#ff4b8d; font-weight:bold; text-decoration:none; display:block; margin-top:8px;">
                   Read Full Story →
                </a>
            ` : ''}
            
            <div class="story-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                <span class="story-mood" style="font-size: 0.85rem; color: #888;">${moodText}</span>
                
                <div class="story-actions" style="display: flex; gap: 15px;">
                    ${isOwner ? `
                        <button class="delete-story-button" data-id="${story.id}" title="Delete Story" style="background:none; border:none; cursor:pointer; color:#999;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    ` : ''}

                    <button class="story-action like-button ${story.user_liked ? 'liked' : ''}" data-id="${story.id}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${story.user_liked ? '#ff4b8d' : 'none'}" stroke="${story.user_liked ? '#ff4b8d' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                        </svg>
                        <span class="like-count">${story.likes_count || 0}</span>
                    </button>
                    
                    <button class="story-action comment-toggle" data-id="${story.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                        </svg>
                        <span>${story.comments_count || 0}</span>
                    </button>
                    
                    <button class="story-action share-action-toggle" 
                            data-share-url="${window.location.origin}${storyUrl}" 
                            data-share-title="${safeTitle}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        <span class="share-count">${story.shares_count || 0}</span>
                    </button>
                </div>
            </div>
            
            <div class="comments-section hidden" id="comments-${story.id}">
                <div class="comment-form">
                    <input type="text" class="comment-input" placeholder="Add a comment..." data-story-id="${story.id}">
                    <button class="comment-submit" data-story-id="${story.id}">Post</button>
                </div>
                <div class="comments-list" id="comments-list-${story.id}"></div>
            </div>
        </div>
    `;
    }

    getEmptyStateHTML() {
        return `
            <div class="empty-state" style="text-align:center; padding:40px; color:#666;">
                <div class="empty-icon" style="font-size:48px; margin-bottom:15px;">💌</div>
                <h3>No stories found</h3>
                <p>Try clearing your search filters or be the first to share one!</p>
            </div>
        `;
    }
}

// ==============================================
// 3. PAGE CLASS: LoveStoriesPage
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
        if (this.currentSearch) apiParams.search = this.currentSearch;
        if (this.currentCategory && this.currentCategory !== 'all') apiParams.category = this.currentCategory;

        this.isLoading = true;
        loadMoreBtn?.classList.add('hidden');
        
        if (this.loveStories.storiesContainer) {
            this.loveStories.storiesContainer.innerHTML = '<div class="loading-indicator" style="text-align:center; padding:20px;">Loading stories...</div>';
        }

        try {
            await this.loveStories.loadStories(apiParams);
            this.isLoading = false;
            this.updateStats(); 
            this.renderStories(); 
        } catch (error) {
            this.isLoading = false;
            if (this.loveStories.storiesContainer) {
                this.loveStories.storiesContainer.innerHTML = this.loveStories.getEmptyStateHTML();
            }
        }
    }

    sortStories(stories, sortBy) {
        const sorted = [...stories];
        switch (sortBy) {
            case 'newest': return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            case 'oldest': return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            case 'popular': return sorted.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
            case 'comments': return sorted.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
            default: return sorted;
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
        
        container.innerHTML = storiesToShow.map(story => this.loveStories.getStoryHTML(story)).join('');
        
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
        if(document.getElementById('totalStories')) document.getElementById('totalStories').textContent = stories.length;
        if(document.getElementById('totalLikes')) document.getElementById('totalLikes').textContent = stories.reduce((sum, story) => sum + (story.likes_count || 0), 0);
        if(document.getElementById('totalComments')) document.getElementById('totalComments').textContent = stories.reduce((sum, story) => sum + (story.comments_count || 0), 0);
    }
}

// ==============================================
// 5. GLOBAL INITIALIZATION
// ==============================================
function initializeLoveStories() {
    const loveStories = new LoveStories(); 
    
    // Page-specific components (Only if container exists)
    if (document.getElementById('storiesContainer')) {
        window.loveStoriesPage = new LoveStoriesPage(loveStories);
    }
    
    // Make it global
    window.loveStories = loveStories; 
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoveStories);
} else {
    initializeLoveStories();
}

// Get User ID (for ownership checks)
fetch(`${window.API_BASE}/auth/me`, { credentials: 'include' })
    .then(res => res.ok ? res.json() : null)
    .then(data => { window.currentUserId = data?.id || null; })
    .catch(() => { window.currentUserId = null; });