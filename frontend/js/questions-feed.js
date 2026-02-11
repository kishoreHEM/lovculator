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
      if (isHomepage() && q.answers_count > 0 && q.top_answer_text) {
        const cleanPreviewText = escapeHtml(String(q.top_answer_text || "").replace(/^\s*×\s*/g, ""));
        answerPreview = `
          ${topAnswerImage ? `
            <div class="answer-preview-image" style="margin:10px 0;">
              <img src="${topAnswerImage}" alt="Answer image" style="max-width:100%;border-radius:10px;display:block;">
            </div>
          ` : ""}
          <div class="answer-preview">
            ${cleanPreviewText}
            <a href="/question/${slug}" class="read-more">Read more</a>
          </div>
        `;
      }

      return `
        <div class="question-card" data-question-id="${q.id}">
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

    bindShareButtons();

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

// ======================================================
// 8️⃣ SHARE
// ======================================================
function bindShareButtons() {
  document.querySelectorAll(".share-btn").forEach(btn => {
    btn.onclick = async () => {
      const url = btn.dataset.shareUrl;
      const title = btn.dataset.shareTitle;

      if (navigator.share) {
        try {
          await navigator.share({ title, url });
        } catch {}
      } else {
        await navigator.clipboard.writeText(url);
        window.showNotification?.("Link copied 📋", "success");
      }
    };
  });
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
