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

const SAVED_QUESTIONS_KEY = "lovculator_saved_questions";

function renderQuestionSkeletons(count = 4) {
  return `
    <div class="questions-skeleton-grid" aria-hidden="true">
      ${Array.from({ length: count }).map(() => `
        <article class="question-card question-skeleton-card">
          <div class="question-card-top">
            <div class="question-card-meta">
              <span class="question-skeleton-pill"></span>
              <span class="question-skeleton-pill question-skeleton-pill-short"></span>
              <span class="question-skeleton-line question-skeleton-line-date"></span>
            </div>
            <span class="question-skeleton-icon"></span>
          </div>
          <div class="question-skeleton-line question-skeleton-line-title"></div>
          <div class="question-skeleton-line question-skeleton-line-title question-skeleton-line-title-short"></div>
          <div class="question-stats question-skeleton-stats">
            <span class="question-skeleton-pill question-skeleton-pill-wide"></span>
            <span class="question-skeleton-line question-skeleton-line-stat"></span>
            <span class="question-skeleton-line question-skeleton-line-stat"></span>
          </div>
          <div class="question-actions question-skeleton-actions">
            <span class="question-skeleton-btn question-skeleton-btn-primary"></span>
            <span class="question-skeleton-btn"></span>
            <span class="question-skeleton-btn"></span>
            <span class="question-skeleton-icon"></span>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function getSavedQuestionIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_QUESTIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function setSavedQuestionIds(ids) {
  localStorage.setItem(SAVED_QUESTIONS_KEY, JSON.stringify(Array.from(new Set(ids.map(String)))));
}

function isQuestionSaved(questionId) {
  return getSavedQuestionIds().includes(String(questionId));
}

function toggleSavedQuestion(questionId) {
  const id = String(questionId || "");
  if (!id) return false;
  const saved = getSavedQuestionIds();
  const next = saved.includes(id)
    ? saved.filter((item) => item !== id)
    : [...saved, id];
  setSavedQuestionIds(next);
  return next.includes(id);
}

function updateSaveButtonState(button, saved) {
  if (!button) return;
  button.classList.toggle("is-saved", saved);
  button.setAttribute("aria-pressed", saved ? "true" : "false");
  button.setAttribute("aria-label", saved ? "Question saved" : "Save question");
  const label = button.querySelector("span");
  if (label) label.textContent = saved ? "Saved" : "Save";
}

function closeQuestionMenus(exceptMenu = null) {
  document.querySelectorAll('.question-more-menu').forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.hidden = true;
      menu.closest('.question-card')?.querySelector('.question-more-btn')?.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindQuestionsPageActions() {
  if (isHomepage()) return;
  if (window.__questionsPageActionsBound) return;
  window.__questionsPageActionsBound = true;

  document.addEventListener('click', async (event) => {
    const saveBtn = event.target.closest('.question-card .save-btn');
    if (saveBtn) {
      event.preventDefault();
      const card = saveBtn.closest('.question-card');
      const saved = toggleSavedQuestion(card?.dataset.questionId);
      updateSaveButtonState(saveBtn, saved);
      return;
    }

    const moreBtn = event.target.closest('.question-card .question-more-btn, .question-card .question-report-btn');
    if (moreBtn) {
      event.preventDefault();
      const card = moreBtn.closest('.question-card');
      const menu = card?.querySelector('.question-more-menu');
      if (!menu) return;
      const willOpen = menu.hidden;
      closeQuestionMenus(willOpen ? menu : null);
      menu.hidden = !willOpen;
      moreBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      return;
    }

    const menuAction = event.target.closest('.question-more-menu-item');
    if (menuAction) {
      event.preventDefault();
      const card = menuAction.closest('.question-card');
      const questionUrl = menuAction.dataset.questionUrl || '';
      const questionTitle = menuAction.dataset.questionTitle || 'Lovculator question';
      const action = menuAction.dataset.action;

      if (action === 'copy-link' && questionUrl) {
        try {
          await navigator.clipboard.writeText(questionUrl);
          menuAction.querySelector('.question-more-menu-text').textContent = 'Link copied';
          setTimeout(() => {
            const label = menuAction.querySelector('.question-more-menu-text');
            if (label) label.textContent = 'Copy link';
          }, 1400);
        } catch {
          window.prompt('Copy this link', questionUrl);
        }
      }

      if (action === 'report' && questionUrl) {
        window.location.href = `mailto:support@lovculator.com?subject=${encodeURIComponent(`Report question: ${questionTitle}`)}&body=${encodeURIComponent(`Please review this question: ${questionUrl}`)}`;
      }

      if (action === 'hide-card') {
        card?.classList.add('question-card-fade-out');
        setTimeout(() => card?.remove(), 220);
      }

      closeQuestionMenus();
      return;
    }

    const resetBtn = event.target.closest('.questions-empty-reset');
    if (resetBtn) {
      event.preventDefault();
      const categorySelect = document.getElementById('categorySelect');
      const sortSelect = document.getElementById('sortSelect');
      if (categorySelect) categorySelect.value = 'all';
      if (sortSelect) sortSelect.value = 'newest';
      currentCategory = 'all';
      currentSort = 'newest';
      window.loadQuestions(false);
      return;
    }

    if (!event.target.closest('.question-more-menu') && !event.target.closest('.question-more-btn') && !event.target.closest('.question-report-btn')) {
      closeQuestionMenus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeQuestionMenus();
  });
}

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

function isBulletLine(line) {
  return /^(?:[•\-–*])\s+/.test((line || "").trim());
}

function isOrderedLine(line) {
  return /^\d+[\.)]\s+/.test((line || "").trim());
}

function stripListMarker(line) {
  return (line || "")
    .trim()
    .replace(/^(?:[•\-–*]|\d+[\.)])\s+/, "")
    .trim();
}

function buildListHtml(tagName, items) {
  const safeItems = items
    .map((item) => stripListMarker(item))
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return safeItems ? `<${tagName}>${safeItems}</${tagName}>` : "";
}

function normalizePlainAnswerToHtml(text) {
  if (typeof text !== "string") return "";

  const blocks = text
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return "";

    if (lines.every(isBulletLine)) {
      return buildListHtml("ul", lines);
    }

    if (lines.every(isOrderedLine)) {
      return buildListHtml("ol", lines);
    }

    if (lines.length > 1 && /[:：]$/.test(lines[0])) {
      const heading = `<p>${escapeHtml(lines[0])}</p>`;
      const rest = lines.slice(1);

      if (rest.every((line) => isBulletLine(line) || isOrderedLine(line) || line.length <= 120)) {
        const listTag = rest.every(isOrderedLine) ? "ol" : "ul";
        return heading + buildListHtml(listTag, rest);
      }

      return heading + `<p>${escapeHtml(rest.join(" "))}</p>`;
    }

    return `<p>${escapeHtml(lines.join(" "))}</p>`;
  }).join("");
}

