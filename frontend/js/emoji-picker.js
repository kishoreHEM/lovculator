/**
 * frontend/js/emoji-picker.js
 * Reusable Emoji Picker Module using Picmo
 */

class EmojiPickerManager {
    constructor(triggerBtnId, containerId, inputId) {
        this.triggerBtn = document.getElementById(triggerBtnId);
        this.container = document.getElementById(containerId);
        this.input = document.getElementById(inputId);
        this.picker = null;
        
        // Don't init if elements are missing
        if (!this.triggerBtn || !this.container || !this.input) {
            console.error("❌ EmojiPickerManager: Elements not found", { 
                btn: !!this.triggerBtn, 
                container: !!this.container, 
                input: !!this.input 
            });
            return;
        }

        this.init();
    }

    init() {
        // Ensure Picmo is loaded
        if (!window.picmo) {
            console.error("❌ Picmo library not found. Make sure the script tag is in messages.html");
            return;
        }

        try {
            console.log("🎨 Creating Picmo Picker...");
            // 1. Create the Picker
            this.picker = window.picmo.createPicker({
                rootElement: this.container,
                theme: 'light',
                showPreview: false,
                initialCategory: 'smileys-emotion',
                emojisPerRow: 7,
                visibleRows: window.innerWidth < 768 ? 5 : 6 
            });

            // 2. Listen for Emoji Selection
            this.picker.addEventListener('emoji:select', (selection) => {
                this.insertEmoji(selection.emoji);
            });

            // 3. Toggle Logic
            this.triggerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });

            // 4. Close on Click Outside
            document.addEventListener('click', (e) => {
                this.handleClickOutside(e);
            });

            console.log("✅ Emoji Picker Initialized successfully");

        } catch (e) {
            console.error("❌ Failed to create emoji picker:", e);
        }
    }

    insertEmoji(emoji) {
        const cursorPosition = this.input.selectionStart;
        const text = this.input.value;

        // Insert at cursor
        this.input.value = text.slice(0, cursorPosition) + emoji + text.slice(cursorPosition);
        
        // Move cursor forward
        const newCursorPos = cursorPosition + emoji.length;
        this.input.setSelectionRange(newCursorPos, newCursorPos);
        this.input.focus();

        // Trigger input event (so auto-resize logic in messages.js sees the change)
        this.input.dispatchEvent(new Event('input'));
    }

    toggle() {
        // Check if classList contains hidden (or active)
        if (this.container.classList.contains('hidden')) {
            this.show();
        } else {
            this.hide();
        }
    }

    show() {
        this.container.classList.remove('hidden');
        // Small delay for CSS animation
        setTimeout(() => this.container.classList.add('active'), 10);
    }

    hide() {
        this.container.classList.remove('active');
        setTimeout(() => this.container.classList.add('hidden'), 200);
    }

    handleClickOutside(e) {
        // If click is NOT on the container AND NOT on the button
        if (!this.container.contains(e.target) && !this.triggerBtn.contains(e.target)) {
            // If it is currently visible, hide it
            if (!this.container.classList.contains('hidden')) {
                this.hide();
            }
        }
    }
}

// Attach to window so other scripts can use it
window.EmojiPickerManager = EmojiPickerManager;