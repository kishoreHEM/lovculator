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
let currentTab = "for-you"; // for-you | latest | trending | unanswered | following | bookmarks
let currentSearchQuery = "";
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
  const svg = button.querySelector("svg");
  if (svg) {
    svg.setAttribute("fill", saved ? "#ff4b8d" : "none");
    svg.setAttribute("stroke", saved ? "#ff4b8d" : "currentColor");
  }
  const label = button.querySelector("span");
  if (label) label.textContent = saved ? "Saved" : "Save";
}

function closeQuestionMenus(exceptMenu = null) {
  document.querySelectorAll('.question-more-menu').forEach((menu) => {
    if (menu !== exceptMenu) {
      menu.hidden = true;
      menu.closest('.question-card')?.querySelector('.question-more-btn, .question-report-btn')?.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindQuestionsPageActions() {
  if (isHomepage()) return;
  if (window.__questionsPageActionsBound) return;
  window.__questionsPageActionsBound = true;

  document.addEventListener('click', async (event) => {
    // 1. Save / Bookmark Button
    const saveBtn = event.target.closest('.question-card .save-btn');
    if (saveBtn) {
      event.preventDefault();
      const card = saveBtn.closest('.question-card');
      const questionId = saveBtn.dataset.questionId || card?.dataset.questionId;
      const saved = toggleSavedQuestion(questionId);
      updateSaveButtonState(saveBtn, saved);
      if (currentTab === 'bookmarks' && !saved) {
        card?.classList.add('question-card-fade-out');
        setTimeout(() => {
          card?.remove();
          const container = document.getElementById("questionsFeedContainer") || document.getElementById("storiesContainer");
          if (container && !container.querySelectorAll('.question-card').length) {
            window.loadQuestions(false);
          }
        }, 220);
      }
      return;
    }

    // 2. Like Question Button
    const likeBtn = event.target.closest('.question-card .qa-like-btn');
    if (likeBtn) {
      event.preventDefault();
      const card = likeBtn.closest('.question-card');
      const questionId = likeBtn.dataset.questionId || card?.dataset.questionId;
      if (!questionId) return;

      if (!window.currentUserId) {
        if (window.showLoginModal) {
          window.showLoginModal('like this question');
        } else {
          alert('Please log in to like this question.');
        }
        return;
      }

      try {
        const res = await fetch(`${window.API_BASE}/questions/${questionId}/like`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const isLiked = Boolean(data.is_liked);
          likeBtn.classList.toggle('liked', isLiked);
          const svg = likeBtn.querySelector('svg');
          if (svg) {
            svg.setAttribute('fill', isLiked ? '#ff4b8d' : 'none');
            svg.setAttribute('stroke', isLiked ? '#ff4b8d' : 'currentColor');
          }
          const countEl = likeBtn.querySelector('.like-count');
          if (countEl && typeof data.likes_count !== 'undefined') {
            countEl.textContent = data.likes_count;
          }
        }
      } catch (err) {
        console.error('Failed to like question:', err);
      }
      return;
    }

    // 3. Follow Author Button
    const followBtn = event.target.closest('.question-card .qa-author-follow-btn');
    if (followBtn) {
      event.preventDefault();
      const userId = followBtn.dataset.userId;
      if (!userId) return;

      if (!window.currentUserId) {
        if (window.showLoginModal) {
          window.showLoginModal('follow this member');
        } else {
          alert('Please log in to follow members.');
        }
        return;
      }

      try {
        const res = await fetch(`${window.API_BASE}/users/${userId}/follow`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          const isFollowing = Boolean(data.following || data.is_following);
          followBtn.classList.toggle('following', isFollowing);
          followBtn.textContent = isFollowing ? 'Following' : '+ Follow';
        }
      } catch (err) {
        console.error('Failed to toggle follow:', err);
      }
      return;
    }

    // 4. Share Question Button
    const shareBtn = event.target.closest('.question-card .share-btn');
    if (shareBtn) {
      event.preventDefault();
      const url = shareBtn.dataset.shareUrl || window.location.href;
      const title = shareBtn.dataset.shareTitle || document.title;

      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (e) {
          if (e.name === 'AbortError') return;
        }
      }

      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          const label = shareBtn.querySelector('span');
          if (label) {
            const original = label.textContent;
            label.textContent = 'Copied!';
            setTimeout(() => { label.textContent = original; }, 1400);
          }
        } catch {
          window.prompt('Copy this link:', url);
        }
      } else {
        window.prompt('Copy this link:', url);
      }
      return;
    }

    // 5. More Options Button
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

    // 6. More Options Menu Items
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
          const label = menuAction.querySelector('.question-more-menu-text');
          if (label) {
            label.textContent = 'Link copied';
            setTimeout(() => { label.textContent = 'Copy link'; }, 1400);
          }
        } catch {
          window.prompt('Copy this link:', questionUrl);
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

    // 7. Reset Filters Empty State Action
    const resetBtn = event.target.closest('.questions-empty-reset');
    if (resetBtn) {
      event.preventDefault();
      const categorySelect = document.getElementById('categorySelect');
      const searchInput = document.getElementById('questionSearchInput');
      if (categorySelect) categorySelect.value = 'all';
      if (searchInput) searchInput.value = '';
      currentCategory = 'all';
      currentSearchQuery = '';
      currentSort = 'newest';
      window.switchTab('for-you');
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
function buildAnswersPageCard(q) {
  const title = escapeHtml(q.question);
  const slug = escapeHtml(q.slug || q.id);
  const date = formatRelativeTime(q.created_at);
  const categoryLabel = escapeHtml((q.category || "General").replace(/^\w/, (m) => m.toUpperCase()));
  const description = escapeHtml(q.description || "");
  const answersCount = Number(q.answers_count || 0);
  const likesCount = Number(q.likes_count || 0);
  const viewsCount = Number(q.views_count || 0);
  const isLiked = Boolean(q.user_liked);
  const questionSaved = isQuestionSaved(q.id);
  const questionUrl = `https://lovculator.com/question/${slug}`;

  // Author details
  const authorUserId = q.user_id || "";
  const authorUsername = escapeHtml(q.username || "");
  const authorName = escapeHtml(q.display_name || q.username || "Anonymous");
  const authorAvatar = escapeHtml(q.avatar_url || "/images/default-avatar.png");
  const authorLink = authorUsername ? `/profile/${encodeURIComponent(authorUsername)}` : "";
  const isFollowing = Boolean(q.user_following);
  const isSelfAuthor =
    Number(authorUserId) > 0 &&
    Number(window.currentUserId || 0) > 0 &&
    Number(authorUserId) === Number(window.currentUserId);

  // Top answer excerpt
  let topAnswerSnippet = "";
  if (q.top_answer_text || q.top_answer_html) {
    const answerAuthor = escapeHtml(q.top_answer_display_name || q.top_answer_username || "Community Member");
    const rawText = String(q.top_answer_text || "").replace(/^\s*×\s*/g, "");
    const cleanExcerpt = escapeHtml(rawText.length > 200 ? rawText.slice(0, 200) + "..." : rawText);
    topAnswerSnippet = `
      <div class="qa-answer-preview">
        <div class="qa-answer-preview-header">
          <span>Answer by <strong>${answerAuthor}</strong>:</span>
        </div>
        <div class="qa-answer-preview-body">
          ${cleanExcerpt}
        </div>
      </div>
    `;
  }

  return `
    <article class="question-card" data-question-id="${q.id}">
      <div class="qa-card-author-row">
        <div class="qa-author-info">
          ${
            authorLink
              ? `
            <a href="${authorLink}">
              <img src="${authorAvatar}" alt="${authorName}" class="qa-author-avatar" onerror="this.src='/images/default-avatar.png'">
            </a>
          `
              : `
            <img src="${authorAvatar}" alt="${authorName}" class="qa-author-avatar" onerror="this.src='/images/default-avatar.png'">
          `
          }
          <div class="qa-author-details">
            <div class="qa-author-name-line">
              ${authorLink ? `<a href="${authorLink}" class="qa-author-name">${authorName}</a>` : `<span class="qa-author-name">${authorName}</span>`}
              <span class="qa-card-meta-dot">•</span>
              <span class="qa-card-date">${date}</span>
              ${categoryLabel ? `<span class="qa-card-meta-dot">•</span> <span class="qa-topic-badge">${categoryLabel}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="qa-card-header-actions">
          ${
            isSelfAuthor || !authorUserId
              ? ""
              : `
            <button class="qa-author-follow-btn ${isFollowing ? "following" : ""}" data-user-id="${authorUserId}">
              ${isFollowing ? "Following" : "+ Follow"}
            </button>
          `
          }
        </div>
      </div>

      <a href="/question/${slug}" class="question-title">${title}</a>

      ${description ? `<p class="qa-card-desc">${description}</p>` : ""}

      ${topAnswerSnippet}

      <div class="qa-card-footer">
        <div class="qa-card-actions-left">
          <a href="/question/${slug}" class="qa-action-btn" title="View answers">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <span>${answersCount} answers</span>
          </a>

          <button class="qa-action-btn qa-like-btn ${isLiked ? "liked" : ""}" data-question-id="${q.id}" type="button" aria-label="Like question">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="${isLiked ? "#ff4b8d" : "none"}" stroke="${isLiked ? "#ff4b8d" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span class="like-count">${likesCount}</span>
          </button>

          <span class="qa-action-btn" title="Views">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>${viewsCount}</span>
          </span>
        </div>

        <div class="qa-card-actions-right">
          <button class="qa-action-btn share-btn" data-share-url="${questionUrl}" data-share-title="${title}" type="button" aria-label="Share question">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <span>Share</span>
          </button>

          <button class="qa-action-btn save-btn ${questionSaved ? "is-saved" : ""}" data-question-id="${q.id}" type="button" aria-label="${questionSaved ? "Saved" : "Save"}">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="${questionSaved ? "#ff4b8d" : "none"}" stroke="${questionSaved ? "#ff4b8d" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${questionSaved ? "Saved" : "Save"}</span>
          </button>

          <button class="qa-action-btn question-more-btn" type="button" aria-label="More options" aria-expanded="false">
            <span>⋯</span>
          </button>
        </div>
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
    </article>
  `;
}

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

  // Handle Following Tab when user is not logged in
  if (!isHomepage() && currentTab === "following" && !window.currentUserId) {
    container.innerHTML = `
      <section class="questions-empty-state" aria-live="polite">
        <div class="questions-empty-icon" aria-hidden="true">👥</div>
        <span class="questions-empty-eyebrow">Personalized Feed</span>
        <h2>Questions from People You Follow</h2>
        <p>Log in and follow people to see questions and answers from your favorite creators in this feed.</p>
        <div class="questions-empty-actions">
          <button type="button" class="question-primary-btn" onclick="window.showLoginModal ? window.showLoginModal('view following feed') : null">Log In</button>
          <button type="button" class="question-secondary-btn" onclick="window.switchTab('for-you')">Browse For You</button>
        </div>
      </section>
    `;
    return;
  }

  // Handle Bookmarks Tab when no saved questions exist
  if (!isHomepage() && currentTab === "bookmarks") {
    const savedIds = getSavedQuestionIds();
    if (!savedIds.length) {
      container.innerHTML = `
        <section class="questions-empty-state" aria-live="polite">
          <div class="questions-empty-icon" aria-hidden="true">🔖</div>
          <span class="questions-empty-eyebrow">Saved Questions</span>
          <h2>No Bookmarked Questions Yet</h2>
          <p>You haven’t saved any questions yet. Click the bookmark icon on any question to save it for reading later.</p>
          <div class="questions-empty-actions">
            <button type="button" class="question-primary-btn" onclick="window.switchTab('for-you')">Discover Questions</button>
          </div>
        </section>
      `;
      return;
    }
  }

  try {
    const categoryParam =
      currentCategory !== "all"
        ? `&category=${encodeURIComponent(currentCategory)}`
        : "";

    let url = "";

    if (isHomepage()) {
      url = `${window.API_BASE}/questions/latest?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}&status=answered&sort=answered`;
    } else if (currentTab === "bookmarks") {
      url = `${window.API_BASE}/questions/latest?limit=100&offset=0${categoryParam}`;
    } else if (currentTab === "following") {
      url = `${window.API_BASE}/questions/for-you?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}`;
    } else if (currentTab === "unanswered") {
      url = `${window.API_BASE}/questions/latest?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}&status=unanswered&sort=unanswered`;
    } else if (currentTab === "trending") {
      url = `${window.API_BASE}/questions/latest?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}&sort=popular`;
    } else if (currentTab === "latest") {
      url = `${window.API_BASE}/questions/latest?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}&sort=newest`;
    } else {
      // "for-you" default
      url = `${window.API_BASE}/questions/latest?limit=${PAGE_LIMIT}&offset=${currentOffset}${categoryParam}&sort=popular`;
    }

    const response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let apiQuestions = await response.json();
    let apiCount = apiQuestions.length;

    // Filter bookmarks locally if in bookmarks tab
    if (!isHomepage() && currentTab === "bookmarks") {
      const savedIds = getSavedQuestionIds();
      apiQuestions = apiQuestions.filter((q) => savedIds.includes(String(q.id)));
    }

    let questions = processQuestions(
      apiQuestions,
      currentTab === "trending" ? "popular" : currentTab === "unanswered" ? "unanswered" : currentSort
    );

    // Apply real-time search filtering if search query exists
    if (currentSearchQuery) {
      questions = questions.filter((q) => {
        const text = `${q.question || ""} ${q.description || ""} ${q.category || ""} ${q.tags || ""}`.toLowerCase();
        return text.includes(currentSearchQuery);
      });
    }

    // Safety net for homepage
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
            <h2>We couldn’t find questions for this filter.</h2>
            <p>Try widening your search, choosing a different category, or resetting filters to browse more community conversations.</p>
            <div class="questions-empty-actions">
              <button type="button" class="question-primary-btn questions-empty-reset">Reset Filters</button>
              <button type="button" class="question-secondary-btn" onclick="window.switchTab('for-you')">Browse All Questions</button>
            </div>
          </section>
        `;
      return;
    }

    // ======================================================
    // 6️⃣ RENDER CARDS
    // ======================================================
    let html = "";
    if (!isHomepage()) {
      html = questions.map((q) => buildAnswersPageCard(q)).join("");
    } else {
      // Preserved Homepage Card Rendering
      html = questions
        .map((q) => {
          const title = escapeHtml(q.question);
          const slug = escapeHtml(q.slug || q.id);
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
            (q.answers_count || 0) > 0 && firstAnswerUserId
              ? `
              <div class="question-first-answer" style="display:flex;align-items:center;gap:12px;margin:8px 0 12px 0;">
                ${
                  answererProfileLink
                    ? `
                  <a href="${answererProfileLink}" style="display:inline-flex;">
                    <img src="${firstAnswerAvatar}"
                         alt="${firstAnswerName}"
                         style="width:40px;height:40px;border-radius:50%;object-fit:cover;"
                         onerror="this.src='/images/default-avatar.png'">
                  </a>
                `
                    : `
                  <img src="${firstAnswerAvatar}"
                       alt="${firstAnswerName}"
                       style="width:40px;height:40px;border-radius:50%;object-fit:cover;"
                       onerror="this.src='/images/default-avatar.png'">
                `
                }
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
            ? q.top_answer_image_url.startsWith("http")
              ? q.top_answer_image_url
              : (window.ASSET_BASE || "") + q.top_answer_image_url
            : "";

          let answerPreview = "";
          if (q.answers_count > 0 && (q.top_answer_html || q.top_answer_text)) {
            const rawHtml =
              typeof q.top_answer_html === "string" ? q.top_answer_html.trim() : "";
            const rawText = String(q.top_answer_text || "").replace(/^\s*×\s*/g, "");
            const cleanPreviewMarkup = rawHtml
              ? normalizeStoredAnswerMarkup(rawHtml)
              : normalizeStoredAnswerMarkup(rawText);
            const answerMarkupHasImage = /<img[\s>]/i.test(cleanPreviewMarkup);

            answerPreview = `
            ${
              topAnswerImage && !answerMarkupHasImage
                ? `
              <div class="answer-preview-image">
                <img src="${topAnswerImage}" alt="Answer image">
              </div>
            `
                : ""
            }
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
            ${firstAnswerRow}
            <a href="/question/${slug}" class="question-title">${title}</a>
            ${answerPreview}
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
          </div>
        `;
        })
        .join("");
    }

    if (loadMore) {
      container.insertAdjacentHTML("beforeend", html);
    } else {
      container.innerHTML = html;
    }

    currentOffset += apiCount;

    // Load More button (only when relevant and more items exist)
    if (apiCount === PAGE_LIMIT && currentTab !== "bookmarks") {
      container.insertAdjacentHTML(
        "afterend",
        `
        <div id="loadMoreContainer" style="text-align:center;margin:24px 0 32px;">
          <button class="answer-btn" id="loadMoreBtn">
            Load More Questions
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
            <span class="questions-empty-eyebrow">Connection issue</span>
            <h2>We couldn’t load questions right now.</h2>
            <p>Please check your connection and retry. Your filters are preserved.</p>
            <div class="questions-empty-actions">
              <button type="button" class="question-primary-btn" onclick="window.loadQuestions()">Retry</button>
            </div>
          </section>
        `;
    }
  }
};

window.switchTab = function (tabName) {
  const tabBtn = document.querySelector(`.qa-tab[data-tab="${tabName}"]`);
  if (tabBtn) {
    tabBtn.click();
  } else {
    currentTab = tabName;
    document.querySelectorAll(".qa-tab").forEach((t) => {
      const match = t.dataset.tab === tabName;
      t.classList.toggle("active", match);
      t.setAttribute("aria-selected", match ? "true" : "false");
    });
    const url = new URL(window.location);
    url.searchParams.set("tab", tabName);
    window.history.replaceState({}, "", url);
    window.loadQuestions(false);
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
      try {
        applyAnswerActivityToHome(JSON.parse(e.newValue));
      } catch {}
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
// 8️⃣ FILTER & TABS INITIALIZATION
// ======================================================
function initQaFilters() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab");
  if (initialTab) {
    currentTab = initialTab;
    document.querySelectorAll(".qa-tab").forEach((t) => {
      const active = t.dataset.tab === initialTab;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  const initialCat = urlParams.get("category");
  if (initialCat) {
    currentCategory = initialCat;
    const catSelect = document.getElementById("categorySelect");
    if (catSelect) catSelect.value = initialCat;
    document.querySelectorAll(".topic-nav-link").forEach((link) => {
      link.classList.toggle("active", link.dataset.topic === initialCat);
    });
  }

  // Wire Tab Buttons
  document.querySelectorAll(".qa-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab;
      if (!tabName) return;
      document.querySelectorAll(".qa-tab").forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      currentTab = tabName;
      const url = new URL(window.location);
      url.searchParams.set("tab", tabName);
      window.history.replaceState({}, "", url);
      window.loadQuestions(false);
    });
  });

  // Wire Search Input
  let searchTimer = null;
  const searchInput = document.getElementById("questionSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentSearchQuery = e.target.value.trim().toLowerCase();
        window.loadQuestions(false);
      }, 250);
    });
  }

  // Wire Category Select
  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      currentCategory = e.target.value || "all";
      const url = new URL(window.location);
      if (currentCategory === "all") {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", currentCategory);
      }
      window.history.replaceState({}, "", url);

      // Sync Left Sidebar Topic links
      document.querySelectorAll(".topic-nav-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.topic === currentCategory);
      });

      window.loadQuestions(false);
    });
  }

  // Wire Left Sidebar Topic Links when on /questions
  document.addEventListener("click", (e) => {
    const topicLink = e.target.closest(".topic-nav-link");
    if (
      topicLink &&
      !isHomepage() &&
      (window.location.pathname.startsWith("/questions") ||
        document.body.classList.contains("answers-page"))
    ) {
      e.preventDefault();
      const topic = topicLink.dataset.topic || "all";
      currentCategory = topic;
      const catSelect = document.getElementById("categorySelect");
      if (catSelect) catSelect.value = topic;

      document.querySelectorAll(".topic-nav-link").forEach((link) => {
        link.classList.toggle("active", link.dataset.topic === topic);
      });

      const url = new URL(window.location);
      if (topic === "all") {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", topic);
      }
      window.history.replaceState({}, "", url);

      window.loadQuestions(false);
    }
  });
}

// ======================================================
// 9️⃣ INIT
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
  if (isHomepage()) {
    document.querySelector('#sortSelect option[value="unanswered"]')?.remove();
  } else {
    initQaFilters();
  }

  if (
    document.getElementById("questionsFeedContainer") ||
    document.getElementById("storiesContainer")
  ) {
    bindQuestionsPageActions();
    window.loadQuestions();
  }
});

