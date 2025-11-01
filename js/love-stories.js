// love-stories.js
class LoveStories {
    constructor() {
        this.stories = JSON.parse(localStorage.getItem('loveStories')) || [];
        this.migrateOldData(); // Migrate old data format
        this.currentPage = 1;
        this.storiesPerPage = 5;
        this.init();
    }

    // Migrate old data format to new format
    migrateOldData() {
        let needsMigration = false;
        
        this.stories.forEach(story => {
            // Migrate likes from number to array
            if (typeof story.likes === 'number') {
                story.likes = []; // Reset likes when migrating from number to array
                needsMigration = true;
            }
            
            // Ensure likes is always an array
            if (!Array.isArray(story.likes)) {
                story.likes = [];
                needsMigration = true;
            }
            
            // Ensure comments is always an array
            if (!Array.isArray(story.comments)) {
                story.comments = [];
                needsMigration = true;
            }
            
            // Add timestamp if missing
            if (!story.timestamp) {
                story.timestamp = new Date().toISOString();
                needsMigration = true;
            }
            
            // Add ID if missing
            if (!story.id) {
                story.id = Date.now().toString();
                needsMigration = true;
            }
        });
        
        if (needsMigration) {
            this.saveToLocalStorage();
            console.log('📦 Data migration completed');
        }
    }

