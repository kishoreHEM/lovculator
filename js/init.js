// Main Application Initialization
class AppInitializer {
    constructor() {
        this.init();
    }

    init() {
        this.waitForDOM().then(() => {
            this.initializeComponents();
            this.setupGlobalErrorHandling();
            this.setupServiceWorker();
        });
    }

    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }

    initializeComponents() {
        console.log('🚀 Initializing Lovculator App...');
        
        try {
            // Initialize core components in order
            this.initializeCoreComponents();
            this.initializeSocialFeatures();
            this.initializeAdditionalFeatures();
            
            console.log('✅ All components initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing components:', error);
            this.showErrorState();
        }
    }

    initializeCoreComponents() {
        // Love Calculator (main app)
        if (typeof LoveCalculator !== 'undefined') {
            window.loveCalculator = new LoveCalculator();
            console.log('✅ Love Calculator initialized');
        }

        // Navigation
        if (typeof Navigation !== 'undefined') {
            new Navigation();
            console.log('✅ Navigation initialized');
        }

        // Social Share
        if (typeof SocialShare !== 'undefined') {
            window.socialShare = new SocialShare();
            console.log('✅ Social Share initialized');
        }
    }

    initializeSocialFeatures() {
        // Love Stories
        if (typeof LoveStories !== 'undefined') {
            window.loveStories = new LoveStories();
            console.log('✅ Love Stories initialized');
        }

        // Achievements System
        if (typeof AchievementSystem !== 'undefined') {
            window.achievementSystem = new AchievementSystem();
            console.log('✅ Achievement System initialized');
        }

        // Couple of the Week
        if (typeof CoupleOfWeek !== 'undefined') {
            window.coupleOfWeek = new CoupleOfWeek();
            console.log('✅ Couple of the Week initialized');
        }

        // Social Challenges
        if (typeof SocialChallenges !== 'undefined') {
            window.socialChallenges = new SocialChallenges();
            console.log('✅ Social Challenges initialized');
        }
    }

    initializeAdditionalFeatures() {
        // Contact Form (if on contact page)
        if (typeof ContactForm !== 'undefined' && document.getElementById('contactForm')) {
            new ContactForm();
            console.log('✅ Contact Form initialized');
        }

        // Setup inter-component communication
        this.setupComponentCommunication();
        
        // Initialize analytics
        this.initializeAnalytics();
    }

    setupComponentCommunication() {
        // Global event bus for component communication
        window.appEvents = {
            emit: (eventName, data) => {
                const event = new CustomEvent(eventName, { detail: data });
                document.dispatchEvent(event);
            },
            on: (eventName, callback) => {
                document.addEventListener(eventName, callback);
            }
        };

        // Setup common events
        this.setupCommonEvents();
    }

    setupCommonEvents() {
        // When love is calculated
        document.addEventListener('calculationComplete', (e) => {
            if (window.achievementSystem) {
                window.achievementSystem.recordCalculation();
            }
            if (window.socialChallenges) {
                // Track for challenges if needed
            }
        });

        // When story is shared
        document.addEventListener('storyShared', (e) => {
            if (window.achievementSystem) {
                window.achievementSystem.recordStoryShared();
            }
            if (window.socialChallenges) {
                window.socialChallenges.updateChallengeProgress('challenge_1', 1);
            }
        });

        // When result is shared
        document.addEventListener('resultShared', (e) => {
            if (window.socialChallenges) {
                window.socialChallenges.updateChallengeProgress('challenge_3', 1);
            }
        });
    }

    initializeAnalytics() {
        // Basic analytics tracking
        this.trackPageView();
        this.setupPerformanceMonitoring();
    }

    trackPageView() {
        const pageName = document.title || 'Unknown Page';
        console.log(`📊 Page View: ${pageName}`);
        
        // You can integrate with Google Analytics here
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                page_title: pageName,
                page_location: window.location.href
            });
        }
    }

    setupPerformanceMonitoring() {
        // Monitor Core Web Vitals
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    console.log(`⚡ ${entry.name}:`, entry.value);
                });
            });
            
            observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input'] });
        }
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('❌ Service Worker registration failed:', error);
                });
        }
    }

    setupGlobalErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.logError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.logError(event.reason);
        });
    }

    logError(error) {
        // You can send errors to your error tracking service here
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        console.error('🚨 Application Error:', errorInfo);
    }

    showErrorState() {
        // Show a friendly error message to users
        const errorBanner = document.createElement('div');
        errorBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ff6b6b;
            color: white;
            padding: 10px;
            text-align: center;
            z-index: 10000;
            font-weight: 500;
        `;
        errorBanner.textContent = '⚠️ Some features may not be working properly. Please refresh the page.';
        
        document.body.appendChild(errorBanner);
        
        setTimeout(() => {
            errorBanner.remove();
        }, 5000);
    }
}

// Enhanced User Profiles with Social Integration
class EnhancedUserProfiles {
    constructor() {
        this.currentUser = this.getOrCreateUser();
        this.friends = JSON.parse(localStorage.getItem('userFriends')) || [];
        this.init();
    }

    init() {
        this.displayEnhancedProfile();
        this.setupFriendSystem();
    }

    getOrCreateUser() {
        let user = localStorage.getItem('currentUser');
        if (!user) {
            user = {
                id: 'user_' + Date.now(),
                username: 'LoveUser' + Math.floor(Math.random() * 1000),
                joinDate: new Date().toISOString(),
                bio: 'Spread love and positivity! 💖',
                interests: ['relationships', 'friendship', 'dating'],
                avatar: this.generateAvatar(),
                stats: {
                    stories: 0,
                    comments: 0,
                    likes: 0,
                    achievements: 0,
                    calculations: 0,
                    friends: 0
                },
                level: 1,
                experience: 0,
                badges: []
            };
            localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
            user = JSON.parse(user);
        }
        return user;
    }

    generateAvatar() {
        const avatars = ['💕', '❤️', '💖', '💘', '💝', '💞', '💓', '💗'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    displayEnhancedProfile() {
        const container = document.getElementById('userProfileContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="user-profile-card">
                <div class="profile-header">
                    <div class="avatar">${this.currentUser.avatar}</div>
                    <div class="profile-info">
                        <h3>${this.currentUser.username}</h3>
                        <p class="user-bio">${this.currentUser.bio}</p>
                        <p class="join-date">Level ${this.currentUser.level} • Joined ${new Date(this.currentUser.joinDate).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div class="experience-bar">
                    <div class="experience-fill" style="width: ${(this.currentUser.experience % 100)}%"></div>
                    <span class="experience-text">${this.currentUser.experience % 100}/100 XP</span>
                </div>
                
                <div class="profile-stats">
                    <div class="stat">
                        <span class="number">${this.currentUser.stats.stories}</span>
                        <span class="label">Stories</span>
                    </div>
                    <div class="stat">
                        <span class="number">${this.currentUser.stats.comments}</span>
                        <span class="label">Comments</span>
                    </div>
                    <div class="stat">
                        <span class="number">${this.currentUser.stats.likes}</span>
                        <span class="label">Likes</span>
                    </div>
                    <div class="stat">
                        <span class="number">${this.currentUser.stats.achievements}</span>
                        <span class="label">Badges</span>
                    </div>
                </div>
                
                ${this.friends.length > 0 ? `
                    <div class="friends-section">
                        <h4>Friends (${this.friends.length})</h4>
                        <div class="friends-list">
                            ${this.friends.slice(0, 6).map(friend => `
                                <div class="friend-avatar" title="${friend.username}">${friend.avatar}</div>
                            `).join('')}
                            ${this.friends.length > 6 ? `<div class="friend-more">+${this.friends.length - 6}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    setupFriendSystem() {
        // Listen for friend-related events
        document.addEventListener('userInteraction', (e) => {
            this.handleUserInteraction(e.detail);
        });
    }

    addExperience(points) {
        this.currentUser.experience += points;
        
        // Level up every 100 experience points
        if (this.currentUser.experience >= this.currentUser.level * 100) {
            this.levelUp();
        }
        
        this.saveUser();
        this.displayEnhancedProfile();
    }

    levelUp() {
        this.currentUser.level++;
        this.currentUser.experience = 0;
        
        // Show level up notification
        this.showLevelUpNotification();
        
        // Award level badge
        this.awardLevelBadge();
    }

    showLevelUpNotification() {
        const notification = document.createElement('div');
        notification.className = 'level-up-notification';
        notification.innerHTML = `
            <div class="level-up-content">
                <div class="level-up-icon">🎉</div>
                <h4>Level Up!</h4>
                <p>You reached Level ${this.currentUser.level}!</p>
                <div class="level-reward">+5 Friend Capacity</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    awardLevelBadge() {
        const badge = {
            id: `level_${this.currentUser.level}`,
            name: `Level ${this.currentUser.level} Lover`,
            icon: '⭐',
            unlockedAt: new Date().toISOString()
        };
        
        this.currentUser.badges.push(badge);
        this.saveUser();
    }

    addFriend(friendUser) {
        if (this.friends.length >= 5 + (this.currentUser.level * 5)) {
            this.showNotification('Friend list full! Level up to add more friends.');
            return;
        }
        
        if (!this.friends.find(f => f.id === friendUser.id)) {
            this.friends.push(friendUser);
            this.currentUser.stats.friends = this.friends.length;
            this.saveFriends();
            this.saveUser();
            this.displayEnhancedProfile();
            
            this.showNotification(`Added ${friendUser.username} as friend!`);
        }
    }

    handleUserInteraction(interaction) {
        // Add experience for various interactions
        switch(interaction.type) {
            case 'story_shared':
                this.addExperience(10);
                break;
            case 'comment_posted':
                this.addExperience(5);
                break;
            case 'like_given':
                this.addExperience(2);
                break;
            case 'calculation_done':
                this.addExperience(3);
                break;
        }
    }

    saveUser() {
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }

    saveFriends() {
        localStorage.setItem('userFriends', JSON.stringify(this.friends));
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'user-notification';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize the complete application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize main app
    new AppInitializer();
    
    // Initialize enhanced user profiles
    if (document.getElementById('userProfileContainer')) {
        window.enhancedUserProfiles = new EnhancedUserProfiles();
    }
    
    console.log('💖 Lovculator fully loaded and ready!');
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppInitializer, EnhancedUserProfiles };
}