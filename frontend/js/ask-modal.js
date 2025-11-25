// frontend/js/ask-modal.js
class AskModal {
    constructor() {
        this.askModal = document.getElementById("askCreateModal");
        this.storyModal = document.getElementById("storyModal");
        this.init();
    }

    init() {
        // Ask/Post bar elements
        const askTrigger = document.getElementById("askTrigger");
        const askBtn = document.getElementById("askQuestionBtn");
        const postBtn = document.getElementById("postStoryBtn");

        // Ask modal elements
        const tabQuestion = document.getElementById("tabAddQuestion");
        const tabPost = document.getElementById("tabCreatePost");
        const questionSection = document.getElementById("questionSection");
        const postSection = document.getElementById("postSection");
        const cancelAskCreate = document.getElementById("cancelAskCreate");
        const cancelPostCreate = document.getElementById("cancelPostCreate");
        const submitQuestion = document.getElementById("submitQuestion");
        const submitPost = document.getElementById("submitPost");

        // Close button in story modal
        const closeStoryModal = document.getElementById("closeModal");

        // Helper: Switch tabs
        const switchTab = (type) => {
            if (!tabQuestion || !tabPost || !questionSection || !postSection) return;
            const isQuestion = type === "question";
            tabQuestion.classList.toggle("active", isQuestion);
            tabPost.classList.toggle("active", !isQuestion);
            questionSection.classList.toggle("hidden", !isQuestion);
            postSection.classList.toggle("hidden", isQuestion);
        };

        // Helper: Safe modal toggle
        const showModal = (modal) => {
            if (modal) modal.classList.remove("hidden");
        };
        const hideModal = (modal) => {
            if (modal) modal.classList.add("hidden");
        };

        // 🧠 Open modal from Ask bar
        askTrigger?.addEventListener("click", () => showModal(this.askModal));
        askBtn?.addEventListener("click", () => {
            showModal(this.askModal);
            switchTab("question");
        });
        postBtn?.addEventListener("click", () => {
            showModal(this.askModal);
            switchTab("post");
        });

        // 🗂️ Tab switching
        tabQuestion?.addEventListener("click", () => switchTab("question"));
        tabPost?.addEventListener("click", () => switchTab("post"));

        // ❌ Close Ask modal
        cancelAskCreate?.addEventListener("click", () => hideModal(this.askModal));
        cancelPostCreate?.addEventListener("click", () => hideModal(this.askModal));

        // ✅ Submit Question
        submitQuestion?.addEventListener("click", async () => {
            const questionInput = document.getElementById("questionText");
            const question = questionInput?.value.trim();
            if (!question) return alert("Please enter your question.");

            try {
                const res = await fetch("/api/questions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ question })
                });

                if (res.ok) {
                    alert("✅ Question posted successfully!");
                    questionInput.value = "";
                    localStorage.removeItem("draft_question");
                    hideModal(this.askModal);
                } else if (res.status === 401) {
                    alert("⚠️ Please log in to post a question.");
                    window.location.href = "/login.html";
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert("❌ Failed to post question: " + (data.error || "Unknown error"));
                }

            } catch (err) {
                console.error("Error posting question:", err);
                alert("⚠️ Something went wrong. Try again later.");
            }
        });

        // 🩷 Create Post (opens Love Story modal)
        submitPost?.addEventListener("click", () => {
            hideModal(this.askModal);
            showModal(this.storyModal);
        });

        // ✖️ Close Love Story modal
        closeStoryModal?.addEventListener("click", () => hideModal(this.storyModal));

        // 🪄 Close modals when clicking outside
        window.addEventListener("click", (e) => {
            if (e.target === this.askModal) hideModal(this.askModal);
            if (e.target === this.storyModal) hideModal(this.storyModal);
        });

        console.log("✅ Ask/Post modal logic initialized successfully");
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AskModal };
}