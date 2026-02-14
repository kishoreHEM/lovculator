/**
 * questions-feed.js
 * PRODUCTION READY
 * Updated: 2026-02-06
 *
 * Responsibilities:
 * - Fetch questions
 * - Homepage: show ONLY answered Q&A
 * - Quora-style answer preview
 * - Safe pagination
 * - No SEO schema pollution
 */

// ======================================================
// 1️⃣ API BASE
// ======================================================
if (!window.API_BASE) {
  window.API_BASE = window.location.hostname.includes("localhost")
    ? "http://localhost:3001/api"
    : "https://lovculator.com/api";
}

// ======================================================
// 2️⃣ GLOBAL STATE
// ======================================================
let currentOffset = 0;
let currentCategory = "all";
let currentSort = "newest"; // newest | popular | unanswered
const PAGE_LIMIT = 30;

// ======================================================
// 3️⃣ HELPERS
// ======================================================
function escapeHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeAnswerMarkup(html) {
  const container = document.createElement("div");
  container.innerHTML = html || "";

  container.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((el) => el.remove());

  container.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = (attr.value || "").trim();
      const allowed = ["href", "src", "alt", "title", "target", "rel"];
      if (!allowed.includes(name)) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  container.querySelectorAll("p,div").forEach((el) => {
    const onlyWhitespace = !el.textContent || !el.textContent.trim();
    const hasMedia = el.querySelector("img,video");
    if (onlyWhitespace && !hasMedia) el.remove();
  });

  container.querySelectorAll("li > p:only-child").forEach((p) => {
    const li = p.parentElement;
    if (!li) return;
    li.textContent = p.textContent || "";
  });

  return container.innerHTML;
}

function normalizePlainAnswerToHtml(text) {
  if (typeof text !== "string") return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    if (/^(?:[•\-–*])\s+/.test(line)) {
      html += "<ul>";
      while (i < lines.length) {
        const liLine = lines[i].trim();
        if (!/^(?:[•\-–*])\s+/.test(liLine)) break;
        html += `<li>${escapeHtml(liLine.replace(/^(?:[•\-–*])\s+/, ""))}</li>`;
        i++;
      }
      html += "</ul>";
      continue;
    }

    html += `<p>${escapeHtml(line)}</p>`;
    i++;
  }

  return html;
}

function isHomepage() {
  return document.body.classList.contains("homepage");
}

