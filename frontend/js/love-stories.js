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

    try {
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
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
    return this.request("/stories", {
      method: "POST",
      body: JSON.stringify(storyData),
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
            this.stories = await this.api.request(`/stories?${queryString}`);
            document.dispatchEvent(new CustomEvent('storiesLoaded')); 
        } catch (error) {
            console.error('Error loading stories:', error);
            this.stories = [];
            document.dispatchEvent(new CustomEvent('storiesLoaded')); 
            throw error;
        }
    }

    bindEvents() {
        // Only bind form/UI events, NOT social interactions
        const moodOptions = document.querySelectorAll('.mood-option');
        if (moodOptions.length > 0) {
            moodOptions.forEach(option => {
                option.addEventListener('click', () => {
                    document.querySelectorAll('.mood-option').forEach(opt => 
                        opt.classList.remove('selected'));
                    option.classList.add('selected');
                    document.getElementById('selectedMood').value = 
                        option.dataset.mood;
                });
            });
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
            
            window.simpleStats?.trackStory();
            
            // Use global notification
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

    // Story HTML template method
    getStoryHTML(story) {
        const date = new Date(story.created_at).toLocaleDateString();
        const isLong = story.love_story.length > 200;

        const shareUrl = `https://lovculator.com/stories/${story.id}`; 
        const shareTitle = story.story_title;
        const shareText = `Read this beautiful love story: ${story.story_title}`;
        
        // Author and Avatar Logic
        const authorName = story.anonymous_post
          ? "Anonymous User"
          : story.author_display_name || story.author_username || "User";

        const authorUsername = story.author_username || '';
        const authorAvatar = story.author_avatar_url || "/images/default-avatar.png"; 
        
        // Ownership Check
        const ownerId = story.user_id; 
        const isOwner = window.currentUserId && ownerId === window.currentUserId;

        // Follow button logic
        const canFollow = !story.anonymous_post && !isOwner && story.author_id;
        const isFollowing = story.is_following_author;

        return `
        <div class="story-card" data-story-id="${story.id}">
            <div class="story-card-header">
                <div class="story-user-info">
                    <a href="/profile/${encodeURIComponent(authorUsername)}" class="story-user-link">
                        <img src="${authorAvatar}" alt="${authorName}" class="story-avatar" />
                    </a>
                    <div class="story-user-details">
                        <a href="/profile/${encodeURIComponent(authorUsername)}" class="story-username-link">
                            <h4 class="story-username">${authorName}</h4>
                        </a>
                        <span class="story-date">${date}</span>
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
            
            <h3 class="story-title">${story.story_title}</h3>
            <div class="story-content ${isLong ? '' : 'expanded'}" ${isLong ? `data-full-text="${story.love_story}"` : ''}>
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
        this.loveStories.storiesContainer.innerHTML = '<div class="loading-indicator">Loading stories...</div>';

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
// 4. UI CLASS: StoryModal
// ==============================================
class StoryModal {
    constructor(loveStoriesInstance) {
        this.loveStories = loveStoriesInstance;
        this.storyFab = document.getElementById('storyFab');
        this.storyModal = document.getElementById('storyModal');
        this.closeModal = document.getElementById('closeModal');
        this.storyForm = document.getElementById('storyForm');
        this.init();
    }

    init() {
        if (!this.storyFab || !this.storyModal) return;
        this.storyFab.addEventListener('click', (e) => {
            e.preventDefault();
            this.storyModal.classList.remove('hidden');
        });
        this.closeModal.addEventListener('click', () => {
            this.storyModal.classList.add('hidden');
        });
        if (this.storyForm) {
            this.storyForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const submitBtn = this.storyForm.querySelector('.submit-story-btn');
        submitBtn.disabled = true;

        const formData = {
            coupleNames: document.getElementById('coupleNames').value,
            storyTitle: document.getElementById('storyTitle').value,
            togetherSince: document.getElementById('togetherSince').value,
            loveStory: document.getElementById('loveStory').value,
            category: document.getElementById('storyCategory').value,
            mood: document.getElementById('selectedMood').value,
            allowComments: document.getElementById('allowComments').checked,
            anonymousPost: document.getElementById('anonymousPost').checked
        };

        const backendPayload = {
            story_title: formData.storyTitle,
            love_story: formData.loveStory,
            category: formData.category,
            mood: formData.mood,
            couple_names: formData.coupleNames,
            together_since: formData.togetherSince,
            allow_comments: formData.allowComments,
            anonymous_post: formData.anonymousPost
        };

        try {
            await this.loveStories.addStory(backendPayload);
            this.storyModal.classList.add('hidden');
            this.storyForm.reset();
        } catch (error) {
            console.error(error);
            if (window.showNotification) {
                window.showNotification('Failed to share story.', 'error');
            }
        } finally {
            submitBtn.disabled = false;
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
    
    // Page-specific components
    if (document.getElementById('storiesContainer')) {
        window.loveStoriesPage = new LoveStoriesPage(loveStories);
    }
    
    // Story creation modal
    if (document.getElementById('storyFab')) {
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