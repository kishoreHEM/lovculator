class AskModalController {
    constructor() {
        // ---- MODALS ----
        this.storyModal = document.getElementById("storyModal");
        this.askModal = document.getElementById("askCreateModal");
        this.postModal = document.getElementById("createPostModal");

        // ---- OPEN BUTTONS ----
        this.btnStory = document.getElementById("btnStory");
        this.btnAsk = document.getElementById("btnQuestion");
        this.btnPost = document.getElementById("btnPost");
        this.bigTextBar = document.getElementById("openPostModal");

        // ---- CLOSE BUTTONS ----
        this.closeAskBtn = document.getElementById("closeAskModal");
        this.closeStoryBtn = document.getElementById("closeModal");
        this.closePostBtn = document.getElementById("closePostModal");
        this.cancelAskBtn = document.getElementById("cancelAskCreate");

        // ---- ASK FORM ELEMENTS ----
        this.submitAskBtn = document.getElementById("submitQuestion");
        this.questionInput = document.getElementById("questionText");
        this.askCharCount = document.getElementById("askCharCount");

        // ---- USER INFO ELEMENTS ----
        this.askUserAvatar = document.getElementById("askUserAvatar");
        this.askUserName = document.getElementById("askUserName");

        this.init();
        this.injectStyles(); // ✅ Inject Mobile Styles
    }

    /* -----------------------------------------
       HELPERS
    ----------------------------------------- */
    open(modal) {
        modal?.classList.remove("hidden");
        document.body.classList.add("modal-open");
    }

    close(modal) {
        modal?.classList.add("hidden");
        document.body.classList.remove("modal-open");
    }

    /* -----------------------------------------
       LOAD USER INFO (Enhanced with AuthManager)
    ----------------------------------------- */
    async updateUserInfo() {
        // 1. Try AuthManager (Most reliable)
        if (window.AuthManager) {
            try {
                const { res, data } = await window.AuthManager.getProfile();
                if (res.ok && data.success && data.user) {
                    this.renderUser(data.user);
                    return;
                }
            } catch (e) { console.error("Auth load failed", e); }
        }

        // 2. Fallback: Global Variable
        if (window.currentUser) {
            this.renderUser(window.currentUser);
            return;
        }

        // 3. Fallback: Local Storage
        try {
            const stored = localStorage.getItem('user');
            if (stored) {
                this.renderUser(JSON.parse(stored));
                return;
            }
        } catch (e) {}

        // 4. Default Guest
        this.renderUser(null);
    }

    renderUser(user) {
        if (!user) {
            if (this.askUserName) this.askUserName.textContent = "Guest User";
            if (this.askUserAvatar) this.askUserAvatar.src = "/images/default-avatar.png";
            return;
        }

        if (this.askUserAvatar) {
            this.askUserAvatar.src = user.avatar_url && user.avatar_url !== "null" 
                ? user.avatar_url 
                : "/images/default-avatar.png";
        }
        if (this.askUserName) {
            this.askUserName.textContent =
    user.display_name || user.username || "User";

        }
    }

    openAskModal() {
        if (!window.currentUserId) {
            window.showLoginModal?.("ask a question");
            return;
        }
        this.updateUserInfo();
        this.open(this.askModal);
        
        // ✅ UX Fix: Only auto-focus on Desktop. 
        // On Mobile, auto-focus pops the keyboard immediately which is annoying.
        if (window.innerWidth > 768) {
            setTimeout(() => this.questionInput?.focus(), 100);
        }
    }

    /* -----------------------------------------
       ✅ TOAST NOTIFICATION SYSTEM
    ----------------------------------------- */
    showToast(message, type = 'info') {
        const existing = document.querySelector('.app-toast');
        if(existing) existing.remove();

        const colors = { success: '#4CAF50', error: '#f44336', info: '#2196F3' };
        const toast = document.createElement('div');
        toast.className = 'app-toast';
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: ${colors[type] || colors.info}; 
            color: white; padding: 12px 20px; border-radius: 8px; 
            z-index: 10000; animation: slideInRight 0.3s ease; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    /* -----------------------------------------
       ✅ SUBMIT QUESTION LOGIC
    ----------------------------------------- */
    async submitQuestion() {
        if (!window.currentUserId) {
            window.showLoginModal?.("ask a question");
            return;
        }
        const text = this.questionInput?.value.trim();

        if (!text) {
            this.showToast("Please write a question first", "error");
            return;
        }

        // 1. Show Loading State
        const originalText = this.submitAskBtn.innerHTML;
        this.submitAskBtn.innerHTML = '<span class="loading-spinner-small"></span> Posting...';
        this.submitAskBtn.disabled = true;

        try {
            const API_BASE = window.location.hostname.includes("localhost")
                ? "http://localhost:3001/api"
                : "https://lovculator.com/api";

            const response = await fetch(`${API_BASE}/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ question: text })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast("Question posted successfully! 🎉", "success");
                this.questionInput.value = ""; 
                this.close(this.askModal);
                
                // Optional: Reload feed if function exists, else page reload
                if (window.loadFeed) window.loadFeed();
                else setTimeout(() => window.location.reload(), 1000);
                
            } else {
                throw new Error(data.error || "Failed to post question");
            }

        } catch (err) {
            console.error(err);
            this.showToast(err.message || "Network Error", "error");
        } finally {
            // 4. Reset Button
            if (this.submitAskBtn) {
                this.submitAskBtn.innerHTML = originalText; // Restore original text/icon
                this.submitAskBtn.disabled = false;
            }
        }
    }

    /* -----------------------------------------
       ✅ STYLE INJECTION (Mobile Full Screen)
    ----------------------------------------- */
    injectStyles() {
        if (document.getElementById('ask-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'ask-modal-styles';
        style.textContent = `
            @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            .loading-spinner-small {
                width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
                border-top-color: white; border-radius: 50%; display: inline-block;
                animation: spin 1s linear infinite; margin-right: 8px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }

            /* Ensure hidden class works forcefully */
            .hidden { display: none !important; }
            .modal-open { overflow: hidden; }

            /* BACKDROP */
            #askCreateModal:not(.hidden) {
                display: flex;
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6);
                z-index: 9000;
                justify-content: center;
                align-items: center;
                animation: fadeIn 0.2s ease-out;
            }

            /* == MODAL CARD DESIGN == */
            /* Targets the direct child div of the modal container */
            #askCreateModal > div {
                background: white;
                width: 100%;
                max-width: 500px; /* Slightly narrower than post modal for questions */
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                max-height: 90vh;
                overflow: hidden;
            }

            /* DESKTOP ANIMATION */
            @media (min-width: 769px) {
                #askCreateModal > div {
                    transform: scale(1);
                    transition: transform 0.2s;
                }
            }

            /* MOBILE FULL SCREEN STYLES */
            @media (max-width: 768px) {
                #askCreateModal:not(.hidden) {
                    background: white;
                    align-items: flex-start;
                }

                #askCreateModal > div {
                    max-width: 100%;
                    height: 100%;     /* Full Height */
                    max-height: 100%; 
                    border-radius: 0; 
                    box-shadow: none;
                    animation: slideUp 0.3s ease-out;
                }
                
                /* Ensure textarea area expands on mobile */
                #askCreateModal textarea {
                    flex-grow: 1;
                    min-height: 150px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    init() {
        // --- Open Actions ---
        this.btnStory?.addEventListener("click", () => this.open(this.storyModal));
        this.btnAsk?.addEventListener("click", () => this.openAskModal());
        this.btnPost?.addEventListener("click", () => this.open(this.postModal));
        this.bigTextBar?.addEventListener("click", () => this.open(this.postModal));

        // --- Close Actions ---
        this.closeAskBtn?.addEventListener("click", () => this.close(this.askModal));
        this.cancelAskBtn?.addEventListener("click", () => this.close(this.askModal));
        this.closeStoryBtn?.addEventListener("click", () => this.close(this.storyModal));
        this.closePostBtn?.addEventListener("click", () => this.close(this.postModal));

        // --- Click Outside ---
        window.addEventListener("click", (e) => {
            if (e.target === this.askModal) this.close(this.askModal);
            if (e.target === this.storyModal) this.close(this.storyModal);
            if (e.target === this.postModal) this.close(this.postModal);
        });

        // --- Submit Action ---
        this.submitAskBtn?.addEventListener("click", () => this.submitQuestion());

        // --- Character Count ---
        this.questionInput?.addEventListener("input", () => {
            const len = this.questionInput.value.length;
            if (this.askCharCount) this.askCharCount.innerText = `${len} / 300`;
            
            if (this.submitAskBtn) {
                this.submitAskBtn.disabled = len === 0;
            }
        });

        console.log("✅ AskModalController initialized with Mobile UI & Toasts");
    }
}

// AUTO INIT
document.addEventListener("DOMContentLoaded", () => {
    new AskModalController();
});
