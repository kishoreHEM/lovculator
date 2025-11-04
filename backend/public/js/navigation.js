// SUPER SAFE Minimal Navigation - FIXED VERSION
document.addEventListener('DOMContentLoaded', function() {
    try {
        console.log('🚀 Safe mobile menu initializing...');
        
        const menuToggle = document.querySelector('.menu-toggle');
        const navMenu = document.querySelector('.nav-menu');
        const overlay = document.querySelector('.mobile-menu-overlay');

        // Safe element check with better debugging
        if (!menuToggle) {
            console.log('ℹ️ Menu toggle not found');
            return;
        }
        
        if (!navMenu) {
            console.log('ℹ️ Nav menu not found');
            return;
        }

        console.log('✅ Mobile menu elements found:', {
            menuToggle: !!menuToggle,
            navMenu: !!navMenu,
            overlay: !!overlay
        });

        // Debug: Check if nav links exist - REMOVED DUPLICATE DECLARATION
        const debugNavLinks = document.querySelectorAll('.nav-menu .nav-link');
        console.log('🔍 Nav links found:', debugNavLinks.length);
        debugNavLinks.forEach((link, index) => {
            console.log(`   Link ${index + 1}:`, link.textContent);
        });

        // Safe event listeners
        function handleMenuToggle() {
            try {
                console.log('🎯 Menu toggle clicked');
                menuToggle.classList.toggle('active');
                navMenu.classList.toggle('active');
                
                if (overlay) {
                    overlay.classList.toggle('active');
                }
                
                // Toggle body overflow
                if (navMenu.classList.contains('active')) {
                    document.body.style.overflow = 'hidden';
                    console.log('📱 Menu opened');
                } else {
                    document.body.style.overflow = '';
                    console.log('📱 Menu closed');
                }
                
            } catch (error) {
                console.error('❌ Error in menu toggle:', error);
            }
        }

        function handleOverlayClick() {
            try {
                console.log('🎯 Overlay clicked');
                menuToggle.classList.remove('active');
                navMenu.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            } catch (error) {
                console.error('❌ Error in overlay click:', error);
            }
        }

        function handleNavLinkClick(e) {
            try {
                console.log('🎯 Nav link clicked:', e.target.textContent);
                if (window.innerWidth <= 768) {
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                    console.log('📱 Mobile menu closed after link click');
                }
                // Allow default link behavior
            } catch (error) {
                console.error('❌ Error in nav link click:', error);
            }
        }

        function handleEscapeKey(e) {
            try {
                if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                    console.log('🎯 Escape key pressed');
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            } catch (error) {
                console.error('❌ Error in escape key handler:', error);
            }
        }

        function handleResize() {
            try {
                if (window.innerWidth > 768 && navMenu.classList.contains('active')) {
                    console.log('🖥️ Desktop size detected, closing mobile menu');
                    menuToggle.classList.remove('active');
                    navMenu.classList.remove('active');
                    if (overlay) overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            } catch (error) {
                console.error('❌ Error in resize handler:', error);
            }
        }

        // Add event listeners safely
        console.log('🔗 Adding event listeners...');
        
        menuToggle.addEventListener('click', handleMenuToggle);
        
        if (overlay) {
            overlay.addEventListener('click', handleOverlayClick);
        }

        // Safe nav link handling - ONLY for menu navigation links
        const navLinks = document.querySelectorAll('.nav-menu .nav-link'); // This is the only declaration now
        console.log('🔗 Adding click listeners to', navLinks.length, 'nav links');
        
        navLinks.forEach(link => {
            link.addEventListener('click', handleNavLinkClick);
        });

        document.addEventListener('keydown', handleEscapeKey);
        window.addEventListener('resize', handleResize);

        console.log('💖 Safe mobile menu ready!');

    } catch (error) {
        console.error('💥 CRITICAL: Mobile menu initialization failed:', error);
    }
});