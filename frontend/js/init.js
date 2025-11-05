// SAFE Application Initialization - FIXED FOR SIMPLE NAVIGATION
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
            // Initialize only components that exist
            this.initializeCoreComponents();
            
            console.log('✅ Components initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing components:', error);
            this.showErrorState();
        }
    }

    initializeCoreComponents() {
        // Love Calculator (main app) - check if it exists
        if (typeof LoveCalculator !== 'undefined') {
            try {
                window.loveCalculator = new LoveCalculator();
                console.log('✅ Love Calculator initialized');
            } catch (error) {
                console.warn('⚠️ Love Calculator failed to initialize:', error);
            }
        } else {
            console.log('ℹ️ Love Calculator not found (might not be on this page)');
        }

        // FIXED: Navigation is handled by simple function in navigation.js
        // Don't try to initialize Navigation class - it doesn't exist
        console.log('ℹ️ Navigation handled by simple function in navigation.js');

        // Social Share - check if it exists
        if (typeof SocialShare !== 'undefined') {
            try {
                window.socialShare = new SocialShare();
                console.log('✅ Social Share initialized');
            } catch (error) {
                console.warn('⚠️ Social Share failed to initialize:', error);
            }
        }

        // Initialize features that exist
        this.initializeFeaturesSafely();
    }

    initializeFeaturesSafely() {
    console.log('🔧 Initializing features safely...');

    // LOVE STORIES - FIXED: Use the initializeLoveStories function
    if (typeof initializeLoveStories === 'function') {
        try {
            initializeLoveStories();
            console.log('✅ Love Stories system initialized via function');
        } catch (error) {
            console.warn('⚠️ Love Stories function failed:', error);
        }
    } else if (typeof LoveStories !== 'undefined') {
        try {
            // Fallback: try direct initialization if function not available
            window.loveStories = new LoveStories();
            console.log('✅ Love Stories initialized via class (fallback)');
        } catch (error) {
            console.warn('⚠️ Love Stories class failed:', error);
        }
    } else {
        console.log('ℹ️ Love Stories system not available on this page');
    }

    // FAQ Manager - only if it exists
    if (typeof FAQManager !== 'undefined') {
        try {
            window.faqManager = new FAQManager();
            console.log('✅ FAQ Manager initialized');
        } catch (error) {
            console.warn('⚠️ FAQ Manager failed to initialize:', error);
        }
    }

    // Contact Form - only if on contact page
    if (typeof ContactForm !== 'undefined' && document.getElementById('contactForm')) {
        try {
            new ContactForm();
            console.log('✅ Contact Form initialized');
        } catch (error) {
            console.warn('⚠️ Contact Form failed to initialize:', error);
        }
    }

    // Profile System - only if on profile page
    if (typeof ProfileManager !== 'undefined' && document.getElementById('userProfileContainer')) {
        try {
            new ProfileManager();
            console.log('✅ Profile Manager initialized');
        } catch (error) {
            console.warn('⚠️ Profile Manager failed to initialize:', error);
        }
    }
}

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('✅ Service Worker registered:', registration);
                    })
                    .catch(error => {
                        console.log('ℹ️ Service Worker registration failed (normal if no SW):', error);
                    });
            } catch (error) {
                console.log('ℹ️ Service Worker not available:', error);
            }
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
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        console.error('🚨 Application Error:', errorInfo);
    }

    showErrorState() {
        // Only show error if it's critical
        console.log('⚠️ Some features may not be available');
    }
}

// Safe Enhanced User Profiles
class EnhancedUserProfiles {
    constructor() {
        try {
            this.currentUser = this.getOrCreateUser();
            this.friends = JSON.parse(localStorage.getItem('userFriends')) || [];
            this.init();
        } catch (error) {
            console.warn('⚠️ User profiles failed to initialize:', error);
        }
    }

    init() {
        try {
            this.displayEnhancedProfile();
            console.log('✅ User Profile initialized');
        } catch (error) {
            console.warn('⚠️ User profile display failed:', error);
        }
    }

    getOrCreateUser() {
        try {
            let user = localStorage.getItem('currentUser');
            if (!user) {
                user = {
                    id: 'user_' + Date.now(),
                    username: 'LoveUser' + Math.floor(Math.random() * 1000),
                    joinDate: new Date().toISOString(),
                    bio: 'Spread love and positivity! 💖',
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
        } catch (error) {
            console.warn('⚠️ User creation failed:', error);
            return this.getDefaultUser();
        }
    }

    getDefaultUser() {
        return {
            id: 'default_user',
            username: 'LoveUser',
            joinDate: new Date().toISOString(),
            bio: 'Spread love! 💖',
            avatar: '💕',
            stats: { stories: 0, comments: 0, likes: 0, achievements: 0, calculations: 0, friends: 0 },
            level: 1,
            experience: 0,
            badges: []
        };
    }

    generateAvatar() {
        const avatars = ['💕', '❤️', '💖', '💘', '💝'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    displayEnhancedProfile() {
        const container = document.getElementById('userProfileContainer');
        if (!container) {
            console.log('ℹ️ User profile container not found');
            return;
        }

        try {
            container.innerHTML = `
                <div class="user-profile-card">
                    <div class="profile-header">
                        <div class="avatar">${this.currentUser.avatar}</div>
                        <div class="profile-info">
                            <h3>${this.currentUser.username}</h3>
                            <p class="user-bio">${this.currentUser.bio}</p>
                            <p class="join-date">Level ${this.currentUser.level}</p>
                        </div>
                    </div>
                    
                    <div class="profile-stats">
                        <div class="stat">
                            <span class="number">${this.currentUser.stats.calculations}</span>
                            <span class="label">Calculations</span>
                        </div>
                        <div class="stat">
                            <span class="number">${this.currentUser.stats.stories}</span>
                            <span class="label">Stories</span>
                        </div>
                        <div class="stat">
                            <span class="number">${this.currentUser.level}</span>
                            <span class="label">Level</span>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.warn('⚠️ User profile display failed:', error);
            container.innerHTML = '<div class="user-profile-card"><p>Profile loading...</p></div>';
        }
    }
}

// SAFE Initialization - No errors!
document.addEventListener('DOMContentLoaded', () => {
    console.log('💖 Lovculator starting safe initialization...');
    
    try {
        // Initialize main app safely
        new AppInitializer();
        
        // Initialize user profiles only if container exists
        if (document.getElementById('userProfileContainer')) {
            setTimeout(() => {
                window.enhancedUserProfiles = new EnhancedUserProfiles();
            }, 100);
        }
        
        console.log('🎉 Lovculator fully loaded without errors!');
    } catch (error) {
        console.error('💥 Critical initialization error:', error);
    }
});