// Complete Navigation with Mobile Menu
class Navigation {
    constructor() {
        this.menuToggle = document.querySelector('.menu-toggle');
        this.mobileOverlay = document.querySelector('.mobile-menu-overlay');
        this.navMenu = document.querySelector('.nav-menu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    init() {
        console.log('🚀 Initializing navigation...');
        
        // Update active link based on current page
        this.updateActiveLink();

        // Setup mobile menu functionality
        this.setupMobileMenu();

        // Setup regular navigation
        this.setupNavigation();

        console.log('💖 Navigation & Mobile Menu initialized - Current page:', this.currentPage);
    }

    // Mobile Menu Methods
    setupMobileMenu() {
        console.log('📱 Setting up mobile menu...');
        
        if (this.menuToggle && this.mobileOverlay && this.navMenu) {
            console.log('✅ Mobile menu elements found');
            
            // Menu toggle button
            this.menuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });

            // Overlay click to close
            this.mobileOverlay.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeMenu();
            });

            // Close menu when clicking nav links (mobile)
            this.navLinks.forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 768) {
                        this.closeMenu();
                    }
                });
            });

            // Close menu on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeMenu();
                }
            });

            // Close menu when clicking outside on mobile
            document.addEventListener('click', (e) => {
                if (window.innerWidth <= 768 && 
                    this.navMenu.classList.contains('active') &&
                    !this.navMenu.contains(e.target) &&
                    !this.menuToggle.contains(e.target)) {
                    this.closeMenu();
                }
            });

        } else {
            console.log('❌ Mobile menu elements missing:', {
                menuToggle: !!this.menuToggle,
                mobileOverlay: !!this.mobileOverlay,
                navMenu: !!this.navMenu
            });
        }
    }

    toggleMenu() {
        console.log('🍔 Toggling mobile menu');
        const isOpen = this.menuToggle.classList.contains('active');
        
        if (isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        console.log('📖 Opening mobile menu');
        this.menuToggle.classList.add('active');
        this.mobileOverlay.classList.add('active');
        this.navMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Update ARIA attributes
        this.menuToggle.setAttribute('aria-expanded', 'true');
        this.navMenu.setAttribute('aria-hidden', 'false');
    }

    closeMenu() {
        console.log('📕 Closing mobile menu');
        this.menuToggle.classList.remove('active');
        this.mobileOverlay.classList.remove('active');
        this.navMenu.classList.remove('active');
        document.body.style.overflow = '';
        
        // Update ARIA attributes
        this.menuToggle.setAttribute('aria-expanded', 'false');
        this.navMenu.setAttribute('aria-hidden', 'true');
    }

    // Regular Navigation Methods
    setupNavigation() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                this.handleLinkClick(e.currentTarget);
            });
        });
    }

    getCurrentPage() {
        const path = window.location.pathname;
        console.log('📍 Current path:', path);
        
        if (path === '/' || path === '' || path.includes('index')) return 'home';
        if (path.includes('about')) return 'about';
        if (path.includes('contact')) return 'contact';
        if (path.includes('record')) return 'record';
        return 'home';
    }

    handleLinkClick(clickedLink) {
        console.log('🔗 Link clicked:', clickedLink.getAttribute('href'));
        this.setActiveLink(clickedLink);
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
            const cleanHref = this.cleanHref(linkHref);
            const cleanCurrent = this.currentPage;
            
            if (this.isLinkActive(cleanHref, cleanCurrent)) {
                link.classList.add('active');
                console.log('🎯 Active link:', linkHref);
            }
        });
    }

    cleanHref(href) {
        return href.replace('/', '').replace('.html', '').replace('./', '') || 'home';
    }

    isLinkActive(linkHref, currentPage) {
        // Home page special case
        if (currentPage === 'home' && (linkHref === 'home' || linkHref === '' || linkHref === 'index')) {
            return true;
        }
        
        // Other pages
        return linkHref === currentPage;
    }
}

// Initialize with error handling
function initializeNavigation() {
    try {
        console.log('🚀 Starting navigation initialization...');
        window.appNavigation = new Navigation();
    } catch (error) {
        console.error('❌ Navigation initialization failed:', error);
        
        // Fallback: Simple active state
        const path = window.location.pathname;
        document.querySelectorAll('.nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if ((path === '/' && (href === '/' || href === 'index.html')) ||
                (path.includes(href) && href !== '/')) {
                link.classList.add('active');
            }
        });
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
    initializeNavigation();
}