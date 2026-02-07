document.addEventListener("DOMContentLoaded", () => {

  // Big text bar → Ask modal
  document.getElementById("openPostModal")?.addEventListener("click", () => {
    if (window.askModalController?.openAskModal) {
      window.askModalController.openAskModal();
    } else {
      document.getElementById("btnQuestion")?.click();
    }
  });

  // Ask button → Ask modal
  document.getElementById("btnQuestion")?.addEventListener("click", () => {
    window.askModalController?.openAskModal();
  });

  // Love Story → Story modal (already works)
  document.getElementById("btnStory")?.addEventListener("click", () => {
    document.getElementById("storyModal")?.classList.remove("hidden");
  });

  // Answer → redirect to /answer page
  document.getElementById("btnPost")?.addEventListener("click", () => {
    window.location.href = "/questions";
  });

});
