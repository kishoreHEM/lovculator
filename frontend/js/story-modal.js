class StoryModal {
    constructor(loveStoriesInstance) {
        this.loveStories = loveStoriesInstance || null;
        
        // ============================================================
        // 1. Find ALL trigger buttons (Updated with your new IDs)
        // ============================================================
        this.triggers = [];
        
        // --- Story Specific Buttons ---
        const btnStory = document.getElementById('btnStory'); 
        const storyFab = document.getElementById('storyFab'); 
        const askBtnTrigger = document.getElementById('askQuestionBtn');  // The "+ LoveStory" button

        // --- Add only if they exist ---
        if (btnStory) this.triggers.push(btnStory);
        if (storyFab) this.triggers.push(storyFab);
        if (askBtnTrigger) this.triggers.push(askBtnTrigger);

        // ❌ REMOVED: openPostModalBtn
        // This button ID implies it belongs to the Post Modal script (feed.js), 
        // NOT this Story Modal script. Removing it here fixes the "double modal" issue.

        // ⚠️ DECISION REQUIRED: The "Ask Bar" (Text Input)
        // If you want the big text bar to open the STORY modal, keep this line:
        const askBarTrigger = document.getElementById('askTrigger');
        if (askBarTrigger) this.triggers.push(askBarTrigger);
        // (If you want the bar to open the POST modal instead, delete the two lines above)

        // 2. Main Elements
        this.storyModal = document.getElementById('storyModal');
        this.closeModal = document.getElementById('closeModal');
        this.storyForm = document.getElementById('storyForm');
        this.successMessage = document.getElementById('successMessage');
        this.successOk = document.getElementById('successOk');

        // 3. Character Counter Elements
        this.loveStory = document.getElementById('loveStory');
        this.charCounter = document.getElementById('charCounter');

        // 4. Image Upload Elements
        this.imageInput = document.getElementById('storyImageInput');
        this.triggerImageBtn = document.getElementById('triggerStoryImageBtn');
        this.previewContainer = document.getElementById('storyImagePreviewContainer');
        this.previewImage = document.getElementById('storyImagePreview');
        this.removeImageBtn = document.getElementById('removeStoryImageBtn');

        this.init();
        this.injectStyles(); 
    }

    init() {
        if (!this.storyModal) return;

        // ✅ This loop now adds click listeners to your new buttons too
        this.triggers.forEach(btn => {
            btn.addEventListener('click', (e) => this.openModal(e));
        });

        // Close Logic
        if (this.closeModal) this.closeModal.addEventListener('click', () => this.closeModalFunc());
        
        this.storyModal.addEventListener('click', (e) => {
            if (e.target === this.storyModal) this.closeModalFunc();
        });

        // Submit Logic
        if (this.storyForm) {
            this.storyForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.successOk) {
            this.successOk.addEventListener('click', () => this.closeSuccessMessage());
        }

        // Character Counter Listener
        if (this.loveStory && this.charCounter) {
            this.loveStory.addEventListener('input', () => this.updateCharCounter());
        }

        // Image Upload Logic
        if (this.triggerImageBtn && this.imageInput) {
            this.triggerImageBtn.addEventListener('click', (e) => {
                e.preventDefault(); 
                this.imageInput.click();
            });

            this.imageInput.addEventListener('change', () => this.handleImageSelect());
        }

        if (this.removeImageBtn) {
            this.removeImageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearImage();
            });
        }
    }

    /* -----------------------------------------
       TOAST NOTIFICATION SYSTEM
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

    // Update Character Counter
    updateCharCounter() {
        const count = this.loveStory.value.length;
        this.charCounter.textContent = count;
        
        if (count > 19000) {
            this.charCounter.style.color = '#e74c3c'; 
        } else {
            this.charCounter.style.color = '#666';
        }

        if (count > 20000) {
            this.loveStory.value = this.loveStory.value.substring(0, 20000);
            this.charCounter.textContent = '20000';
            this.showToast("Character limit reached!", "error");
        }
    }

    handleImageSelect() {
        const file = this.imageInput.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                this.showToast("Image is too large (Max 5MB)", "error");
                this.imageInput.value = "";
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImage.src = e.target.result;
                this.previewContainer.classList.remove('hidden');
                this.triggerImageBtn.classList.add('hidden');
            };
            reader.readAsDataURL(file);
        }
    }

    clearImage() {
        this.imageInput.value = '';
        this.previewImage.src = '';
        this.previewContainer.classList.add('hidden');
        this.triggerImageBtn.classList.remove('hidden');
    }

    openModal(e) {
        if (e) e.preventDefault();
        this.storyModal.classList.remove('hidden');
        document.body.classList.add("modal-open");
        
        this.resetMoodSelection();
        this.updateCharCounter();
    }

    closeModalFunc() {
        this.storyModal.classList.add('hidden');
        document.body.classList.remove("modal-open");
        this.storyForm.reset();
        this.clearImage();
        if (this.charCounter) this.charCounter.textContent = '0';
    }
    
    closeSuccessMessage() {
        if (this.successMessage) this.successMessage.classList.add('hidden');
    }

    resetMoodSelection() {
        const moodOptions = document.querySelectorAll('.mood-option');
        moodOptions.forEach(opt => opt.classList.remove('selected'));
        const firstMood = document.querySelector('.mood-option');
        if (firstMood) {
            firstMood.classList.add('selected');
            const hiddenInput = document.getElementById('selectedMood');
            if(hiddenInput) hiddenInput.value = firstMood.dataset.mood || 'romantic';
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.loveStory.value.trim() || !document.getElementById('storyTitle').value.trim()) {
            this.showToast("Please fill in the title and story!", "error");
            return;
        }

        const submitBtn = this.storyForm.querySelector('.submit-story-btn');
        const originalText = submitBtn.innerText;
        
        submitBtn.innerHTML = '<span class="loading-spinner-small"></span> Sharing...';
        submitBtn.disabled = true;

        const formData = new FormData();
        formData.append('couple_names', document.getElementById('coupleNames').value);
        formData.append('story_title', document.getElementById('storyTitle').value);
        formData.append('together_since', document.getElementById('togetherSince').value);
        formData.append('love_story', this.loveStory.value);
        formData.append('category', document.getElementById('storyCategory').value);
        formData.append('mood', document.getElementById('selectedMood').value);
        formData.append('allow_comments', document.getElementById('allowComments').checked);
        formData.append('anonymous_post', document.getElementById('anonymousPost').checked);

        if (this.imageInput.files[0]) {
            formData.append('image', this.imageInput.files[0]);
        }

        try {
            if (this.loveStories?.addStory) {
                await this.loveStories.addStory(formData);
            } else {
                await this.submitStoryDirect(formData);
            }
            this.closeModalFunc();
            this.showToast("Story shared successfully! ❤️", "success");

            // ============================================================
            // ✅ THE FIX: Redirect if we are on the Home Page
            // ============================================================
            const storiesList = document.getElementById('storiesContainer');
            const isHomePage = document.body.classList.contains("homepage");
            
            // If there is no 'storiesContainer' on this page, it means we are 
            // on the Home Page (or elsewhere). We must redirect the user 
            // so they can see their new story.
            if (!storiesList || isHomePage) {
                setTimeout(() => {
                    // Change this URL if your page is named differently (e.g., /stories)
                    window.location.href = '/love-stories'; 
                }, 1000); // Small delay so they see the success toast
            }
            
            if (this.successMessage) this.successMessage.classList.remove('hidden');
            
        } catch (error) {
            this.showToast(error.message || "Failed to share story", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }

    async submitStoryDirect(formData) {
        const apiBase =
            window.API_BASE ||
            (window.location.hostname.includes("localhost")
                ? "http://localhost:3001/api"
                : "https://lovculator.com/api");

        const response = await fetch(`${apiBase}/stories`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!response.ok) {
            let message = "Failed to share story";
            try {
                const data = await response.json();
                message = data?.error || data?.message || message;
            } catch (_) {}
            throw new Error(message);
        }

        return response.json().catch(() => ({}));
    }

    /* -----------------------------------------
       STYLE INJECTION (Mobile Full Screen)
    ----------------------------------------- */
    injectStyles() {
        if (document.getElementById('story-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'story-modal-styles';
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

            /* BACKDROP */
            #storyModal:not(.hidden) {
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

            

            /* Modal Scroll Area */
            .modal-scroll-area {
                overflow-y: auto;
                padding: 20px;
                flex: 1;
            }

            /* DESKTOP ANIMATION */
            @media (min-width: 769px) {
                #storyModal > div {
                    transform: scale(1);
                    transition: transform 0.2s;
                }
            }

            /* MOBILE FULL SCREEN STYLES */
            @media (max-width: 768px) {
                #storyModal:not(.hidden) {
                    background: white;
                    align-items: flex-start;
                }

                #storyModal > div {
                    max-width: 100%;
                    height: 100%;
                    max-height: 100%; 
                    border-radius: 0; 
                    box-shadow: none;
                    animation: slideUp 0.3s ease-out;
                }
                
                .modal-scroll-area {
                    padding: 15px;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// ==============================================
// 6. INITIALIZATION
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    // We wait slightly to ensure window.loveStories is created by the other file
    setTimeout(() => {
        window.storyModal = new StoryModal(window.loveStories || null);
        console.log("✅ Story Modal Initialized");
    }, 100);
});