    init() {
        this.bindEvents();
        this.renderStories();
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

    addStory(storyData) {
        const story = {
            id: Date.now().toString(),
            ...storyData,
            likes: [], // Always start with empty array
            comments: [], // Always start with empty array
            timestamp: new Date().toISOString()
        };

        this.stories.unshift(story);
        this.saveToLocalStorage();
        this.renderStories();
        
        // Show notification
        this.showNotification('Your love story has been shared!');
        this.triggerStorySharedEvent();
    }

    triggerStorySharedEvent() {
        const event = new CustomEvent('storyShared');
        document.dispatchEvent(event);
    }

    renderStories() {
        const container = document.getElementById('storiesContainer');
        const loadMoreBtn = document.getElementById('loadMoreStories');
        
        if (!container) return;
        
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
        const date = new Date(story.timestamp).toLocaleDateString();
        const isLong = story.loveStory.length > 200;
        const displayText = isLong ? 
            story.loveStory.substring(0, 200) + '...' : story.loveStory;

        // Safe check for likes array
        const likesArray = Array.isArray(story.likes) ? story.likes : [];
        const isLiked = likesArray.some(like => {
            if (typeof like === 'object' && like !== null) {
                return like.userId === this.getCurrentUser();
            }
            return false;
        });

        return `
            <div class="story-card" data-story-id="${story.id}">
                <div class="story-card-header">
                    <div class="story-couple">
                        <h4>${story.anonymousPost ? 'Anonymous Couple' : story.coupleNames}</h4>
                        <div class="story-meta">
                            <span>${date}</span>
                            ${story.togetherSince ? `<span>•</span><span>Together since ${story.togetherSince}</span>` : ''}
                        </div>
                    </div>
                    <span class="story-category">${this.getCategoryEmoji(story.category)} ${this.formatCategory(story.category)}</span>
                </div>
                
                <h3 class="story-title">${story.storyTitle}</h3>
                
                <div class="story-content ${isLong ? '' : 'expanded'}">
                    ${story.loveStory}
                </div>
                
                ${isLong ? `<button class="read-more" onclick="loveStories.toggleReadMore('${story.id}')">Read More</button>` : ''}
                
                <div class="story-footer">
                    <span class="story-mood">${this.getMoodText(story.mood)}</span>
                    <div class="story-actions">
                        <button class="story-action ${isLiked ? 'liked' : ''}" 
                                onclick="loveStories.toggleLike('${story.id}')">
                            ❤️ <span class="like-count">${likesArray.length}</span>
                        </button>
                        <button class="story-action" onclick="loveStories.toggleComments('${story.id}')">
                            💬 <span>${Array.isArray(story.comments) ? story.comments.length : 0}</span>
                        </button>
                    </div>
                </div>
                
                ${story.allowComments ? `
                    <div class="comments-section hidden" id="comments-${story.id}">
                        <div class="comment-form">
                            <input type="text" class="comment-input" placeholder="Add a comment..." 
                                   onkeypress="loveStories.handleCommentKeypress(event, '${story.id}')">
                            <button class="comment-submit" 
                                    onclick="loveStories.addComment('${story.id}')">Post</button>
                        </div>
                        <div class="comments-list" id="comments-list-${story.id}">
                            ${Array.isArray(story.comments) ? story.comments.map(comment => `
                                <div class="comment">
                                    <div class="comment-author">${comment.author || 'Anonymous'}</div>
                                    <div class="comment-text">${comment.text || ''}</div>
                                </div>
                            `).join('') : ''}
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

    toggleLike(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        if (story) {
            const currentUser = this.getCurrentUser();
            
            // Ensure likes is an array
            if (!Array.isArray(story.likes)) {
                story.likes = [];
            }
            
            const userLikeIndex = story.likes.findIndex(like => {
                if (typeof like === 'object' && like !== null) {
                    return like.userId === currentUser;
                }
                return false;
            });
            
            if (userLikeIndex > -1) {
                // Unlike
                story.likes.splice(userLikeIndex, 1);
            } else {
                // Like
                story.likes.push({
                    userId: currentUser,
                    timestamp: new Date().toISOString()
                });
            }
            
            this.saveToLocalStorage();
            this.renderStories();
        }
    }

    toggleComments(storyId) {
        const commentsSection = document.getElementById(`comments-${storyId}`);
        if (commentsSection) {
            commentsSection.classList.toggle('hidden');
        }
    }

    handleCommentKeypress(event, storyId) {
        if (event.key === 'Enter') {
            this.addComment(storyId);
        }
    }

    addComment(storyId) {
        const input = document.querySelector(`[data-story-id="${storyId}"] .comment-input`);
        const text = input?.value.trim();
        
        if (text) {
            const story = this.stories.find(s => s.id === storyId);
            if (story) {
                // Ensure comments is an array
                if (!Array.isArray(story.comments)) {
                    story.comments = [];
                }
                
                story.comments.push({
                    author: 'You',
                    text: text,
                    timestamp: new Date().toISOString()
                });
                
                this.saveToLocalStorage();
                this.renderStories();
                input.value = '';
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

    getCurrentUser() {
        let userId = localStorage.getItem('currentUserId');
        if (!userId) {
            userId = 'user_' + Date.now();
            localStorage.setItem('currentUserId', userId);
        }
        return userId;
    }

    saveToLocalStorage() {
        localStorage.setItem('loveStories', JSON.stringify(this.stories));
    }

    bindStoryEvents() {
        // Additional story event bindings if needed
    }
}

// Enhanced Love Stories with Comments & Likes
class EnhancedLoveStories extends LoveStories {
    constructor() {
        super();
        this.currentUser = this.getCurrentUser();
        this.initEnhanced();
    }

    initEnhanced() {
        this.bindEnhancedEvents();
        this.renderStoriesWithEnhancedUI();
    }

    bindEnhancedEvents() {
        // Enhanced like functionality with double-tap
        document.addEventListener('dblclick', (e) => {
            const storyCard = e.target.closest('.story-card');
            if (storyCard) {
                const storyId = storyCard.dataset.storyId;
                this.handleDoubleTapLike(storyId);
            }
        });

        // Comment submission with Enter key
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
                const storyCard = e.target.closest('.story-card');
                if (storyCard) {
                    const storyId = storyCard.dataset.storyId;
                    this.addComment(storyId);
                }
            }
        });

        // Real-time comment updates
        this.setupRealTimeUpdates();
    }

    handleDoubleTapLike(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        if (story) {
            // Add visual feedback
            this.showLikeAnimation(storyId);
            
            // Toggle like
            this.toggleLike(storyId);
        }
    }

    showLikeAnimation(storyId) {
        const storyCard = document.querySelector(`[data-story-id="${storyId}"]`);
        if (!storyCard) return;
        
        const heart = document.createElement('div');
        heart.innerHTML = '❤️';
        heart.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 4rem;
            z-index: 1000;
            animation: heartBeat 0.6s ease-out;
            pointer-events: none;
        `;
        
        storyCard.style.position = 'relative';
        storyCard.appendChild(heart);
        
        setTimeout(() => {
            if (heart.parentNode === storyCard) {
                heart.remove();
            }
        }, 600);
    }

    renderStoriesWithEnhancedUI() {
        console.log('🎨 Rendering stories with enhanced UI');
        
        const container = document.getElementById('storiesContainer');
        if (!container) {
            console.error('❌ Stories container not found');
            return;
        }

        // Clear existing content
        container.innerHTML = '';

        if (this.stories.length === 0) {
            this.renderEmptyState(container);
            return;
        }

        // Create stories grid
        const storiesGrid = document.createElement('div');
        storiesGrid.className = 'stories-grid';

        this.stories.forEach((story, index) => {
            const storyCard = this.createStoryCard(story, index);
            storiesGrid.appendChild(storyCard);
        });

        container.appendChild(storiesGrid);
        this.attachStoryInteractions();
    }

    // Helper methods for the enhanced UI
    createStoryCard(story, index) {
        const storyCard = document.createElement('div');
        storyCard.className = `story-card ${story.mood || 'romantic'}`;
        storyCard.setAttribute('data-story-id', story.id);
        
        // Safe check for likes
        const likesArray = Array.isArray(story.likes) ? story.likes : [];
        const isLiked = likesArray.some(like => {
            if (typeof like === 'object' && like !== null) {
                return like.userId === this.currentUser;
            }
            return false;
        });
        
        storyCard.innerHTML = `
            <div class="story-card-header">
                <div class="story-avatar">${this.getAvatarEmoji(story.mood)}</div>
                <div class="story-author">
                    <div class="author-name">${story.anonymousPost ? 'Anonymous' : story.coupleNames}</div>
                    <div class="story-meta">
                        <span class="story-category">${this.getCategoryIcon(story.category)} ${this.formatCategory(story.category)}</span>
                        <span class="story-date">${this.formatDate(story.timestamp)}</span>
                    </div>
                </div>
            </div>
            
            <div class="story-card-body">
                <h4 class="story-title">${story.storyTitle}</h4>
                <p class="story-excerpt">${this.getExcerpt(story.loveStory)}</p>
                
                <div class="story-stats">
                    <span class="stat likes">❤️ ${likesArray.length}</span>
                    <span class="stat comments">💬 ${Array.isArray(story.comments) ? story.comments.length : 0}</span>
                    <span class="stat mood">${this.getMoodEmoji(story.mood)}</span>
                </div>
            </div>
            
            <div class="story-card-actions">
                <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" data-story-id="${story.id}">
                    ❤️ ${isLiked ? 'Liked' : 'Like'}
                </button>
                <button class="action-btn comment-btn" data-story-id="${story.id}">
                    💬 Comment
                </button>
                <button class="action-btn share-btn" data-story-id="${story.id}">
                    📤 Share
                </button>
            </div>
        `;
        
        return storyCard;
    }

    getAvatarEmoji(mood) {
        const moodEmojis = {
            romantic: '💖',
            emotional: '🥰',
            funny: '😂',
            inspiring: '✨',
            dramatic: '🎭'
        };
        return moodEmojis[mood] || '💕';
    }

    getCategoryIcon(category) {
        const categoryIcons = {
            romantic: '💖',
            proposal: '💍',
            journey: '🛤️',
            challenge: '🛡️',
            special: '🌟',
            longdistance: '✈️',
            secondchance: '🔁'
        };
        return categoryIcons[category] || '📖';
    }

    getMoodEmoji(mood) {
        const moodEmojis = {
            romantic: '😊',
            emotional: '🥰',
            funny: '😂',
            inspiring: '🤩',
            dramatic: '🎭'
        };
        return moodEmojis[mood] || '😊';
    }

    getExcerpt(content, maxLength = 150) {
        if (!content) return 'No content';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Recently';
        return new Date(timestamp).toLocaleDateString();
    }

    renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💌</div>
                <h3>No love stories yet</h3>
                <p>Be the first to share your beautiful love story!</p>
                <button class="fab-button" id="emptyStateFab">
                    <span class="fab-icon">+</span>
                    Share Your Story
                </button>
            </div>
        `;
        
        // Add event listener for empty state button
        const emptyFab = document.getElementById('emptyStateFab');
        if (emptyFab) {
            emptyFab.addEventListener('click', () => {
                document.getElementById('storyFab')?.click();
            });
        }
    }

    attachStoryInteractions() {
        // Like button functionality
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const storyId = e.target.dataset.storyId;
                this.toggleLike(storyId);
            });
        });
        
        // Comment button functionality
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const storyId = e.target.dataset.storyId;
                this.toggleComments(storyId);
            });
        });
        
        // Share button functionality
        document.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const storyId = e.target.dataset.storyId;
                this.handleShare(storyId);
            });
        });
    }

    toggleComments(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        if (!story) return;

        let commentsSection = document.getElementById(`comments-${storyId}`);
        
        if (!commentsSection) {
            // Create comments section if it doesn't exist
            const storyCard = document.querySelector(`[data-story-id="${storyId}"]`);
            commentsSection = document.createElement('div');
            commentsSection.id = `comments-${storyId}`;
            commentsSection.className = 'comments-section';
            commentsSection.innerHTML = this.getCommentsHTML(story);
            storyCard.appendChild(commentsSection);
        }
        
        commentsSection.classList.toggle('hidden');
    }

    getCommentsHTML(story) {
        return `
            <div class="comment-form">
                <input type="text" class="comment-input" placeholder="Add a comment..." 
                       data-story-id="${story.id}">
                <button class="comment-submit" data-story-id="${story.id}">Post</button>
            </div>
            <div class="comments-list" id="comments-list-${story.id}">
                ${Array.isArray(story.comments) ? story.comments.map(comment => `
                    <div class="comment" data-comment-id="${comment.id}">
                        <div class="comment-header">
                            <span class="comment-author">${comment.author || 'Anonymous'}</span>
                            <span class="comment-time">${this.formatTime(comment.timestamp)}</span>
                        </div>
                        <div class="comment-text">${this.escapeHtml(comment.text || '')}</div>
                        <div class="comment-actions">
                            <button class="comment-like" 
                                    data-story-id="${story.id}" data-comment-id="${comment.id}">
                                ❤️ <span>0</span>
                            </button>
                        </div>
                    </div>
                `).join('') : ''}
            </div>
        `;
    }

    handleShare(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        if (story) {
            const shareText = `Check out this beautiful love story: "${story.storyTitle}" by ${story.anonymousPost ? 'Anonymous' : story.coupleNames}`;
            
            if (navigator.share) {
                navigator.share({
                    title: story.storyTitle,
                    text: shareText,
                    url: window.location.href
                });
            } else {
                // Fallback: copy to clipboard
                navigator.clipboard.writeText(shareText).then(() => {
                    this.showNotification('Story link copied to clipboard! 📋');
                });
            }
        }
    }

    setupRealTimeUpdates() {
        // Simulate real-time updates (in real app, use WebSockets)
        setInterval(() => {
            this.updateStoryMetrics();
        }, 30000); // Update every 30 seconds
    }

    updateStoryMetrics() {
        // Update view counts or other metrics
        this.stories.forEach(story => {
            if (!story.views) story.views = 0;
            story.views += Math.floor(Math.random() * 3); // Simulate new views
        });
        this.saveToLocalStorage();
    }

    formatTime(timestamp) {
        const now = new Date();
        const commentTime = new Date(timestamp);
        const diffMs = now - commentTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return commentTime.toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Modal functionality
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
        if (!this.storyFab || !this.storyModal) return;

        // Open modal
        this.storyFab.addEventListener('click', () => this.openModal());

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

    openModal() {
        this.storyModal.classList.remove('hidden');
        this.storyModal.setAttribute('aria-hidden', 'false');
    }

    closeModalFunc() {
        this.storyModal.classList.add('hidden');
        this.storyModal.setAttribute('aria-hidden', 'true');
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

    handleSubmit(e) {
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
            anonymousPost: document.getElementById('anonymousPost').checked,
            timestamp: new Date().toISOString()
        };
        
        // Simulate API call delay
        setTimeout(() => {
            this.loveStories.addStory(formData);
            
            // Hide modal and show success
            this.closeModalFunc();
            this.showSuccessMessage();
            
            // Reset form and button
            this.resetForm();
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            submitBtn.disabled = false;
            
            // Reset mood selection
            this.resetMoodSelection();
        }, 1500);
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

// FAB Notification System - Added without affecting existing functionality
class FABNotificationSystem {
    constructor() {
        this.init();
    }

    init() {
        this.setupFABNotifications();
        this.addFABStyles();
    }

    setupFABNotifications() {
        const storyFab = document.getElementById('storyFab');
        const storyModal = document.getElementById('storyModal');
        
        if (storyFab) {
            // Add notification badge to FAB
            const notificationBadge = document.createElement('div');
            notificationBadge.className = 'fab-notification-badge';
            notificationBadge.textContent = '!';
            notificationBadge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: linear-gradient(135deg, #ff6b6b, #ff4b8d);
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                animation: pulse 2s infinite;
                box-shadow: 0 2px 8px rgba(255, 75, 141, 0.4);
            `;
            
            storyFab.style.position = 'relative';
            storyFab.appendChild(notificationBadge);
            
            // Add tooltip on hover
            storyFab.setAttribute('title', 'Write your beautiful love story here!');
            
            // Add click handler with notification
            storyFab.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Show notification message
                this.showFabNotification();
                
                // Open modal after a short delay
                setTimeout(() => {
                    if (storyModal) {
                        storyModal.classList.remove('hidden');
                        document.body.style.overflow = 'hidden';
                    }
                }, 800);
            }.bind(this));
        }
    }

    showFabNotification() {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.fab-notification-toast');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification toast
        const notification = document.createElement('div');
        notification.className = 'fab-notification-toast';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">💖</span>
                <div>
                    <strong>Share Your Love Story!</strong>
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 2px;">
                        Write your beautiful love story here
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add arrow pointing to FAB
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: fixed;
            bottom: 85px;
            right: 45px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid #ff4b8d;
            z-index: 1001;
            animation: slideUpFade 0.5s ease-out;
        `;
        document.body.appendChild(arrow);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(10px)';
                notification.style.transition = 'all 0.3s ease';
                
                if (arrow.parentNode) {
                    arrow.style.opacity = '0';
                    arrow.style.transition = 'all 0.3s ease';
                }
                
                setTimeout(() => {
                    notification.remove();
                    arrow.remove();
                }, 300);
            }
        }, 3000);
    }

    addFABStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fabPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            
            .fab-notification-badge {
                animation: fabPulse 2s ease-in-out infinite;
            }
            
            .fab-notification-toast {
                position: fixed;
                bottom: 100px;
                right: 30px;
                background: linear-gradient(135deg, #ff4b8d, #ff6b6b);
                color: white;
                padding: 15px 20px;
                border-radius: 25px;
                box-shadow: 0 8px 25px rgba(255, 75, 141, 0.4);
                z-index: 1001;
                animation: slideUpFade 0.5s ease-out;
                max-width: 280px;
                font-weight: 600;
                text-align: center;
                line-height: 1.4;
            }
            
            @keyframes slideUpFade {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .fab-button:hover .fab-notification-badge {
                animation: fabPulse 0.5s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }

    setupScrollNotifications() {
        // Show notification when user scrolls near bottom (indicating they might want to share)
        window.addEventListener('scroll', function() {
            const scrollPosition = window.scrollY + window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            // If user is near bottom of page and hasn't seen notification recently
            if (scrollPosition >= documentHeight - 500) {
                const lastBottomNotification = localStorage.getItem('lastBottomNotification');
                const now = Date.now();
                
                if (!lastBottomNotification || (now - parseInt(lastBottomNotification)) > 300000) { // 5 minutes
                    this.showFabNotification();
                    localStorage.setItem('lastBottomNotification', now.toString());
                }
            }
        }.bind(this));
    }

    setupEnhancedFABEffects() {
        const storyFab = document.getElementById('storyFab');
        if (storyFab) {
            storyFab.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
            });
            
            storyFab.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Use EnhancedLoveStories instead of basic LoveStories
    const loveStories = new EnhancedLoveStories();
    new StoryModal(loveStories);
    
    // Initialize FAB Notification System
    const fabNotifications = new FABNotificationSystem();
    
    // Setup additional FAB notification features
    fabNotifications.setupScrollNotifications();
    fabNotifications.setupEnhancedFABEffects();
    
    // Show notification on page load after a delay
    setTimeout(() => {
        const hasSeenNotification = localStorage.getItem('fabNotificationSeen');
        if (!hasSeenNotification) {
            fabNotifications.showFabNotification();
            localStorage.setItem('fabNotificationSeen', 'true');
        }
    }, 2000);
    
    // Make loveStories available globally for onclick handlers
    window.loveStories = loveStories;
    window.enhancedStories = loveStories;
});