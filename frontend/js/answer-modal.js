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
  let selectedImages = [];
  let imageIndexCounter = 0;

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

    const imageIndex = imageIndexCounter++;
    selectedImages[imageIndex] = file;

    const reader = new FileReader();
    reader.onload = () => {
      const wrapper = document.createElement("div");
      wrapper.className = "editor-image-wrapper";
      wrapper.contentEditable = "false"; 
      wrapper.style.position = "relative";
      wrapper.style.margin = "15px 0";

      const img = document.createElement("img");
      img.src = reader.result;
      img.setAttribute("data-upload-index", String(imageIndex));
      img.style.maxWidth = "100%";
      img.style.borderRadius = "8px";
      img.style.display = "block";

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "&times;";
      removeBtn.className = "editor-image-remove";
      removeBtn.style.cssText = "position:absolute;top:10px;right:10px;background:#fff;border-radius:50%;width:28px;height:28px;border:1px solid #ddd;cursor:pointer;font-size:20px;";
      removeBtn.onclick = () => {
        selectedImages[imageIndex] = null;
        wrapper.remove();
        validate();
      };

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
  // BULLET NORMALIZATION (PASTE)
  // ==================================================
  function buildHtmlFromText(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let inList = false;

    const isBulletLine = (line) => {
      const t = line.trim();
      return t.startsWith("•") || t.startsWith("-") || t.startsWith("–");
    };

    const stripBullet = (line) => line.trim().replace(/^([•\-\–])\s*/, "");

    lines.forEach((line) => {
      if (isBulletLine(line)) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${escapeHtml(stripBullet(line))}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        if (line.trim().length) {
          html += `<p>${escapeHtml(line)}</p>`;
        }
      }
    });

    if (inList) html += "</ul>";
    return html;
  }

  function insertHtmlAtCursor(html) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      editor.insertAdjacentHTML("beforeend", html);
      return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const temp = document.createElement("div");
    temp.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    while ((node = temp.firstChild)) {
      frag.appendChild(node);
    }
    range.insertNode(frag);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  editor?.addEventListener("paste", (e) => {
    const htmlData = e.clipboardData?.getData("text/html") || "";
    const text = e.clipboardData?.getData("text/plain") || "";

    if (htmlData.includes("<ul") || htmlData.includes("<ol")) {
      e.preventDefault();
      insertHtmlAtCursor(htmlData);
      validate();
      return;
    }

    if (text) {
      const hasBullets = /(^|\n)\s*[•\-\–]/.test(text);
      if (hasBullets) {
        e.preventDefault();
        const html = buildHtmlFromText(text);
        insertHtmlAtCursor(html);
        validate();
      }
    }
  });

  // ==================================================
  // SUBMIT (Rich Content)
  // ==================================================
  submitBtn?.addEventListener("click", async () => {
    if (!currentQuestionId) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = "Posting…";

    try {
      const clone = editor.cloneNode(true);
      clone.querySelectorAll(".editor-image-remove").forEach(btn => btn.remove());
      if (!clone.querySelector("img") && !clone.querySelector("ul") && /(^|\n)[•\-\–]\s/.test(editor.innerText)) {
        clone.innerHTML = buildHtmlFromText(editor.innerText);
      }
      const imgs = clone.querySelectorAll("img[data-upload-index]");
      const imageIndices = [];
      imgs.forEach(img => {
        const idx = img.getAttribute("data-upload-index");
        if (idx) {
          imageIndices.push(Number(idx));
          img.setAttribute("src", `__IMAGE_${idx}__`);
          img.removeAttribute("data-upload-index");
        }
      });

      const fd = new FormData();
      fd.append("answer_html", clone.innerHTML);
      fd.append("answer_text", clone.textContent || "");
      fd.append("image_indices", JSON.stringify(imageIndices));

      imageIndices.forEach(idx => {
        const file = selectedImages[idx];
        if (file) fd.append("images", file);
      });

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
    selectedImages = [];
    imageIndexCounter = 0;
  }

  function toast(msg, type = "info") {
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;top:20px;right:20px;padding:12px;background:${type==="error"?"#e74c3c":"#4CAF50"};color:#fff;border-radius:8px;z-index:10000;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
});
