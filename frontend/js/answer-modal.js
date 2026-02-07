/**
 * answer-modal.js
 * Production-ready – Supports interleaved text, multiple images, and dynamic credentials
 */

document.addEventListener("DOMContentLoaded", () => {

  // ==================================================
  // CONFIG & STATE
  // ==================================================
  const MAX_CHARS = 10000;
  let currentQuestionId = null;

  // ==================================================
  // ELEMENTS
  // ==================================================
  const modal = document.getElementById("answerCreateModal");
  const closeBtn = document.getElementById("closePostModal");
  const userAvatarEl = document.getElementById("modalPostAvatar");
  const userNameEl = document.getElementById("modalPostUserName");
  const userBioEl = document.getElementById("modalUserBio"); // Target the new ID
  const questionTitleEl = document.getElementById("answerModalQuestionTitle");

  const editor = document.getElementById("modalPostContent"); 
  const submitBtn = document.getElementById("modalSubmitPost");
  const charCount = document.getElementById("modalCharCount");

  const uploadBtn = document.getElementById("modalImageUploadBtn");
  const fileInput = document.getElementById("modalImageUpload");
  const emojiBtn = document.getElementById("modalEmojiBtn");
  const emojiContainer = document.getElementById("emojiPickerContainer");
  let selectedImage = null;

  // ==================================================
  // LOAD USER (Picks bio dynamically from profile)
  // ==================================================
  async function loadUser() {
    // Helper to set UI
    const setUserUI = (user) => {
      userNameEl.textContent = user.display_name || user.username || "User";
      userAvatarEl.src = user.avatar_url || "/images/default-avatar.png";
      
      // Picks bio from user profile, fallback to default
      userBioEl.textContent = user.bio || "Community Member"; 
    };

    if (window.currentUser) {
      setUserUI(window.currentUser);
      return;
    }

    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const user = data.user || data;
        window.currentUser = user;
        setUserUI(user);
      }
    } catch (e) {
      userNameEl.textContent = "Guest";
      userBioEl.textContent = "Sign in to contribute";
    }
  }

  // ==================================================
  // OPEN / CLOSE
  // ==================================================
  window.openAnswerModal = function (questionId, questionTitle) {
    currentQuestionId = questionId;
    questionTitleEl.textContent = questionTitle || "";
    loadUser(); // Triggers dynamic data pull
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
    setTimeout(() => editor?.focus(), 150);
  };

  function closeModal() {
    modal.classList.add("hidden");
    document.body.classList.remove("modal-open");
    resetForm();
  }

  closeBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", e => { if (e.target === modal) closeModal(); });

  // ==================================================
  // INTERLEAVED IMAGE UPLOAD
  // ==================================================
  uploadBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Select a valid image", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Image max 5MB", "error");
      return;
    }

    selectedImage = file;

    const reader = new FileReader();
    reader.onload = () => {
      const wrapper = document.createElement("div");
      wrapper.className = "editor-image-wrapper";
      wrapper.contentEditable = "false"; 
      wrapper.style.position = "relative";
      wrapper.style.margin = "15px 0";

      const img = document.createElement("img");
      img.src = reader.result;
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      img.style.display = "block";

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "&times;";
      removeBtn.style.cssText = "position:absolute;top:10px;right:10px;background:#fff;border-radius:50%;width:28px;height:28px;border:1px solid #ddd;cursor:pointer;font-size:20px;";
      removeBtn.onclick = () => { wrapper.remove(); validate(); };

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);

      editor.focus();
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(wrapper);
        
        const br = document.createElement("p");
        br.innerHTML = "<br>";
        wrapper.after(br);

        range.setStartAfter(br);
        range.setEndAfter(br);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      validate();
    };
    reader.readAsDataURL(file);
    fileInput.value = ""; 
  });

  // ==================================================
  // EMOJI PICKER & TOOLBAR (Aa)
  // ==================================================
  if (emojiBtn && emojiContainer && window.picmo) {
    const picker = window.picmo.createPicker({ rootElement: emojiContainer });
    picker.addEventListener("emoji:select", e => {
      editor.focus();
      document.execCommand("insertText", false, e.emoji);
      emojiContainer.classList.add("hidden");
      validate();
    });
    emojiBtn.addEventListener("click", () => emojiContainer.classList.toggle("hidden"));
  }

  // ==================================================
  // VALIDATION & CHAR COUNT
  // ==================================================
  editor?.addEventListener("input", () => {
    const len = editor.innerText.length;
    charCount.textContent = `${len} / ${MAX_CHARS}`;
    charCount.style.color = len > MAX_CHARS ? "#e74c3c" : "#65676b";
    validate();
  });

  function validate() {
    const hasText = editor.innerText.trim().length > 0;
    const hasImages = editor.querySelectorAll("img").length > 0;
    submitBtn.disabled = !(hasText || hasImages) || editor.innerText.length > MAX_CHARS;
  }

  // ==================================================
  // SUBMIT (Rich Content)
  // ==================================================
  submitBtn?.addEventListener("click", async () => {
    if (!currentQuestionId) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = "Posting…";

    try {
      const fd = new FormData();
      fd.append("answer", editor.innerText.trim());
      if (selectedImage) fd.append("image", selectedImage);

      const res = await fetch(`/api/questions/${currentQuestionId}/answer`, {
        method: "POST",
        body: fd,
        credentials: "include"
      });

      if (!res.ok) {
        let message = "Failed to post answer";
        try {
          const data = await res.json();
          message = data?.error || data?.message || message;
        } catch {}
        throw new Error(message);
      }

      toast("Answer posted!", "success");
      setTimeout(() => window.location.reload(), 1000);

    } catch (err) {
      toast(err.message || "Failed to post answer", "error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Post";
    }
  });

  function resetForm() {
    editor.innerHTML = "";
    charCount.textContent = `0 / ${MAX_CHARS}`;
    submitBtn.disabled = true;
    currentQuestionId = null;
    selectedImage = null;
  }

  function toast(msg, type = "info") {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;top:20px;right:20px;padding:12px;background:${type==="error"?"#e74c3c":"#4CAF50"};color:#fff;border-radius:8px;z-index:10000;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
});
