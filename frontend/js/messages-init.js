document.addEventListener("DOMContentLoaded", () => {
    const btnStory = document.getElementById("btnStory");
    const btnQuestion = document.getElementById("btnQuestion");
    const btnPost = document.getElementById("btnPost");
    const openPostModal = document.getElementById("openPostModal");

    if (btnStory) btnStory.addEventListener("click", () => window.location.href = "/love-stories");
    if (btnQuestion) btnQuestion.addEventListener("click", () => openPostModal?.click());
    if (btnPost) btnPost.addEventListener("click", () => openPostModal?.click());

    // Auto-load feed if function exists
    if (window.loadFeed) window.loadFeed();
});
