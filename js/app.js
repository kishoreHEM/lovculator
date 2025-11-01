// Main Love Calculator Class with Enhanced PWA Features
class LoveCalculator {
    constructor() {
        this.form = document.getElementById('loveForm');
        this.result = document.getElementById('result');
        this.percentageElement = document.getElementById('percentage');
        this.messageElement = document.getElementById('message');
        this.displayName1 = document.getElementById('displayName1');
        this.displayName2 = document.getElementById('displayName2');
        this.againBtn = document.getElementById('calculateAgain');
        this.calculatorContent = document.querySelector('.calculator-content');
        
        this.APP_VERSION = '1.2.0'; // Updated version
        this.init();    
    }
    
    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.againBtn.addEventListener('click', () => this.resetForm());
        this.initPWA();
        this.initSocialShare();
        this.setupSocialIntegration();
        
        console.log('💖 Love Calculator initialized v' + this.APP_VERSION);
    }
    
    handleSubmit(e) {
        e.preventDefault();
        
        const name1 = document.getElementById('fin_person1').value.trim();
        const name2 = document.getElementById('fin_person2').value.trim();
        const gender1 = document.querySelector('input[name="gender1"]:checked')?.value;
        const gender2 = document.querySelector('input[name="gender2"]:checked')?.value;
        
        if (!name1 || !name2) {
            this.showNotification('Please enter both names!');
            return;
        }
        
        if (name1 === name2) {
            this.showNotification('Please enter different names!');
            return;
        }
        
        if (!gender1 || !gender2) {
            this.showNotification('Please select genders for both people!');
            return;
        }
        
        const percentage = this.calculateLove(name1, name2, gender1, gender2);
        const message = this.generateMessage(percentage, gender1, gender2);
        
        // Track in stats
        window.simpleStats?.trackCalculation();
        
        // Check if dataManager exists before using it
        if (window.dataManager) {
            const calculation = window.dataManager.addLoveCalculation(
                [name1, name2],
                percentage,
                [gender1, gender2],
                message
            );
            window.dataManager.updateUserStats({ calculations: 1 });
            this.displayResult(name1, name2, percentage, message, calculation.id);
            this.checkCalculationAchievements();
        } else {
            // Fallback if dataManager is not available
            this.displayResult(name1, name2, percentage, message);
        }
    }
    
    // Add achievement checking
    checkCalculationAchievements() {
        if (!window.dataManager) return;
        
        const stats = window.dataManager.getCalculationStats();
        
        // First calculation achievement
        if (stats.total === 1) {
            window.dataManager.unlockAchievement({
                name: 'First Calculation!',
                description: 'Performed your first love calculation',
                icon: '🔮',
                points: 10,
                category: 'calculations'
            });
        }
        
        // 10 calculations achievement
        if (stats.total === 10) {
            window.dataManager.unlockAchievement({
                name: 'Love Detective',
                description: 'Performed 10 love calculations',
                icon: '🕵️',
                points: 50,
                category: 'calculations'
            });
        }
    }
    
    calculateLove(name1, name2, gender1, gender2) {
        // Enhanced algorithm with numerology and name compatibility
        const nameCompatibility = this.calculateNameCompatibility(name1, name2);
        const genderSynergy = this.calculateGenderSynergy(gender1, gender2);
        const astrologicalFactor = this.calculateAstrologicalFactor(name1, name2);
        
        // Combine factors with weights
        let percentage = (
            nameCompatibility * 0.6 +
            genderSynergy * 0.3 +
            astrologicalFactor * 0.1
        );
        
        // Add some randomness for fun
        const randomFactor = (Math.random() * 0.2) + 0.9; // 0.9-1.1
        percentage *= randomFactor;
        
        return Math.min(100, Math.max(0, Math.round(percentage)));
    }
    
    calculateNameCompatibility(name1, name2) {
        // Numerology-based calculation
        const value1 = this.nameToNumber(name1);
        const value2 = this.nameToNumber(name2);
        const compatibility = 100 - Math.abs(value1 - value2);
        return Math.max(0, compatibility);
    }
    
    nameToNumber(name) {
        return name.toLowerCase().split('').reduce((sum, char) => {
            const charCode = char.charCodeAt(0) - 96;
            return sum + (charCode > 0 && charCode <= 26 ? charCode : 0);
        }, 0) % 9 || 9;
    }
    
    calculateGenderSynergy(gender1, gender2) {
        const combinations = {
            'malemale': 75,
            'femalefemale': 75,
            'malefemale': 85,
            'femalemale': 85
        };
        return combinations[gender1 + gender2] || 70;
    }
    
    calculateAstrologicalFactor(name1, name2) {
        // Simple astrological-like calculation based on name lengths
        const length1 = name1.length;
        const length2 = name2.length;
        const lengthDiff = Math.abs(length1 - length2);
        return Math.max(0, 100 - (lengthDiff * 5));
    }
    
    generateMessage(percentage, gender1, gender2) {
        const pronouns1 = gender1 === 'male' ? 'He' : 'She';
        const pronouns2 = gender2 === 'male' ? 'he' : 'she';
        
        if (percentage >= 90) {
            return `Perfect Match! 💖 True love found! ${pronouns1} and ${pronouns2} complement each other perfectly!`;
        } else if (percentage >= 80) {
            return `Excellent! 🌟 Great potential for love! ${pronouns1} and ${pronouns2} have amazing chemistry!`;
        } else if (percentage >= 70) {
            return `Very Good! 💕 Strong connection! ${pronouns1} and ${pronouns2} understand each other well!`;
        } else if (percentage >= 60) {
            return `Good Match! 😊 Worth pursuing! ${pronouns1} and ${pronouns2} could build something special!`;
        } else if (percentage >= 50) {
            return `Average 👌 Could work with effort! ${pronouns1} and ${pronouns2} need to communicate more!`;
        } else if (percentage >= 40) {
            return `Below Average 🤔 Needs work! ${pronouns1} and ${pronouns2} have different perspectives!`;
        } else if (percentage >= 30) {
            return `Poor Match 😟 Challenging! ${pronouns1} and ${pronouns2} might face some obstacles!`;
        } else {
            return `Very Poor 💔 Not compatible! ${pronouns1} and ${pronouns2} have major differences!`;
        }
    }
    
    displayResult(name1, name2, percentage, message, calculationId) {
        this.displayName1.textContent = this.capitalize(name1);
        this.displayName2.textContent = this.capitalize(name2);
        
        // Hide form and show result
        this.form.style.display = 'none';
        this.result.classList.remove('hidden');
        
        // Scroll to result on mobile
        if (window.innerWidth <= 768) {
            this.result.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Animate percentage counter
        this.animatePercentage(0, percentage, 1500);
        this.messageElement.textContent = message;
        
        // Show share buttons after percentage animation completes
        setTimeout(() => {
            this.showShareButtons();
        }, 1600);
        
        // Trigger social events
        this.triggerCalculationComplete(percentage, name1, name2);
    }
    
    animatePercentage(start, end, duration) {
        const range = end - start;
        const startTime = performance.now();
        
        const updatePercentage = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (range * easeOutQuart));
            
            this.percentageElement.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(updatePercentage);
            } else {
                this.percentageElement.textContent = end;
                this.percentageElement.classList.add('pulse');
            }
        };
        
        requestAnimationFrame(updatePercentage);
    }
    
    resetForm() {
        // Reset form values
        this.form.reset();
        
        // Show form and hide result
        this.form.style.display = 'block';
        this.result.classList.add('hidden');
        this.percentageElement.classList.remove('pulse');
        
        // Hide share buttons
        this.hideShareButtons();
        
        // Scroll to form on mobile
        if (window.innerWidth <= 768) {
            this.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    capitalize(name) {
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
    
    // Enhanced PWA Methods - UPDATED 2024
    initPWA() {
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
            this.setupServiceWorkerLifecycle();
        }
        
        this.setupInstallPrompt();
        this.setupPWAFeatures();
    }

    registerServiceWorker() {
        const swUrl = this.getCorrectSWPath();
        
        if (!swUrl) {
            console.log('⚠️ Service Worker path not found');
            return;
        }

        navigator.serviceWorker.register(swUrl)
            .then(registration => {
                console.log('✅ SW registered scope:', registration.scope);
                
                // Check for updates every hour
                setInterval(() => registration.update(), 60 * 60 * 1000);
                
                return registration;
            })
            .catch(error => {
                console.error('❌ SW registration failed:', error);
                
                // Fallback: Try absolute path
                if (swUrl.startsWith('./')) {
                    const absoluteUrl = swUrl.replace('./', '/');
                    navigator.serviceWorker.register(absoluteUrl)
                        .then(reg => console.log('✅ SW registered with absolute path'))
                        .catch(err => console.error('❌ Absolute path also failed:', err));
                }
            });
    }

    getCorrectSWPath() {
        const path = window.location.pathname;
        
        // Handle different deployment environments
        if (path.includes('/love-stories') || 
            path.includes('/about') || 
            path.includes('/contact') ||
            path.includes('/record')) {
            return '../sw.js';
        } else if (path === '/' || path.endsWith('index.html')) {
            return './sw.js';
        } else {
            // For root level or unknown paths
            return '/sw.js';
        }
    }

    setupServiceWorkerLifecycle() {
        let isRefreshing = false;
        
        // Listen for controller change (update installed)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!isRefreshing) {
                isRefreshing = true;
                console.log('🔄 New SW activated, reloading...');
                window.location.reload();
            }
        });
        
        // Listen for messages from SW
        navigator.serviceWorker.addEventListener('message', event => {
            const { type, data } = event.data || {};
            
            switch (type) {
                case 'UPDATE_AVAILABLE':
                    this.showUpdatePrompt(data?.version);
                    break;
                case 'CACHE_UPDATED':
                    console.log('📦 Cache updated:', data?.cacheName);
                    break;
                case 'OFFLINE':
                    this.showOfflineIndicator();
                    break;
                case 'ONLINE':
                    this.hideOfflineIndicator();
                    break;
            }
        });
        
        // Check if update is waiting
        navigator.serviceWorker.ready.then(registration => {
            if (registration.waiting) {
                this.showUpdatePrompt();
            }
        });
    }

    showUpdatePrompt(version) {
        // Don't show if already refreshing
        if (document.querySelector('.update-prompt')) return;
        
        const prompt = document.createElement('div');
        prompt.className = 'update-prompt';
        prompt.innerHTML = `
            <div class="update-content">
                <div class="update-icon">🔄</div>
                <div class="update-text">
                    <strong>New Update Available!</strong>
                    ${version ? `Version ${version}` : 'Refresh to get the latest features'}
                </div>
                <div class="update-actions">
                    <button class="update-now">Update Now</button>
                    <button class="update-later">Later</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        // Add event listeners
        prompt.querySelector('.update-now').addEventListener('click', () => {
            // Tell SW to skip waiting and refresh
            navigator.serviceWorker.ready.then(registration => {
                if (registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                    window.location.reload();
                }
            });
            prompt.remove();
        });
        
        prompt.querySelector('.update-later').addEventListener('click', () => {
            prompt.remove();
            // Show again in 1 hour
            setTimeout(() => this.showUpdatePrompt(version), 60 * 60 * 1000);
        });
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (prompt.parentElement) {
                prompt.remove();
            }
        }, 30000);
    }

    setupPWAFeatures() {
        // Network status detection
        this.setupNetworkDetection();
        
        // Badging API for notifications
        this.setupAppBadging();
        
        // Periodic Sync for background updates
        this.setupPeriodicSync();
    }

    setupNetworkDetection() {
        const updateOnlineStatus = () => {
            if (!navigator.onLine) {
                this.showOfflineIndicator();
            } else {
                this.hideOfflineIndicator();
            }
        };
        
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus(); // Initial check
    }

    showOfflineIndicator() {
        let indicator = document.getElementById('offline-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.innerHTML = '🔴 You are offline';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #ff6b6b;
                color: white;
                padding: 10px;
                text-align: center;
                z-index: 10000;
                font-weight: 600;
            `;
            document.body.appendChild(indicator);
        }
    }

    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    setupAppBadging() {
        if ('setAppBadge' in navigator) {
            // Set initial badge (optional)
            navigator.setAppBadge(0).catch(console.error);
        }
    }

    setupPeriodicSync() {
        if ('periodicSync' in navigator && 'register' in navigator.periodicSync) {
            navigator.periodicSync.register('update-check', {
                minInterval: 24 * 60 * 60 * 1000 // 1 day
            }).then(() => {
                console.log('✅ Periodic sync registered');
            }).catch(console.error);
        }
    }

    // Enhanced install prompt with better UX
    setupInstallPrompt() {
        let deferredPrompt;
        const installPrompt = document.getElementById('installPrompt');
        
        if (!installPrompt) return;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show after user engagement
            const showPrompt = () => {
                if (deferredPrompt && !this.isAppInstalled() && !this.wasPromptDismissed()) {
                    installPrompt.classList.remove('hidden');
                    
                    // Auto-hide after 15 seconds
                    setTimeout(() => {
                        installPrompt.classList.add('hidden');
                        this.recordPromptDismissal();
                    }, 15000);
                }
            };
            
            // Show after 3 interactions or 30 seconds
            let interactions = 0;
            const interactionHandler = () => {
                interactions++;
                if (interactions >= 3) {
                    document.removeEventListener('click', interactionHandler);
                    showPrompt();
                }
            };
            
            document.addEventListener('click', interactionHandler);
            setTimeout(showPrompt, 30000);
        });
        
        // Handle install button
        document.getElementById('installBtn')?.addEventListener('click', async () => {
            if (deferredPrompt) {
                installPrompt.classList.add('hidden');
                deferredPrompt.prompt();
                
                const { outcome } = await deferredPrompt.userChoice;
                this.trackInstallation(outcome);
                deferredPrompt = null;
            }
        });
        
        // Handle cancel button
        document.getElementById('cancelInstall')?.addEventListener('click', () => {
            installPrompt.classList.add('hidden');
            this.recordPromptDismissal();
        });
    }

    wasPromptDismissed() {
        const dismissed = localStorage.getItem('installPromptDismissed');
        if (!dismissed) return false;
        
        // Don't show for 7 days after dismissal
        return (Date.now() - parseInt(dismissed)) < (7 * 24 * 60 * 60 * 1000);
    }

    recordPromptDismissal() {
        localStorage.setItem('installPromptDismissed', Date.now().toString());
    }

    trackInstallation(outcome) {
        // Track in your analytics
        console.log(`📊 Install ${outcome}`);
        
        if (outcome === 'accepted' && window.userProfiles) {
            window.userProfiles.addExperience(100); // Bonus for installing
            window.notificationSystem?.addNotification('achievement', {
                name: 'App Fan!',
                message: 'Thanks for installing Lovculator! 🎉'
            });
        }
    }

    isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone ||
               document.referrer.includes('android-app://');
    }
    
    // Social Integration Methods
    setupSocialIntegration() {
        console.log('🔧 Setting up social integration...');
        
        // Listen for social events
        document.addEventListener('storyShared', (e) => {
            console.log('📖 Story shared event received');
            if (window.userProfiles) {
                window.userProfiles.updateStats('stories');
            }
            if (window.activityFeed) {
                window.activityFeed.addActivity('story', {
                    title: e.detail?.title || 'A love story'
                });
            }
            if (window.notificationSystem) {
                window.notificationSystem.addNotification('story', {
                    message: 'Your story was shared successfully!'
                });
            }
        });

        document.addEventListener('commentPosted', (e) => {
            console.log('💬 Comment posted event received');
            if (window.userProfiles) {
                window.userProfiles.updateStats('comments');
            }
            if (window.activityFeed) {
                window.activityFeed.addActivity('comment', {});
            }
        });

        document.addEventListener('likeGiven', (e) => {
            console.log('❤️ Like given event received');
            if (window.userProfiles) {
                window.userProfiles.updateStats('likes');
            }
            if (window.activityFeed) {
                window.activityFeed.addActivity('like', {});
            }
        });
    }
    
    triggerCalculationComplete(percentage, name1, name2) {
        const event = new CustomEvent('calculationComplete', {
            detail: { 
                percentage: percentage, 
                names: `${name1} & ${name2}`,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
        
        console.log('📊 Calculation complete event triggered:', percentage);
        
        // Update user profiles and activity feed
        if (window.userProfiles) {
            window.userProfiles.updateStats('calculations');
        }
        if (window.activityFeed) {
            window.activityFeed.addActivity('calculation', {
                percentage: percentage,
                names: `${name1} & ${name2}`
            });
        }
        if (window.notificationSystem) {
            window.notificationSystem.addNotification('calculation', {
                message: `Love calculation completed: ${percentage}%`
            });
        }
    }
    
    // Social Share Methods
    initSocialShare() {
        this.bindShareEvents();
    }
    
    bindShareEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.share-btn')) {
                const btn = e.target.closest('.share-btn');
                const platform = btn.classList[1];
                this.handleShare(platform);
            }
        });
    }
    
    handleShare(platform) {
        const percentage = this.percentageElement.textContent;
        const name1 = this.displayName1.textContent;
        const name2 = this.displayName2.textContent;
        
        console.log(`📤 Sharing on ${platform}: ${percentage}% for ${name1} & ${name2}`);
        
        switch(platform) {
            case 'facebook':
                this.shareOnFacebook(percentage, name1, name2);
                break;
            case 'twitter':
                this.shareOnTwitter(percentage, name1, name2);
                break;
            case 'whatsapp':
                this.shareOnWhatsApp(percentage, name1, name2);
                break;
            case 'instagram':
                this.shareOnInstagram(percentage, name1, name2);
                break;
        }
        
        this.trackShare(platform);
        this.triggerResultShared();
    }
    
    shareOnFacebook(percentage, name1, name2) {
        const text = `Our love compatibility is ${percentage}%! ❤️ ${name1} + ${name2} = Perfect Match!`;
        const url = encodeURIComponent(window.location.href);
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(text)}`;
        this.openShareWindow(shareUrl, 'facebook_share');
    }
    
    shareOnTwitter(percentage, name1, name2) {
        const text = `🔥 Our love compatibility is ${percentage}%! ${name1} + ${name2} = True Love! 💖 Check yours:`;
        const url = encodeURIComponent(window.location.href);
        const hashtags = 'LoveCalculator,Dating,Relationship';
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}&hashtags=${hashtags}`;
        this.openShareWindow(shareUrl, 'twitter_share');
    }
    
    shareOnWhatsApp(percentage, name1, name2) {
        const text = `💕 Our love compatibility is ${percentage}%! ${name1} + ${name2} = Perfect Match! Check your love compatibility: ${window.location.href}`;
        const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        this.openShareWindow(shareUrl, 'whatsapp_share');
    }
    
    shareOnInstagram(percentage, name1, name2) {
        this.createShareableImage(percentage, name1, name2);
    }
    
    openShareWindow(url, name) {
        const width = 600;
        const height = 400;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(url, name, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    }
    
    createShareableImage(percentage, name1, name2) {
        const message = `📸 Perfect for Instagram!\n\n✨ ${name1} ❤️ ${name2} ✨\n💖 Love Score: ${percentage}%\n\nTake a screenshot and share this beautiful result!\n\nTag us: #Lovculator #LoveCalculator #${name1.replace(/\s+/g, '')}And${name2.replace(/\s+/g, '')}`;
        
        this.showCustomNotification(message);
        this.highlightResultForScreenshot();
    }
    
    showCustomNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 30px;
            border-radius: 20px;
            z-index: 10000;
            text-align: center;
            max-width: 90%;
            width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            font-family: inherit;
            font-size: 16px;
            line-height: 1.5;
            border: 2px solid white;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 15px;">📸</div>
            <div style="margin-bottom: 20px; font-weight: 600;">Instagram Ready!</div>
            <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 14px;">
                ${message.replace(/\n/g, '<br>')}
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: white; 
                color: #667eea; 
                border: none; 
                padding: 12px 30px; 
                border-radius: 25px; 
                font-weight: 600; 
                cursor: pointer;
                font-family: inherit;
            ">Got it! 👍</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 8000);
    }
    
    highlightResultForScreenshot() {
        const result = document.getElementById('result');
        if (result) {
            result.style.boxShadow = '0 0 0 4px #ff4b8d, 0 0 30px rgba(255, 75, 141, 0.5)';
            result.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                result.style.boxShadow = 'none';
            }, 3000);
        }
    }
    
    trackShare(platform) {
        console.log(`📊 Shared on ${platform}`);
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'share', {
                'method': platform,
                'content_type': 'love_result',
                'content_id': `${this.displayName1.textContent}_${this.displayName2.textContent}`
            });
        }
    }
    
    triggerResultShared() {
        const event = new CustomEvent('resultShared', {
            detail: {
                platform: 'social',
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    }
    
    showShareButtons() {
        const shareButtons = document.querySelector('.share-buttons');
        if (shareButtons) {
            shareButtons.style.display = 'flex';
            
            setTimeout(() => {
                shareButtons.style.opacity = '1';
                shareButtons.style.transform = 'translateY(0)';
            }, 100);
        }
    }
    
    hideShareButtons() {
        const shareButtons = document.querySelector('.share-buttons');
        if (shareButtons) {
            shareButtons.style.display = 'none';
            shareButtons.style.opacity = '0';
            shareButtons.style.transform = 'translateY(20px)';
        }
    }
    
    // Fallback share method
    fallbackShare() {
        const percentage = this.percentageElement.textContent;
        const name1 = this.displayName1.textContent;
        const name2 = this.displayName2.textContent;
        
        const text = `Our love compatibility is ${percentage}%! ${name1} ❤️ ${name2} - Check yours at: ${window.location.href}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Love Compatibility Result',
                text: text,
                url: window.location.href,
            })
            .catch(error => console.log('Error sharing:', error));
        } else {
            this.copyToClipboard(text)
                .then(() => this.showCustomNotification('Result copied to clipboard! 📋\n\nYou can now paste it anywhere.'))
                .catch(() => prompt('Copy this result to share:', text));
        }
    }
    
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                textArea.remove();
                return success;
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
            return false;
        }
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
            font-weight: 500;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
}

// Enhanced User Profiles Class
class UserProfiles {
    constructor() {
        this.currentUser = this.getOrCreateUser();
        console.log('👤 User Profiles initialized:', this.currentUser.username);
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
            console.log('🆕 New user created:', user.username);
        } else {
            user = JSON.parse(user);
        }
        return user;
    }

    generateAvatar() {
        const avatars = ['💕', '❤️', '💖', '💘', '💝', '💞', '💓', '💗'];
        return avatars[Math.floor(Math.random() * avatars.length)];
    }

    updateStats(type) {
        if (this.currentUser.stats[type] !== undefined) {
            this.currentUser.stats[type]++;
            this.saveUser();
            console.log(`📈 Updated ${type} stat:`, this.currentUser.stats[type]);
            
            // Add experience for activities
            this.addExperience(this.getExperienceForActivity(type));
            
            this.displayProfile();
            return true;
        }
        return false;
    }

    getExperienceForActivity(type) {
        const experienceMap = {
            'stories': 10,
            'comments': 5,
            'likes': 2,
            'calculations': 3,
            'achievements': 20
        };
        return experienceMap[type] || 1;
    }

    addExperience(points) {
        this.currentUser.experience += points;
        
        // Level up every 100 experience points
        if (this.currentUser.experience >= this.currentUser.level * 100) {
            this.levelUp();
        }
        
        this.saveUser();
        this.displayProfile();
    }

    levelUp() {
        this.currentUser.level++;
        this.currentUser.experience = 0;
        
        console.log('🎉 Level up! New level:', this.currentUser.level);
        
        this.showLevelUpNotification();
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

    saveUser() {
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    }

    displayProfile() {
        const container = document.getElementById('userProfileContainer');
        if (!container) return;

        const experiencePercent = (this.currentUser.experience % 100);

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
                    <div class="experience-fill" style="width: ${experiencePercent}%"></div>
                    <span class="experience-text">${experiencePercent}/100 XP</span>
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
                        <span class="number">${this.currentUser.stats.comments}</span>
                        <span class="label">Comments</span>
                    </div>
                    <div class="stat">
                        <span class="number">${this.currentUser.stats.achievements}</span>
                        <span class="label">Badges</span>
                    </div>
                </div>
                
                ${this.currentUser.badges.length > 0 ? `
                    <div class="badges-section">
                        <h4>Recent Badges</h4>
                        <div class="badges-list">
                            ${this.currentUser.badges.slice(-3).map(badge => `
                                <div class="badge" title="${badge.name}">${badge.icon}</div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
}

// Activity Feed Class
class ActivityFeed {
    constructor() {
        this.activities = JSON.parse(localStorage.getItem('activityFeed')) || [];
        this.init();
    }

    init() {
        if (this.activities.length === 0) {
            this.addActivity('welcome', {
                message: 'Welcome to our love community! Share your first story.'
            });
        }
        this.displayFeed();
        console.log('📝 Activity Feed initialized with', this.activities.length, 'activities');
    }

    addActivity(type, data) {
        const activity = {
            id: 'activity_' + Date.now(),
            type: type,
            userId: window.userProfiles?.currentUser?.id || 'system',
            username: window.userProfiles?.currentUser?.username || 'System',
            avatar: window.userProfiles?.currentUser?.avatar || '💖',
            data: data,
            timestamp: new Date().toISOString()
        };

        this.activities.unshift(activity);
        
        // Keep only last 30 activities
        if (this.activities.length > 30) {
            this.activities = this.activities.slice(0, 30);
        }
        
        this.saveActivities();
        this.displayFeed();
        
        console.log('➕ Added activity:', type);
    }

    displayFeed() {
        const container = document.getElementById('activityFeed');
        if (!container) return;

        if (this.activities.length === 0) {
            container.innerHTML = `
                <div class="empty-feed">
                    <div class="empty-icon">💌</div>
                    <h4>No activities yet</h4>
                    <p>Be the first to share a love story!</p>
                </div>
            `;
            return;
        }

        const feedHtml = this.activities.map(activity => `
            <div class="activity-item">
                <div class="activity-avatar">${activity.avatar}</div>
                <div class="activity-content">
                    <div class="activity-text">
                        <strong>${activity.username}</strong> ${this.getActivityText(activity)}
                    </div>
                    <div class="activity-time">
                        ${this.getTimeAgo(activity.timestamp)}
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = feedHtml;
    }

    getActivityText(activity) {
        const texts = {
            welcome: 'joined the love community! 💖',
            story: `shared a love story: "${activity.data.title}"`,
            comment: 'commented on a love story 💬',
            like: 'liked a love story ❤️',
            achievement: `unlocked achievement: ${activity.data.name}`,
            calculation: `calculated love compatibility: ${activity.data.percentage}%`
        };
        return texts[activity.type] || 'shared something new';
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return time.toLocaleDateString();
    }

    saveActivities() {
        localStorage.setItem('activityFeed', JSON.stringify(this.activities));
    }
}

// Notification System Class
class NotificationSystem {
    constructor() {
        this.notifications = JSON.parse(localStorage.getItem('notifications')) || [];
        this.updateBadge();
        console.log('🔔 Notification System initialized');
    }

    addNotification(type, data) {
        const notification = {
            id: 'notif_' + Date.now(),
            type: type,
            data: data,
            read: false,
            timestamp: new Date().toISOString()
        };

        this.notifications.unshift(notification);
        this.saveNotifications();
        this.updateBadge();
        this.showToast(notification);
        
        console.log('📨 Added notification:', type);
    }

    updateBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount > 0 ? unreadCount : '';
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }

    showToast(notification) {
        const existingToasts = document.querySelectorAll('.notification-toast');
        existingToasts.forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.innerHTML = `
            <div class="toast-icon">${this.getNotificationIcon(notification.type)}</div>
            <div class="toast-content">
                <div class="toast-message">${this.getNotificationMessage(notification)}</div>
                <div class="toast-time">just now</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 4000);
    }

    getNotificationIcon(type) {
        const icons = {
            like: '❤️',
            comment: '💬',
            achievement: '🏆',
            welcome: '🎉',
            calculation: '💝',
            story: '📖'
        };
        return icons[type] || '💕';
    }

    getNotificationMessage(notification) {
        const messages = {
            like: 'Someone liked your story!',
            comment: 'New comment on your story',
            achievement: 'Achievement unlocked!',
            welcome: 'Welcome to Lovculator!',
            calculation: 'Love calculation completed!',
            story: 'Your story was shared successfully!'
        };
        return messages[notification.type] || 'New notification';
    }

    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }
}

// Social Features Initialization
function initializeSocialFeatures() {
    console.log('🔧 Initializing social features...');
    
    try {
        // Initialize user profiles
        window.userProfiles = new UserProfiles();
        window.activityFeed = new ActivityFeed();
        window.notificationSystem = new NotificationSystem();
        
        // Display user profile
        window.userProfiles.displayProfile();
        
        console.log('✅ Social features initialized successfully');
        
        // Show welcome notification
        setTimeout(() => {
            window.notificationSystem.addNotification('welcome', {
                message: 'Welcome to Lovculator! Start calculating love compatibility.'
            });
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error initializing social features:', error);
    }
}

// Global social share functions
function shareOnFacebook() {
    if (window.loveCalculator) {
        window.loveCalculator.shareOnFacebook();
    }
}

function shareOnTwitter() {
    if (window.loveCalculator) {
        window.loveCalculator.shareOnTwitter();
    }
}

function shareOnWhatsApp() {
    if (window.loveCalculator) {
        window.loveCalculator.shareOnWhatsApp();
    }
}

function shareOnInstagram() {
    if (window.loveCalculator) {
        window.loveCalculator.shareOnInstagram();
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing Lovculator v1.2.0...');
    
    // Initialize main love calculator
    window.loveCalculator = new LoveCalculator();
    
    // Initialize social features
    initializeSocialFeatures();
    
    console.log('💖 Lovculator fully loaded and ready!');
});