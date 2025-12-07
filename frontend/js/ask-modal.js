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
        this.submitAskBtn = document.getElementById("submitQuestion"); // The "Ask" button
        this.questionInput = document.getElementById("questionText");
        this.askCharCount = document.getElementById("askCharCount");

        // ---- USER INFO ELEMENTS ----
        this.askUserAvatar = document.getElementById("askUserAvatar");
        this.askUserName = document.getElementById("askUserName");

        this.init();
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

    updateUserInfo() {
        // 1. Try to get user from global variable
        let user = window.currentUser;

        // 2. Fallback: Try local storage
        if (!user) {
            try {
                const stored = localStorage.getItem('user');
                if (stored) user = JSON.parse(stored);
            } catch (e) {
                console.error("Error parsing user from storage", e);
            }
        }

        // 3. Update the UI
        if (user) {
            if (this.askUserAvatar) {
                this.askUserAvatar.src = user.avatar_url && user.avatar_url !== "null" 
                    ? user.avatar_url 
                    : "/images/default-avatar.png";
            }
            if (this.askUserName) {
                this.askUserName.textContent = user.username || "User";
            }
        }
    }

    openAskModal() {
        this.updateUserInfo();
        this.open(this.askModal);
        // Focus the input
        setTimeout(() => this.questionInput?.focus(), 100);
    }

    /* -----------------------------------------
       ✅ NEW: SUBMIT QUESTION LOGIC
    ----------------------------------------- */
    async submitQuestion() {
        const text = this.questionInput.value.trim();

        if (!text) {
            alert("Please write a question first.");
            return;
        }

        // 1. Show Loading State
        const originalText = this.submitAskBtn.innerText;
        this.submitAskBtn.innerText = "Posting...";
        this.submitAskBtn.disabled = true;

        try {
            // 2. Send to Backend
            // Detect API URL (Local vs Prod)
            const API_BASE = window.location.hostname.includes("localhost")
                ? "http://localhost:3001/api"
                : "https://lovculator.com/api";

            const response = await fetch(`${API_BASE}/questions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include", // Important for cookies/session
                body: JSON.stringify({ question: text })
            });

            const data = await response.json();

            if (response.ok) {
                // 3. Success!
                alert("✅ Question posted successfully!");
                this.questionInput.value = ""; // Clear input
                this.close(this.askModal);
                
                // Optional: Reload to see new question
                window.location.reload(); 
            } else {
                alert("❌ Error: " + (data.error || "Failed to post question"));
            }

        } catch (err) {
            console.error(err);
            alert("❌ Network Error. Please try again.");
        } finally {
            // 4. Reset Button
            this.submitAskBtn.innerText = originalText;
            this.submitAskBtn.disabled = false;
        }
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

        // --- ✅ Submit Action ---
        this.submitAskBtn?.addEventListener("click", () => this.submitQuestion());

        // --- Character Count & Auto-Enable Button ---
        this.questionInput?.addEventListener("input", () => {
            const len = this.questionInput.value.length;
            if (this.askCharCount) this.askCharCount.innerText = `${len} / 300`;
            
            // Enable button only if text exists
            if (this.submitAskBtn) {
                this.submitAskBtn.disabled = len === 0;
            }
        });

        console.log("✅ AskModalController initialized with Submit Logic");
    }
}

// AUTO INIT
document.addEventListener("DOMContentLoaded", () => {
    new AskModalController();
});