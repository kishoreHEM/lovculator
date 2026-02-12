// ============================
// 🌍 Social Share Functions (Lovculator Optimized)
// ============================
class SocialShare {
  constructor() {
    this.bindEvents();
  }

  bindEvents() {
    if (window.__lovculatorShareClickBound) return;
    window.__lovculatorShareClickBound = true;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.share-btn');
      if (!btn) return;

      const platform = btn.classList[1];
      this.trackShare(platform);

      switch (platform) {
        case 'facebook': this.shareOnFacebook(); break;
        case 'twitter': this.shareOnTwitter(); break;
        case 'whatsapp': this.shareOnWhatsApp(); break;
        case 'instagram': this.shareOnInstagram(); break;
      }
    });
  }

  get names() {
    return {
      percentage: document.getElementById('percentage')?.textContent || '0',
      name1: document.getElementById('displayName1')?.textContent || 'You',
      name2: document.getElementById('displayName2')?.textContent || 'Your Partner'
    };
  }

  // ---------------------------
  // Facebook Share
  // ---------------------------
  shareOnFacebook() {
    try {
      const { percentage, name1, name2 } = this.names;
      const text = `Our love compatibility is ${percentage}%! ❤️ ${name1} + ${name2} = Perfect Match!`;
      const url = encodeURIComponent(window.location.href);
      const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${encodeURIComponent(text)}`;
      this.openShareWindow(shareUrl, 'facebook_share');
    } catch (error) {
      console.error('Facebook share error:', error);
      this.fallbackShare();
    }
  }

  // ---------------------------
  // Twitter (X) Share
  // ---------------------------
  shareOnTwitter() {
    try {
      const { percentage, name1, name2 } = this.names;
      const text = `🔥 Our love compatibility is ${percentage}%! ${name1} + ${name2} = True Love! 💖 Check yours:`;
      const url = encodeURIComponent(window.location.href);
      const hashtags = 'LoveCalculator,Relationship,Compatibility';
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}&hashtags=${hashtags}`;
      this.openShareWindow(shareUrl, 'twitter_share');
    } catch (error) {
      console.error('Twitter share error:', error);
      this.fallbackShare();
    }
  }

  // ---------------------------
  // WhatsApp Share
  // ---------------------------
  shareOnWhatsApp() {
    try {
      const { percentage, name1, name2 } = this.names;
      const text = `💕 Our love compatibility is ${percentage}%! ${name1} + ${name2} = Perfect Match! Check yours: ${window.location.href}`;
      const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      this.openShareWindow(shareUrl, 'whatsapp_share');
    } catch (error) {
      console.error('WhatsApp share error:', error);
      this.fallbackShare();
    }
  }

  // ---------------------------
  // Instagram (screenshot prompt)
  // ---------------------------
  shareOnInstagram() {
    try {
      const { percentage, name1, name2 } = this.names;
      this.createShareableImage(percentage, name1, name2);
    } catch (error) {
      console.error('Instagram share error:', error);
      this.fallbackShare();
    }
  }

  // ---------------------------
  // Helpers
  // ---------------------------
  openShareWindow(url, name) {
    const width = 600, height = 400;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    window.open(url, name, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`);
  }

  createShareableImage(percentage, name1, name2) {
    const message = `📸 Perfect for Instagram!\n\n✨ ${name1} ❤️ ${name2} ✨\n💖 Love Score: ${percentage}%\n\nTake a screenshot and share this beautiful result!\n\nTag us: #Lovculator #LoveCalculator #${name1}And${name2}`;
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
      z-index: 9999;
      text-align: center;
      max-width: 90%;
      width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      font-family: inherit;
      font-size: 16px;
      line-height: 1.5;
    `;
    notification.innerHTML = `
      <div style="font-size: 3rem; margin-bottom: 15px;">📸</div>
      <div style="margin-bottom: 10px; font-weight: 600;">Instagram Ready!</div>
      <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 14px;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: white;
        color: #667eea;
        border: none;
        padding: 12px 25px;
        border-radius: 25px;
        font-weight: 600;
        cursor: pointer;
      ">Got it! 👍</button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 8000);
  }

  highlightResultForScreenshot() {
    const result = document.getElementById('result');
    if (!result) return;
    result.style.boxShadow = '0 0 0 4px #ff4b8d, 0 0 30px rgba(255, 75, 141, 0.5)';
    result.style.transition = 'all 0.5s ease';
    setTimeout(() => (result.style.boxShadow = 'none'), 3000);
  }

  trackShare(platform) {
    console.log(`Shared on ${platform}`);
    if (typeof gtag !== 'undefined') {
      gtag('event', 'share', {
        method: platform,
        content_type: 'love_result',
        content_id: `${this.names.name1}_${this.names.name2}`,
      });
    }
  }

  fallbackShare() {
    const { percentage, name1, name2 } = this.names;
    const text = `Our love compatibility is ${percentage}%! ${name1} ❤️ ${name2} - Check yours at: ${window.location.href}`;
    if (navigator.share) {
      navigator
        .share({ title: 'Love Compatibility Result', text, url: window.location.href })
        .catch((error) => console.log('Share cancelled:', error));
    } else {
      this.copyToClipboard(text)
        .then(() => this.showCustomNotification('📋 Result copied to clipboard!\nYou can paste it anywhere.'))
        .catch(() => alert('Copy this text manually:\n\n' + text));
    }
  }

  async copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      return true;
    } catch (err) {
      console.error('Clipboard error:', err);
      return false;
    }
  }
}

// ✅ Initialize globally (one instance only)
window.socialShare = new SocialShare();
