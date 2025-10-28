// Couple of the Week Feature - Debugged Version
class CoupleOfWeek {
    constructor() {
        console.log('🔧 CoupleOfWeek: Initializing...');
        this.featuredCouples = JSON.parse(localStorage.getItem('featuredCouples')) || [];
        this.currentWeek = this.getCurrentWeek();
        this.init();
    }

    init() {
        console.log('🔧 CoupleOfWeek: Starting init...');
        console.log('🔧 Current week:', this.currentWeek);
        console.log('🔧 Featured couples in storage:', this.featuredCouples.length);
        
        this.checkNewWeek();
        this.displayFeaturedCouple();
        this.setupVoting();
        
        console.log('🔧 CoupleOfWeek: Init complete');
    }

    getCurrentWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const pastDaysOfYear = (now - startOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    }

    checkNewWeek() {
        const lastFeaturedWeek = localStorage.getItem('lastFeaturedWeek');
        console.log('🔧 Last featured week:', lastFeaturedWeek);
        
        if (!lastFeaturedWeek || parseInt(lastFeaturedWeek) !== this.currentWeek) {
            console.log('🔧 New week detected! Selecting new featured couple...');
            this.selectNewFeaturedCouple();
            localStorage.setItem('lastFeaturedWeek', this.currentWeek.toString());
        } else {
            console.log('🔧 Same week, keeping existing featured couple');
        }
    }

    selectNewFeaturedCouple() {
        try {
            const stories = JSON.parse(localStorage.getItem('loveStories')) || [];
            console.log('🔧 Total stories found:', stories.length);
            
            if (stories.length === 0) {
                console.log('🔧 No stories available, creating sample featured couple');
                this.createSampleFeaturedCouple();
                return;
            }

            // Get stories from the last week
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            
            const recentStories = stories.filter(story => {
                const storyDate = new Date(story.timestamp);
                return storyDate > oneWeekAgo;
            });

            console.log('🔧 Recent stories (last 7 days):', recentStories.length);

            if (recentStories.length > 0) {
                // Find story with most likes
                const mostLikedStory = recentStories.reduce((prev, current) => 
                    ((prev.likes && prev.likes.length) || 0) > ((current.likes && current.likes.length) || 0) ? prev : current
                );

                console.log('🔧 Most liked story:', mostLikedStory);

                const featuredCouple = {
                    id: 'featured_' + Date.now(),
                    storyId: mostLikedStory.id,
                    coupleNames: mostLikedStory.coupleNames || 'Anonymous Couple',
                    lovePercentage: this.generateLovePercentage(mostLikedStory.coupleNames),
                    storyExcerpt: mostLikedStory.loveStory ? 
                        (mostLikedStory.loveStory.substring(0, 150) + '...') : 
                        'A beautiful love story shared by our community.',
                    votes: 0,
                    week: this.currentWeek,
                    featuredDate: new Date().toISOString(),
                    likes: mostLikedStory.likes ? mostLikedStory.likes.length : 0
                };

                this.featuredCouples.unshift(featuredCouple);
                
                // Keep only last 4 featured couples
                if (this.featuredCouples.length > 4) {
                    this.featuredCouples = this.featuredCouples.slice(0, 4);
                }
                
                this.saveFeaturedCouples();
                console.log('🔧 New featured couple created:', featuredCouple.coupleNames);
                
                this.showFeaturedNotification(featuredCouple);
            } else {
                this.createSampleFeaturedCouple();
            }
        } catch (error) {
            console.error('🔧 Error selecting featured couple:', error);
            this.createSampleFeaturedCouple();
        }
    }

    createSampleFeaturedCouple() {
        console.log('🔧 Creating sample featured couple');
        const sampleCouples = [
            {
                names: 'Alex & Taylor',
                percentage: 92,
                story: 'Met in college and have been inseparable ever since. Their love story inspires everyone around them!'
            },
            {
                names: 'Jordan & Casey', 
                percentage: 88,
                story: 'From friends to lovers, their journey shows that true love often starts with friendship.'
            },
            {
                names: 'Riley & Morgan',
                percentage: 95,
                story: 'A chance encounter turned into a lifetime of love and happiness together.'
            }
        ];

        const sample = sampleCouples[Math.floor(Math.random() * sampleCouples.length)];
        
        const featuredCouple = {
            id: 'sample_' + Date.now(),
            storyId: null,
            coupleNames: sample.names,
            lovePercentage: sample.percentage,
            storyExcerpt: sample.story,
            votes: Math.floor(Math.random() * 50) + 10,
            week: this.currentWeek,
            featuredDate: new Date().toISOString(),
            likes: Math.floor(Math.random() * 30) + 5,
            isSample: true
        };

        this.featuredCouples.unshift(featuredCouple);
        this.saveFeaturedCouples();
    }

