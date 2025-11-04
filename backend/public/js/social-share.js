// Social Share Functions - Enhanced
class SocialShare {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // Add click event listeners for better tracking
        document.addEventListener('click', (e) => {
            if (e.target.closest('.share-btn')) {
                const btn = e.target.closest('.share-btn');
                const platform = btn.classList[1]; // facebook, twitter, etc.
                this.trackShare(platform);
            }
        });
    }

    shareOnFacebook() {
        try {
            const percentage = document.getElementById('percentage').textContent;
            const name1 = document.getElementById('displayName1').textContent;
            const name2 = document.getElementById('displayName2').textContent;
            
            const text = `Our love compatibility is ${percentage}%! ❤️ ${name1} + ${name2} = Perfect Match!`;
            const url = encodeURIComponent(window.location.href);
            
            const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(text)}`;
            this.openShareWindow(shareUrl, 'facebook_share');
            
        } catch (error) {
            console.error('Facebook share error:', error);
            this.fallbackShare();
        }
    }

    shareOnTwitter() {
        try {
            const percentage = document.getElementById('percentage').textContent;
            const name1 = document.getElementById('displayName1').textContent;
            const name2 = document.getElementById('displayName2').textContent;
            
            const text = `🔥 Our love compatibility is ${percentage}%! ${name1} + ${name2} = True Love! 💖 Check yours:`;
            const url = encodeURIComponent(window.location.href);
            const hashtags = 'LoveCalculator,Dating,Relationship';
            
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}&hashtags=${hashtags}`;
            this.openShareWindow(shareUrl, 'twitter_share');
            
        } catch (error) {
            console.error('Twitter share error:', error);
            this.fallbackShare();
        }
    }

    shareOnWhatsApp() {
        try {
            const percentage = document.getElementById('percentage').textContent;
            const name1 = document.getElementById('displayName1').textContent;
            const name2 = document.getElementById('displayName2').textContent;
            
            const text = `💕 Our love compatibility is ${percentage}%! ${name1} + ${name2} = Perfect Match! Check your love compatibility: ${window.location.href}`;
            
            const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
            this.openShareWindow(shareUrl, 'whatsapp_share');
            
        } catch (error) {
            console.error('WhatsApp share error:', error);
            this.fallbackShare();
        }
    }

    shareOnInstagram() {
        try {
            const percentage = document.getElementById('percentage').textContent;
            const name1 = document.getElementById('displayName1').textContent;
            const name2 = document.getElementById('displayName2').textContent;
            
            // For Instagram, we'll create a shareable image or prompt for screenshot
            this.createShareableImage(percentage, name1, name2);
            
        } catch (error) {
            console.error('Instagram share error:', error);
            this.fallbackShare();
        }
    }

    openShareWindow(url, name) {
        const width = 600;
        const height = 400;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(url, name, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    }

    createShareableImage(percentage, name1, name2) {
        // Create a beautiful alert message for Instagram sharing
        const message = `📸 Perfect for Instagram!\n\n✨ ${name1} ❤️ ${name2} ✨\n💖 Love Score: ${percentage}%\n\nTake a screenshot and share this beautiful result!\n\nTag us: #Lovculator #LoveCalculator #${name1}And${name2}`;
        
        // Show styled notification instead of basic alert
        this.showCustomNotification(message);
        
        // Optional: Add a visual highlight effect to the result
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
        
        // Auto-remove after 8 seconds
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
        // Here you can add analytics tracking
        console.log(`Shared on ${platform}`);
        
        // Example: Send to Google Analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'share', {
                'method': platform,
                'content_type': 'love_result',
                'content_id': `${document.getElementById('displayName1').textContent}_${document.getElementById('displayName2').textContent}`
            });
        }
    }

    fallbackShare() {
        const percentage = document.getElementById('percentage').textContent;
        const name1 = document.getElementById('displayName1').textContent;
        const name2 = document.getElementById('displayName2').textContent;
        
        const text = `Our love compatibility is ${percentage}%! ${name1} ❤️ ${name2} - Check yours at: ${window.location.href}`;
        
        if (navigator.share) {
            // Use Web Share API if available
            navigator.share({
                title: 'Love Compatibility Result',
                text: text,
                url: window.location.href,
            })
            .catch(error => console.log('Error sharing:', error));
        } else {
            // Fallback to clipboard
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
                // Fallback for older browsers
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
}

// Make functions globally available
function shareOnFacebook() {
    new SocialShare().shareOnFacebook();
}

function shareOnTwitter() {
    new SocialShare().shareOnTwitter();
}

function shareOnWhatsApp() {
    new SocialShare().shareOnWhatsApp();
}

function shareOnInstagram() {
    new SocialShare().shareOnInstagram();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SocialShare();
});