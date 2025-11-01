// love-stories.js - UPDATED FOR DATABASE
class LoveStories {
    constructor() {
        this.api = new LoveStoriesAPI(); // Use the API class
        this.stories = [];
        this.currentPage = 1;
        this.storiesPerPage = 10;
        this.init();
    }

    async init() {
        await this.loadStories();
        this.bindEvents();
        console.log('💖 Love Stories initialized with database');
    }

    async loadStories() {
        try {
            this.stories = await this.api.getStories();
            this.renderStories();
        } catch (error) {
            console.error('Error loading stories:', error);
            this.stories = [];
            this.renderStories();
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

        // Load more stories
        const loadMoreBtn = document.getElementById('loadMoreStories');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreStories());
        }

        // Empty state FAB
        const emptyStateFab = document.getElementById('emptyStateFab');
        if (emptyStateFab) {
            emptyStateFab.addEventListener('click', 
                () => document.getElementById('storyFab').click());
        }
    }

    async addStory(storyData) {
        try {
            const newStory = await this.api.createStory(storyData);
            this.stories.unshift(newStory);
            this.renderStories();
            
            // Track story in stats
            window.simpleStats?.trackStory();
            
            this.showNotification('Your love story has been shared with everyone! 🌍');
            this.triggerStorySharedEvent();
            
            return newStory;
        } catch (error) {
            console.error('Error creating story:', error);
            this.showError('Failed to share story. Please try again.');
            throw error;
        }
    }

    triggerStorySharedEvent() {
        const event = new CustomEvent('storyShared');
        document.dispatchEvent(event);
    }

    renderStories() {
        const container = document.getElementById('storiesContainer');
        const loadMoreBtn = document.getElementById('loadMoreStories');
        
        if (!container) {
            console.log('⏳ Stories container not ready yet');
            return;
        }
        
        if (this.stories.length === 0) {
            container.innerHTML = this.getEmptyStateHTML();
            if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
            return;
        }

        const storiesToShow = this.stories.slice(0, 
            this.currentPage * this.storiesPerPage);
        
        container.innerHTML = storiesToShow.map(story => 
            this.getStoryHTML(story)).join('');

        // Show/hide load more button
        if (loadMoreBtn) {
            if (this.stories.length > storiesToShow.length) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }

        this.bindStoryEvents();
    }

    getStoryHTML(story) {
        const date = new Date(story.created_at).toLocaleDateString();
        const isLong = story.love_story.length > 200;
        const displayText = isLong ? 
            story.love_story.substring(0, 200) + '...' : story.love_story;

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
                    ${story.love_story}
                </div>
                
                ${isLong ? `<button class="read-more" onclick="loveStories.toggleReadMore(${story.id})">Read More</button>` : ''}
                
                <div class="story-footer">
                    <span class="story-mood">${this.getMoodText(story.mood)}</span>
                    <div class="story-actions">
                        <button class="story-action ${story.user_liked ? 'liked' : ''}" 
                                onclick="loveStories.toggleLike(${story.id})">
                            ❤️ <span class="like-count">${story.likes_count}</span>
                        </button>
                        <button class="story-action" onclick="loveStories.toggleComments(${story.id})">
                            💬 <span>${story.comments_count}</span>
                        </button>
                    </div>
                </div>
                
                ${story.allow_comments ? `
                    <div class="comments-section hidden" id="comments-${story.id}">
                        <div class="comment-form">
                            <input type="text" class="comment-input" placeholder="Add a comment..." 
                                   data-story-id="${story.id}">
                            <button class="comment-submit" 
                                    onclick="loveStories.handleAddComment(${story.id})">Post</button>
                        </div>
                        <div class="comments-list" id="comments-list-${story.id}">
                            <!-- Comments will be loaded when opened -->
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
                <h3>No stories yet</h3>
                <p>Be the first to share your love story!</p>
                <button class="fab-button" id="emptyStateFab">
                    <span class="fab-icon">+</span>
                </button>
            </div>
        `;
    }

    toggleReadMore(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        const contentEl = document.querySelector(`[data-story-id="${storyId}"] .story-content`);
        const buttonEl = document.querySelector(`[data-story-id="${storyId}"] .read-more`);

        if (contentEl && buttonEl) {
            if (contentEl.classList.contains('expanded')) {
                contentEl.classList.remove('expanded');
                buttonEl.textContent = 'Read More';
            } else {
                contentEl.classList.add('expanded');
                buttonEl.textContent = 'Read Less';
            }
        }
    }

    async toggleLike(storyId) {
        try {
            const result = await this.api.toggleLike(storyId);
            
            // Update the story in our local array
            const storyIndex = this.stories.findIndex(s => s.id === storyId);
            if (storyIndex !== -1) {
                this.stories[storyIndex].likes_count = result.likes_count;
                this.stories[storyIndex].user_liked = result.liked;
                
                // Update stats if liked
                if (result.liked) {
                    window.simpleStats?.trackLike();
                }
            }
            
            this.renderStories();
        } catch (error) {
            console.error('Error toggling like:', error);
            this.showError('Failed to update like. Please try again.');
        }
    }

    toggleComments(storyId) {
        const commentsSection = document.getElementById(`comments-${storyId}`);
        if (commentsSection) {
            commentsSection.classList.toggle('hidden');
            
            // Load comments when opening
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
                        <div class="comment-author">${comment.author_name}</div>
                        <div class="comment-text">${comment.comment_text}</div>
                        <div class="comment-time">${new Date(comment.created_at).toLocaleDateString()}</div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
        }
    }

    handleCommentKeypress(event, storyId) {
        if (event.key === 'Enter') {
            this.handleAddComment(storyId);
        }
    }

    async handleAddComment(storyId) {
        const input = document.querySelector(`[data-story-id="${storyId}"] .comment-input`);
        const text = input?.value.trim();
        
        if (text) {
            try {
                const result = await this.api.addComment(storyId, {
                    text: text,
                    author: 'You'
                });

                // Update the story in our local array
                const storyIndex = this.stories.findIndex(s => s.id === storyId);
                if (storyIndex !== -1) {
                    this.stories[storyIndex].comments_count = result.comments_count;
                }

                // Track in stats
                window.simpleStats?.trackComment();
                
                // Reload comments
                this.loadComments(storyId);
                input.value = '';
                
                this.showNotification('Comment added!');
            } catch (error) {
                console.error('Error adding comment:', error);
                this.showError('Failed to add comment. Please try again.');
            }
        }
    }

    loadMoreStories() {
        this.currentPage++;
        this.renderStories();
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 3000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 3000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    getCategoryEmoji(category) {
        const emojis = {
            romantic: '💖',
            proposal: '💍',
            journey: '🛤️',
            challenge: '🛡️',
            special: '🌟',
            longdistance: '✈️',
            secondchance: '🔁'
        };
        return emojis[category] || '💕';
    }

    formatCategory(category) {
        const formats = {
            romantic: 'Romantic Moment',
            proposal: 'Marriage Proposal',
            journey: 'Love Journey',
            challenge: 'Overcoming Challenges',
            special: 'Special Memory',
            longdistance: 'Long Distance Love',
            secondchance: 'Second Chance'
        };
        return formats[category] || 'Love Story';
    }

    getMoodText(mood) {
        const texts = {
            romantic: 'Heartwarming romance',
            emotional: 'Deep emotions',
            funny: 'Funny and sweet',
            inspiring: 'Inspiring journey',
            dramatic: 'Dramatic love story'
        };
        return texts[mood] || 'Beautiful story';
    }

    bindStoryEvents() {
        // Additional story event bindings if needed
    }

    // Public method for LoveStoriesPage to use
    getAllStories() {
        return this.stories;
    }
}

// Love Stories API Manager
class LoveStoriesAPI {
    constructor() {
        // For production - use relative path since backend serves frontend
        this.apiBase = '/api';
    }

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getStories() {
        return this.request('/stories');
    }

    async createStory(storyData) {
        return this.request('/stories', {
            method: 'POST',
            body: JSON.stringify(storyData)
        });
    }

    async toggleLike(storyId) {
        return this.request(`/stories/${storyId}/like`, {
            method: 'POST'
        });
    }

    async addComment(storyId, commentData) {
        return this.request(`/stories/${storyId}/comments`, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    async getComments(storyId) {
        return this.request(`/stories/${storyId}/comments`);
    }

    async healthCheck() {
        return this.request('/health');
    }
}

// Modal functionality - UPDATED FOR DATABASE
class StoryModal {
    constructor(loveStoriesInstance) {
        this.loveStories = loveStoriesInstance;
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
        if (!this.storyFab || !this.storyModal) {
            console.log('⏳ Modal elements not ready yet');
            return;
        }

        // Open modal - remove any existing listeners first
        this.storyFab.removeEventListener('click', this.openModal);
        this.storyFab.addEventListener('click', (e) => this.openModal(e));

        // Close modal
        this.closeModal.addEventListener('click', () => this.closeModalFunc());

        // Close modal when clicking outside
        this.storyModal.addEventListener('click', (e) => {
            if (e.target === this.storyModal) {
                this.closeModalFunc();
            }
        });

        // Character counter
        if (this.loveStory && this.charCounter) {
            this.loveStory.addEventListener('input', () => this.updateCharCounter());
        }

        // Form submission
        if (this.storyForm) {
            this.storyForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Success message close
        if (this.successOk) {
            this.successOk.addEventListener('click', () => this.closeSuccessMessage());
        }

        // Close success message when clicking outside
        if (this.successMessage) {
            this.successMessage.addEventListener('click', (e) => {
                if (e.target === this.successMessage) {
                    this.closeSuccessMessage();
                }
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModalFunc();
                this.closeSuccessMessage();
            }
        });
    }

    openModal(e) {
        if (e) e.preventDefault();
        this.storyModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Set focus to the first form element for accessibility
        setTimeout(() => {
            document.getElementById('coupleNames')?.focus();
        }, 100);

        this.previousActiveElement = document.activeElement;
    }

    closeModalFunc() {
        this.storyModal.classList.add('hidden');
        this.storyModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        // Return focus to the element that was active before modal opened
        if (this.previousActiveElement) {
            this.previousActiveElement.focus();
        }
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
        
        // Show loading state
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
            
            // Hide modal and show success
            this.closeModalFunc();
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Error submitting story:', error);
            this.showError('Failed to share story. Please try again.');
        } finally {
            // Reset form and button
            this.resetForm();
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            submitBtn.disabled = false;
            
            // Reset mood selection
            this.resetMoodSelection();
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

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'notification error';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 3000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }

    resetForm() {
        if (this.storyForm) {
            this.storyForm.reset();
        }
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
            document.getElementById('selectedMood').value = 'romantic';
        }
    }
}

// Global initialization
let loveStories, storyModal;

async function initializeLoveStories() {
    try {
        // Check if we're on a page that needs Love Stories
        const storiesContainer = document.getElementById('storiesContainer');
        const storyFab = document.getElementById('storyFab');
        
        // Only initialize if we have either stories container or FAB button
        if (!storiesContainer && !storyFab) {
            console.log('🚫 Love Stories not needed on this page');
            return;
        }
        
        // Initialize main components
        loveStories = new LoveStories();
        
        // Only initialize modal if FAB exists
        if (storyFab) {
            storyModal = new StoryModal(loveStories);
        }
        
        // Make available globally
        window.loveStories = loveStories;
        
        console.log('💖 Love Stories system initialized with database');
        
    } catch (error) {
        console.error('❌ Error initializing Love Stories:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoveStories);
} else {
    initializeLoveStories();
}