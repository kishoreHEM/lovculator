// =============================================
// FAB NOTIFICATION SYSTEM - Add this at the END
// =============================================

class FABNotificationSystem {
    constructor() {
        this.init();
    }

    init() {
        this.setupFABNotifications();
        this.addFABStyles();
        this.setupScrollNotifications();
        this.setupEnhancedFABEffects();
    }

    setupFABNotifications() {
        const storyFab = document.getElementById('storyFab');
        const storyModal = document.getElementById('storyModal');
        
        if (storyFab) {
            // Add notification badge to FAB
            const notificationBadge = document.createElement('div');
            notificationBadge.className = 'fab-notification-badge';
            notificationBadge.textContent = '!';
            notificationBadge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: linear-gradient(135deg, #ff6b6b, #ff4b8d);
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                animation: pulse 2s infinite;
                box-shadow: 0 2px 8px rgba(255, 75, 141, 0.4);
            `;
            
            storyFab.style.position = 'relative';
            storyFab.appendChild(notificationBadge);
            
            // Add tooltip on hover
            storyFab.setAttribute('title', 'Write your beautiful love story here!');
            
            // Add click handler with notification
            storyFab.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Show notification message
                this.showFabNotification();
                
                // Open modal after a short delay
                setTimeout(() => {
                    if (storyModal) {
                        storyModal.classList.remove('hidden');
                        document.body.style.overflow = 'hidden';
                    }
                }, 800);
            });
        }
    }

    showFabNotification() {
        // Remove existing notification if any
        const existingNotification = document.querySelector('.fab-notification-toast');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification toast
        const notification = document.createElement('div');
        notification.className = 'fab-notification-toast';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">💖</span>
                <div>
                    <strong>Share Your Love Story!</strong>
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 2px;">
                        Write your beautiful love story here
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Add arrow pointing to FAB
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: fixed;
            bottom: 85px;
            right: 45px;
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 8px solid #ff4b8d;
            z-index: 1001;
            animation: slideUpFade 0.5s ease-out;
        `;
        document.body.appendChild(arrow);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(10px)';
                notification.style.transition = 'all 0.3s ease';
                
                if (arrow.parentNode) {
                    arrow.style.opacity = '0';
                    arrow.style.transition = 'all 0.3s ease';
                }
                
                setTimeout(() => {
                    notification.remove();
                    arrow.remove();
                }, 300);
            }
        }, 3000);
    }

    addFABStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fabPulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            
            .fab-notification-badge {
                animation: fabPulse 2s ease-in-out infinite;
            }
            
            .fab-notification-toast {
                position: fixed;
                bottom: 100px;
                right: 30px;
                background: linear-gradient(135deg, #ff4b8d, #ff6b6b);
                color: white;
                padding: 15px 20px;
                border-radius: 25px;
                box-shadow: 0 8px 25px rgba(255, 75, 141, 0.4);
                z-index: 1001;
                animation: slideUpFade 0.5s ease-out;
                max-width: 280px;
                font-weight: 600;
                text-align: center;
                line-height: 1.4;
            }
            
            @keyframes slideUpFade {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .fab-button:hover .fab-notification-badge {
                animation: fabPulse 0.5s ease-in-out infinite;
            }
        `;
        document.head.appendChild(style);
    }

    setupScrollNotifications() {
        // Show notification when user scrolls near bottom (indicating they might want to share)
        window.addEventListener('scroll', () => {
            const scrollPosition = window.scrollY + window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            // If user is near bottom of page and hasn't seen notification recently
            if (scrollPosition >= documentHeight - 500) {
                const lastBottomNotification = localStorage.getItem('lastBottomNotification');
                const now = Date.now();
                
                if (!lastBottomNotification || (now - parseInt(lastBottomNotification)) > 300000) { // 5 minutes
                    this.showFabNotification();
                    localStorage.setItem('lastBottomNotification', now.toString());
                }
            }
        });
    }

    setupEnhancedFABEffects() {
        const storyFab = document.getElementById('storyFab');
        if (storyFab) {
            storyFab.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.1)';
            });
            
            storyFab.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
        }
    }
}

// Initialize FAB Notifications when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize FAB Notification System
    const fabNotifications = new FABNotificationSystem();
    
    // Show notification on page load after a delay
    setTimeout(() => {
        const hasSeenNotification = localStorage.getItem('fabNotificationSeen');
        if (!hasSeenNotification) {
            fabNotifications.showFabNotification();
            localStorage.setItem('fabNotificationSeen', 'true');
        }
    }, 2000);
});