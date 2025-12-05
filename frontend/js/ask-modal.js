// frontend/js/ask-modal.js
class AskModalController {
    constructor() {
        // ---- MODALS ----
        this.storyModal = document.getElementById("storyModal");
        this.askModal = document.getElementById("askCreateModal");
        this.postModal = document.getElementById("createPostModal");

        // ---- BUTTONS ----
        this.btnStory = document.getElementById("btnStory");
        this.btnAsk = document.getElementById("btnQuestion");
        this.btnPost = document.getElementById("btnPost");
        this.bigTextBar = document.getElementById("openPostModal"); // Main big input bar

        // ---- CLOSE BUTTONS ----
        this.closeAskBtn = document.getElementById("closeAskModal");
        this.closeStoryBtn = document.getElementById("closeModal");
        this.closePostBtn = document.getElementById("closePostModal");

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

    openAskModal() {
        this.open(this.askModal);

        // Make sure ASK TAB is selected
        const tabQuestion = document.getElementById("tabAddQuestion");
        const tabPost = document.getElementById("tabCreatePost");
        const questionSection = document.getElementById("questionSection");
        const postSection = document.getElementById("postSection");

        if (tabQuestion && questionSection) {
            tabQuestion.classList.add("active");
            tabPost?.classList.remove("active");
            questionSection.classList.remove("hidden");
            postSection?.classList.add("hidden");
        }
    }

    init() {
        /* -----------------------------------------
           BUTTON ACTIONS (HOME PAGE)
        ----------------------------------------- */

        // ❤️ Love Story
        this.btnStory?.addEventListener("click", () =>
            this.open(this.storyModal)
        );

        // ❓ Ask
        this.btnAsk?.addEventListener("click", () =>
            this.openAskModal()
        );

        // 📝 Post
        this.btnPost?.addEventListener("click", () =>
            this.open(this.postModal)
        );

        // Big text bar = open post modal
        this.bigTextBar?.addEventListener("click", () =>
            this.open(this.postModal)
        );

        /* -----------------------------------------
           CLOSE BUTTONS
        ----------------------------------------- */

        this.closeAskBtn?.addEventListener("click", () =>
            this.close(this.askModal)
        );

        this.closeStoryBtn?.addEventListener("click", () =>
            this.close(this.storyModal)
        );

        this.closePostBtn?.addEventListener("click", () =>
            this.close(this.postModal)
        );

        /* -----------------------------------------
           CLICK OUTSIDE CLOSE
        ----------------------------------------- */

        window.addEventListener("click", (e) => {
            if (e.target === this.askModal) this.close(this.askModal);
            if (e.target === this.storyModal) this.close(this.storyModal);
            if (e.target === this.postModal) this.close(this.postModal);
        });

        console.log("✅ AskModalController initialized successfully");
    }
}

// AUTO INIT
document.addEventListener("DOMContentLoaded", () => {
    new AskModalController();
});
