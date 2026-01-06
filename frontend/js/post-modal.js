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

    // ... inside DOMContentLoaded ...

    // === EMOJI PICKER LOGIC ===
    const emojiBtn = document.getElementById("modalEmojiBtn");
    const emojiContainer = document.getElementById("emojiPickerContainer");
    let picker = null;

    if (emojiBtn && emojiContainer && window.picmo) {
        
        // 1. Initialize Picker
        try {
            picker = window.picmo.createPicker({
                rootElement: emojiContainer,
                theme: 'light', 
                showPreview: false,
                initialCategory: 'smileys-emotion',
                
                // ✅ FORCE 7 COLUMNS
                emojisPerRow: 7, 
                
                // Optional: Adjust rows based on screen size
                visibleRows: window.innerWidth < 768 ? 6 : 8 
            });

            // 2. Handle Emoji Selection
            picker.addEventListener('emoji:select', (selection) => {
                const emoji = selection.emoji;
                const cursorPosition = textArea.selectionStart;
                const text = textArea.value;

                // Insert at cursor position
                const newText = text.slice(0, cursorPosition) + emoji + text.slice(cursorPosition);
                textArea.value = newText;
                
                // Move cursor after emoji
                const newCursorPos = cursorPosition + emoji.length;
                textArea.setSelectionRange(newCursorPos, newCursorPos);
                textArea.focus();

                // Trigger input event to update validation/char count
                textArea.dispatchEvent(new Event('input'));
                
                // Optional: Close picker after selection
                // emojiContainer.classList.add('hidden'); 
            });

        } catch (e) {
            console.error("Failed to init emoji picker:", e);
        }

        // 3. Toggle Picker Visibility
        emojiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent modal click listener from closing it immediately
            emojiContainer.classList.toggle('hidden');
        });

        // 4. Close Picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!emojiContainer.contains(e.target) && !emojiBtn.contains(e.target)) {
                emojiContainer.classList.add('hidden');
            }
        });
    }

    /* ==================================================
       LOAD USER DETAILS
    ================================================== */
    async function loadUser() {
    if (!userNameEl || !userAvatarEl || !window.AuthManager) return;

    try {
        const { res, data } = await window.AuthManager.getProfile();

        // ✅ FIX: backend returns { user }, not { success }
        if (res.ok && data?.user) {
            const user = data.user;

            userNameEl.textContent =
                user.display_name || user.username || "User";

            userAvatarEl.src =
                user.avatar_url || "/images/default-avatar.png";

            window.currentUser = user;
        } else {
            throw new Error("No user in response");
        }
    } catch (err) {
        console.error("❌ Failed to load user:", err);
        userNameEl.textContent = "Guest User";
        userAvatarEl.src = "/images/default-avatar.png";
    }
}


    /* ==================================================
       MODAL UI HANDLERS
    ================================================== */
    function openModal() {
        if (!modal) return;
        loadUser(); 
        modal.classList.remove("hidden");
        document.body.classList.add("modal-open");
        
        // Mobile UX: Delay focus slightly to prevent keyboard jumping immediately
        if(window.innerWidth > 768) {
            textArea?.focus();
        }
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.add("hidden");
        document.body.classList.remove("modal-open"); 
        resetForm();
    }

    openBtn?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);

    // Close on backdrop click (Desktop only - mobile usually requires explicit close)
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
            showToast('Please add text or an image', 'error');
            return;
        }

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

            const response = await fetch('/api/posts', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            if (response.ok) {
                showToast('Post created!', 'success');
                closeModal();
                if (window.loadFeed) {
                    window.loadFeed(); 
                } else if (window.layoutManager?.loadHomeContent) {
                    window.layoutManager.loadHomeContent();
                }
            } else {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Failed');
            }

        } catch (error) {
            console.error('❌ Post error:', error);
            showToast(error.message, 'error');
        } finally {
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
        // Auto-grow
        textArea.style.height = "auto";
        textArea.style.height = textArea.scrollHeight + "px";
        
        const length = textArea.value.length;
        charCount.textContent = `${length} / 500`;
        
        if (charCount) {
             if (length > 450) charCount.style.color = '#f39c12';
             else if (length > 490) charCount.style.color = '#e74c3c';
             else charCount.style.color = '#65676b';
        }
        validate();
    });

    function validate() {
        const content = textArea?.value?.trim() || "";
        const hasContent = content.length > 0 || selectedImage !== null;
        const withinLimit = content.length <= 500;
        if (submitBtn) submitBtn.disabled = !hasContent || !withinLimit;
    }

    /* ==================================================
       IMAGE UPLOAD
    ================================================== */
    uploadBtn?.addEventListener("click", () => fileInput?.click());

    fileInput?.addEventListener("change", (e) => {
        handleImageFile(e.target.files[0]);
    });

    removeImage?.addEventListener("click", () => {
        selectedImage = null;
        previewContainer?.classList.add("hidden");
        if (fileInput) fileInput.value = "";
        validate();
    });

    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
        });
        dropZone.addEventListener("dragover", () => dropZone.classList.add("drag-over"));
        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
        dropZone.addEventListener("drop", (e) => {
            dropZone.classList.remove("drag-over");
            handleImageFile(e.dataTransfer.files[0]);
        });
    }

    function handleImageFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Select an image file', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image too large (max 5MB)', 'error');
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

    function resetForm() {
        if (textArea) { textArea.value = ""; textArea.style.height = "auto"; }
        selectedImage = null;
        previewContainer?.classList.add("hidden");
        if (fileInput) fileInput.value = "";
        if (charCount) charCount.textContent = "0 / 500";
        if (privacySelect) privacySelect.value = "public";
        validate();
    }

    /* ==================================================
       TOAST & STYLES (MOBILE ENHANCED)
    ================================================== */
    function showToast(message, type = 'info') {
        const existing = document.querySelector('.app-toast');
        if(existing) existing.remove();

        const colors = { success: '#4CAF50', error: '#f44336', info: '#2196F3' };
        const toast = document.createElement('div');
        toast.className = 'app-toast';
        toast.style.cssText = `position:fixed; top:20px; right:20px; background:${colors[type]}; color:white; padding:12px 20px; border-radius:8px; z-index:10000; animation:slideInRight 0.3s ease;`;
        toast.textContent = message; // Safer than innerHTML
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    if (!document.querySelector('#post-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'post-modal-styles';
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

            .hidden { display: none !important; }
            .modal-open { overflow: hidden; }

            /* BACKDROP */
            .modal-overlay:not(.hidden) {
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

            /* == RESPONSIVE MODAL BOX == */
            /* Assuming your HTML has a child inside #createPostModal, 
               typically a div with class 'modal-content' or similar. 
               We target the direct child div here for safety. */
            
            #createPostModal > div {
                background: white;
                width: 100%;
                max-width: 550px;
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                display: flex;
                flex-direction: column;
                max-height: 90vh; /* Don't overflow desktop screen */
                overflow: hidden;
            }

            /* --- DESKTOP STYLES --- */
            @media (min-width: 769px) {
                #createPostModal > div {
                    /* Desktop Animation */
                    transform: scale(1);
                    transition: transform 0.2s;
                }
            }

            /* --- MOBILE FULL SCREEN STYLES --- */
            @media (max-width: 768px) {
                .modal-overlay:not(.hidden) {
                    background: white; /* Solid background on mobile */
                    align-items: flex-start; /* Align to top */
                }

                #createPostModal > div {
                    max-width: 100%;
                    height: 100%;     /* Full Height */
                    max-height: 100%; /* Override desktop restriction */
                    border-radius: 0; /* Remove corners */
                    box-shadow: none;
                    animation: slideUp 0.3s ease-out; /* Slide up from bottom */
                }

                /* If you have a header class in your HTML */
                .modal-header {
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                }

                /* Ensure content area scrolls if keyboard opens */
                .modal-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                }

                /* Fix footer to bottom if needed */
                .modal-footer {
                    padding: 15px;
                    border-top: 1px solid #eee;
                    background: white;
                }
            }
        `;
        document.head.appendChild(style);
    }
});