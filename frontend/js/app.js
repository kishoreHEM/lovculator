// Lovculator Main App (v1.3.0) - Simplified & Optimized
// No Gamification / Badges / XP System

class LoveCalculator {
    constructor() {
        this.form = document.getElementById('loveForm');
        this.result = document.getElementById('result');
        this.percentageElement = document.getElementById('percentage');
        this.messageElement = document.getElementById('message');
        this.displayName1 = document.getElementById('displayName1');
        this.displayName2 = document.getElementById('displayName2');
        this.againBtn = document.getElementById('calculateAgain');
        this.APP_VERSION = '1.3.0';
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.againBtn.addEventListener('click', () => this.resetForm());
        this.initPWA();
        this.initSocialShare();
        console.log('💖 Lovculator initialized v' + this.APP_VERSION);
    }

    handleSubmit(e) {
        e.preventDefault();

        const name1 = document.getElementById('fin_person1').value.trim();
        const name2 = document.getElementById('fin_person2').value.trim();
        const gender1 = document.querySelector('input[name="gender1"]:checked')?.value;
        const gender2 = document.querySelector('input[name="gender2"]:checked')?.value;

        if (!name1 || !name2) return this.showNotification('Please enter both names!');
        if (name1 === name2) return this.showNotification('Please enter different names!');
        if (!gender1 || !gender2) return this.showNotification('Please select genders!');

        const percentage = this.calculateLove(name1, name2, gender1, gender2);
        const message = this.generateMessage(percentage, gender1, gender2);
        this.displayResult(name1, name2, percentage, message);
    }

    calculateLove(name1, name2, gender1, gender2) {
        const nameScore = this.nameToNumber(name1) + this.nameToNumber(name2);
        const diff = Math.abs(this.nameToNumber(name1) - this.nameToNumber(name2));
        const genderBonus = gender1 !== gender2 ? 10 : -5;
        let percentage = 100 - diff + genderBonus;
        percentage += Math.random() * 10 - 5;
        return Math.min(100, Math.max(0, Math.round(percentage)));
    }

    nameToNumber(name) {
        return name.toLowerCase().split('').reduce((sum, ch) => {
            const val = ch.charCodeAt(0) - 96;
            return sum + (val > 0 && val <= 26 ? val : 0);
        }, 0) % 100;
    }

    generateMessage(percent, gender1, gender2) {
        const p1 = gender1 === 'male' ? 'He' : 'She';
        const p2 = gender2 === 'male' ? 'he' : 'she';
        if (percent >= 90) return `Perfect Match! 💖 ${p1} and ${p2} are made for each other!`;
        if (percent >= 75) return `Great Compatibility! 🌟 ${p1} and ${p2} share strong chemistry!`;
        if (percent >= 60) return `Good Match! 😊 With effort, love can blossom beautifully!`;
        if (percent >= 45) return `Average Match 👌 Needs better understanding and communication.`;
        return `Challenging Match 💔 ${p1} and ${p2} might face some differences.`;
    }

    displayResult(name1, name2, percentage, message) {
        this.form.style.display = 'none';
        this.result.classList.remove('hidden');
        this.displayName1.textContent = this.capitalize(name1);
        this.displayName2.textContent = this.capitalize(name2);
        this.animatePercentage(0, percentage, 1500);
        this.messageElement.textContent = message;
        setTimeout(() => this.showShareButtons(), 1600);
    }

    animatePercentage(start, end, duration) {
        const startTime = performance.now();
        const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1);
            const value = Math.floor(start + (end - start) * (1 - Math.pow(1 - progress, 4)));
            this.percentageElement.textContent = value;
            if (progress < 1) requestAnimationFrame(animate);
            else this.percentageElement.classList.add('pulse');
        };
        requestAnimationFrame(animate);
    }

    resetForm() {
        this.form.reset();
        this.result.classList.add('hidden');
        this.form.style.display = 'block';
        this.percentageElement.classList.remove('pulse');
        this.hideShareButtons();
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // ================= PWA Setup =================

    initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => console.log('✅ Service Worker registered:', reg.scope))
                .catch((err) => console.error('❌ Service Worker registration failed:', err));
        }
        this.setupInstallPrompt();
        this.setupNetworkDetection();
    }

    setupInstallPrompt() {
        let deferredPrompt;
        const installPrompt = document.getElementById('installPrompt');
        if (!installPrompt) return;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installPrompt.classList.remove('hidden');
        });

        document.getElementById('installBtn')?.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt = null;
                installPrompt.classList.add('hidden');
            }
        });

        document.getElementById('cancelInstall')?.addEventListener('click', () => {
            installPrompt.classList.add('hidden');
        });
    }

    setupNetworkDetection() {
        const indicatorId = 'offline-indicator';
        const showOffline = () => {
            if (!document.getElementById(indicatorId)) {
                const el = document.createElement('div');
                el.id = indicatorId;
                el.textContent = '🔴 You are offline';
                el.style.cssText = `
                    position:fixed;top:0;left:0;right:0;background:#ff6b6b;color:#fff;
                    text-align:center;padding:8px;z-index:9999;font-weight:600;
                `;
                document.body.appendChild(el);
            }
        };
        const hideOffline = () => document.getElementById(indicatorId)?.remove();

        window.addEventListener('online', hideOffline);
        window.addEventListener('offline', showOffline);
        if (!navigator.onLine) showOffline();
    }

    // ================= Social Sharing =================

    initSocialShare() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.share-btn');
            if (!btn) return;
            const platform = btn.classList[1];
            this.share(platform);
        });
    }

    share(platform) {
        const percentage = this.percentageElement.textContent;
        const name1 = this.displayName1.textContent;
        const name2 = this.displayName2.textContent;
        const url = encodeURIComponent(window.location.href);
        const text = `Our love compatibility is ${percentage}%! ❤️ ${name1} + ${name2} = Perfect Match!`;

        const shareUrls = {
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(text)}`,
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
        };

        if (platform in shareUrls) {
            window.open(shareUrls[platform], '_blank', 'width=600,height=400');
        } else {
            this.fallbackShare(text);
        }
    }

    async fallbackShare(text) {
        if (navigator.share) {
            await navigator.share({ title: 'Love Result', text, url: window.location.href });
        } else {
            try {
                await navigator.clipboard.writeText(text);
                this.showNotification('Copied result to clipboard! 📋');
            } catch {
                prompt('Copy this result:', text);
            }
        }
    }

    showShareButtons() {
    const buttons = document.querySelector('.share-buttons');
    if (buttons) {
        buttons.classList.add('show');  // ✅ use "show" not "visible"
    }
}

hideShareButtons() {
    const buttons = document.querySelector('.share-buttons');
    if (buttons) {
        buttons.classList.remove('show'); // ✅ match CSS
    }
}


    showNotification(message) {
        const note = document.createElement('div');
        note.textContent = message;
        note.style.cssText = `
            position:fixed;top:20px;right:20px;background:#ff4b8d;color:white;
            padding:10px 20px;border-radius:8px;z-index:9999;font-weight:500;
            box-shadow:0 2px 6px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 3000);
    }
}



// Initialize Lovculator
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Lovculator v1.3.0 initializing...');
    window.loveCalculator = new LoveCalculator();
    console.log('✅ Lovculator ready!');
});
