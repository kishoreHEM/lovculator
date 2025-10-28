// Instagram Style Navigation
class Navigation {
    constructor() {
        this.navLinks = document.querySelectorAll('.nav-link');
        this.init();
    }

    init() {
        // Update active link based on current page
        this.updateActiveLink();

        // Add click handlers for navigation
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                this.setActiveLink(e.currentTarget);
            });
        });

        // Handle mobile menu if needed
        this.handleMobileMenu();

        console.log('💖 Instagram-style navigation loaded!');
    }

    setActiveLink(clickedLink) {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
        });
        clickedLink.classList.add('active');
    }

    updateActiveLink() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        this.navLinks.forEach(link => {
            const linkPage = link.getAttribute('href');
            if (linkPage === currentPage || 
                (currentPage === '' && linkPage === 'index.html') ||
                (currentPage === '/' && linkPage === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    handleMobileMenu() {
        // Add any mobile-specific navigation handling here
        if (window.innerWidth <= 768) {
            // Mobile-specific initialization if needed
        }
    }
}

// Initialize navigation when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new Navigation();
});

// Handle window resize
window.addEventListener('resize', () => {
    // You can add responsive behavior here if needed
});