    generateLovePercentage(coupleNames) {
        if (!coupleNames) return Math.floor(Math.random() * 41) + 60;
        
        const combined = coupleNames.replace(/\s/g, '').toLowerCase();
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash) % 41 + 60; // 60-100%
    }

    displayFeaturedCouple() {
        const container = document.getElementById('featuredCoupleContainer');
        if (!container) {
            console.error('🔧 Featured couple container not found!');
            return;
        }

        console.log('🔧 Displaying featured couple...');
        console.log('🔧 Available featured couples:', this.featuredCouples.length);

        if (this.featuredCouples.length === 0) {
            console.log('🔧 No featured couples, creating one...');
            this.createSampleFeaturedCouple();
        }

        const currentFeatured = this.featuredCouples[0];
        console.log('🔧 Current featured couple:', currentFeatured);
        
        container.innerHTML = `
            <div class="featured-couple-card">
                <div class="featured-badge">🌟 Couple of the Week</div>
                
                <div class="couple-hero">
                    <div class="couple-avatars">
                        <div class="avatar">${this.getInitial(currentFeatured.coupleNames.split('&')[0]?.trim()) || 'A'}</div>
                        <div class="heart-connector">❤️</div>
                        <div class="avatar">${this.getInitial(currentFeatured.coupleNames.split('&')[1]?.trim()) || 'B'}</div>
                    </div>
                    
                    <div class="couple-info">
                        <h3>${currentFeatured.coupleNames}</h3>
                        <div class="love-percentage-featured">
                            ${currentFeatured.lovePercentage}% Match
                        </div>
                        <div class="votes-count">
                            <span class="vote-number">${currentFeatured.votes}</span>
                            <span class="vote-label">community votes</span>
                        </div>
                        ${currentFeatured.likes ? `
                        <div class="likes-count">
                            <span class="like-number">${currentFeatured.likes}</span>
                            <span class="like-label">story likes</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="featured-story">
                    <p>"${currentFeatured.storyExcerpt}"</p>
                </div>

                <div class="featured-actions">
                    <button class="vote-btn" onclick="coupleOfWeek.voteForCouple('${currentFeatured.id}')">
                        ❤️ Vote for This Couple
                    </button>
                    <button class="share-featured-btn" onclick="coupleOfWeek.shareFeaturedCouple('${currentFeatured.id}')">
                        📢 Share Their Story
                    </button>
                </div>

                <div class="week-info">
                    Week ${currentFeatured.week} • ${currentFeatured.isSample ? 'Sample Feature' : 'Featured on ' + new Date(currentFeatured.featuredDate).toLocaleDateString()}
                </div>
            </div>

            ${this.featuredCouples.length > 1 ? `
                <div class="previous-couples">
                    <h4>Previous Featured Couples</h4>
                    <div class="previous-couples-grid">
                        ${this.featuredCouples.slice(1, 4).map(couple => `
                            <div class="previous-couple">
                                <span class="couple-names">${couple.coupleNames}</span>
                                <span class="couple-percentage">${couple.lovePercentage}%</span>
                                <span class="couple-week">Week ${couple.week}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        this.setupVoting();
        console.log('🔧 Featured couple displayed successfully');
    }

    getInitial(name) {
        return name ? name.charAt(0).toUpperCase() : '?';
    }

    setupVoting() {
        const votedCouples = JSON.parse(localStorage.getItem('votedCouples')) || {};
        const currentFeatured = this.featuredCouples[0];
        
        if (currentFeatured && votedCouples[currentFeatured.id]) {
            const voteBtn = document.querySelector('.vote-btn');
            if (voteBtn) {
                voteBtn.disabled = true;
                voteBtn.textContent = '✅ Already Voted';
                voteBtn.style.opacity = '0.7';
            }
        }
    }

    voteForCouple(coupleId) {
        console.log('🔧 Voting for couple:', coupleId);
        const couple = this.featuredCouples.find(c => c.id === coupleId);
        if (!couple) {
            console.error('🔧 Couple not found for voting');
            return;
        }

        const votedCouples = JSON.parse(localStorage.getItem('votedCouples')) || {};
        
        if (votedCouples[coupleId]) {
            this.showNotification('You already voted for this couple! ❤️');
            return;
        }

        couple.votes++;
        votedCouples[coupleId] = true;
        
        this.saveFeaturedCouples();
        localStorage.setItem('votedCouples', JSON.stringify(votedCouples));
        
        this.displayFeaturedCouple();
        this.showNotification('Thank you for voting! 🗳️');
        
        // Trigger achievement check
        if (typeof achievementSystem !== 'undefined') {
            achievementSystem.recordVote();
        }
    }

    shareFeaturedCouple(coupleId) {
        const couple = this.featuredCouples.find(c => c.id === coupleId);
        if (!couple) return;

        const text = `🌟 Vote for ${couple.coupleNames} - Couple of the Week on Lovculator! \n\nThey have a ${couple.lovePercentage}% love match! \n\nShow your support: ${window.location.href}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Couple of the Week',
                text: text,
                url: window.location.href,
            });
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Copied to clipboard! 📋');
            }).catch(() => {
                // Final fallback
                prompt('Copy this text to share:', text);
            });
        }
    }

    showFeaturedNotification(couple) {
        console.log('🔧 New featured couple notification:', couple.coupleNames);
        // This will be handled by the display method
    }

    showNotification(message) {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.couple-notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = 'couple-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
            font-weight: 500;
        `;
        
        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    saveFeaturedCouples() {
        localStorage.setItem('featuredCouples', JSON.stringify(this.featuredCouples));
        console.log('🔧 Saved featured couples to localStorage');
    }
}

// Initialize with error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Couple of the Week...');
        window.coupleOfWeek = new CoupleOfWeek();
        console.log('✅ Couple of the Week initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Couple of the Week:', error);
        // Create a fallback display
        const container = document.getElementById('featuredCoupleContainer');
        if (container) {
            container.innerHTML = `
                <div class="featured-couple-card">
                    <div class="featured-badge">🌟 Couple of the Week</div>
                    <div style="text-align: center; padding: 40px 20px;">
                        <div style="font-size: 3rem; margin-bottom: 15px;">💕</div>
                        <h3>Featured Couples Coming Soon!</h3>
                        <p>Share your love story to be featured here!</p>
                        <button class="vote-btn" onclick="document.getElementById('storyFab').click()">
                            Share Your Story
                        </button>
                    </div>
                </div>
            `;
        }
    }
});