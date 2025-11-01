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
                const likeCount = story.likes;
                story.likes = []; // Reset to empty array
                // Add dummy likes to preserve count (for demo)
                for (let i = 0; i < likeCount; i++) {
                    story.likes.push({
                        userId: `user_${i}`,
                        timestamp: new Date().toISOString()
                    });
                }
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
        // Don't render here - let LoveStoriesPage handle rendering if it exists
        if (!window.loveStoriesPage) {
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

        // Load more stories - only bind if LoveStoriesPage doesn't exist
        const loadMoreBtn = document.getElementById('loadMoreStories');
        if (loadMoreBtn && !window.loveStoriesPage) {
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
        // Track story in stats
        window.simpleStats?.trackStory();
        
        // Trigger re-render through LoveStoriesPage if it exists
        if (window.loveStoriesPage) {
            window.loveStoriesPage.loadStories();
        } else {
            this.renderStories();
        }
        
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
                window.simpleStats?.trackLike();
            }
            
            this.saveToLocalStorage();
            
            // Trigger re-render through LoveStoriesPage if it exists
            if (window.loveStoriesPage) {
                window.loveStoriesPage.applyFiltersAndSort();
            } else {
                this.renderStories();
            }
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
                // Track comment in stats
                window.simpleStats?.trackComment();
                
                // Trigger re-render through LoveStoriesPage if it exists
                if (window.loveStoriesPage) {
                    window.loveStoriesPage.applyFiltersAndSort();
                } else {
                    this.renderStories();
                }
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

    // Public method for LoveStoriesPage to use
    getAllStories() {
        return this.stories;
    }
}

// Remove EnhancedLoveStories class - it's causing conflicts
// Use basic LoveStories class for consistency

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

// Global initialization
let loveStories, storyModal;

function initializeLoveStories() {
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
        loveStories = new LoveStories(); // Use basic LoveStories, not Enhanced
        
        // Only initialize modal if FAB exists
        if (storyFab) {
            storyModal = new StoryModal(loveStories);
        }
        
        // Make available globally
        window.loveStories = loveStories;
        
        console.log('💖 Love Stories system initialized successfully');
        
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