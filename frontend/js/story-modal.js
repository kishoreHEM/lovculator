// frontend/js/story-modal.js
class StoryModal {
    constructor(loveStoriesInstance) {
        this.loveStories = loveStoriesInstance;
        
        // 1. Find ALL trigger buttons (Home Page + FAB)
        this.triggers = [];
        const btnStory = document.getElementById('btnStory'); // Home page button
        const storyFab = document.getElementById('storyFab'); // FAB button
        
        if (btnStory) this.triggers.push(btnStory);
        if (storyFab) this.triggers.push(storyFab);

        // 2. Main Elements
        this.storyModal = document.getElementById('storyModal');
        this.closeModal = document.getElementById('closeModal');
        this.storyForm = document.getElementById('storyForm');
        this.successMessage = document.getElementById('successMessage');
        this.successOk = document.getElementById('successOk');

        // ✅ 3. Character Counter Elements (Added Back)
        this.loveStory = document.getElementById('loveStory');
        this.charCounter = document.getElementById('charCounter');

        // 4. Image Upload Elements
        this.imageInput = document.getElementById('storyImageInput');
        this.triggerImageBtn = document.getElementById('triggerStoryImageBtn');
        this.previewContainer = document.getElementById('storyImagePreviewContainer');
        this.previewImage = document.getElementById('storyImagePreview');
        this.removeImageBtn = document.getElementById('removeStoryImageBtn');

        this.init();
    }

    init() {
        if (!this.storyModal) return;

        // Open Listeners
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

        // ✅ Character Counter Listener
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

    // ✅ NEW: Update Character Counter to 20,000
    updateCharCounter() {
        const count = this.loveStory.value.length;
        this.charCounter.textContent = count;
        
        // Optional warning style near the limit
        if (count > 19000) {
            this.charCounter.style.color = 'red';
        } else {
            this.charCounter.style.color = '';
        }

        // Hard Limit
        if (count > 20000) {
            this.loveStory.value = this.loveStory.value.substring(0, 20000);
            this.charCounter.textContent = '20000';
        }
    }

    handleImageSelect() {
        const file = this.imageInput.files[0];
        if (file) {
            // Optional: Check size (e.g. 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert("Image is too large (Max 5MB)");
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
        document.body.style.overflow = 'hidden';
        
        // Reset Mood
        this.resetMoodSelection();
        // Reset Counter
        this.updateCharCounter();
    }

    closeModalFunc() {
        this.storyModal.classList.add('hidden');
        document.body.style.overflow = '';
        this.storyForm.reset();
        this.clearImage();
        if (this.charCounter) this.charCounter.textContent = '0';
    }
    
    closeSuccessMessage() {
        if (this.successMessage) this.successMessage.classList.add('hidden');
    }

    resetMoodSelection() {
        // Reset visual selection to first option
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
        const submitBtn = this.storyForm.querySelector('.submit-story-btn');
        const btnText = submitBtn.querySelector('.btn-text'); // If you have span for text
        const btnLoading = submitBtn.querySelector('.btn-loading'); // If you have spinner

        if(btnText) btnText.classList.add('hidden');
        if(btnLoading) btnLoading.classList.remove('hidden');
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
            await this.loveStories.addStory(formData);
            this.closeModalFunc();
            if (this.successMessage) this.successMessage.classList.remove('hidden');
        } catch (error) {
            alert('Failed to share story: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            if(btnText) btnText.classList.remove('hidden');
            if(btnLoading) btnLoading.classList.add('hidden');
        }
    }
}