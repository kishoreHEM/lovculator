// Love Stories Page Controller
class LoveStoriesPage {
    constructor() {
        this.stories = [];
        this.filteredStories = [];
        this.currentFilter = 'all';
        this.currentSort = 'newest';
        this.currentPage = 1;
        this.storiesPerPage = 10;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadStories();
        this.updateStats();
        
        console.log('📖 Love Stories Page initialized');
    }

    bindEvents() {
        // Filter tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleFilterChange(e));
        });

        // Sort dropdown
        document.getElementById('sortStories').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.applyFiltersAndSort();
        });

        // Search functionality
        const searchInput = document.getElementById('storiesSearch');
        const searchBtn = document.querySelector('.search-btn');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch(searchInput.value));
        }

        // Load more button
        document.getElementById('loadMoreStories').addEventListener('click', () => {
            this.loadMoreStories();
        });
    }

    loadStories() {
        this.isLoading = true;
        this.showLoadingState();

        // Get stories from localStorage (shared with home page)
        const storedStories = JSON.parse(localStorage.getItem('loveStories')) || [];
        
        // Add sample stories if empty (for demo)
        if (storedStories.length === 0) {
            this.stories = this.getSampleStories();
            localStorage.setItem('loveStories', JSON.stringify(this.stories));
        } else {
            this.stories = storedStories;
        }

        this.isLoading = false;
        this.applyFiltersAndSort();
        this.updateStats();
    }

    getSampleStories() {
        return [
            {
                id: 'sample_1',
                coupleNames: 'Sarah & John',
                storyTitle: 'Love at First Sight in Paris 💘',
                loveStory: 'We met at a small café near the Eiffel Tower. I was studying abroad, and he was a local artist painting the scenery. He asked to paint my portrait, and we spent the whole afternoon talking. Two years later, we\'re married and living in Paris! The city of love truly brought us together.',
                category: 'romantic',
                mood: 'romantic',
                anonymousPost: false,
                togetherSince: '2022',
                allowComments: true,
                likes: 24,
                comments: [
                    {
                        author: 'HopefulRomantic',
                        text: 'This is absolutely magical! Paris is indeed the city of love 💕',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                    },
                    {
                        author: 'TravelLover',
                        text: 'Makes me want to book a trip to Paris immediately! ✈️',
                        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
                    }
                ],
                timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'sample_2',
                coupleNames: 'Alex & Taylor',
                storyTitle: '3 Years Long Distance - Now Together Forever ✈️',
                loveStory: 'We met online during the pandemic while living 2000 miles apart. For three years, we maintained our relationship through daily video calls, handwritten letters, and visiting each other every 3 months. There were tough times when we doubted if we could make it, but our love only grew stronger. Yesterday, he proposed at the airport when I moved to his city! Never give up on true love, no matter the distance.',
                category: 'longdistance',
                mood: 'inspiring',
                anonymousPost: false,
                togetherSince: '2021',
                allowComments: true,
                likes: 42,
                comments: [
                    {
                        author: 'LDRWarrior',
                        text: 'As someone in a LDR, this gives me so much hope and motivation! 🥹',
                        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
                    },
                    {
                        author: 'DistanceMaker',
                        text: 'Congratulations! The airport proposal is so romantic ✈️💍',
                        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
                    }
                ],
                timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'sample_3',
                anonymousPost: true,
                storyTitle: 'Secret Office Romance Turned Marriage 💼❤️',
                loveStory: 'We\'ve been secretly dating at work for 2 years. Nobody in the office knew about us - we had our own secret signals, lunch dates at different times, and even managed business trips together without raising suspicion. The thrill of keeping our love secret made every workday exciting. Last month, we both got new jobs at different companies and finally went public with our relationship. Our colleagues were shocked but incredibly happy for us! Sometimes love finds you in the most unexpected places.',
                category: 'romantic',
                mood: 'funny',
                togetherSince: '2022',
                allowComments: true,
                likes: 18,
                comments: [
                    {
                        author: 'OfficeRomantic',
                        text: 'This is like a movie plot! So happy for you both 🎬',
                        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
                    }
                ],
                timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'sample_4',
                coupleNames: 'Maria & Carlos',
                storyTitle: 'Second Chance After 10 Years 🔁',
                loveStory: 'We dated in high school but went our separate ways for college. For 10 years, we lived different lives, got married to other people, and then both went through divorces. We reconnected at our high school reunion and realized the love never faded. It\'s been 2 years since we got back together, and it feels like no time passed at all. Sometimes love deserves a second chance.',
                category: 'secondchance',
                mood: 'emotional',
                anonymousPost: false,
                togetherSince: '2022',
                allowComments: true,
                likes: 31,
                comments: [
                    {
                        author: 'HopefulHeart',
                        text: 'This gives me hope for second chances! Beautiful story 💫',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                    }
                ],
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }

    handleFilterChange(e) {
        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
        e.target.classList.add('active');
        
        this.currentFilter = e.target.dataset.filter;
        this.currentPage = 1;
        this.applyFiltersAndSort();
    }

    handleSearch(searchTerm) {
        this.currentPage = 1;
        this.applyFiltersAndSort(searchTerm);
    }

    applyFiltersAndSort(searchTerm = '') {
        // Filter stories
        let filtered = this.stories;
        
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(story => story.category === this.currentFilter);
        }
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(story => 
                story.storyTitle.toLowerCase().includes(term) ||
                story.loveStory.toLowerCase().includes(term) ||
                (story.coupleNames && story.coupleNames.toLowerCase().includes(term))
            );
        }
        
        // Sort stories
        filtered = this.sortStories(filtered, this.currentSort);
        
        this.filteredStories = filtered;
        this.renderStories();
    }

    sortStories(stories, sortBy) {
        switch (sortBy) {
            case 'newest':
                return [...stories].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            case 'oldest':
                return [...stories].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            case 'popular':
                return [...stories].sort((a, b) => (b.likes || 0) - (a.likes || 0));
            case 'comments':
                return [...stories].sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
            default:
                return stories;
        }
    }

    renderStories() {
        const container = document.getElementById('storiesContainer');
        const loadMoreBtn = document.getElementById('loadMoreStories');
        const emptyState = document.getElementById('emptyState');
        
        if (!container) return;

        if (this.filteredStories.length === 0) {
            container.classList.add('hidden');
            emptyState.classList.remove('hidden');
            loadMoreBtn.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        emptyState.classList.add('hidden');

        const storiesToShow = this.filteredStories.slice(0, this.currentPage * this.storiesPerPage);
        
        // Use the existing LoveStories class to render stories
        if (window.loveStories) {
            container.innerHTML = storiesToShow.map(story => 
                window.loveStories.getStoryHTML(story)
            ).join('');
            
            // Re-bind story events
            window.loveStories.bindStoryEvents();
        } else {
            // Fallback rendering
            container.innerHTML = storiesToShow.map(story => this.getFallbackStoryHTML(story)).join('');
        }

        // Show/hide load more button
        if (this.filteredStories.length > storiesToShow.length) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    }

    getFallbackStoryHTML(story) {
        const date = new Date(story.timestamp).toLocaleDateString();
        const isLong = story.loveStory.length > 200;
        const displayText = isLong ? story.loveStory.substring(0, 200) + '...' : story.loveStory;

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
                
                ${isLong ? `<button class="read-more" onclick="this.parentElement.classList.toggle('expanded'); this.textContent = this.parentElement.classList.contains('expanded') ? 'Read Less' : 'Read More'">Read More</button>` : ''}
                
                <div class="story-footer">
                    <span class="story-mood">${this.getMoodText(story.mood)}</span>
                    <div class="story-actions">
                        <span class="story-action">
                            ❤️ ${story.likes || 0}
                        </span>
                        <span class="story-action">
                            💬 ${story.comments?.length || 0}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    loadMoreStories() {
        this.currentPage++;
        this.renderStories();
    }

    updateStats() {
        const totalStories = this.stories.length;
        const totalLikes = this.stories.reduce((sum, story) => sum + (story.likes || 0), 0);
        const totalComments = this.stories.reduce((sum, story) => sum + (story.comments?.length || 0), 0);

        document.getElementById('totalStories').textContent = totalStories;
        document.getElementById('totalLikes').textContent = totalLikes;
        document.getElementById('totalComments').textContent = totalComments;
    }

    showLoadingState() {
        const container = document.getElementById('storiesContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-stories">
                    <div class="loading-spinner"></div>
                    <p>Loading love stories...</p>
                </div>
            `;
        }
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
}

// Export for use in love-stories.js initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoveStoriesPage;
}