// SUPER SAFE Minimal Navigation
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('🚀 Safe mobile menu initializing...');
        
        const menuToggle = document.querySelector('.menu-toggle');
        const navMenu = document.querySelector('.nav-menu');
        const overlay = document.querySelector('.mobile-menu-overlay');

        // Safe element check
        if (!menuToggle || !navMenu) {
            console.log('ℹ️ No mobile menu found on this page');
            return;
        }

        console.log('✅ Mobile menu elements found');

        // Safe event listeners
        function handleMenuToggle() {
            try {
                menuToggle.classList.toggle('active');
                navMenu.classList.toggle('active');
                
                if (overlay) {
                    overlay.classList.toggle('active');
                }
                
                document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
                
                console.log('Menu state:', navMenu.classList.contains('active') ? 'OPEN' : 'CLOSED');
            } catch (error) {
                console.error('❌ Error in menu toggle:', error);
            }
        }

        function handleOverlayClick() {
            try {
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            } catch (error) {
                console.error('❌ Error in overlay click:', error);
            }
        }

        function handleNavLinkClick() {
            try {
                if (window.innerWidth <= 768) {
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            } catch (error) {
                console.error('❌ Error in nav link click:', error);
            }
        }

        function handleEscapeKey(e) {
            try {
                if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            } catch (error) {
                console.error('❌ Error in escape key handler:', error);
            }
        }

        // Add event listeners safely
        menuToggle.addEventListener('click', handleMenuToggle);
        
        if (overlay) {
            overlay.addEventListener('click', handleOverlayClick);
        }

        // Safe nav link handling
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', handleNavLinkClick);
        });

        document.addEventListener('keydown', handleEscapeKey);

        console.log('💖 Safe mobile menu ready!');

    } catch (error) {
        console.error('💥 CRITICAL: Mobile menu initialization failed:', error);
    }
});