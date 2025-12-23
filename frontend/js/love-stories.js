// ==============================================
// 🌍 Global Base URLs
// ==============================================

// 1. API Base (For JSON endpoints)
window.API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

// 2. ASSET Base (For static files like Avatars)
window.ASSET_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001" 
  : "https://lovculator.com"; 


// ==============================================
// 🔧 Utility: Slugify helper
// ==============================================
function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")   // remove special chars
    .replace(/\s+/g, "-")       // spaces to hyphen
    .replace(/-+/g, "-");       // collapse multiple hyphens
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
}

// ==============================================
// 2. CORE CLASS: LoveStories Manager (RENDERING ONLY)
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

            this.stories = Array.isArray(response)
              ? response
              : Array.isArray(response.stories)
                  ? response.stories
                  : [];

            document.dispatchEvent(new CustomEvent('storiesLoaded'));
        } catch (error) {
            this.stories = [];
            document.dispatchEvent(new CustomEvent('storiesLoaded'));
            throw error;
        }
    }

    bindEvents() {
        const moodOptions = document.querySelectorAll('.mood-option');
        moodOptions.forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.mood-option')
                    .forEach(opt => opt.classList.remove('selected'));

                option.classList.add('selected');
                document.getElementById('selectedMood').value =
                    option.dataset.mood;
            });
        });
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
            
            window.simpleStats?.trackStory();
            
            if (window.showNotification) {
                window.showNotification('Your love story has been shared with everyone! 🌍', 'success');
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

    // Story HTML template method - REARRANGED LAYOUT
getStoryHTML(story) {
    const date = new Date(story.created_at).toLocaleDateString();
    const isLong = story.love_story && story.love_story.length > 300;

    // SIMPLIFIED: Use a safer approach
    const shareUrl = `https://lovculator.com/stories/${story.id}-${slugify(story.story_title || 'love-story')}`;
 
    const shareTitle = story.story_title || "Love Story";
    const shareText = `Read this beautiful love story: ${story.story_title || "Love Story"}`;
    
    const authorName = story.anonymous_post
      ? "Anonymous User"
      : story.author_display_name || story.author_username || "User";

    const authorUsername = story.author_username || '';
    const authorAvatar = story.author_avatar_url || "/images/default-avatar.png"; 
    
    const ownerId = story.user_id; 
    const isOwner = window.currentUserId && ownerId === window.currentUserId;
    const canFollow = !story.anonymous_post && !isOwner && story.author_id;
    const isFollowing = story.is_following_author;

    // Handle story text safely
    let storyText = story.love_story || "";
    let displayText = storyText;
    
    if (isLong) {
        displayText = storyText.substring(0, 300) + '...';
    }

    // 1. IMAGE (Top)
    let imageHtml = '';
    if (story.image_url) {
        imageHtml = `
        <div class="story-image-container" style="margin-bottom: 15px; border-radius: 8px; overflow: hidden;">
            <img src="${story.image_url}" alt="Story Image" style="width: 100%; height: auto; display: block; max-height: 500px; object-fit: cover;">
        </div>`;
    }

    // Creates a clean URL: /stories/15-the-story-title
const slug = slugify(story.story_title || 'story');
const storyUrl = `/stories/${story.id}-${slug}`;

const titleHtml = `
  <a href="${storyUrl}" style="text-decoration: none; color: inherit;">
      <h3 class="story-title" style="margin-top: 0; margin-bottom: 10px; font-size: 1.4rem; color: #333; cursor: pointer;">
          ${story.story_title || "Untitled Story"}
      </h3>
  </a>`;

    // 3. BOTH NAMES
    let coupleNamesHtml = '';
    if (story.couple_names) {
        coupleNamesHtml = `<div class="story-meta-row" style="margin-bottom: 5px; color: #666; font-weight: 500;">
            ❤️ <strong>Couple:</strong> ${story.couple_names}
        </div>`;
    }

    // 4. TOGETHER SINCE
    let togetherSinceHtml = '';
    if (story.together_since) {
         const togetherDate = new Date(story.together_since).toLocaleDateString();
         togetherSinceHtml = `<div class="story-meta-row" style="margin-bottom: 5px; color: #666; font-size: 0.95rem;">
            📅 <strong>Together Since:</strong> ${togetherDate}
         </div>`;
    }

    // 5. CATEGORY
    let categoryHtml = '';
    if (story.category) {
        const catDisplay = story.category.charAt(0).toUpperCase() + story.category.slice(1);
        categoryHtml = `<div class="story-meta-row" style="margin-bottom: 15px; display: inline-block; background: #fff0f5; padding: 4px 12px; border-radius: 15px; font-size: 0.85rem; color: #ff4b8d; font-weight: 600;">
            ${catDisplay}
        </div>`;
    }

    // 6. LOVE STORY CONTENT (PREVIEW ONLY)
const contentHtml = `
  <div class="story-content ${isLong ? '' : 'expanded'}"
       style="white-space: pre-line; line-height: 1.6; color: #444; font-size: 1rem;">
    ${displayText}
  </div>

  ${isLong ? `
    <a href="/stories/${story.id}-${slugify(story.story_title || 'love-story')}"
       class="read-more"
       style="color:#ff4b8d; font-weight:bold; text-decoration:none;">
       Read Full Story →
    </a>
  ` : ''}
`;


    return `
    <div class="story-card" data-story-id="${story.id}" style="padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); margin-bottom: 20px;">
        <div class="story-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div class="story-user-info" style="display: flex; align-items: center; gap: 10px;">
                <a href="/profile/${encodeURIComponent(authorUsername)}" class="story-user-link">
                    <img src="${authorAvatar}" alt="${authorName}" class="story-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />
                </a>
                <div class="story-user-details">
                    <a href="/profile/${encodeURIComponent(authorUsername)}" class="story-username-link" style="text-decoration: none; color: inherit;">
                        <h4 class="story-username" style="margin: 0; font-size: 0.95rem;">${authorName}</h4>
                    </a>
                    <span class="story-date" style="font-size: 0.8rem; color: #999;">${date}</span>
                </div>
            </div>

            ${canFollow ? `
                <button class="follow-btn ${isFollowing ? 'following' : ''}" 
                      data-user-id="${story.author_id}"
                      data-story-id="${story.id}">
                      ${isFollowing ? 'Following' : '+ Follow'}
                </button>
            ` : ''}
        </div>
        
        ${imageHtml}
        ${titleHtml}
        ${coupleNamesHtml}
        ${togetherSinceHtml}
        ${categoryHtml}
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 10px 0;">
        
        ${contentHtml}
        
        <div class="story-footer" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
            <span class="story-mood" style="font-size: 0.85rem; color: #888;">${this.getMoodText(story.mood)}</span>
            <div class="story-actions" style="display: flex; gap: 15px;">
                
                ${isOwner ? `
                    <button class="delete-story-button" title="Delete Story">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                ` : ''}

                <button class="story-action like-button ${story.user_liked ? 'liked' : ''}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${story.user_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="like-icon">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                    <span class="like-count">${story.likes_count || 0}</span>
                </button>
                
                <button class="story-action comment-toggle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="comment-icon">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                    </svg>
                    <span>${story.comments_count || 0}</span>
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

                <button class="story-action report-story-button" title="Report">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flag-icon"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                </button>
            </div>
        </div>
        
        <div class="comments-section hidden" id="comments-${story.id}">
            <div class="comment-form">
                <input type="text" class="comment-input" placeholder="Add a comment..." 
                       data-story-id="${story.id}">
                <button class="comment-submit">Post</button>
            </div>
            <div class="comments-list" id="comments-list-${story.id}">
                </div>
        </div>
    </div>
`;
}
    getEmptyStateHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">💌</div>
                <h3>No stories found</h3>
                <p>Try clearing your search filters or be the first to share one!</p>
            </div>
        `;
    }

    getMoodText(mood) {
        const texts = { romantic: 'Heartwarming romance', emotional: 'Deep emotions', funny: 'Funny and sweet', inspiring: 'Inspiring journey', dramatic: 'Dramatic love story' };
        return texts[mood] || 'Beautiful story';
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
        if (this.currentSearch) {
            apiParams.search = this.currentSearch;
        }
        if (this.currentCategory && this.currentCategory !== 'all') {
            apiParams.category = this.currentCategory;
        }

        this.isLoading = true;
        loadMoreBtn?.classList.add('hidden');
        if (this.loveStories.storiesContainer) {
            this.loveStories.storiesContainer.innerHTML = '<div class="loading-indicator">Loading stories...</div>';
        }

        try {
            await this.loveStories.loadStories(apiParams);
            
            this.isLoading = false;
            this.updateStats(); 
            this.renderStories(); 
            
        } catch (error) {
            this.isLoading = false;
            if (window.showNotification) {
                window.showNotification('Failed to load stories with the current filters.', 'error');
            }
            if (this.loveStories.storiesContainer) {
                this.loveStories.storiesContainer.innerHTML = this.loveStories.getEmptyStateHTML();
            }
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
// 5. GLOBAL INITIALIZATION
// ==============================================
function initializeLoveStories() {
    // Theme Manager
    const themeToggle = document.getElementById('darkModeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', () => document.body.classList.toggle('dark-mode'));
    }
    
    // Core Stories Manager
    const loveStories = new LoveStories(); 
    
    // Page-specific components (Only if container exists)
    if (document.getElementById('storiesContainer')) {
        window.loveStoriesPage = new LoveStoriesPage(loveStories);
    }
    
    // Story creation modal (Works on Home Page & Stories Page)
    if (typeof StoryModal !== 'undefined') {
        new StoryModal(loveStories);
    }
    
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
    .then(data => {
        window.currentUserId = data?.id || null;
    })
    .catch(() => {
        window.currentUserId = null;
    });