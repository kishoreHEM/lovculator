// frontend/js/post-modal.js

document.addEventListener("DOMContentLoaded", () => {
    // === Get DOM Elements ===
    const modal = document.getElementById("createPostModal");
    const openBtn = document.getElementById("openPostModal");
    const closeBtn = document.getElementById("closePostModal");
    
    // User info elements
    const userAvatarEl = document.getElementById("modalPostAvatar");
    const userNameEl = document.getElementById("modalPostUserName");

    // Form elements
    const textArea = document.getElementById("modalPostContent");
    const submitBtn = document.getElementById("modalSubmitPost");   
    const charCount = document.getElementById("modalCharCount");
    const uploadBtn = document.getElementById("modalImageUploadBtn");
    const fileInput = document.getElementById("modalImageUpload");
    const dropZone = document.getElementById("modalImageDropZone");
    const previewContainer = document.getElementById("modalImagePreviewContainer");
    const previewImage = document.getElementById("modalPreviewImage");
    const removeImage = document.getElementById("modalRemoveImage");
    const privacySelect = document.getElementById("modalPostPrivacy");

    let selectedImage = null;

    /* ==================================================
       LOAD USER DETAILS (FINAL FIX: Use AuthManager and new response format)
       This fixes the "Guest User" issue.
    ================================================== */
    async function loadUser() {
    if (!userNameEl || !userAvatarEl || !window.AuthManager) return;

    try {
        const { res, data } = await window.AuthManager.getProfile();

        if (res.ok && data.success && data.user) {
            const user = data.user;

            userNameEl.textContent = user.display_name || user.username;
            userAvatarEl.src = user.avatar_url || "/images/default-avatar.png";

            window.currentUser = user;
        } else {
            userNameEl.textContent = "Guest User";
            userAvatarEl.src = "/images/default-avatar.png";
        }
    } catch (err) {
        console.error("❌ Failed to load user via AuthManager:", err);
        userNameEl.textContent = "Guest User";
        userAvatarEl.src = "/images/default-avatar.png";
    }
}


    /* ==================================================
       MODAL UI HANDLERS (OPEN/CLOSE)
    ================================================== */
    function openModal() {
        if (!modal) return;
        
        // 1. Load user details
        loadUser(); 
        
        // 2. Show the modal (using the 'hidden' class based on your HTML)
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open"); // For background scroll prevention
        
        textArea?.focus();
    }

    function closeModal() {
        if (!modal) return;

        modal.classList.add("hidden");
        document.body.classList.remove("modal-open"); 
        resetForm();
    }

    // --- MAIN EVENT LISTENERS ---
    openBtn?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });

    /* ==================================================
       POST SUBMISSION
    ================================================== */
    async function submitPost() {
        const content = textArea?.value?.trim() || "";
        
        if (!content && !selectedImage) {
            showToast('Please add some text or an image', 'error');
            return;
        }

        // Show loading state
        const originalText = submitBtn.innerHTML;
        if (submitBtn) {
            submitBtn.innerHTML = '<span class="loading-spinner-small"></span> Posting...';
            submitBtn.disabled = true;
        }

        try {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('type', 'post');
            
            formData.append('privacy', privacySelect ? privacySelect.value : 'public');
            
            if (selectedImage) {
                formData.append('image', selectedImage);
            }

            // Using standard fetch here since post creation is not in AuthManager
            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (response.ok) {
                showToast('Post created successfully!', 'success');
                closeModal();
                
                // Reload the feed
                if (window.loadFeed) {
                    window.loadFeed(); 
                } else if (window.layoutManager?.loadHomeContent) {
                    window.layoutManager.loadHomeContent();
                }
                
            } else {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Failed to create post');
            }

        } catch (error) {
            console.error('❌ Post creation error:', error);
            showToast(error.message || 'Failed to create post. Please try again.', 'error');
        } finally {
            // Reset button state
            if (submitBtn) {
                submitBtn.innerHTML = originalText;
                validate();
            }
        }
    }
    submitBtn?.addEventListener("click", submitPost);

    /* ==================================================
       TEXTAREA & VALIDATION
    ================================================== */
    textArea?.addEventListener("input", () => {
        // Auto-resize textarea
        textArea.style.height = "auto";
        textArea.style.height = Math.min(textArea.scrollHeight, 200) + "px";
        
        // Update character count
        const length = textArea.value.length;
        charCount.textContent = `${length} / 500`;
        
        // Visual feedback for character limit
        if (charCount) {
             if (length > 450) {
                charCount.style.color = '#f39c12';
            } else if (length > 490) {
                charCount.style.color = '#e74c3c';
            } else {
                charCount.style.color = '#65676b';
            }
        }
       
        validate();
    });

    function validate() {
        const content = textArea?.value?.trim() || "";
        const hasContent = content.length > 0 || selectedImage !== null;
        const withinLimit = content.length <= 500;
        
        if (submitBtn) {
             submitBtn.disabled = !hasContent || !withinLimit;
        }
    }

    /* ==================================================
       IMAGE UPLOAD & DRAG/DROP
    ================================================== */
    uploadBtn?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", (e) => {
        const file = e.target.files[0];
        handleImageFile(file);
    });

    removeImage?.addEventListener("click", () => {
        selectedImage = null;
        previewContainer?.classList.add("hidden");
        if (fileInput) fileInput.value = "";
        validate();
    });

    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        dropZone.addEventListener("dragover", () => dropZone.classList.add("drag-over"), false);
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"), false);

        dropZone.addEventListener("drop", (e) => {
            dropZone.classList.remove("drag-over");
            const file = e.dataTransfer.files[0];
            handleImageFile(file);
        }, false);
    }

    function handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please select an image file (JPEG, PNG, GIF)', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            showToast('Image size should be less than 5MB', 'error');
            return;
        }

        selectedImage = file;
        const reader = new FileReader();
        reader.onload = () => {
            if (previewImage) previewImage.src = reader.result;
            previewContainer?.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
        validate();
    }


    /* ==================================================
       RESET MODAL FORM
    ================================================== */
    function resetForm() {
        if (textArea) {
            textArea.value = "";
            textArea.style.height = "auto";
        }
        selectedImage = null;
        previewContainer?.classList.add("hidden");
        if (fileInput) fileInput.value = "";
        if (charCount) {
            charCount.textContent = "0 / 500";
            charCount.style.color = '#65676b';
        }
        if (privacySelect) privacySelect.value = "public";

        validate();
    }
    
    resetForm();

    /* ==================================================
       TOAST NOTIFICATION UTILITY
    ================================================== */
    function showToast(message, type = 'info') {
        document.querySelectorAll('.app-toast').forEach(t => t.remove());

        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3',
            warning: '#ff9800'
        };

        const toast = document.createElement('div');
        toast.className = 'app-toast';
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        
        toast.innerHTML = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    // Add CSS for required animations/spinners/visibility if not present
    if (!document.querySelector('#post-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'post-modal-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .loading-spinner-small {
                width: 16px;
                height: 16px;
                border: 2px solid transparent;
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                display: inline-block;
                margin-right: 8px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            /* Use this to make sure your modal container is hidden by the 'hidden' class */
            .hidden {
                display: none !important;
            }
            /* Ensure the modal overlay is centered when not hidden */
            .modal-overlay:not(.hidden) {
                display: flex;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5); 
                z-index: 9000;
                justify-content: center;
                align-items: center;
            }
            .modal-open {
                overflow: hidden; /* Prevent background scrolling */
            }
        `;
        document.head.appendChild(style);
    }
});