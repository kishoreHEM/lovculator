// right-sidebar.js - Loads right sidebar component and populates real data

async function loadRightSidebar() {
  const container = document.getElementById("global-right-sidebar-container");
  if (!container) return;

  try {
    const res = await fetch("/components/right-sidebar.html", { cache: "no-store" });
    if (!res.ok) return;

    container.innerHTML = await res.text();
    fetchTrendingQuestionsForSidebar();
    fetchTrendingStoriesForSidebar();
  } catch (err) {
    console.warn("Could not load right sidebar:", err);
  }
}

async function fetchTrendingQuestionsForSidebar() {
  const listEl = document.getElementById("rightSidebarQuestionsList");
  if (!listEl) return;

  try {
    const apiBase = window.API_BASE || (window.location.hostname.includes("localhost") ? "http://localhost:3001/api" : "https://lovculator.com/api");
    const res = await fetch(`${apiBase}/questions/latest?sort=popular&limit=5`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch trending questions");

    const questions = await res.json();
    if (!Array.isArray(questions) || questions.length === 0) {
      listEl.innerHTML = '<div class="widget-empty">No questions yet. Ask the first!</div>';
      return;
    }

    listEl.innerHTML = questions.slice(0, 5).map(q => {
      const title = escapeSidebarHTML(q.question || "Relationship question");
      const slug = encodeURIComponent(q.slug || q.id);
      const answersCount = Number(q.answers_count) || 0;
      const viewsCount = Number(q.views_count) || 0;

      return `
        <a href="/question/${slug}" class="widget-story-item">
          <div class="widget-story-title">${title}</div>
          <div class="widget-story-meta">
            <span class="widget-story-answers">💬 ${answersCount} answers</span>
            ${viewsCount > 0 ? `<span class="widget-story-views">· 👁️ ${viewsCount}</span>` : ""}
          </div>
        </a>
      `;
    }).join("");

  } catch (err) {
    listEl.innerHTML = `
      <a href="/questions" class="widget-story-item">
        <div class="widget-story-title">Explore relationship questions</div>
        <div class="widget-story-meta">Join community conversations &rarr;</div>
      </a>
    `;
  }
}

async function fetchTrendingStoriesForSidebar() {
  const listEl = document.getElementById("rightSidebarStoriesList");
  if (!listEl) return;

  try {
    const apiBase = window.API_BASE || (window.location.hostname.includes("localhost") ? "http://localhost:3001/api" : "https://lovculator.com/api");
    const res = await fetch(`${apiBase}/stories`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch stories");

    const stories = await res.json();
    if (!Array.isArray(stories) || stories.length === 0) {
      listEl.innerHTML = '<div class="widget-empty">No stories yet. Be the first!</div>';
      return;
    }

    const sorted = [...stories].sort((a, b) => (Number(b.likes_count) || 0) - (Number(a.likes_count) || 0)).slice(0, 4);

    listEl.innerHTML = sorted.map(s => {
      const title = escapeSidebarHTML(s.story_title || s.couple_names || "Love Story");
      const likes = Number(s.likes_count) || 0;
      const author = escapeSidebarHTML(s.author_display_name || s.couple_names || "Anonymous");
      return `
        <a href="/love-stories" class="widget-story-item">
          <div class="widget-story-title">${title}</div>
          <div class="widget-story-meta">
            <span class="widget-story-likes">❤️ ${likes}</span>
            <span class="widget-story-author">by ${author}</span>
          </div>
        </a>
      `;
    }).join("");

  } catch (err) {
    listEl.innerHTML = `
      <a href="/love-stories" class="widget-story-item">
        <div class="widget-story-title">Explore romantic stories</div>
        <div class="widget-story-meta">Read community submissions &rarr;</div>
      </a>
    `;
  }
}

function escapeSidebarHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", loadRightSidebar);