function normalizeStoredAnswerMarkup(input) {
  if (typeof input !== "string" || !input.trim()) return "";
  if (!/<[a-z][\s\S]*>/i.test(input)) {
    return normalizePlainAnswerToHtml(input);
  }
  return sanitizeAnswerMarkup(input);
}

function isHomepage() {
  return document.body.classList.contains("homepage");
}

function formatRelativeTime(dateString) {
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return "";

  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  const intervals = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
  ];

  for (const [unit, size] of intervals) {
    const value = Math.floor(seconds / size);
    if (value >= 1) {
      return `${value} ${unit}${value > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
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
    container.innerHTML = isHomepage()
      ? `
        <div class="loading-stories">
          <div class="loading-spinner"></div>
          <p>Loading questions...</p>
        </div>
      `
      : renderQuestionSkeletons();
  }

  document.getElementById("loadMoreContainer")?.remove();

  try {
    const categoryParam =
      currentCategory !== "all"
        ? `&category=${encodeURIComponent(currentCategory)}`
        : "";
    const statusParam = isHomepage()
      ? "&status=answered&sort=answered"
      : currentSort === "unanswered"
        ? "&status=unanswered&sort=unanswered"
        : `&sort=${encodeURIComponent(currentSort)}`;

    const url =
      `${window.API_BASE}/questions/latest` +
      `?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}${statusParam}`;

    const response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let apiQuestions = await response.json();
    let apiCount = apiQuestions.length;

    let questions = processQuestions(apiQuestions, currentSort);

    // Safety net while older/cached backends roll over: homepage must not go blank.
    if (isHomepage() && !questions.length && !loadMore) {
      const fallbackUrl =
        `${window.API_BASE}/questions/latest` +
        `?limit=100&offset=0${categoryParam}&sort=answered`;
      const fallbackResponse = await fetch(fallbackUrl, {
        credentials: "include",
        headers: { Accept: "application/json" }
      });

      if (fallbackResponse.ok) {
        apiQuestions = await fallbackResponse.json();
        apiCount = apiQuestions.length;
        questions = processQuestions(apiQuestions, currentSort);
      }
    }

    // Empty state
    if (!questions.length && !loadMore) {
      container.innerHTML = isHomepage()
        ? `
          <div class="empty-state">
            <p>No questions found.</p>
            <a href="/ask" class="answer-btn">Ask a Question</a>
          </div>
        `
        : `
          <section class="questions-empty-state" aria-live="polite">
            <div class="questions-empty-icon" aria-hidden="true">?</div>
            <span class="questions-empty-eyebrow">No matching questions</span>
            <h2>We couldn’t find questions for this filter set.</h2>
            <p>Try widening your search, switching categories, or resetting the filters to browse more community conversations.</p>
            <div class="questions-empty-actions">
              <button type="button" class="question-primary-btn questions-empty-reset">Reset Filters</button>
              <a href="/questions" class="question-secondary-btn">Browse All Questions</a>
            </div>
          </section>
        `;
      return;
    }

    // ======================================================
    // 6️⃣ RENDER
    // ======================================================
    const html = questions.map(q => {
      const title = escapeHtml(q.question);
      const slug = escapeHtml(q.slug || q.id);
      const date = formatRelativeTime(q.created_at);
      const categoryLabel = escapeHtml((q.category || "General").replace(/^\w/, (m) => m.toUpperCase()));
      const isTrending = (q.views_count || 0) >= 25 || (q.answers_count || 0) >= 3;
      const isUnanswered = (q.answers_count || 0) === 0;
      const shareCount = q.share_count || q.shares_count || 0;

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
          ? normalizeStoredAnswerMarkup(rawHtml)
          : normalizeStoredAnswerMarkup(rawText);
        const answerMarkupHasImage = /<img[\s>]/i.test(cleanPreviewMarkup);

        answerPreview = `
          ${topAnswerImage && !answerMarkupHasImage ? `
            <div class="answer-preview-image">
              <img src="${topAnswerImage}" alt="Answer image">
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

      const questionUrl = `https://lovculator.com/question/${slug}`;
      const questionSaved = isQuestionSaved(q.id);

      return `
        <div class="question-card" data-question-id="${q.id}" data-top-answer-id="${q.top_answer_id || ""}" data-answer-id="${q.top_answer_id || ""}">
          ${
            isHomepage()
              ? ""
              : `
                <div class="question-header question-card-top">
                  <div class="question-card-meta">
                    <span class="category-badge">${categoryLabel}</span>
                    ${isTrending ? `<span class="trend-badge">Trending</span>` : ""}
                    ${isUnanswered ? `<span class="needs-answer-badge">Unanswered</span>` : ""}
                    <span class="question-date">${date}</span>
                  </div>
                  <button class="question-report-btn" type="button" aria-label="Question actions" aria-expanded="false" title="Question actions">
                    <span aria-hidden="true">⋯</span>
                  </button>
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
                <div class="question-stats" aria-label="Question statistics">
                  <span class="stat-pill answer-count-pill">${q.answers_count || 0} answers</span>
                  <span class="stat-item"><strong>${q.views_count || 0}</strong> views</span>
                  <span class="stat-item"><strong>${shareCount}</strong> shares</span>
                </div>

                <div class="question-actions">
                  <a class="answer-btn question-primary-btn" href="/question/${slug}">
                    <span>View Answers</span>
                  </a>

                  <button class="share-btn question-secondary-btn"
                    data-share-url="${questionUrl}"
                    data-share-title="${title}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    <span>Share</span>
                  </button>

                  <button class="save-btn question-secondary-btn ${questionSaved ? "is-saved" : ""}" type="button" aria-label="${questionSaved ? "Question saved" : "Save question"}" aria-pressed="${questionSaved ? "true" : "false"}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span>${questionSaved ? "Saved" : "Save"}</span>
                  </button>

                  <button class="question-more-btn" type="button" aria-label="Report or more options" aria-expanded="false" title="More options">
                    <span aria-hidden="true">⋯</span>
                  </button>
                </div>

                <div class="question-more-menu" hidden role="menu" aria-label="Question options">
                  <button class="question-more-menu-item" type="button" role="menuitem" data-action="copy-link" data-question-url="${questionUrl}" data-question-title="${title}">
                    <span class="question-more-menu-text">Copy link</span>
                  </button>
                  <button class="question-more-menu-item" type="button" role="menuitem" data-action="report" data-question-url="${questionUrl}" data-question-title="${title}">
                    <span class="question-more-menu-text">Report question</span>
                  </button>
                  <button class="question-more-menu-item question-more-menu-item-danger" type="button" role="menuitem" data-action="hide-card">
                    <span class="question-more-menu-text">Hide from feed</span>
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
    bindQuestionsPageActions();

  } catch (err) {
    console.error("❌ Load questions error:", err);
    if (!loadMore) {
      container.innerHTML = isHomepage()
        ? `
          <div class="error-state">
            <p>Failed to load questions.</p>
            <button class="retry-btn" onclick="window.loadQuestions()">Retry</button>
          </div>
        `
        : `
          <section class="questions-empty-state questions-error-state" aria-live="polite">
            <div class="questions-empty-icon" aria-hidden="true">!</div>
            <span class="questions-empty-eyebrow">Temporary issue</span>
            <h2>We couldn’t load questions right now.</h2>
            <p>Please retry in a moment. Your filters are still here, and the feed will reload when the connection stabilizes.</p>
            <div class="questions-empty-actions">
              <button type="button" class="question-primary-btn" onclick="window.loadQuestions()">Retry</button>
            </div>
          </section>
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
    bindQuestionsPageActions();
    window.loadQuestions();
  }
});
