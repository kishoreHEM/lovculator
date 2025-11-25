// frontend/js/fab-manager.js
class FabManager {
    constructor() {
        this.fabButtons = new Map();
        this.init();
    }

    init() {
        // Initialize FAB buttons based on page
        this.detectPageAndInitFAB();
    }

    detectPageAndInitFAB() {
        const path = window.location.pathname;
        
        if (path.includes('stories') || path === '/') {
            this.initStoriesFAB();
        }
        
        if (path.includes('questions')) {
            this.initQuestionsFAB();
        }
        
        if (path.includes('profile')) {
            this.initProfileFAB();
        }
    }

    initStoriesFAB() {
        const fab = document.getElementById('storyFab');
        if (!fab) return;

        fab.addEventListener('click', (e) => {
            e.preventDefault();
            this.openStoryModal();
        });

        this.fabButtons.set('stories', fab);
        console.log('✅ Stories FAB initialized');
    }

    initQuestionsFAB() {
        const fab = document.getElementById('askFab');
        if (!fab) return;

        fab.addEventListener('click', (e) => {
            e.preventDefault();
            this.openAskModal();
        });

        this.fabButtons.set('questions', fab);
        console.log('✅ Questions FAB initialized');
    }

    initProfileFAB() {
        const fab = document.getElementById('editProfileFab');
        if (!fab) return;

        fab.addEventListener('click', (e) => {
            e.preventDefault();
            this.openEditProfileModal();
        });

        this.fabButtons.set('profile', fab);
        console.log('✅ Profile FAB initialized');
    }

    openStoryModal() {
        const storyModal = document.getElementById('storyModal');
        if (storyModal) {
            storyModal.classList.remove('hidden');
        } else {
            console.warn('Story modal not found on this page');
        }
    }

    openAskModal() {
        const askModal = document.getElementById('askCreateModal');
        if (askModal) {
            askModal.classList.remove('hidden');
        } else {
            console.warn('Ask modal not found on this page');
        }
    }

    openEditProfileModal() {
        const profileModal = document.getElementById('editProfileModal');
        if (profileModal) {
            profileModal.classList.remove('hidden');
        } else {
            console.warn('Edit profile modal not found on this page');
        }
    }

    // Show/hide FAB based on scroll
    initScrollBehavior() {
        let lastScrollTop = 0;
        const fab = document.querySelector('.fab-button');
        
        if (!fab) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                fab.style.transform = 'translateY(100px)';
            } else {
                // Scrolling up
                fab.style.transform = 'translateY(0)';
            }
            
            lastScrollTop = scrollTop;
        });
    }

    // Add pulse animation for new content
    pulseFAB() {
        const fab = document.querySelector('.fab-button');
        if (fab) {
            fab.classList.add('pulse');
            setTimeout(() => fab.classList.remove('pulse'), 1000);
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FabManager };
}