// frontend/js/story-modal.js
class StoryModal {
    constructor(loveStoriesInstance, notificationService) {
        this.loveStories = loveStoriesInstance;
        this.notifications = notificationService;
        this.storyFab = document.getElementById('storyFab');
        this.storyModal = document.getElementById('storyModal');
        this.closeModal = document.getElementById('closeModal');
        this.storyForm = document.getElementById('storyForm');
        this.successMessage = document.getElementById('successMessage');
        this.successOk = document.getElementById('successOk');
        this.loveStory = document.getElementById('loveStory');
        this.charCounter = document.getElementById('charCounter');
        
        this.init();
    }

    init() {
        if (!this.storyFab || !this.storyModal) return;

        this.storyFab.addEventListener('click', (e) => this.openModal(e));
        this.closeModal.addEventListener('click', () => this.closeModalFunc());
        this.storyModal.addEventListener('click', (e) => {
            if (e.target === this.storyModal) this.closeModalFunc();
        });

        if (this.loveStory && this.charCounter) {
            this.loveStory.addEventListener('input', () => this.updateCharCounter());
        }

        if (this.storyForm) {
            this.storyForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        if (this.successOk) {
            this.successOk.addEventListener('click', () => this.closeSuccessMessage());
        }

        if (this.successMessage) {
            this.successMessage.addEventListener('click', (e) => {
                if (e.target === this.successMessage) this.closeSuccessMessage();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModalFunc();
                this.closeSuccessMessage();
            }
        });
    }

    openModal(e) {
        if (e) e.preventDefault();
        this.storyModal.classList.remove('hidden');
        this.storyModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('coupleNames')?.focus(), 100);
        this.previousActiveElement = document.activeElement;
        this.resetMoodSelection();
    }

    closeModalFunc() {
        this.storyModal.classList.add('hidden');
        this.storyModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (this.previousActiveElement) this.previousActiveElement.focus();
    }

    updateCharCounter() {
        const count = this.loveStory.value.length;
        this.charCounter.textContent = count;
        
        if (count > 9000) {
            this.charCounter.classList.add('warning');
        } else {
            this.charCounter.classList.remove('warning');
        }
        
        if (count > 10000) {
            this.loveStory.value = this.loveStory.value.substring(0, 10000);
            this.charCounter.textContent = '10000';
            this.charCounter.classList.add('warning');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const submitBtn = this.storyForm.querySelector('.submit-story-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        submitBtn.disabled = true;

        const formData = {
            coupleNames: document.getElementById('coupleNames').value,
            storyTitle: document.getElementById('storyTitle').value,
            togetherSince: document.getElementById('togetherSince').value,
            loveStory: this.loveStory.value,
            category: document.getElementById('storyCategory').value,
            mood: document.getElementById('selectedMood').value,
            allowComments: document.getElementById('allowComments').checked,
            anonymousPost: document.getElementById('anonymousPost').checked
        };

        const backendPayload = {
            story_title: formData.storyTitle,
            love_story: formData.loveStory,
            category: formData.category,
            mood: formData.mood,
            couple_names: formData.coupleNames,
            together_since: formData.togetherSince,
            allow_comments: formData.allowComments,
            anonymous_post: formData.anonymousPost
        };

        if (!backendPayload.story_title?.trim() || !backendPayload.love_story?.trim()) {
            this.notifications.showError("Please fill in both title and story content before submitting.");
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            return;
        }

        try {
            await this.loveStories.addStory(backendPayload);
            this.closeModalFunc();
            this.showSuccessMessage();
        } catch (error) {
            console.error('Error submitting story:', error);
            this.notifications.showError('Failed to share story. ' + error.message);
        } finally {
            this.resetForm();
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    showSuccessMessage() {
        if (this.successMessage) {
            this.successMessage.classList.remove('hidden');
            this.successMessage.setAttribute('aria-hidden', 'false');
        }
    }

    closeSuccessMessage() {
        if (this.successMessage) {
            this.successMessage.classList.add('hidden');
            this.successMessage.setAttribute('aria-hidden', 'true');
        }
    }

    resetForm() {
        if (this.storyForm) this.storyForm.reset();
        if (this.charCounter) {
            this.charCounter.textContent = '0';
            this.charCounter.classList.remove('warning');
        }
    }

    resetMoodSelection() {
        document.querySelectorAll('.mood-option').forEach(opt => 
            opt.classList.remove('selected'));
        const firstMood = document.querySelector('.mood-option');
        if (firstMood) {
            firstMood.classList.add('selected');
            document.getElementById('selectedMood').value = firstMood.dataset.mood || 'romantic';
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StoryModal };
}