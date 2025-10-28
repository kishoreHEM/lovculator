// Instagram Style Navigation
class Navigation {
    constructor() {
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        // Update active link based on current page
        this.updateActiveLink();

        // Add click handlers for navigation
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Don't prevent default - let the link work normally
                this.handleLinkClick(e.currentTarget);
            });
        });

        // Handle mobile menu
        this.handleMobileMenu();

        console.log('💖 Navigation initialized - Current page:', this.currentPage);
    }

    getCurrentPage() {
        const path = window.location.pathname;
        // Handle different URL formats
        if (path === '/' || path === '' || path.endsWith('index.html')) {
            return 'index.html';
        }
        // Extract filename from path
        return path.split('/').pop() || 'index.html';
    }

    handleLinkClick(clickedLink) {
        // Update active state immediately for better UX
        this.setActiveLink(clickedLink);
        
        // Optional: Add smooth transition effect
        this.addClickFeedback(clickedLink);
    }

    setActiveLink(activeLink) {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
    }

    updateActiveLink() {
        this.navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            
            // Handle different link formats
            if (this.isLinkActive(linkHref)) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    isLinkActive(linkHref) {
        // Handle exact matches
        if (linkHref === this.currentPage) {
            return true;
        }

        // Handle index.html variations
        if ((this.currentPage === 'index.html' || this.currentPage === '/') && 
            (linkHref === 'index.html' || linkHref === './' || linkHref === '/')) {
            return true;
        }

        // Handle about.html, contact.html, etc.
        if (this.currentPage === linkHref) {
            return true;
        }

        return false;
    }

    addClickFeedback(link) {
        // Add temporary active state for better UX
        link.style.transform = 'scale(0.95)';
        setTimeout(() => {
            link.style.transform = 'scale(1)';
        }, 150);
    }

    handleMobileMenu() {
        // Add mobile menu toggle if needed in the future
        if (window.innerWidth <= 768) {
            // Mobile-specific enhancements can go here
            this.addMobileEnhancements();
        }
    }

    addMobileEnhancements() {
        // Example: Add touch feedback for mobile
        this.navLinks.forEach(link => {
            link.style.transition = 'all 0.2s ease';
        });
    }

    // Method to manually update navigation (useful for SPAs)
    updateForPage(pageName) {
        this.currentPage = pageName;
        this.updateActiveLink();
    }
}

// Enhanced initialization with error handling
function initializeNavigation() {
    try {
        window.appNavigation = new Navigation();
        
        // Export for global access if needed
        window.updateNavigation = (page) => {
            if (window.appNavigation) {
                window.appNavigation.updateForPage(page);
            }
        };
        
    } catch (error) {
        console.error('❌ Navigation initialization failed:', error);
        
        // Fallback: Simple active link highlighting
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('active');
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
    initializeNavigation();
}

// Handle page transitions (useful for SPAs)
window.addEventListener('popstate', () => {
    if (window.appNavigation) {
        window.appNavigation.currentPage = window.appNavigation.getCurrentPage();
        window.appNavigation.updateActiveLink();
    }
});