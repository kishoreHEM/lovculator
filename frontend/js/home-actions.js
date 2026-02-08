document.addEventListener("DOMContentLoaded", () => {
  const requireAuth = (actionLabel) => {
    if (window.currentUserId) return true;
    if (typeof window.showLoginModal === "function") {
      window.showLoginModal(actionLabel);
    }
    return false;
  };

  // Big text bar → Ask modal
  document.getElementById("openPostModal")?.addEventListener("click", () => {
    if (!requireAuth("ask a question")) return;
    if (window.askModalController?.openAskModal) {
      window.askModalController.openAskModal();
    } else {
      document.getElementById("btnQuestion")?.click();
    }
  });

  // Ask button → Ask modal
  document.getElementById("btnQuestion")?.addEventListener("click", () => {
    if (!requireAuth("ask a question")) return;
    window.askModalController?.openAskModal();
  });

  // Love Story → Story modal (already works)
  document.getElementById("btnStory")?.addEventListener("click", () => {
    if (!requireAuth("share a love story")) return;
    document.getElementById("storyModal")?.classList.remove("hidden");
  });

  // Answer → redirect to /answer page
  document.getElementById("btnPost")?.addEventListener("click", () => {
    if (!requireAuth("answer questions")) return;
    window.location.href = "/questions";
  });

});