// ======================================================
// 4️⃣ SORT + FILTER (STABLE)
// ======================================================
function processQuestions(list, sortType) {
  if (!Array.isArray(list)) return [];

  let result = list.slice();

  // ✅ Homepage rule: ONLY answered questions
  if (isHomepage()) {
    result = result.filter(q => (q.answers_count || 0) > 0);

    // ✅ Homepage: newest answers first
    return result.sort((a, b) => {
      const aDate = new Date(a.latest_answer_at || a.top_answer_created_at || a.created_at).getTime();
      const bDate = new Date(b.latest_answer_at || b.top_answer_created_at || b.created_at).getTime();
      return bDate - aDate;
    });
  }

  switch (sortType) {
    case "popular":
      return result.sort((a, b) => {
        const aAnswered = (a.answers_count || 0) > 0;
        const bAnswered = (b.answers_count || 0) > 0;
        if (aAnswered !== bAnswered) return aAnswered ? 1 : -1;

        const likeDiff = (b.likes_count || 0) - (a.likes_count || 0);
        if (likeDiff !== 0) return likeDiff;

        const viewDiff = (b.views_count || 0) - (a.views_count || 0);
        if (viewDiff !== 0) return viewDiff;

        return new Date(b.created_at) - new Date(a.created_at);
      });

    case "unanswered":
      return result.filter(q => (q.answers_count || 0) === 0);

    case "newest":
    default:
      return result.sort((a, b) => {
        const aAnswered = (a.answers_count || 0) > 0;
        const bAnswered = (b.answers_count || 0) > 0;
        if (aAnswered !== bAnswered) return aAnswered ? 1 : -1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }
}

// ======================================================
// 5️⃣ MAIN LOAD FUNCTION
// ======================================================
window.loadQuestions = async function (loadMore = false) {
  const container =
    document.getElementById("questionsFeedContainer") ||
    document.getElementById("storiesContainer");

  if (!container) return;

  if (!loadMore) {
    currentOffset = 0;
    container.innerHTML = `
      <div class="loading-stories">
        <div class="loading-spinner"></div>
        <p>Loading questions...</p>
      </div>
    `;
  }

  document.getElementById("loadMoreContainer")?.remove();

  try {
    const categoryParam =
      currentCategory !== "all"
        ? `&category=${encodeURIComponent(currentCategory)}`
        : "";

    const url =
      `${window.API_BASE}/questions/latest` +
      `?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}`;

    const response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const apiQuestions = await response.json();
    const apiCount = apiQuestions.length;

    const questions = processQuestions(apiQuestions, currentSort);

    // Empty state
    if (!questions.length && !loadMore) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No questions found.</p>
          <a href="/ask" class="answer-btn">Ask a Question</a>
        </div>
      `;
      return;
    }

    // ======================================================
    // 6️⃣ RENDER
    // ======================================================
    const html = questions.map(q => {
      const title = escapeHtml(q.question);
      const slug = escapeHtml(q.slug || q.id);
      const date = new Date(q.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
      });

      const firstAnswerUserId = q.top_answer_user_id || "";
      const firstAnswerUsername = escapeHtml(q.top_answer_username || "");
      const firstAnswerName = escapeHtml(
        q.top_answer_display_name || q.top_answer_username || "User"
      );
      const firstAnswerAvatar = escapeHtml(
        q.top_answer_avatar_url || "/images/default-avatar.png"
      );
      const firstAnswerBio = escapeHtml(q.top_answer_bio || "");
      const isFollowing = Boolean(q.top_answer_user_following);
      const isSelfAnswerer =
        Number(firstAnswerUserId) > 0 &&
        Number(window.currentUserId || 0) > 0 &&
        Number(firstAnswerUserId) === Number(window.currentUserId);
      const answererProfileLink = firstAnswerUsername
        ? `/profile/${encodeURIComponent(firstAnswerUsername)}`
        : "";

      const firstAnswerRow =
        isHomepage() && (q.answers_count || 0) > 0 && firstAnswerUserId
          ? `
            <div class="question-first-answer" style="display:flex;align-items:center;gap:12px;margin:8px 0 12px 0;">
              ${answererProfileLink ? `
                <a href="${answererProfileLink}" style="display:inline-flex;">
                  <img src="${firstAnswerAvatar}"
                       alt="${firstAnswerName}"
                       style="width:40px;height:40px;border-radius:50%;object-fit:cover;"
                       onerror="this.src='/images/default-avatar.png'">
                </a>
              ` : `
                <img src="${firstAnswerAvatar}"
                     alt="${firstAnswerName}"
                     style="width:40px;height:40px;border-radius:50%;object-fit:cover;"
                     onerror="this.src='/images/default-avatar.png'">
              `}
              <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  ${
                    answererProfileLink
                      ? `<a href="${answererProfileLink}" style="font-weight:600;color:#1c1e21;text-decoration:none;">${firstAnswerName}</a>`
                      : `<span style="font-weight:600;color:#1c1e21;">${firstAnswerName}</span>`
                  }
                  ${
                    isSelfAnswerer
                      ? ""
                      : `<button class="follow-author-btn ${isFollowing ? "following" : ""}"
                          data-user-id="${firstAnswerUserId}">
                        ${isFollowing ? "Following" : "+ Follow"}
                      </button>`
                  }
                </div>
                ${firstAnswerBio ? `<div style="color:#65676b;font-size:0.92rem;line-height:1.3;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${firstAnswerBio}</div>` : ""}
              </div>
            </div>
          `
          : "";

      const topAnswerImage = q.top_answer_image_url
        ? (q.top_answer_image_url.startsWith("http")
            ? q.top_answer_image_url
            : (window.ASSET_BASE || "") + q.top_answer_image_url)
        : "";

      let answerPreview = "";
      if (isHomepage() && q.answers_count > 0 && (q.top_answer_html || q.top_answer_text)) {
        const rawHtml = typeof q.top_answer_html === "string" ? q.top_answer_html.trim() : "";
        const rawText = String(q.top_answer_text || "").replace(/^\s*×\s*/g, "");
        const cleanPreviewMarkup = rawHtml
          ? sanitizeAnswerMarkup(rawHtml)
          : sanitizeAnswerMarkup(normalizePlainAnswerToHtml(rawText));

        answerPreview = `
          ${topAnswerImage ? `
            <div class="answer-preview-image" style="margin:10px 0;">
              <img src="${topAnswerImage}" alt="Answer image" style="max-width:100%;border-radius:10px;display:block;">
            </div>
          ` : ""}
          <div class="answer-preview-wrap">
            <div class="answer-preview answer-preview-collapsed" data-role="answer-preview">
              ${cleanPreviewMarkup}
            </div>
            <button type="button" class="read-more read-more-toggle" data-role="answer-toggle">Read more</button>
          </div>
        `;
      }

      return `
        <div class="question-card" data-question-id="${q.id}" data-top-answer-id="${q.top_answer_id || ""}" data-answer-id="${q.top_answer_id || ""}">
          ${
            isHomepage()
              ? ""
              : `
                <div class="question-header">
                  <span class="question-date">Asked on ${date}</span>
                  ${
                    (q.answers_count || 0) > 0
                      ? `<span class="answered-badge">Answered</span>`
                      : `<span class="needs-answer-badge">Needs Advice</span>`
                  }
                </div>
              `
          }

          ${isHomepage() ? firstAnswerRow : ""}

          <a href="/question/${slug}" class="question-title">${title}</a>

          ${answerPreview}

          ${
            isHomepage()
              ? `
                <div class="post-actions home-answer-footer">
                  <button class="post-action view-action" type="button" aria-label="Views" title="Views">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>${q.views_count || 0}</span>
                  </button>

                  <button class="post-action like-btn ${q.top_answer_user_liked ? "liked" : ""}"
                    type="button"
                    data-id="${q.top_answer_id || ""}"
                    data-answer-id="${q.top_answer_id || ""}"
                    data-type="answer"
                    aria-label="Like answer"
                    ${q.top_answer_id ? "" : "disabled"}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="${q.top_answer_user_liked ? "#e91e63" : "none"}" stroke="${q.top_answer_user_liked ? "#e91e63" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span class="like-count">${q.top_answer_likes_count || 0}</span>
                  </button>

                  <button class="post-action comment-toggle"
                    type="button"
                    data-id="${q.top_answer_id || ""}"
                    data-answer-id="${q.top_answer_id || ""}"
                    aria-label="Open comments"
                    ${q.top_answer_id ? "" : "disabled"}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                    </svg>
                    <span class="comment-count">${q.top_answer_comments_count || 0}</span>
                  </button>

                  <button class="post-action share-action-toggle"
                    type="button"
                    data-share-url="https://lovculator.com/question/${slug}"
                    data-share-title="${title}"
                    aria-label="Share question">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span class="share-label">Share</span>
                  </button>
                </div>

                <div id="comments-${q.top_answer_id || ""}" class="comments-section hidden">
                  <div class="comment-form">
                    <input type="text"
                           class="comment-input"
                           data-answer-id="${q.top_answer_id || ""}"
                           placeholder="Write a comment...">
                    <button class="comment-submit" data-answer-id="${q.top_answer_id || ""}">Post</button>
                  </div>
                  <div class="comments-list" id="comments-list-${q.top_answer_id || ""}"></div>
                </div>
              `
              : `
                <div class="question-stats">
                  <span>${q.answers_count || 0} answers</span>
                  <span>${q.likes_count || 0} likes</span>
                  <span>${q.views_count || 0} views</span>
                </div>

                <div class="question-actions">
                  <a class="answer-btn" href="/question/${slug}">
                    View Answers
                  </a>

                  <button class="share-btn"
                    data-share-url="https://lovculator.com/question/${slug}"
                    data-share-title="${title}">
                    Share
                  </button>
                </div>
              `
          }
        </div>
      `;
    }).join("");

    if (loadMore) {
      container.insertAdjacentHTML("beforeend", html);
    } else {
      container.innerHTML = html;
    }

    currentOffset += apiCount;

    // ======================================================
    // 7️⃣ LOAD MORE (API-BASED)
    // ======================================================
    if (apiCount === PAGE_LIMIT) {
      container.insertAdjacentHTML(
        "afterend",
        `
        <div id="loadMoreContainer" style="text-align:center;margin:30px 0;">
          <button class="answer-btn" id="loadMoreBtn">
            Load More
          </button>
        </div>
        `
      );

      document.getElementById("loadMoreBtn").onclick = () =>
        window.loadQuestions(true);
    }

    bindAnswerPreviewToggles();
    bindHomeFooterActions();

  } catch (err) {
    console.error("❌ Load questions error:", err);
    if (!loadMore) {
      container.innerHTML = `
        <div class="error-state">
          <p>Failed to load questions.</p>
          <button class="retry-btn" onclick="window.loadQuestions()">Retry</button>
        </div>
      `;
    }
  }
};

function bindAnswerPreviewToggles() {
  if (!isHomepage()) return;

  document.querySelectorAll(".answer-preview-wrap").forEach((wrap) => {
    const preview = wrap.querySelector('[data-role="answer-preview"]');
    const toggle = wrap.querySelector('[data-role="answer-toggle"]');
    if (!preview || !toggle || toggle.dataset.bound) return;

    const updateLabel = () => {
      const expanded = preview.classList.contains("answer-preview-expanded");
      toggle.textContent = expanded ? "Show less" : "Read more";
    };

    const handleToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      preview.classList.toggle("answer-preview-collapsed");
      preview.classList.toggle("answer-preview-expanded");
      updateLabel();
    };

    toggle.dataset.bound = "true";
    toggle.addEventListener("click", handleToggle);
    preview.style.cursor = "pointer";
    preview.addEventListener("click", handleToggle);
    updateLabel();
  });
}

function bindHomeFooterActions() {
  if (!isHomepage()) return;

  if (!window.__homeAnswerActivitySyncBound) {
    window.__homeAnswerActivitySyncBound = true;
    window.addEventListener("storage", (e) => {
      if (e.key !== "lovculator_answer_activity" || !e.newValue) return;
      try { applyAnswerActivityToHome(JSON.parse(e.newValue)); } catch {}
    });
    window.addEventListener("lovculator:answer-activity", (e) => {
      if (e?.detail) applyAnswerActivityToHome(e.detail);
    });
  }
}

function applyAnswerActivityToHome(payload) {
  const answerId = String(payload?.answerId || "");
  if (!answerId) return;
  const card = document.querySelector(`.question-card[data-top-answer-id="${answerId}"]`);
  if (!card) return;

  if (typeof payload.likeCount === "number") {
    const likeCountEl = card.querySelector(".home-answer-footer .like-count");
    if (likeCountEl) likeCountEl.textContent = String(payload.likeCount);
  }

  if (typeof payload.commentCount === "number") {
    const commentCountEl = card.querySelector(".home-answer-footer .comment-count");
    if (commentCountEl) commentCountEl.textContent = String(payload.commentCount);
  }
}

// ======================================================
// 9️⃣ FILTER BAR
// ======================================================
document.getElementById("applyFilterBtn")?.addEventListener("click", () => {
  const categorySelect = document.getElementById("categorySelect");
  const sortSelect = document.getElementById("sortSelect");

  if (categorySelect) {
    currentCategory = categorySelect.value || "all";
  } else {
    currentCategory = "all";
  }

  currentSort = sortSelect?.value || "newest";

  window.loadQuestions(false);
});

// ======================================================
// 🔟 INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  // Homepage should never show unanswered sort
  if (isHomepage()) {
    document
      .querySelector('#sortSelect option[value="unanswered"]')
      ?.remove();
  }

  if (
    document.getElementById("questionsFeedContainer") ||
    document.getElementById("storiesContainer")
  ) {
    window.loadQuestions();
  }
});
